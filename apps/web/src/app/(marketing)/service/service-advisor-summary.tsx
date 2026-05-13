'use client';

import { CheckCircle2 } from 'lucide-react';
import { useEffect, useState, type ReactElement } from 'react';
import { parseGuidedDiagnosticJson } from '@/lib/marketing/guided-diagnostic-types';
import {
  resolveProjectRescueBriefAssessment,
  resolveProjectRescueGoodFitBullets,
  resolveProjectRescueSessionTitle,
} from '@it-advisory/diagnostic-core/project-rescue-service-context';

const QUIZ_SESSION_API_URL = '/api/quiz/session';

function normalizeGuidedDiagnosticRaw(raw: unknown): string | undefined {
  if (typeof raw === 'string') {
    return raw;
  }
  if (raw !== undefined && raw !== null && typeof raw === 'object') {
    try {
      return JSON.stringify(raw);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function extractAdvisorSummaryFromAnswers(answers: Record<string, unknown> | undefined): string {
  if (answers === undefined) {
    return '';
  }
  const direct = answers.situationAdvisorSummary;
  if (typeof direct === 'string') {
    const trimmed = direct.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  const rawGuided = answers.guidedDiagnostic;
  const normalized = normalizeGuidedDiagnosticRaw(rawGuided);
  if (normalized === undefined || normalized === '') {
    return '';
  }
  const parsed = parseGuidedDiagnosticJson(normalized);
  const fromOutcome = parsed?.outcome?.advisorSummary?.trim() ?? '';
  return fromOutcome;
}

function extractBriefAssessmentFragment(answers: Record<string, unknown> | undefined): string {
  if (answers === undefined) {
    return '';
  }
  const rawGuided = answers.guidedDiagnostic;
  const normalized = normalizeGuidedDiagnosticRaw(rawGuided);
  if (normalized === undefined || normalized === '') {
    return '';
  }
  const parsed = parseGuidedDiagnosticJson(normalized);
  return typeof parsed?.outcome?.briefAssessment === 'string' ? parsed.outcome.briefAssessment : '';
}

function extractSessionTitleFragment(answers: Record<string, unknown> | undefined): string {
  if (answers === undefined) {
    return '';
  }
  const rawGuided = answers.guidedDiagnostic;
  const normalized = normalizeGuidedDiagnosticRaw(rawGuided);
  if (normalized === undefined || normalized === '') {
    return '';
  }
  const parsed = parseGuidedDiagnosticJson(normalized);
  return typeof parsed?.outcome?.sessionTitle === 'string' ? parsed.outcome.sessionTitle : '';
}

function extractGoodFitBulletsFragment(answers: Record<string, unknown> | undefined): readonly unknown[] | null {
  if (answers === undefined) {
    return null;
  }
  const rawGuided = answers.guidedDiagnostic;
  const normalized = normalizeGuidedDiagnosticRaw(rawGuided);
  if (normalized === undefined || normalized === '') {
    return null;
  }
  const parsed = parseGuidedDiagnosticJson(normalized);
  const raw = parsed?.outcome?.goodFitBullets;
  return Array.isArray(raw) ? raw : null;
}

export type ServiceAdvisorSummaryProps = {
  readonly fallbackTitle: string;
  readonly fallbackTagline: string;
  readonly whatsIncluded: readonly string[];
  readonly fallbackGoodFitBullets: readonly string[];
};

/**
 * Personalized headline and hero copy when a diagnostic outcome exists, plus the advisor handoff block from the latest quiz session.
 */
export function ServiceAdvisorSummary(props: ServiceAdvisorSummaryProps): ReactElement {
  const { fallbackTitle, fallbackTagline, whatsIncluded, fallbackGoodFitBullets } = props;
  const [headline, setHeadline] = useState<string>(fallbackTitle);
  const [tagline, setTagline] = useState<string>(fallbackTagline);
  const [advisorSummary, setAdvisorSummary] = useState<string>('');
  const [goodFitBullets, setGoodFitBullets] = useState<readonly string[]>(fallbackGoodFitBullets);
  useEffect(() => {
    let cancelled = false;
    async function loadSession(): Promise<void> {
      try {
        const response = await fetch(QUIZ_SESSION_API_URL);
        if (!response.ok || cancelled) {
          return;
        }
        const data = (await response.json()) as {
          session: { answers: Record<string, unknown> } | null;
        };
        if (cancelled || !data.session) {
          return;
        }
        const answers = data.session.answers;
        setAdvisorSummary(extractAdvisorSummaryFromAnswers(answers));
        setTagline(resolveProjectRescueBriefAssessment(extractBriefAssessmentFragment(answers)));
        setHeadline(resolveProjectRescueSessionTitle(extractSessionTitleFragment(answers)));
        setGoodFitBullets(resolveProjectRescueGoodFitBullets(extractGoodFitBulletsFragment(answers)));
      } catch {
        if (!cancelled) {
          setAdvisorSummary('');
          setTagline(fallbackTagline);
          setHeadline(fallbackTitle);
          setGoodFitBullets(fallbackGoodFitBullets);
        }
      }
    }
    void loadSession();
    return () => {
      cancelled = true;
    };
  }, [fallbackGoodFitBullets, fallbackTagline, fallbackTitle]);
  return (
    <>
      <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground md:text-4xl">{headline}</h1>
      <p className="mt-4 text-pretty text-lg text-muted-foreground">{tagline}</p>
      {advisorSummary.length > 0 ? (
        <div className="mt-10 rounded-2xl border border-border bg-card p-6 shadow-xs">
          <h2 className="text-lg font-semibold text-foreground">Your advisor summary</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Pulled from your latest guided diagnostic — bring this to the session or skim it before you book.
          </p>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{advisorSummary}</p>
        </div>
      ) : null}
      <div className="mt-10 rounded-2xl border border-border bg-card p-6 shadow-xs">
        <h2 className="text-lg font-semibold text-foreground">What&apos;s included</h2>
        <ul className="mt-5 space-y-4">
          {whatsIncluded.map((item) => (
            <li key={item} className="flex gap-3 text-sm text-foreground">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-10 rounded-2xl border border-dashed border-border bg-muted/30 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Good fit if</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          {goodFitBullets.map((line, index) => (
            <li key={`${index}-${line.slice(0, 24)}`}>{line}</li>
          ))}
        </ul>
      </div>
    </>
  );
}
