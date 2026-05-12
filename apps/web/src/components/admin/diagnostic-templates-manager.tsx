'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, CheckCircle2, GripVertical, Plus, Save, Trash2 } from 'lucide-react';
import { type CSSProperties, type ReactNode, useEffect, useMemo, useState, type ReactElement } from 'react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { DiagnosticTemplateValue } from '@/lib/diagnostic-template-types';
import { buildApiUrl } from '@/lib/config/build-api-url';
import { cn } from '@/lib/utils';

type DiagnosticTemplatesManagerProps = {
  readonly initialTemplates: readonly DiagnosticTemplateValue[];
};

type DiagnosticTemplateQuestionValue = DiagnosticTemplateValue['rounds'][number]['questions'][number];

type DiagnosticTemplateOptionValue = DiagnosticTemplateQuestionValue['options'][number];

type TemplateApiResponse = {
  readonly template?: DiagnosticTemplateValue;
  readonly error?: string;
  readonly details?: string;
};

const DIAGNOSTIC_TEMPLATES_API_URL = buildApiUrl('/api/admin/diagnostic-templates');

function createDraftRound(roundIndex: number): DiagnosticTemplateValue['rounds'][number] {
  return {
    id: crypto.randomUUID(),
    title: `Round ${roundIndex + 1}`,
    guidance: '',
    order: roundIndex,
    questions: [],
  };
}

function createDraftQuestion(questionIndex: number): DiagnosticTemplateValue['rounds'][number]['questions'][number] {
  return {
    id: crypto.randomUUID(),
    prompt: '',
    description: null,
    order: questionIndex,
    options: [
      createDraftOption(0),
      createDraftOption(1),
    ],
  };
}

function createDraftOption(
  optionIndex: number,
): DiagnosticTemplateValue['rounds'][number]['questions'][number]['options'][number] {
  return {
    id: crypto.randomUUID(),
    label: '',
    description: null,
    order: optionIndex,
  };
}

function moveArrayItem<T>(items: readonly T[], fromIndex: number, toIndex: number): readonly T[] {
  if (toIndex < 0 || toIndex >= items.length) {
    return items;
  }
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  if (item === undefined) {
    return items;
  }
  next.splice(toIndex, 0, item);
  return next;
}

function countTemplateQuestions(template: DiagnosticTemplateValue): number {
  return template.rounds.reduce((total, round) => total + round.questions.length, 0);
}

function reorderOptionsById(params: {
  readonly options: readonly DiagnosticTemplateOptionValue[];
  readonly activeId: UniqueIdentifier;
  readonly overId: UniqueIdentifier;
}): readonly DiagnosticTemplateOptionValue[] {
  const activeOptionId = String(params.activeId);
  const overOptionId = String(params.overId);
  const activeOptionIndex = params.options.findIndex((option) => option.id === activeOptionId);
  const overOptionIndex = params.options.findIndex((option) => option.id === overOptionId);
  if (activeOptionIndex < 0 || overOptionIndex < 0 || activeOptionIndex === overOptionIndex) {
    return params.options;
  }
  return arrayMove([...params.options], activeOptionIndex, overOptionIndex);
}

function reindexTemplate(template: DiagnosticTemplateValue): DiagnosticTemplateValue {
  return {
    ...template,
    rounds: template.rounds.map((round, roundIndex) => ({
      ...round,
      order: roundIndex,
      title: round.title.trim().length > 0 ? round.title : `Round ${roundIndex + 1}`,
      questions: round.questions.map((question, questionIndex) => ({
        ...question,
        order: questionIndex,
        options: question.options.map((option, optionIndex) => ({
          ...option,
          order: optionIndex,
        })),
      })),
    })),
  };
}

function buildTemplatePatchBody(template: DiagnosticTemplateValue): string {
  return JSON.stringify({
    name: template.name,
    rounds: template.rounds.map((round) => ({
      id: round.id,
      title: round.title,
      guidance: round.guidance,
      questions: round.questions.map((question) => ({
        id: question.id,
        prompt: question.prompt,
        description: question.description,
        options: question.options.map((option) => ({
          id: option.id,
          label: option.label,
          description: option.description,
        })),
      })),
    })),
  });
}

