'use client';

import { useMemo, type ReactElement } from 'react';
import {
  parseGuidedDiagnosticJson,
  type CompletedRoundBundle,
  type DiagnosticQuestionBlock,
  type DiagnosticQuestionSelection,
  type GuidedDiagnosticV1,
} from '@/lib/marketing/guided-diagnostic-types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

function resolveRankForOption(selection: DiagnosticQuestionSelection | undefined, optionId: string): number | null {
  if (selection === undefined) {
    return null;
  }
  const index = selection.selectedOptionIds.indexOf(optionId);
  return index >= 0 ? index + 1 : null;
}

function findOptionLabel(question: DiagnosticQuestionBlock, optionId: string): string {
  const option = question.options.find((candidate) => candidate.id === optionId);
  return option?.label ?? optionId;
}

function renderQuestionBlock(params: {
  readonly question: DiagnosticQuestionBlock;
  readonly selection: DiagnosticQuestionSelection | undefined;
  readonly answerNote?: string;
}): ReactElement {
  const { question, selection, answerNote } = params;
  const isRanked = question.type === 'ranked-options';
  const rankedLimit = question.rankedOptionLimit ?? 3;
  const rankedSelectionIds = selection?.selectedOptionIds ?? [];
  return (
    <div key={question.id} className="rounded-lg border border-border bg-muted/20 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Question</p>
      <p className="mt-1 text-sm font-medium text-foreground">{question.prompt}</p>
      {question.description !== null && question.description.trim().length > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">{question.description}</p>
      ) : null}
      {isRanked ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Ranked question — pick order is saved: <span className="font-medium text-foreground">1 = highest priority</span>
          , up to {rankedLimit} options.
        </p>
      ) : null}
      {answerNote !== undefined && answerNote.trim().length > 0 ? (
        <p className="mt-2 rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-950 dark:text-amber-100">
          <span className="font-semibold">Note: </span>
          {answerNote}
        </p>
      ) : null}
      {isRanked ? (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Saved ranking</p>
          {rankedSelectionIds.length > 0 ? (
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-foreground">
              {rankedSelectionIds.map((optionId) => (
                <li key={optionId} className="pl-1">
                  <span className="font-medium">{findOptionLabel(question, optionId)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No ranked selection was stored for this question.</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {rankedSelectionIds.length} / {rankedLimit} ranked
          </p>
        </div>
      ) : null}
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {isRanked ? 'All options (rank badges match saved order above)' : 'Options shown'}
      </p>
      <ul className="mt-2 space-y-2">
        {question.options.map((option) => {
          const selected = isOptionSelected(selection, option.id);
          const rank = isRanked ? resolveRankForOption(selection, option.id) : null;
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
                    {rank !== null ? `Rank ${rank}` : 'Selected'}
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

function renderCompletedRoundTabContent(bundle: CompletedRoundBundle): ReactElement {
  return (
    <div className="space-y-4">
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

function renderActiveRoundTabContent(activeRound: NonNullable<GuidedDiagnosticV1['activeRound']>): ReactElement {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">In progress</p>
        <p className="mt-1 text-base font-semibold text-foreground">{activeRound.roundTitle}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Step {activeRound.stepIndex + 1} of {activeRound.questions.length}
        </p>
      </div>
      {activeRound.guidance !== null && activeRound.guidance.trim().length > 0 ? (
        <p className="text-sm text-muted-foreground">{activeRound.guidance}</p>
      ) : null}
      <div className="space-y-4">
        {activeRound.questions.map((question) =>
          renderQuestionBlock({
            question,
            selection: activeRound.answers[question.id],
            answerNote: activeRound.answerNotes[question.id],
          }),
        )}
      </div>
    </div>
  );
}

function resolveDefaultRoundSubTab(guided: GuidedDiagnosticV1): string {
  if (guided.completedBundles.length > 0) {
    return 'completed-0';
  }
  if (guided.activeRound !== null) {
    return 'active';
  }
  return 'completed-0';
}

const ROUND_TAB_TRIGGER_CLASS =
  'max-w-[min(14rem,40vw)] whitespace-normal text-left leading-snug line-clamp-2 hyphens-auto';

function resolveCompletedRoundTabLabel(bundle: CompletedRoundBundle): string {
  const trimmedTitle = bundle.roundTitle.trim();
  return trimmedTitle.length > 0 ? trimmedTitle : `Round ${bundle.roundIndex + 1}`;
}

function resolveCompletedRoundTabTitle(bundle: CompletedRoundBundle): string {
  return `Round ${bundle.roundIndex + 1} · ${bundle.roundTitle.trim()}`;
}

function renderRoundsSubTabs(guided: GuidedDiagnosticV1): ReactElement {
  const defaultRoundTab = resolveDefaultRoundSubTab(guided);
  return (
    <Tabs defaultValue={defaultRoundTab} className="w-full">
      <TabsList className="flex h-auto min-h-9 w-full flex-wrap justify-start gap-1 py-1">
        {guided.completedBundles.map((bundle, index) => (
          <TabsTrigger
            key={`completed-${bundle.roundIndex}-${index}`}
            value={`completed-${index}`}
            title={resolveCompletedRoundTabTitle(bundle)}
            className={ROUND_TAB_TRIGGER_CLASS}
          >
            {resolveCompletedRoundTabLabel(bundle)}
          </TabsTrigger>
        ))}
        {guided.activeRound !== null ? (
          <TabsTrigger
            value="active"
            title={`In progress · ${guided.activeRound.roundTitle.trim()}`}
            className={ROUND_TAB_TRIGGER_CLASS}
          >
            {guided.activeRound.roundTitle.trim().length > 0 ? guided.activeRound.roundTitle.trim() : 'In progress'}
          </TabsTrigger>
        ) : null}
      </TabsList>
      {guided.completedBundles.map((bundle, index) => (
        <TabsContent key={`content-completed-${bundle.roundIndex}-${index}`} value={`completed-${index}`} className="space-y-4">
          {renderCompletedRoundTabContent(bundle)}
        </TabsContent>
      ))}
      {guided.activeRound !== null ? (
        <TabsContent value="active" className="space-y-4">
          {renderActiveRoundTabContent(guided.activeRound)}
        </TabsContent>
      ) : null}
    </Tabs>
  );
}

function renderRecommendationSection(guided: GuidedDiagnosticV1): ReactElement {
  if (guided.outcome === null) {
    return <p className="text-sm text-muted-foreground">No recommendation was recorded for this snapshot.</p>;
  }
  const outcome = guided.outcome;
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Recommendation</h3>
      {outcome.sessionTitle.trim().length > 0 ? (
        <p className="mt-2 text-base font-semibold text-foreground">{outcome.sessionTitle}</p>
      ) : null}
      {outcome.briefAssessment.trim().length > 0 ? (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{outcome.briefAssessment}</p>
      ) : null}
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mapped situation</p>
      <p className="mt-1 text-sm font-medium text-foreground">{outcome.mappedSituation}</p>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Advisor summary</p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{outcome.advisorSummary}</p>
      {outcome.goodFitBullets.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Good fit if</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
            {outcome.goodFitBullets.map((bullet, index) => (
              <li key={`${index}-${bullet.slice(0, 24)}`}>{bullet}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function resolveDefaultDiagnosticTab(guided: GuidedDiagnosticV1): string {
  if (guided.completedBundles.length > 0 || guided.activeRound !== null) {
    return 'rounds';
  }
  if (guided.outcome !== null) {
    return 'recommendation';
  }
  return 'intake';
}

function renderGuided(guided: GuidedDiagnosticV1): ReactElement {
  const defaultTab = resolveDefaultDiagnosticTab(guided);
  const hasRounds = guided.completedBundles.length > 0 || guided.activeRound !== null;
  const hasRecommendation = guided.outcome !== null;
  const hasIntake = guided.initialPrompt.trim().length > 0;
  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <TabsList className="flex w-full flex-wrap gap-1 sm:w-auto">
        <TabsTrigger value="intake">Intake</TabsTrigger>
        <TabsTrigger value="rounds" disabled={!hasRounds}>
          Rounds
        </TabsTrigger>
        <TabsTrigger value="recommendation" disabled={!hasRecommendation}>
          Recommendation
        </TabsTrigger>
      </TabsList>
      <TabsContent value="intake" className="space-y-3">
        {hasIntake ? (
          <>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Initial situation</h3>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{guided.initialPrompt}</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No initial situation text was saved.</p>
        )}
      </TabsContent>
      <TabsContent value="rounds">
        {!hasRounds ? (
          <p className="text-sm text-muted-foreground">No rounds were saved on this snapshot.</p>
        ) : (
          renderRoundsSubTabs(guided)
        )}
      </TabsContent>
      <TabsContent value="recommendation">{renderRecommendationSection(guided)}</TabsContent>
    </Tabs>
  );
}

/**
 * Rounds, questions, and every option as stored on the booking (read-only admin CRM view).
 */
export function BookingDiagnosticReadonly(props: BookingDiagnosticReadonlyProps): ReactElement {
  const guided = useMemo(() => {
    if (props.guidedDiagnosticRaw === null || props.guidedDiagnosticRaw.trim().length === 0) {
      return null;
    }
    return parseGuidedDiagnosticJson(props.guidedDiagnosticRaw);
  }, [props.guidedDiagnosticRaw]);
  if (props.guidedDiagnosticRaw === null || props.guidedDiagnosticRaw.trim().length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No guided diagnostic snapshot was stored (visitor may not have started the quiz, or MongoDB was unavailable when
        saving).
      </p>
    );
  }
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
