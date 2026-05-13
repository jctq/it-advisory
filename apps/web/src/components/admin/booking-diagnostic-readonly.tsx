import type { ReactElement } from 'react';
import {
  parseGuidedDiagnosticJson,
  type CompletedRoundBundle,
  type DiagnosticQuestionBlock,
  type DiagnosticQuestionSelection,
  type GuidedDiagnosticV1,
} from '@/lib/marketing/guided-diagnostic-types';
import { cn } from '@/lib/utils';

type BookingDiagnosticReadonlyProps = {
  readonly guidedDiagnosticRaw: string | null;
};

function isOptionSelected(selection: DiagnosticQuestionSelection | undefined, optionId: string): boolean {
  if (selection === undefined) {
    return false;
  }
  return selection.selectedOptionIds.includes(optionId);
}

function isChildOptionSelected(
  selection: DiagnosticQuestionSelection | undefined,
  parentOptionId: string,
  childOptionId: string,
): boolean {
  if (selection === undefined) {
    return false;
  }
  const list = selection.childSelections[parentOptionId] ?? [];
  return list.includes(childOptionId);
}

function renderQuestionBlock(params: {
  readonly question: DiagnosticQuestionBlock;
  readonly selection: DiagnosticQuestionSelection | undefined;
  readonly answerNote?: string;
}): ReactElement {
  const { question, selection, answerNote } = params;
  return (
    <div key={question.id} className="rounded-lg border border-border bg-muted/20 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Question</p>
      <p className="mt-1 text-sm font-medium text-foreground">{question.prompt}</p>
      {question.description !== null && question.description.trim().length > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">{question.description}</p>
      ) : null}
      {answerNote !== undefined && answerNote.trim().length > 0 ? (
        <p className="mt-2 rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-950 dark:text-amber-100">
          <span className="font-semibold">Note: </span>
          {answerNote}
        </p>
      ) : null}
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Options shown</p>
      <ul className="mt-2 space-y-2">
        {question.options.map((option) => {
          const selected = isOptionSelected(selection, option.id);
          return (
            <li
              key={option.id}
              className={cn(
                'rounded-md border px-3 py-2 text-sm',
                selected ? 'border-primary bg-primary/10 text-foreground' : 'border-border/80 bg-background text-muted-foreground',
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{option.label}</span>
                {selected ? (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
                    Selected
                  </span>
                ) : null}
              </div>
              {option.description !== null && option.description.trim().length > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
              ) : null}
              {option.childQuestion !== null && selected ? (
                <div className="mt-3 border-t border-border/60 pt-3">
                  <p className="text-xs font-semibold text-foreground">{option.childQuestion.prompt}</p>
                  <ul className="mt-2 space-y-1">
                    {option.childQuestion.options.map((child) => {
                      const childSelected = isChildOptionSelected(selection, option.id, child.id);
                      return (
                        <li
                          key={child.id}
                          className={cn(
                            'rounded border px-2 py-1 text-xs',
                            childSelected ? 'border-primary bg-primary/5' : 'border-transparent',
                          )}
                        >
                          {child.label}
                          {childSelected ? (
                            <span className="ml-2 text-[10px] font-bold uppercase text-primary">Selected</span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function renderBundle(bundle: CompletedRoundBundle): ReactElement {
  return (
    <div key={`${bundle.roundIndex}-${bundle.roundTitle}`} className="space-y-4">
      <h3 className="text-base font-semibold text-foreground">
        Round {bundle.roundIndex + 1}: {bundle.roundTitle}
      </h3>
      {bundle.guidance !== null && bundle.guidance.trim().length > 0 ? (
        <p className="text-sm text-muted-foreground">{bundle.guidance}</p>
      ) : null}
      <div className="space-y-4">
        {bundle.questions.map((question) =>
          renderQuestionBlock({
            question,
            selection: bundle.answers[question.id],
            answerNote: bundle.answerNotes[question.id],
          }),
        )}
      </div>
    </div>
  );
}

function renderGuided(guided: GuidedDiagnosticV1): ReactElement {
  return (
    <div className="space-y-10">
      {guided.initialPrompt.trim().length > 0 ? (
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Initial situation</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{guided.initialPrompt}</p>
        </section>
      ) : null}
      {guided.completedBundles.map((bundle) => renderBundle(bundle))}
      {guided.activeRound !== null ? (
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-700">In-progress round (at booking)</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {guided.activeRound.roundTitle} — step {guided.activeRound.stepIndex + 1} of {guided.activeRound.questions.length}
          </p>
          <div className="mt-4 space-y-4">
            {guided.activeRound.questions.map((question) =>
              renderQuestionBlock({
                question,
                selection: guided.activeRound?.answers[question.id],
                answerNote: guided.activeRound?.answerNotes[question.id],
              }),
            )}
          </div>
        </section>
      ) : null}
      {guided.outcome !== null ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Outcome</h3>
          <p className="mt-2 text-sm font-medium text-foreground">{guided.outcome.mappedSituation}</p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{guided.outcome.advisorSummary}</p>
        </section>
      ) : null}
    </div>
  );
}

/**
 * Rounds, questions, and every option as stored on the booking (read-only admin CRM view).
 */
export function BookingDiagnosticReadonly(props: BookingDiagnosticReadonlyProps): ReactElement {
  if (props.guidedDiagnosticRaw === null || props.guidedDiagnosticRaw.trim().length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No diagnostic snapshot was stored for this booking (visitor may not have completed the guided quiz on web, or
        MongoDB was unavailable at confirmation).
      </p>
    );
  }
  const guided = parseGuidedDiagnosticJson(props.guidedDiagnosticRaw);
  if (guided === null) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-amber-800">Snapshot could not be parsed as guided diagnostic v1.</p>
        <pre className="max-h-96 overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-xs">
          {props.guidedDiagnosticRaw.slice(0, 8000)}
          {props.guidedDiagnosticRaw.length > 8000 ? '\n…' : ''}
        </pre>
      </div>
    );
  }
  return renderGuided(guided);
}