type SortableOptionRowProps = {
  readonly option: DiagnosticTemplateOptionValue;
  readonly optionIndex: number;
  readonly optionsCount: number;
  readonly onChangeLabel: (nextLabel: string) => void;
  readonly onChangeDescription: (nextDescription: string) => void;
  readonly onMoveUp: () => void;
  readonly onMoveDown: () => void;
  readonly onRemove: () => void;
};

type OptionRowContentProps = {
  readonly dragHandle: ReactNode;
  readonly isDragging: boolean;
  readonly onChangeLabel: (nextLabel: string) => void;
  readonly onChangeDescription: (nextDescription: string) => void;
  readonly onRemove: () => void;
  readonly option: DiagnosticTemplateOptionValue;
  readonly optionIndex: number;
};

function OptionRowContent(props: OptionRowContentProps): ReactElement {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-border bg-background px-3 py-3',
        props.isDragging && 'border-primary/40 bg-primary/5 shadow-sm',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          {props.dragHandle}
          <span className="text-xs font-medium">Option {props.optionIndex + 1}</span>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={props.onRemove}>
          Remove
        </Button>
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Label</p>
          <Input
            value={props.option.label}
            onChange={(event) => props.onChangeLabel(event.target.value)}
            placeholder="Short tap label"
          />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Subtext</p>
          <Textarea
            value={props.option.description ?? ''}
            onChange={(event) => props.onChangeDescription(event.target.value)}
            placeholder="Optional supporting text shown below the option label"
            rows={2}
            className="min-h-20"
          />
        </div>
      </div>
    </div>
  );
}

function SortableOptionRow(props: SortableOptionRowProps): ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.option.id,
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <OptionRowContent
        dragHandle={
          <button
            type="button"
            aria-label={`Drag option ${props.optionIndex + 1}`}
            className="flex size-8 touch-none cursor-grab items-center justify-center rounded-md border border-transparent transition-colors hover:border-border hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" aria-hidden />
          </button>
        }
        isDragging={isDragging}
        option={props.option}
        optionIndex={props.optionIndex}
        onChangeLabel={props.onChangeLabel}
        onChangeDescription={props.onChangeDescription}
        onRemove={props.onRemove}
      />
    </div>
  );
}

function StaticOptionRow(props: SortableOptionRowProps): ReactElement {
  return (
    <OptionRowContent
      dragHandle={
        <span
          aria-hidden="true"
          className="flex size-8 items-center justify-center rounded-md border border-transparent text-muted-foreground"
        >
          <GripVertical className="size-4" aria-hidden />
        </span>
      }
      isDragging={false}
      option={props.option}
      optionIndex={props.optionIndex}
      onChangeLabel={props.onChangeLabel}
      onChangeDescription={props.onChangeDescription}
      onRemove={props.onRemove}
    />
  );
}

