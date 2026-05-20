'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  buildAvailableOptionVisibilitySources,
  buildAvailableVisibilitySourceQuestions,
  buildDefaultVisibilityRuleForSource,
  buildVisibilityRuleSummary,
  buildOptionVisibilityRuleSummary,
  createDraftChildOption,
  moveArrayItem,
  SELECTION_MODE_OPTIONS,
  QUESTION_TYPE_OPTIONS,
} from '@/components/admin/diagnostic-template-editor/diagnostic-template-editor-utils';
import {
  findOptionInTemplate,
  findQuestionInTemplate,
  findRoundInTemplate,
  useTemplateEditor,
  type TemplateEditorSelection,
} from '@/components/admin/diagnostic-template-editor/template-editor-context';
import {
  collectWorkspaceNodeIdsForQuestion,
  collectWorkspaceNodeIdsForRound,
  removeQuestionFromTemplate,
  removeRoundFromTemplate,
} from '@/components/admin/diagnostic-template-editor/workspace-template-mutations';
import { pruneWorkspaceLayoutNodeIds } from '@/components/admin/diagnostic-template-editor/workspace-layout-storage';
import type { DiagnosticTemplateVisibilityRule } from '@/lib/diagnostic-template-types';
import {
  WORKSPACE_INSPECTOR_INPUT_CLASS,
  WORKSPACE_INSPECTOR_OUTLINE_BUTTON_CLASS,
  WORKSPACE_INSPECTOR_SELECT_CLASS,
  WORKSPACE_INSPECTOR_SURFACE_CLASS,
  WORKSPACE_PANEL_CLASS,
  WORKSPACE_VISIBILITY_RULE_IDLE_CLASS,
  WORKSPACE_VISIBILITY_RULE_SELECTED_CLASS,
} from '@/components/admin/diagnostic-template-editor/workspace-theme';
import { cn } from '@/lib/utils';

type TemplateWorkspaceInspectorProps = {
  readonly className?: string;
};

export function TemplateWorkspaceInspector(props: TemplateWorkspaceInspectorProps): ReactElement {
  const { template, selection, updateTemplate, setSelection } = useTemplateEditor();
  if (selection === null) {
    return (
      <aside className={cn('flex flex-col border-l p-4', WORKSPACE_PANEL_CLASS, props.className)}>
        <p className="text-sm font-medium text-foreground">Inspector</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Select a round, question, option, or follow-up on the canvas. Follow-up nested options appear in the inspector when
          you select a Follow-up node. Round order follows R1 → R2 labels and dashed &quot;next round&quot; arrows.
        </p>
      </aside>
    );
  }
  if (selection.kind === 'round') {
    return (
      <RoundInspector
        className={props.className}
        roundId={selection.roundId}
        template={template}
        updateTemplate={updateTemplate}
        setSelection={setSelection}
      />
    );
  }
  if (selection.kind === 'question') {
    return (
      <QuestionInspector
        className={props.className}
        roundId={selection.roundId}
        questionId={selection.questionId}
        template={template}
        updateTemplate={updateTemplate}
        setSelection={setSelection}
      />
    );
  }
  if (selection.kind === 'option') {
    return (
      <OptionInspector
        className={props.className}
        roundId={selection.roundId}
        questionId={selection.questionId}
        optionId={selection.optionId}
        template={template}
        updateTemplate={updateTemplate}
        setSelection={setSelection}
      />
    );
  }
  return (
    <ChildQuestionInspector
      className={props.className}
      roundId={selection.roundId}
      questionId={selection.questionId}
      optionId={selection.optionId}
      template={template}
      updateTemplate={updateTemplate}
    />
  );
}

type InspectorBaseProps = {
  readonly className?: string;
  readonly template: ReturnType<typeof useTemplateEditor>['template'];
  readonly updateTemplate: ReturnType<typeof useTemplateEditor>['updateTemplate'];
};

