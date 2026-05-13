import { NextResponse } from 'next/server';
import { z } from 'zod';
import { deleteDiagnosticTemplate, updateDiagnosticTemplate } from '@/lib/data/diagnostic-templates';
import type { DiagnosticTemplateInput } from '@/lib/diagnostic-template-types';

const selectionModeSchema = z.enum(['single', 'multiple']);
const questionTypeSchema = z.enum(['multiple-choice', 'nested-options', 'ranked-options']);
const visibilityMatchSchema = z.enum(['any', 'all']);

const visibilityRuleSchema = z
  .object({
    sourceQuestionId: z.string().max(120),
    optionIds: z.array(z.string().max(120)).min(1),
    match: visibilityMatchSchema.default('any'),
  })
  .nullable()
  .default(null);

const optionPresentationSchema = z.object({
  icon: z.string().max(120).nullable().default(null),
  badgeText: z.string().max(80).nullable().default(null),
  eyebrow: z.string().max(120).nullable().default(null),
  title: z.string().max(240).nullable().default(null),
  supportingText: z.string().max(700).nullable().default(null),
  exampleBullets: z.array(z.string().max(200)).max(8).default([]),
  panelTitle: z.string().max(240).nullable().default(null),
});

const childOptionSchema = z.object({
  id: z.string().max(120),
  label: z.string().max(240),
  description: z.string().max(320).nullable().default(null),
});

const childQuestionSchema = z.object({
  id: z.string().max(120),
  prompt: z.string().max(700),
  description: z.string().max(320).nullable().default(null),
  selectionMode: selectionModeSchema.default('single'),
  options: z.array(childOptionSchema),
});

const optionSchema = z.object({
  id: z.string().max(120),
  label: z.string().max(240),
  description: z.string().max(320).nullable().default(null),
  requestDetailNoteWhenSelected: z.boolean().optional().default(false),
  showWhen: visibilityRuleSchema,
  presentation: optionPresentationSchema.default({
    icon: null,
    badgeText: null,
    eyebrow: null,
    title: null,
    supportingText: null,
    exampleBullets: [],
    panelTitle: null,
  }),
  childQuestion: childQuestionSchema.nullable().default(null),
});

const questionSchema = z.object({
  id: z.string().max(120),
  prompt: z.string().max(700),
  description: z.string().max(320).nullable().default(null),
  showWhen: visibilityRuleSchema,
  type: questionTypeSchema.default('multiple-choice'),
  rankedOptionLimit: z.number().int().min(2).max(10).nullable().default(null),
  selectionMode: selectionModeSchema.default('single'),
  options: z.array(optionSchema),
});

const roundSchema = z.object({
  id: z.string().max(120),
  title: z.string().max(160),
  guidance: z.string().max(700).nullable(),
  showWhen: visibilityRuleSchema,
  questions: z.array(questionSchema),
});

const updateTemplateSchema = z.object({
  name: z.string().max(120),
  rounds: z.array(roundSchema),
});

type RouteContext = {
  params: Promise<{
    templateId: string;
  }>;
};

type VisibilityRulePayload = NonNullable<z.infer<typeof visibilityRuleSchema>>;

type UpdateTemplatePayload = z.infer<typeof updateTemplateSchema>;

type TemplateQuestionReference = {
  readonly optionIds: ReadonlySet<string>;
  readonly questionIndex: number;
  readonly roundIndex: number;
};

function buildQuestionReferenceLookup(payload: UpdateTemplatePayload): Map<string, TemplateQuestionReference> {
  return new Map(
    payload.rounds.flatMap((round, roundIndex) =>
      round.questions.map((question, questionIndex) => [
        question.id,
        {
          roundIndex,
          questionIndex,
          optionIds: new Set(question.options.map((option) => option.id)),
        },
      ] as const),
    ),
  );
}

function validateVisibilityRule(params: {
  readonly availableQuestions: Map<string, TemplateQuestionReference>;
  readonly locationLabel: string;
  readonly rule: VisibilityRulePayload | null;
  readonly targetQuestionIndex?: number;
  readonly targetRoundIndex: number;
}): string | null {
  if (params.rule === null) {
    return null;
  }
  const sourceQuestion = params.availableQuestions.get(params.rule.sourceQuestionId);
  if (sourceQuestion === undefined) {
    return `${params.locationLabel} references a question that does not exist.`;
  }
  const isEarlierQuestion =
    params.targetQuestionIndex === undefined
      ? sourceQuestion.roundIndex < params.targetRoundIndex
      : sourceQuestion.roundIndex < params.targetRoundIndex ||
        (sourceQuestion.roundIndex === params.targetRoundIndex &&
          sourceQuestion.questionIndex < params.targetQuestionIndex);
  if (!isEarlierQuestion) {
    return `${params.locationLabel} must depend on an earlier question.`;
  }
  const hasUnknownOption = params.rule.optionIds.some((optionId) => !sourceQuestion.optionIds.has(optionId));
  if (hasUnknownOption) {
    return `${params.locationLabel} references an option that does not exist on the selected source question.`;
  }
  return null;
}