export function DiagnosticTemplatesManager(props: DiagnosticTemplatesManagerProps): ReactElement {
  const [templates, setTemplates] = useState<readonly DiagnosticTemplateValue[]>(props.initialTemplates);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(props.initialTemplates[0]?.id ?? null);
  const [dirtyTemplateIds, setDirtyTemplateIds] = useState<readonly string[]>([]);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [activatingTemplateId, setActivatingTemplateId] = useState<string | null>(null);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasMounted, setHasMounted] = useState<boolean>(false);
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates],
  );
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const hasDirtySelectedTemplate =
    selectedTemplate !== null && dirtyTemplateIds.includes(selectedTemplate.id);

  useEffect((): void => {
    setHasMounted(true);
  }, []);

  function replaceTemplateInState(nextTemplate: DiagnosticTemplateValue): void {
    setTemplates((previous) =>
      previous.map((template) => (template.id === nextTemplate.id ? reindexTemplate(nextTemplate) : template)),
    );
  }

  function markTemplateDirty(templateId: string): void {
    setDirtyTemplateIds((previous) => (previous.includes(templateId) ? previous : [...previous, templateId]));
  }

  function clearDirtyTemplate(templateId: string): void {
    setDirtyTemplateIds((previous) => previous.filter((id) => id !== templateId));
  }

  function updateSelectedTemplate(
    updater: (template: DiagnosticTemplateValue) => DiagnosticTemplateValue,
  ): void {
    if (selectedTemplate === null) {
      return;
    }
    const nextTemplate = reindexTemplate(updater(selectedTemplate));
    replaceTemplateInState(nextTemplate);
    markTemplateDirty(nextTemplate.id);
    setStatusMessage(null);
    setErrorMessage(null);
  }

  function executeOptionDragEnd(params: {
    readonly roundId: string;
    readonly questionId: string;
    readonly event: DragEndEvent;
  }): void {
    const { active, over } = params.event;
    if (over === null || active.id === over.id) {
      return;
    }
    updateSelectedTemplate((template) => ({
      ...template,
      rounds: template.rounds.map((candidateRound) =>
        candidateRound.id === params.roundId
          ? {
              ...candidateRound,
              questions: candidateRound.questions.map((candidateQuestion) =>
                candidateQuestion.id === params.questionId
                  ? {
                      ...candidateQuestion,
                      options: reorderOptionsById({
                        options: candidateQuestion.options,
                        activeId: active.id,
                        overId: over.id,
                      }),
                    }
                  : candidateQuestion,
              ),
            }
          : candidateRound,
      ),
    }));
  }

  async function executeCreateTemplate(): Promise<void> {
    setIsCreating(true);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const response = await fetch(DIAGNOSTIC_TEMPLATES_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = (await response.json()) as TemplateApiResponse;
      if (!response.ok || data.template === undefined) {
        throw new Error(data.details ?? data.error ?? 'Failed to create diagnostic template.');
      }
      setTemplates((previous) => [data.template!, ...previous]);
      setSelectedTemplateId(data.template.id);
      setStatusMessage('New template created.');
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create diagnostic template.');
    } finally {
      setIsCreating(false);
    }
  }

  async function executeSaveSelectedTemplate(): Promise<void> {
    if (selectedTemplate === null) {
      return;
    }
    setIsSaving(true);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const response = await fetch(`${DIAGNOSTIC_TEMPLATES_API_URL}/${selectedTemplate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: buildTemplatePatchBody(selectedTemplate),
      });
      const data = (await response.json()) as TemplateApiResponse;
      if (!response.ok || data.template === undefined) {
        throw new Error(data.details ?? data.error ?? 'Failed to save diagnostic template.');
      }
      replaceTemplateInState(data.template);
      clearDirtyTemplate(data.template.id);
      setStatusMessage('Template saved.');
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save diagnostic template.');
    } finally {
      setIsSaving(false);
    }
  }

  async function executeActivateTemplate(templateId: string): Promise<void> {
    setActivatingTemplateId(templateId);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const response = await fetch(`${DIAGNOSTIC_TEMPLATES_API_URL}/${templateId}/activate`, {
        method: 'POST',
      });
      const data = (await response.json()) as TemplateApiResponse;
      if (!response.ok || data.template === undefined) {
        throw new Error(data.details ?? data.error ?? 'Failed to activate diagnostic template.');
      }
      setTemplates((previous) =>
        previous.map((template) =>
          template.id === data.template!.id
            ? data.template!
            : {
                ...template,
                isActive: false,
              },
        ),
      );
      setStatusMessage(`"${data.template.name}" is now active for customer-facing diagnostics.`);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to activate diagnostic template.');
    } finally {
      setActivatingTemplateId(null);
    }
  }

  async function executeDeleteSelectedTemplate(): Promise<void> {
    if (selectedTemplate === null) {
      return;
    }
    const confirmed = window.confirm(`Delete "${selectedTemplate.name}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }
    setDeletingTemplateId(selectedTemplate.id);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const response = await fetch(`${DIAGNOSTIC_TEMPLATES_API_URL}/${selectedTemplate.id}`, {
        method: 'DELETE',
      });
      const data = (await response.json()) as { readonly error?: string; readonly details?: string };
      if (!response.ok) {
        throw new Error(data.details ?? data.error ?? 'Failed to delete diagnostic template.');
      }
      setTemplates((previous) => previous.filter((template) => template.id !== selectedTemplate.id));
      setDirtyTemplateIds((previous) => previous.filter((id) => id !== selectedTemplate.id));
      setSelectedTemplateId((previous) => {
        if (previous !== selectedTemplate.id) {
          return previous;
        }
        const remaining = templates.filter((template) => template.id !== selectedTemplate.id);
        return remaining[0]?.id ?? null;
      });
      setStatusMessage('Template deleted.');
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to delete diagnostic template.');
    } finally {
      setDeletingTemplateId(null);
    }
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow="Customer diagnostic"
        title="Diagnostic templates"
        description="Build the structured question flow customers will see when AI Diagnostic is off. Keep one template active at a time."
        actions={
          <Button type="button" onClick={() => void executeCreateTemplate()} disabled={isCreating}>
            <Plus className="size-4" aria-hidden />
            {isCreating ? 'Creating…' : 'Create template'}
          </Button>
        }
      />
      {errorMessage !== null ? (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{errorMessage}</p>
        </div>
      ) : null}
      {statusMessage !== null ? (
        <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <p>{statusMessage}</p>
        </div>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <section className="rounded-3xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between gap-3 border-b border-border px-2 pb-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Templates</h2>
              <p className="text-sm text-muted-foreground">Select one to edit or activate.</p>
            </div>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {templates.length}
            </span>
          </div>
          <div className="mt-4 space-y-2">
            {templates.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
                Create your first template to start managing rounds, questions, and options.
              </div>
            ) : null}
            {templates.map((template) => {
              const active = template.id === selectedTemplateId;
              const isDirty = dirtyTemplateIds.includes(template.id);
              const questionCount = countTemplateQuestions(template);
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setSelectedTemplateId(template.id)}
                  className={cn(
                    'w-full rounded-2xl border px-4 py-3 text-left transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                    active ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-primary/20 hover:bg-muted/40',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">{template.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {template.rounds.length} rounds · {questionCount} questions
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      {template.isActive ? (
                        <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
                          Active
                        </span>
                      ) : null}
                      {isDirty ? (
                        <span className="rounded-full border border-warning/35 bg-warning-soft px-2 py-1 text-[11px] font-semibold text-warning-foreground dark:bg-warning/15 dark:text-warning">
                          Unsaved
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
        <section className="rounded-3xl border border-border bg-card p-6 shadow-xs">
          {selectedTemplate === null ? (
            <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 px-6 text-center text-sm text-muted-foreground">
              Select a template or create a new one.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="border-b border-border pb-6">
                <div className="min-w-0 flex-1 space-y-2">
                  <label htmlFor="diagnostic-template-name" className="text-sm font-medium text-foreground">
                    Template name
                  </label>
                  <Input
                    id="diagnostic-template-name"
                    value={selectedTemplate.name}
                    onChange={(event) =>
                      updateSelectedTemplate((template) => ({
                        ...template,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Example: SMB intake template"
                  />
                  <p className="text-xs text-muted-foreground">
                    The active template is what customer-facing quiz flows will use whenever AI Diagnostic is off.
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                {selectedTemplate.rounds.map((round, roundIndex) => (
                  <article key={round.id} className="rounded-2xl border border-border bg-background p-4 shadow-xs">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">Round {roundIndex + 1}</p>
                        <p className="text-xs text-muted-foreground">
                          Customers see each round in sequence when template mode is active.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateSelectedTemplate((template) => ({
                              ...template,
                              rounds: moveArrayItem(template.rounds, roundIndex, roundIndex - 1),
                            }))
                          }
                          disabled={roundIndex === 0}
                        >
                          Move up
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateSelectedTemplate((template) => ({
                              ...template,
                              rounds: moveArrayItem(template.rounds, roundIndex, roundIndex + 1),
                            }))
                          }
                          disabled={roundIndex >= selectedTemplate.rounds.length - 1}
                        >
                          Move down
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateSelectedTemplate((template) => ({
                              ...template,
                              rounds: template.rounds.filter((candidate) => candidate.id !== round.id),
                            }))
                          }
                        >
                          Remove round
                        </Button>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                      <div className="space-y-2">
                        <label htmlFor={`round-title-${round.id}`} className="text-sm font-medium text-foreground">
                          Round title
                        </label>
                        <Input
                          id={`round-title-${round.id}`}
                          value={round.title}
                          onChange={(event) =>
                            updateSelectedTemplate((template) => ({
                              ...template,
                              rounds: template.rounds.map((candidate) =>
                                candidate.id === round.id
                                  ? {
                                      ...candidate,
                                      title: event.target.value,
                                    }
                                  : candidate,
                              ),
                            }))
                          }
                          placeholder="Example: Environment and symptoms"
                        />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor={`round-guidance-${round.id}`} className="text-sm font-medium text-foreground">
                          Round subtext
                        </label>
                        <Textarea
                          id={`round-guidance-${round.id}`}
                          rows={3}
                          value={round.guidance ?? ''}
                          onChange={(event) =>
                            updateSelectedTemplate((template) => ({
                              ...template,
                              rounds: template.rounds.map((candidate) =>
                                candidate.id === round.id
                                  ? {
                                      ...candidate,
                                      guidance: event.target.value,
                                    }
                                  : candidate,
                              ),
                            }))
                          }
                          placeholder="Optional supporting text shown before the first question in this round."
                        />
                      </div>
                    </div>
                    <div className="mt-6 space-y-3">
                      {round.questions.map((question, questionIndex) => (
                        <div key={question.id} className="rounded-2xl border border-border bg-card p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-foreground">
                                Question {questionIndex + 1}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Keep options short so customers can tap quickly on mobile.
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  updateSelectedTemplate((template) => ({
                                    ...template,
                                    rounds: template.rounds.map((candidate) =>
                                      candidate.id === round.id
                                        ? {
                                            ...candidate,
                                            questions: moveArrayItem(
                                              candidate.questions,
                                              questionIndex,
                                              questionIndex - 1,
                                            ),
                                          }
                                        : candidate,
                                    ),
                                  }))
                                }
                                disabled={questionIndex === 0}
                              >
                                Move up
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  updateSelectedTemplate((template) => ({
                                    ...template,
                                    rounds: template.rounds.map((candidate) =>
                                      candidate.id === round.id
                                        ? {
                                            ...candidate,
                                            questions: moveArrayItem(
                                              candidate.questions,
                                              questionIndex,
                                              questionIndex + 1,
                                            ),
                                          }
                                        : candidate,
                                    ),
                                  }))
                                }
                                disabled={questionIndex >= round.questions.length - 1}
                              >
                                Move down
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  updateSelectedTemplate((template) => ({
                                    ...template,
                                    rounds: template.rounds.map((candidate) =>
                                      candidate.id === round.id
                                        ? {
                                            ...candidate,
                                            questions: candidate.questions.filter(
                                              (candidateQuestion) => candidateQuestion.id !== question.id,
                                            ),
                                          }
                                        : candidate,
                                    ),
                                  }))
                                }
                              >
                                Remove question
                              </Button>
                            </div>
                          </div>
                          <div className="mt-4 space-y-2">
                            <label htmlFor={`question-prompt-${question.id}`} className="text-sm font-medium text-foreground">
                              Prompt
                            </label>
                            <Input
                              id={`question-prompt-${question.id}`}
                              value={question.prompt}
                              onChange={(event) =>
                                updateSelectedTemplate((template) => ({
                                  ...template,
                                  rounds: template.rounds.map((candidateRound) =>
                                    candidateRound.id === round.id
                                      ? {
                                          ...candidateRound,
                                          questions: candidateRound.questions.map((candidateQuestion) =>
                                            candidateQuestion.id === question.id
                                              ? {
                                                  ...candidateQuestion,
                                                  prompt: event.target.value,
                                                }
                                              : candidateQuestion,
                                          ),
                                        }
                                      : candidateRound,
                                  ),
                                }))
                              }
                              placeholder="Example: Which part of the system is hurting most?"
                            />
                          </div>
                          <div className="mt-4 space-y-2">
                            <label htmlFor={`question-description-${question.id}`} className="text-sm font-medium text-foreground">
                              Question subtext
                            </label>
                            <Textarea
                              id={`question-description-${question.id}`}
                              rows={2}
                              value={question.description ?? ''}
                              onChange={(event) =>
                                updateSelectedTemplate((template) => ({
                                  ...template,
                                  rounds: template.rounds.map((candidateRound) =>
                                    candidateRound.id === round.id
                                      ? {
                                          ...candidateRound,
                                          questions: candidateRound.questions.map((candidateQuestion) =>
                                            candidateQuestion.id === question.id
                                              ? {
                                                  ...candidateQuestion,
                                                  description: event.target.value,
                                                }
                                              : candidateQuestion,
                                          ),
                                        }
                                      : candidateRound,
                                  ),
                                }))
                              }
                              placeholder="Optional supporting text shown below the question prompt."
                            />
                          </div>
                          <div className="mt-4 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium text-foreground">Options</p>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  updateSelectedTemplate((template) => ({
                                    ...template,
                                    rounds: template.rounds.map((candidateRound) =>
                                      candidateRound.id === round.id
                                        ? {
                                            ...candidateRound,
                                            questions: candidateRound.questions.map((candidateQuestion) =>
                                              candidateQuestion.id === question.id
                                                ? {
                                                    ...candidateQuestion,
                                                    options: [
                                                      ...candidateQuestion.options,
                                                      createDraftOption(candidateQuestion.options.length),
                                                    ],
                                                  }
                                                : candidateQuestion,
                                            ),
                                          }
                                        : candidateRound,
                                    ),
                                  }))
                                }
                              >
                                <Plus className="size-4" aria-hidden />
                                Add option
                              </Button>
                            </div>
                            <div className="space-y-2">
                              {hasMounted ? (
                                <DndContext
                                  sensors={sensors}
                                  collisionDetection={closestCenter}
                                  onDragEnd={(event) =>
                                    executeOptionDragEnd({
                                      roundId: round.id,
                                      questionId: question.id,
                                      event,
                                    })
                                  }
                                >
                                  <SortableContext
                                    items={question.options.map((option) => option.id)}
                                    strategy={verticalListSortingStrategy}
                                  >
                                    {question.options.map((option, optionIndex) => (
                                      <SortableOptionRow
                                        key={option.id}
                                        option={option}
                                        optionIndex={optionIndex}
                                        optionsCount={question.options.length}
                                        onChangeLabel={(nextLabel) =>
                                          updateSelectedTemplate((template) => ({
                                            ...template,
                                            rounds: template.rounds.map((candidateRound) =>
                                              candidateRound.id === round.id
                                                ? {
                                                    ...candidateRound,
                                                    questions: candidateRound.questions.map((candidateQuestion) =>
                                                      candidateQuestion.id === question.id
                                                        ? {
                                                            ...candidateQuestion,
                                                            options: candidateQuestion.options.map((candidateOption) =>
                                                              candidateOption.id === option.id
                                                                ? {
                                                                    ...candidateOption,
                                                                    label: nextLabel,
                                                                  }
                                                                : candidateOption,
                                                            ),
                                                          }
                                                        : candidateQuestion,
                                                    ),
                                                  }
                                                : candidateRound,
                                            ),
                                          }))
                                        }
                                        onChangeDescription={(nextDescription) =>
                                          updateSelectedTemplate((template) => ({
                                            ...template,
                                            rounds: template.rounds.map((candidateRound) =>
                                              candidateRound.id === round.id
                                                ? {
                                                    ...candidateRound,
                                                    questions: candidateRound.questions.map((candidateQuestion) =>
                                                      candidateQuestion.id === question.id
                                                        ? {
                                                            ...candidateQuestion,
                                                            options: candidateQuestion.options.map((candidateOption) =>
                                                              candidateOption.id === option.id
                                                                ? {
                                                                    ...candidateOption,
                                                                    description: nextDescription,
                                                                  }
                                                                : candidateOption,
                                                            ),
                                                          }
                                                        : candidateQuestion,
                                                    ),
                                                  }
                                                : candidateRound,
                                            ),
                                          }))
                                        }
                                        onMoveUp={() =>
                                          updateSelectedTemplate((template) => ({
                                            ...template,
                                            rounds: template.rounds.map((candidateRound) =>
                                              candidateRound.id === round.id
                                                ? {
                                                    ...candidateRound,
                                                    questions: candidateRound.questions.map((candidateQuestion) =>
                                                      candidateQuestion.id === question.id
                                                        ? {
                                                            ...candidateQuestion,
                                                            options: moveArrayItem(
                                                              candidateQuestion.options,
                                                              optionIndex,
                                                              optionIndex - 1,
                                                            ),
                                                          }
                                                        : candidateQuestion,
                                                    ),
                                                  }
                                                : candidateRound,
                                            ),
                                          }))
                                        }
                                        onMoveDown={() =>
                                          updateSelectedTemplate((template) => ({
                                            ...template,
                                            rounds: template.rounds.map((candidateRound) =>
                                              candidateRound.id === round.id
                                                ? {
                                                    ...candidateRound,
                                                    questions: candidateRound.questions.map((candidateQuestion) =>
                                                      candidateQuestion.id === question.id
                                                        ? {
                                                            ...candidateQuestion,
                                                            options: moveArrayItem(
                                                              candidateQuestion.options,
                                                              optionIndex,
                                                              optionIndex + 1,
                                                            ),
                                                          }
                                                        : candidateQuestion,
                                                    ),
                                                  }
                                                : candidateRound,
                                            ),
                                          }))
                                        }
                                        onRemove={() =>
                                          updateSelectedTemplate((template) => ({
                                            ...template,
                                            rounds: template.rounds.map((candidateRound) =>
                                              candidateRound.id === round.id
                                                ? {
                                                    ...candidateRound,
                                                    questions: candidateRound.questions.map((candidateQuestion) =>
                                                      candidateQuestion.id === question.id
                                                        ? {
                                                            ...candidateQuestion,
                                                            options: candidateQuestion.options.filter(
                                                              (candidateOption) => candidateOption.id !== option.id,
                                                            ),
                                                          }
                                                        : candidateQuestion,
                                                    ),
                                                  }
                                                : candidateRound,
                                            ),
                                          }))
                                        }
                                      />
                                    ))}
                                  </SortableContext>
                                </DndContext>
                              ) : (
                                <>
                                  {question.options.map((option, optionIndex) => (
                                    <StaticOptionRow
                                      key={option.id}
                                      option={option}
                                      optionIndex={optionIndex}
                                      optionsCount={question.options.length}
                                      onChangeLabel={(nextLabel) =>
                                        updateSelectedTemplate((template) => ({
                                          ...template,
                                          rounds: template.rounds.map((candidateRound) =>
                                            candidateRound.id === round.id
                                              ? {
                                                  ...candidateRound,
                                                  questions: candidateRound.questions.map((candidateQuestion) =>
                                                    candidateQuestion.id === question.id
                                                      ? {
                                                          ...candidateQuestion,
                                                          options: candidateQuestion.options.map((candidateOption) =>
                                                            candidateOption.id === option.id
                                                              ? {
                                                                  ...candidateOption,
                                                                  label: nextLabel,
                                                                }
                                                              : candidateOption,
                                                          ),
                                                        }
                                                      : candidateQuestion,
                                                  ),
                                                }
                                              : candidateRound,
                                          ),
                                        }))
                                      }
                                      onChangeDescription={(nextDescription) =>
                                        updateSelectedTemplate((template) => ({
                                          ...template,
                                          rounds: template.rounds.map((candidateRound) =>
                                            candidateRound.id === round.id
                                              ? {
                                                  ...candidateRound,
                                                  questions: candidateRound.questions.map((candidateQuestion) =>
                                                    candidateQuestion.id === question.id
                                                      ? {
                                                          ...candidateQuestion,
                                                          options: candidateQuestion.options.map((candidateOption) =>
                                                            candidateOption.id === option.id
                                                              ? {
                                                                  ...candidateOption,
                                                                  description: nextDescription,
                                                                }
                                                              : candidateOption,
                                                          ),
                                                        }
                                                      : candidateQuestion,
                                                  ),
                                                }
                                              : candidateRound,
                                          ),
                                        }))
                                      }
                                      onMoveUp={() => undefined}
                                      onMoveDown={() => undefined}
                                      onRemove={() =>
                                        updateSelectedTemplate((template) => ({
                                          ...template,
                                          rounds: template.rounds.map((candidateRound) =>
                                            candidateRound.id === round.id
                                              ? {
                                                  ...candidateRound,
                                                  questions: candidateRound.questions.map((candidateQuestion) =>
                                                    candidateQuestion.id === question.id
                                                      ? {
                                                          ...candidateQuestion,
                                                          options: candidateQuestion.options.filter(
                                                            (candidateOption) => candidateOption.id !== option.id,
                                                          ),
                                                        }
                                                      : candidateQuestion,
                                                  ),
                                                }
                                              : candidateRound,
                                          ),
                                        }))
                                      }
                                    />
                                  ))}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateSelectedTemplate((template) => ({
                            ...template,
                            rounds: template.rounds.map((candidate) =>
                              candidate.id === round.id
                                ? {
                                    ...candidate,
                                    questions: [...candidate.questions, createDraftQuestion(candidate.questions.length)],
                                  }
                                : candidate,
                            ),
                          }))
                        }
                      >
                        <Plus className="size-4" aria-hidden />
                        Add question
                      </Button>
                    </div>
                  </article>
                ))}
                <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      updateSelectedTemplate((template) => ({
                        ...template,
                        rounds: [...template.rounds, createDraftRound(template.rounds.length)],
                      }))
                    }
                  >
                    <Plus className="size-4" aria-hidden />
                    Add round
                  </Button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
      {selectedTemplate !== null ? (
        <div className="sticky bottom-4 z-10">
          <div className="flex w-full flex-wrap items-center justify-end gap-2 rounded-2xl border border-border bg-background/95 p-3 shadow-lg backdrop-blur supports-backdrop-filter:bg-background/80">
            <Button
              type="button"
              variant="outline"
              onClick={() => void executeActivateTemplate(selectedTemplate.id)}
              disabled={selectedTemplate.isActive || activatingTemplateId === selectedTemplate.id}
            >
              {activatingTemplateId === selectedTemplate.id ? 'Activating…' : 'Set active'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void executeDeleteSelectedTemplate()}
              disabled={deletingTemplateId === selectedTemplate.id}
            >
              <Trash2 className="size-4" aria-hidden />
              {deletingTemplateId === selectedTemplate.id ? 'Deleting…' : 'Delete'}
            </Button>
            <Button
              type="button"
              onClick={() => void executeSaveSelectedTemplate()}
              disabled={!hasDirtySelectedTemplate || isSaving}
            >
              <Save className="size-4" aria-hidden />
              {isSaving ? 'Saving…' : 'Save template'}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