function RoundInspector(props: InspectorBaseProps & { readonly roundId: string; readonly setSelection: (s: TemplateEditorSelection) => void }): ReactElement {
  const found = findRoundInTemplate(props.template, props.roundId);
  if (found === null) {
    return <EmptyInspector className={props.className} message="Round not found." />;
  }
  const { round, roundIndex } = found;
  const availableQuestions = buildAvailableVisibilitySourceQuestions({
    template: props.template,
    roundId: round.id,
  });
  return (
    <aside className={cn('flex flex-col gap-4 overflow-y-auto border-l p-4', WORKSPACE_PANEL_CLASS, props.className)}>
      <Header
        title="Round"
        onRemove={() => {
          const layoutNodeIds = collectWorkspaceNodeIdsForRound(round);
          props.updateTemplate((current) =>
            removeRoundFromTemplate({ template: current, roundId: round.id }),
          );
          pruneWorkspaceLayoutNodeIds(props.template.id, layoutNodeIds);
          props.setSelection(null);
        }}
      />
      <Field label="Title">
        <Input
          value={round.title}
          onChange={(event) =>
            props.updateTemplate((current) => ({
              ...current,
              rounds: current.rounds.map((candidate) =>
                candidate.id === round.id ? { ...candidate, title: event.target.value } : candidate,
              ),
            }))
          }
          className={WORKSPACE_INSPECTOR_INPUT_CLASS}
        />
      </Field>
      <Field label="Guidance">
        <Textarea
          value={round.guidance ?? ''}
          onChange={(event) =>
            props.updateTemplate((current) => ({
              ...current,
              rounds: current.rounds.map((candidate) =>
                candidate.id === round.id ? { ...candidate, guidance: event.target.value || null } : candidate,
              ),
            }))
          }
          className={WORKSPACE_INSPECTOR_INPUT_CLASS}
          rows={3}
        />
      </Field>
      <VisibilityField
        label="Round visibility"
        availableSources={availableQuestions}
        rule={round.showWhen}
        onChange={(nextRule) =>
          props.updateTemplate((current) => ({
            ...current,
            rounds: current.rounds.map((candidate) =>
              candidate.id === round.id ? { ...candidate, showWhen: nextRule } : candidate,
            ),
          }))
        }
        summary={buildVisibilityRuleSummary({ availableQuestions, rule: round.showWhen })}
      />
      <div className={WORKSPACE_INSPECTOR_SURFACE_CLASS}>
        <p className="text-xs font-medium text-muted-foreground">Customer flow order</p>
        <p className="mt-1 text-sm text-foreground">
          Round {roundIndex + 1} of {props.template.rounds.length}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Lower R numbers run first unless visibility rules skip this round.
        </p>
        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={WORKSPACE_INSPECTOR_OUTLINE_BUTTON_CLASS}
            disabled={roundIndex === 0}
            onClick={() =>
              props.updateTemplate((current) => ({
                ...current,
                rounds: moveArrayItem(current.rounds, roundIndex, roundIndex - 1),
              }))
            }
          >
            Move earlier
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={WORKSPACE_INSPECTOR_OUTLINE_BUTTON_CLASS}
            disabled={roundIndex >= props.template.rounds.length - 1}
            onClick={() =>
              props.updateTemplate((current) => ({
                ...current,
                rounds: moveArrayItem(current.rounds, roundIndex, roundIndex + 1),
              }))
            }
          >
            Move later
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{round.questions.length} questions in this round</p>
    </aside>
  );
}