function validateTemplateVisibilityRules(payload: UpdateTemplatePayload): string | null {
  const availableQuestions = buildQuestionReferenceLookup(payload);
  for (const [roundIndex, round] of payload.rounds.entries()) {
    const roundRuleError = validateVisibilityRule({
      availableQuestions,
      locationLabel: `Round ${roundIndex + 1}`,
      rule: round.showWhen,
      targetRoundIndex: roundIndex,
    });
    if (roundRuleError !== null) {
      return roundRuleError;
    }
    for (const [questionIndex, question] of round.questions.entries()) {
      const questionRuleError = validateVisibilityRule({
        availableQuestions,
        locationLabel: `Round ${roundIndex + 1} question ${questionIndex + 1}`,
        rule: question.showWhen,
        targetRoundIndex: roundIndex,
        targetQuestionIndex: questionIndex,
      });
      if (questionRuleError !== null) {
        return questionRuleError;
      }
      for (const [optionIndex, option] of question.options.entries()) {
        if (option.showWhen === null) {
          continue;
        }
        if (option.showWhen.sourceQuestionId === question.id) {
          const availableSiblingOptionIds = new Set(
            question.options.slice(0, optionIndex).map((candidateOption) => candidateOption.id),
          );
          if (option.showWhen.optionIds.some((optionId) => !availableSiblingOptionIds.has(optionId))) {
            return `Round ${roundIndex + 1} question ${questionIndex + 1} option ${optionIndex + 1} must depend only on earlier options in the same question.`;
          }
          continue;
        }
        const optionRuleError = validateVisibilityRule({
          availableQuestions,
          locationLabel: `Round ${roundIndex + 1} question ${questionIndex + 1} option ${optionIndex + 1}`,
          rule: option.showWhen,
          targetRoundIndex: roundIndex,
          targetQuestionIndex: questionIndex,
        });
        if (optionRuleError !== null) {
          return optionRuleError;
        }
      }
    }
  }
  return null;
}

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const parsed = updateTemplateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const visibilityValidationError = validateTemplateVisibilityRules(parsed.data);
  if (visibilityValidationError !== null) {
    return NextResponse.json({ error: 'Validation failed', details: visibilityValidationError }, { status: 400 });
  }
  const input: DiagnosticTemplateInput = {
    name: parsed.data.name,
    rounds: parsed.data.rounds.map((round) => ({
      id: round.id,
      title: round.title,
      guidance: round.guidance,
      showWhen: round.showWhen,
      questions: round.questions.map((question) => ({
        id: question.id,
        prompt: question.prompt,
        description: question.description ?? null,
        showWhen: question.showWhen,
        type: question.type,
        rankedOptionLimit: question.rankedOptionLimit,
        selectionMode: question.selectionMode,
        options: question.options.map((option) => ({
          id: option.id,
          label: option.label,
          description: option.description ?? null,
          requestDetailNoteWhenSelected: option.requestDetailNoteWhenSelected,
          showWhen: option.showWhen,
          presentation: {
            icon: option.presentation.icon,
            badgeText: option.presentation.badgeText,
            eyebrow: option.presentation.eyebrow,
            title: option.presentation.title,
            supportingText: option.presentation.supportingText,
            exampleBullets: option.presentation.exampleBullets,
            panelTitle: option.presentation.panelTitle,
          },
          childQuestion:
            option.childQuestion === null
              ? null
              : {
                  id: option.childQuestion.id,
                  prompt: option.childQuestion.prompt,
                  description: option.childQuestion.description ?? null,
                  selectionMode: option.childQuestion.selectionMode,
                  options: option.childQuestion.options.map((childOption) => ({
                    id: childOption.id,
                    label: childOption.label,
                    description: childOption.description ?? null,
                  })),
                },
        })),
      })),
    })),
  };
  const { templateId } = await context.params;
  try {
    const template = await updateDiagnosticTemplate(templateId, input);
    return NextResponse.json({ template });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message === 'Diagnostic template not found.' || message === 'Invalid diagnostic template id.' ? 404 : 500;
    return NextResponse.json({ error: 'Failed to update diagnostic template.', details: message }, { status });
  }
}

export async function DELETE(_request: Request, context: RouteContext): Promise<NextResponse> {
  const { templateId } = await context.params;
  try {
    await deleteDiagnosticTemplate(templateId);
    return NextResponse.json({ deleted: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status =
      message === 'Diagnostic template not found.' || message === 'Invalid diagnostic template id.'
        ? 404
        : message === 'Activate a different template before deleting this one.'
          ? 409
          : 500;
    return NextResponse.json({ error: 'Failed to delete diagnostic template.', details: message }, { status });
  }
}