function QuestionInspector(
  props: InspectorBaseProps & {
    readonly roundId: string;
    readonly questionId: string;
    readonly setSelection: (selection: TemplateEditorSelection) => void;
  },
): ReactElement {
  const found = findQuestionInTemplate(props.template, props.questionId);
  if (found === null) {
    return <EmptyInspector className={props.className} message="Question not found." />;
  }
  const { question, round } = found;
  const availableQuestions = buildAvailableVisibilitySourceQuestions({
    template: props.template,
    roundId: round.id,
    targetQuestionId: question.id,
  });
  return (
    <aside className={cn('flex flex-col gap-4 overflow-y-auto border-l p-4', WORKSPACE_PANEL_CLASS, props.className)}>
      <Header
        title="Question"
        onRemove={() => {
          const layoutNodeIds = collectWorkspaceNodeIdsForQuestion(question);
          props.updateTemplate((current) =>
            removeQuestionFromTemplate({
              template: current,
              roundId: round.id,
              questionId: question.id,
            }),
          );
          pruneWorkspaceLayoutNodeIds(props.template.id, layoutNodeIds);
          props.setSelection({ kind: 'round', roundId: round.id });
        }}
      />
      <Field label="Prompt">
        <Textarea
          value={question.prompt}
          onChange={(event) =>
            props.updateTemplate((current) => ({
              ...current,
              rounds: current.rounds.map((candidate) =>
                candidate.id === round.id
                  ? {
                      ...candidate,
                      questions: candidate.questions.map((candidateQuestion) =>
                        candidateQuestion.id === question.id
                          ? { ...candidateQuestion, prompt: event.target.value }
                          : candidateQuestion,
                      ),
                    }
                  : candidate,
              ),
            }))
          }
          className={WORKSPACE_INSPECTOR_INPUT_CLASS}
          rows={3}
        />
      </Field>
      <Field label="Type">
        <select
          value={question.type}
          onChange={(event) =>
            props.updateTemplate((current) => ({
              ...current,
              rounds: current.rounds.map((candidate) =>
                candidate.id === round.id
                  ? {
                      ...candidate,
                      questions: candidate.questions.map((candidateQuestion) =>
                        candidateQuestion.id === question.id
                          ? { ...candidateQuestion, type: event.target.value as typeof question.type }
                          : candidateQuestion,
                      ),
                    }
                  : candidate,
              ),
            }))
          }
          className={WORKSPACE_INSPECTOR_SELECT_CLASS}
        >
          {QUESTION_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Selection mode">
        <select
          value={question.selectionMode}
          onChange={(event) =>
            props.updateTemplate((current) => ({
              ...current,
              rounds: current.rounds.map((candidate) =>
                candidate.id === round.id
                  ? {
                      ...candidate,
                      questions: candidate.questions.map((candidateQuestion) =>
                        candidateQuestion.id === question.id
                          ? {
                              ...candidateQuestion,
                              selectionMode: event.target.value as typeof question.selectionMode,
                            }
                          : candidateQuestion,
                      ),
                    }
                  : candidate,
              ),
            }))
          }
          className={WORKSPACE_INSPECTOR_SELECT_CLASS}
        >
          {SELECTION_MODE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>
      <VisibilityField
        label="Question visibility"
        availableSources={availableQuestions}
        rule={question.showWhen}
        onChange={(nextRule) =>
          props.updateTemplate((current) => ({
            ...current,
            rounds: current.rounds.map((candidate) =>
              candidate.id === round.id
                ? {
                    ...candidate,
                    questions: candidate.questions.map((candidateQuestion) =>
                      candidateQuestion.id === question.id ? { ...candidateQuestion, showWhen: nextRule } : candidateQuestion,
                    ),
                  }
                : candidate,
            ),
          }))
        }
        summary={buildVisibilityRuleSummary({ availableQuestions, rule: question.showWhen })}
      />
    </aside>
  );
}

function OptionInspector(
  props: InspectorBaseProps & {
    readonly roundId: string;
    readonly questionId: string;
    readonly optionId: string;
    readonly setSelection: (s: TemplateEditorSelection) => void;
  },
): ReactElement {
  const found = findOptionInTemplate(props.template, props.optionId);
  if (found === null) {
    return <EmptyInspector className={props.className} message="Option not found." />;
  }
  const { option, question, round } = found;
  const availableSources = buildAvailableOptionVisibilitySources({
    template: props.template,
    roundId: round.id,
    question,
    optionId: option.id,
  });
  return (
    <aside className={cn('flex flex-col gap-4 overflow-y-auto border-l p-4', WORKSPACE_PANEL_CLASS, props.className)}>
      <Header
        title="Option"
        onRemove={() => {
          props.updateTemplate((current) => ({
            ...current,
            rounds: current.rounds.map((candidate) =>
              candidate.id === round.id
                ? {
                    ...candidate,
                    questions: candidate.questions.map((candidateQuestion) =>
                      candidateQuestion.id === question.id
                        ? {
                            ...candidateQuestion,
                            options: candidateQuestion.options.filter((candidateOption) => candidateOption.id !== option.id),
                          }
                        : candidateQuestion,
                    ),
                  }
                : candidate,
            ),
          }));
          props.setSelection({ kind: 'question', roundId: round.id, questionId: question.id });
        }}
      />
      <Field label="Label">
        <Input
          value={option.label}
          onChange={(event) =>
            props.updateTemplate((current) => ({
              ...current,
              rounds: current.rounds.map((candidate) =>
                candidate.id === round.id
                  ? {
                      ...candidate,
                      questions: candidate.questions.map((candidateQuestion) =>
                        candidateQuestion.id === question.id
                          ? {
                              ...candidateQuestion,
                              options: candidateQuestion.options.map((candidateOption) =>
                                candidateOption.id === option.id ? { ...candidateOption, label: event.target.value } : candidateOption,
                              ),
                            }
                          : candidateQuestion,
                      ),
                    }
                  : candidate,
              ),
            }))
          }
          className={WORKSPACE_INSPECTOR_INPUT_CLASS}
        />
      </Field>
      <VisibilityField
        label="Option visibility"
        availableSources={availableSources}
        rule={option.showWhen}
        onChange={(nextRule) =>
          props.updateTemplate((current) => ({
            ...current,
            rounds: current.rounds.map((candidate) =>
              candidate.id === round.id
                ? {
                    ...candidate,
                    questions: candidate.questions.map((candidateQuestion) =>
                      candidateQuestion.id === question.id
                        ? {
                            ...candidateQuestion,
                            options: candidateQuestion.options.map((candidateOption) =>
                              candidateOption.id === option.id ? { ...candidateOption, showWhen: nextRule } : candidateOption,
                            ),
                          }
                        : candidateQuestion,
                    ),
                  }
                : candidate,
            ),
          }))
        }
        summary={buildOptionVisibilityRuleSummary({ availableSources, rule: option.showWhen })}
      />
      {option.childQuestion !== null ? (
        <div className={WORKSPACE_INSPECTOR_SURFACE_CLASS}>
          <p className="text-xs text-muted-foreground">Nested follow-up</p>
          <p className="mt-1 text-sm text-foreground">{option.childQuestion.prompt.trim() || 'Untitled follow-up'}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {option.childQuestion.options.length} nested option{option.childQuestion.options.length === 1 ? '' : 's'} — select
            the Follow-up node on the canvas to edit them.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={cn('mt-2', WORKSPACE_INSPECTOR_OUTLINE_BUTTON_CLASS)}
            onClick={() =>
              props.setSelection({
                kind: 'childQuestion',
                roundId: round.id,
                questionId: question.id,
                optionId: option.id,
              })
            }
          >
            Edit follow-up
          </Button>
        </div>
      ) : null}
    </aside>
  );
}

function ChildQuestionInspector(
  props: InspectorBaseProps & { readonly roundId: string; readonly questionId: string; readonly optionId: string },
): ReactElement {
  const found = findOptionInTemplate(props.template, props.optionId);
  if (found === null || found.option.childQuestion === null) {
    return <EmptyInspector className={props.className} message="Follow-up question not found." />;
  }
  const child = found.option.childQuestion;
  const { round, question, option } = found;
  return (
    <aside className={cn('flex flex-col gap-4 overflow-y-auto border-l p-4', WORKSPACE_PANEL_CLASS, props.className)}>
      <Header title="Follow-up question" />
      <Field label="Prompt">
        <Textarea
          value={child.prompt}
          onChange={(event) =>
            props.updateTemplate((current) => ({
              ...current,
              rounds: current.rounds.map((candidate) =>
                candidate.id === round.id
                  ? {
                      ...candidate,
                      questions: candidate.questions.map((candidateQuestion) =>
                        candidateQuestion.id === question.id
                          ? {
                              ...candidateQuestion,
                              options: candidateQuestion.options.map((candidateOption) =>
                                candidateOption.id === option.id && candidateOption.childQuestion !== null
                                  ? {
                                      ...candidateOption,
                                      childQuestion: { ...candidateOption.childQuestion, prompt: event.target.value },
                                    }
                                  : candidateOption,
                              ),
                            }
                          : candidateQuestion,
                      ),
                    }
                  : candidate,
              ),
            }))
          }
          className={WORKSPACE_INSPECTOR_INPUT_CLASS}
          rows={3}
        />
      </Field>
      <Field label="Selection mode">
        <select
          value={child.selectionMode}
          onChange={(event) =>
            props.updateTemplate((current) => ({
              ...current,
              rounds: current.rounds.map((candidate) =>
                candidate.id === round.id
                  ? {
                      ...candidate,
                      questions: candidate.questions.map((candidateQuestion) =>
                        candidateQuestion.id === question.id
                          ? {
                              ...candidateQuestion,
                              options: candidateQuestion.options.map((candidateOption) =>
                                candidateOption.id === option.id && candidateOption.childQuestion !== null
                                  ? {
                                      ...candidateOption,
                                      childQuestion: {
                                        ...candidateOption.childQuestion,
                                        selectionMode: event.target.value as typeof child.selectionMode,
                                      },
                                    }
                                  : candidateOption,
                              ),
                            }
                          : candidateQuestion,
                      ),
                    }
                  : candidate,
              ),
            }))
          }
          className={WORKSPACE_INSPECTOR_SELECT_CLASS}
        >
          {SELECTION_MODE_OPTIONS.map((modeOption) => (
            <option key={modeOption.value} value={modeOption.value}>
              {modeOption.label}
            </option>
          ))}
        </select>
      </Field>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-foreground">Nested options</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={WORKSPACE_INSPECTOR_OUTLINE_BUTTON_CLASS}
            onClick={() =>
              props.updateTemplate((current) => ({
                ...current,
                rounds: current.rounds.map((candidate) =>
                  candidate.id === round.id
                    ? {
                        ...candidate,
                        questions: candidate.questions.map((candidateQuestion) =>
                          candidateQuestion.id === question.id
                            ? {
                                ...candidateQuestion,
                                options: candidateQuestion.options.map((candidateOption) =>
                                  candidateOption.id === option.id && candidateOption.childQuestion !== null
                                    ? {
                                        ...candidateOption,
                                        childQuestion: {
                                          ...candidateOption.childQuestion,
                                          options: [
                                            ...candidateOption.childQuestion.options,
                                            createDraftChildOption(candidateOption.childQuestion.options.length),
                                          ],
                                        },
                                      }
                                    : candidateOption,
                                ),
                              }
                            : candidateQuestion,
                        ),
                      }
                    : candidate,
                ),
              }))
            }
          >
            <Plus className="size-3.5" aria-hidden />
            Add
          </Button>
        </div>
        {child.options.length === 0 ? (
          <p className="text-xs text-muted-foreground">No nested options yet. Customers will only see the follow-up prompt.</p>
        ) : (
          child.options.map((childOption, childOptionIndex) => (
            <div key={childOption.id} className={cn('space-y-2', WORKSPACE_INSPECTOR_SURFACE_CLASS)}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">Option {childOptionIndex + 1}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-red-400"
                  disabled={child.options.length <= 1}
                  onClick={() =>
                    props.updateTemplate((current) => ({
                      ...current,
                      rounds: current.rounds.map((candidate) =>
                        candidate.id === round.id
                          ? {
                              ...candidate,
                              questions: candidate.questions.map((candidateQuestion) =>
                                candidateQuestion.id === question.id
                                  ? {
                                      ...candidateQuestion,
                                      options: candidateQuestion.options.map((candidateOption) =>
                                        candidateOption.id === option.id && candidateOption.childQuestion !== null
                                          ? {
                                              ...candidateOption,
                                              childQuestion: {
                                                ...candidateOption.childQuestion,
                                                options: candidateOption.childQuestion.options.filter(
                                                  (candidate) => candidate.id !== childOption.id,
                                                ),
                                              },
                                            }
                                          : candidateOption,
                                      ),
                                    }
                                  : candidateQuestion,
                              ),
                            }
                          : candidate,
                      ),
                    }))
                  }
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
              </div>
              <Field label="Label">
                <Input
                  value={childOption.label}
                  onChange={(event) =>
                    props.updateTemplate((current) => ({
                      ...current,
                      rounds: current.rounds.map((candidate) =>
                        candidate.id === round.id
                          ? {
                              ...candidate,
                              questions: candidate.questions.map((candidateQuestion) =>
                                candidateQuestion.id === question.id
                                  ? {
                                      ...candidateQuestion,
                                      options: candidateQuestion.options.map((candidateOption) =>
                                        candidateOption.id === option.id && candidateOption.childQuestion !== null
                                          ? {
                                              ...candidateOption,
                                              childQuestion: {
                                                ...candidateOption.childQuestion,
                                                options: candidateOption.childQuestion.options.map((candidate) =>
                                                  candidate.id === childOption.id
                                                    ? { ...candidate, label: event.target.value }
                                                    : candidate,
                                                ),
                                              },
                                            }
                                          : candidateOption,
                                      ),
                                    }
                                  : candidateQuestion,
                              ),
                            }
                          : candidate,
                      ),
                    }))
                  }
                  className={WORKSPACE_INSPECTOR_INPUT_CLASS}
                />
              </Field>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

function VisibilityField(props: {
  readonly label: string;
  readonly availableSources: readonly { readonly id: string; readonly label: string; readonly optionChoices: readonly { readonly id: string; readonly label: string }[] }[];
  readonly rule: DiagnosticTemplateVisibilityRule;
  readonly onChange: (rule: DiagnosticTemplateVisibilityRule) => void;
  readonly summary: string;
}): ReactElement {
  const rule = props.rule;
  const selectedSource =
    rule === null ? null : (props.availableSources.find((source) => source.id === rule.sourceQuestionId) ?? null);
  return (
    <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
      <p className="text-xs font-medium text-muted-foreground">{props.label}</p>
      <select
        value={props.rule?.sourceQuestionId ?? ''}
        onChange={(event) => {
          const nextSource = props.availableSources.find((source) => source.id === event.target.value);
          if (nextSource === undefined) {
            props.onChange(null);
            return;
          }
          props.onChange(
            buildDefaultVisibilityRuleForSource({
              sourceId: nextSource.id,
              optionChoices: nextSource.optionChoices,
            }),
          );
        }}
        className={cn('flex h-9 w-full rounded-md px-2 text-xs', WORKSPACE_INSPECTOR_SELECT_CLASS)}
      >
        <option value="">Always visible</option>
        {props.availableSources.map((source) => (
          <option key={source.id} value={source.id}>
            {source.label}
          </option>
        ))}
      </select>
      {selectedSource !== null && props.rule !== null ? (
        <div className="flex flex-wrap gap-1">
          {selectedSource.optionChoices.map((optionChoice) => {
            const isSelected = props.rule?.optionIds.includes(optionChoice.id) ?? false;
            return (
              <button
                key={optionChoice.id}
                type="button"
                className={cn(
                  'rounded-md border px-2 py-0.5 text-[10px]',
                  isSelected ? WORKSPACE_VISIBILITY_RULE_SELECTED_CLASS : WORKSPACE_VISIBILITY_RULE_IDLE_CLASS,
                )}
                onClick={() => {
                  if (props.rule === null) {
                    return;
                  }
                  const nextOptionIds = isSelected
                    ? props.rule.optionIds.filter((id) => id !== optionChoice.id)
                    : [...props.rule.optionIds, optionChoice.id];
                  if (nextOptionIds.length === 0) {
                    return;
                  }
                  props.onChange({ ...props.rule, optionIds: nextOptionIds });
                }}
              >
                {optionChoice.label}
              </button>
            );
          })}
        </div>
      ) : null}
      <p className="text-[10px] text-muted-foreground">{props.summary}</p>
    </div>
  );
}

function Header(props: { readonly title: string; readonly onRemove?: () => void }): ReactElement {
  return (
    <div className="flex items-center justify-between gap-2">
      <p className="text-sm font-semibold text-foreground">{props.title}</p>
      {props.onRemove ? (
        <Button type="button" size="sm" variant="ghost" className="text-muted-foreground hover:text-red-400" onClick={props.onRemove}>
          <Trash2 className="size-4" aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}

function Field(props: { readonly label: string; readonly children: React.ReactNode }): ReactElement {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{props.label}</span>
      {props.children}
    </label>
  );
}

function EmptyInspector(props: { readonly className?: string; readonly message: string }): ReactElement {
  return (
    <aside className={cn('border-l p-4', WORKSPACE_PANEL_CLASS, props.className)}>
      <p className="text-xs text-muted-foreground">{props.message}</p>
    </aside>
  );
}
