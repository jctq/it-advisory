'use client';

import { Bug, Building2, CalendarDays, Headphones, LayoutTemplate, MessageSquareQuote, Video } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';
import { AdminFormLoadingPanel } from '@/components/admin/admin-form-loading-panel';
import { AdminSettingsHint, AdminSettingsLabel } from '@/components/admin/admin-settings-hint';
import { Input } from '@/components/ui/input';
import { buildApiUrl } from '@/lib/config/build-api-url';
import { notifyError, notifySuccess } from '@/lib/notify';
import {
  DIAGNOSTIC_MAX_ROUNDS_MAX,
  DIAGNOSTIC_MAX_ROUNDS_MIN,
  DIAGNOSTIC_OPTIONS_PER_QUESTION_MAX,
  DIAGNOSTIC_OPTIONS_PER_QUESTION_MIN,
  DIAGNOSTIC_QUESTIONS_PER_ROUND_MAX,
  DIAGNOSTIC_QUESTIONS_PER_ROUND_MIN,
} from '@/domain/diagnostic-settings-bounds';

const ADMIN_SETTINGS_API_URL: string = buildApiUrl('/api/admin/settings');

type SettingsPayload = {
  readonly siteName: string;
  readonly siteNameEnvDefault: string;
  readonly diagnosticAiEnabled: boolean;
  readonly diagnosticManageBookingEnabled: boolean;
  readonly supportModuleEnabled: boolean;
  readonly reviewsModuleEnabled: boolean;
  readonly bookingSessionRoomLinksEnabled: boolean;
  readonly diagnosticMaxRounds: number;
  readonly diagnosticQuestionsPerRound: number;
  readonly diagnosticOptionsPerQuestion: number;
  readonly diagnosticCacheDebugEnabled: boolean;
};

export type AdminSettingsFormState = {
  readonly isDirty: boolean;
  readonly isSaving: boolean;
  readonly isLoading: boolean;
};

export type AdminSettingsFormHandle = {
  readonly save: () => Promise<void>;
  readonly reset: () => void;
};

type AdminSettingsFormProps = {
  readonly formRef?: Ref<AdminSettingsFormHandle>;
  readonly onStateChange?: (state: AdminSettingsFormState) => void;
};

function areSettingsEqual(left: SettingsPayload, right: SettingsPayload): boolean {
  return (
    left.siteName === right.siteName &&
    left.diagnosticAiEnabled === right.diagnosticAiEnabled &&
    left.diagnosticManageBookingEnabled === right.diagnosticManageBookingEnabled &&
    left.supportModuleEnabled === right.supportModuleEnabled &&
    left.reviewsModuleEnabled === right.reviewsModuleEnabled &&
    left.bookingSessionRoomLinksEnabled === right.bookingSessionRoomLinksEnabled &&
    left.diagnosticMaxRounds === right.diagnosticMaxRounds &&
    left.diagnosticQuestionsPerRound === right.diagnosticQuestionsPerRound &&
    left.diagnosticOptionsPerQuestion === right.diagnosticOptionsPerQuestion &&
    left.diagnosticCacheDebugEnabled === right.diagnosticCacheDebugEnabled
  );
}

function SettingsCard(props: {
  readonly icon: ReactElement;
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
  readonly className?: string;
}): ReactElement {
  return (
    <section className={`space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xs ${props.className ?? ''}`}>
      <div className="flex gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40 text-muted-foreground">
          {props.icon}
        </div>
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-semibold text-foreground">{props.title}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{props.description}</p>
        </div>
      </div>
      {props.children}
    </section>
  );
}

export function AdminSettingsForm(props: AdminSettingsFormProps): ReactElement {
  const [siteName, setSiteName] = useState<string>('');
  const [siteNameEnvDefault, setSiteNameEnvDefault] = useState<string>('TeqMD');
  const [diagnosticAiEnabled, setDiagnosticAiEnabled] = useState<boolean>(false);
  const [diagnosticManageBookingEnabled, setDiagnosticManageBookingEnabled] = useState<boolean>(false);
  const [supportModuleEnabled, setSupportModuleEnabled] = useState<boolean>(false);
  const [reviewsModuleEnabled, setReviewsModuleEnabled] = useState<boolean>(false);
  const [bookingSessionRoomLinksEnabled, setBookingSessionRoomLinksEnabled] = useState<boolean>(true);
  const [diagnosticMaxRounds, setDiagnosticMaxRounds] = useState<number>(4);
  const [diagnosticQuestionsPerRound, setDiagnosticQuestionsPerRound] = useState<number>(5);
  const [diagnosticOptionsPerQuestion, setDiagnosticOptionsPerQuestion] = useState<number>(4);
  const [diagnosticCacheDebugEnabled, setDiagnosticCacheDebugEnabled] = useState<boolean>(false);
  const [savedSnapshot, setSavedSnapshot] = useState<SettingsPayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const onStateChangeRef = useRef(props.onStateChange);
  useEffect(() => {
    onStateChangeRef.current = props.onStateChange;
  }, [props.onStateChange]);
  const currentPayload: SettingsPayload = useMemo(
    () => ({
      siteName,
      siteNameEnvDefault,
      diagnosticAiEnabled,
      diagnosticManageBookingEnabled,
      supportModuleEnabled,
      reviewsModuleEnabled,
      bookingSessionRoomLinksEnabled,
      diagnosticMaxRounds,
      diagnosticQuestionsPerRound,
      diagnosticOptionsPerQuestion,
      diagnosticCacheDebugEnabled,
    }),
    [
      siteName,
      siteNameEnvDefault,
      diagnosticAiEnabled,
      diagnosticManageBookingEnabled,
      supportModuleEnabled,
      reviewsModuleEnabled,
      bookingSessionRoomLinksEnabled,
      diagnosticCacheDebugEnabled,
      diagnosticMaxRounds,
      diagnosticOptionsPerQuestion,
      diagnosticQuestionsPerRound,
    ],
  );
  const isDirty = savedSnapshot !== null && !areSettingsEqual(currentPayload, savedSnapshot);
  useEffect(() => {
    let cancelled = false;
    void fetch(ADMIN_SETTINGS_API_URL)
      .then(async (response) => {
        const data = (await response.json()) as SettingsPayload & { error?: string };
        if (!response.ok) {
          throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load settings');
        }
        return data;
      })
      .then((data) => {
        if (!cancelled) {
          const snapshot: SettingsPayload = {
            siteName: typeof data.siteName === 'string' ? data.siteName : '',
            siteNameEnvDefault: typeof data.siteNameEnvDefault === 'string' ? data.siteNameEnvDefault : 'TeqMD',
            diagnosticAiEnabled: typeof data.diagnosticAiEnabled === 'boolean' ? data.diagnosticAiEnabled : false,
            diagnosticManageBookingEnabled:
              typeof data.diagnosticManageBookingEnabled === 'boolean' ? data.diagnosticManageBookingEnabled : false,
            supportModuleEnabled:
              typeof data.supportModuleEnabled === 'boolean' ? data.supportModuleEnabled : false,
            reviewsModuleEnabled:
              typeof data.reviewsModuleEnabled === 'boolean' ? data.reviewsModuleEnabled : false,
            bookingSessionRoomLinksEnabled:
              typeof data.bookingSessionRoomLinksEnabled === 'boolean'
                ? data.bookingSessionRoomLinksEnabled
                : true,
            diagnosticMaxRounds: data.diagnosticMaxRounds,
            diagnosticQuestionsPerRound: data.diagnosticQuestionsPerRound,
            diagnosticOptionsPerQuestion:
              typeof data.diagnosticOptionsPerQuestion === 'number' ? data.diagnosticOptionsPerQuestion : 4,
            diagnosticCacheDebugEnabled: data.diagnosticCacheDebugEnabled,
          };
          setSiteName(snapshot.siteName);
          setSiteNameEnvDefault(snapshot.siteNameEnvDefault);
          setDiagnosticAiEnabled(snapshot.diagnosticAiEnabled);
          setDiagnosticManageBookingEnabled(snapshot.diagnosticManageBookingEnabled);
          setSupportModuleEnabled(snapshot.supportModuleEnabled);
          setReviewsModuleEnabled(snapshot.reviewsModuleEnabled);
          setBookingSessionRoomLinksEnabled(snapshot.bookingSessionRoomLinksEnabled);
          setDiagnosticMaxRounds(snapshot.diagnosticMaxRounds);
          setDiagnosticQuestionsPerRound(snapshot.diagnosticQuestionsPerRound);
          setDiagnosticOptionsPerQuestion(snapshot.diagnosticOptionsPerQuestion);
          setDiagnosticCacheDebugEnabled(snapshot.diagnosticCacheDebugEnabled);
          setSavedSnapshot(snapshot);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          notifyError(error instanceof Error ? error.message : 'Failed to load settings.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const executeSave = useCallback(async (): Promise<void> => {
    setIsSaving(true);
    try {
      const response = await fetch(ADMIN_SETTINGS_API_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteName,
          diagnosticAiEnabled,
          diagnosticManageBookingEnabled,
          supportModuleEnabled,
          reviewsModuleEnabled,
          bookingSessionRoomLinksEnabled,
          diagnosticMaxRounds,
          diagnosticQuestionsPerRound,
          diagnosticOptionsPerQuestion,
          diagnosticCacheDebugEnabled,
        }),
      });
      const data = (await response.json()) as SettingsPayload & { error?: string };
      if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Save failed');
      }
      const snapshot: SettingsPayload = {
        siteName: typeof data.siteName === 'string' ? data.siteName : '',
        siteNameEnvDefault: typeof data.siteNameEnvDefault === 'string' ? data.siteNameEnvDefault : siteNameEnvDefault,
        diagnosticAiEnabled: data.diagnosticAiEnabled,
        diagnosticManageBookingEnabled: data.diagnosticManageBookingEnabled,
        supportModuleEnabled: data.supportModuleEnabled,
        reviewsModuleEnabled: data.reviewsModuleEnabled,
        bookingSessionRoomLinksEnabled: data.bookingSessionRoomLinksEnabled,
        diagnosticMaxRounds: data.diagnosticMaxRounds,
        diagnosticQuestionsPerRound: data.diagnosticQuestionsPerRound,
        diagnosticOptionsPerQuestion: data.diagnosticOptionsPerQuestion,
        diagnosticCacheDebugEnabled: data.diagnosticCacheDebugEnabled,
      };
      setSiteName(snapshot.siteName);
      setSiteNameEnvDefault(snapshot.siteNameEnvDefault);
      setDiagnosticAiEnabled(snapshot.diagnosticAiEnabled);
      setDiagnosticManageBookingEnabled(snapshot.diagnosticManageBookingEnabled);
      setSupportModuleEnabled(snapshot.supportModuleEnabled);
      setReviewsModuleEnabled(snapshot.reviewsModuleEnabled);
      setBookingSessionRoomLinksEnabled(snapshot.bookingSessionRoomLinksEnabled);
      setDiagnosticMaxRounds(snapshot.diagnosticMaxRounds);
      setDiagnosticQuestionsPerRound(snapshot.diagnosticQuestionsPerRound);
      setDiagnosticOptionsPerQuestion(snapshot.diagnosticOptionsPerQuestion);
      setDiagnosticCacheDebugEnabled(snapshot.diagnosticCacheDebugEnabled);
      setSavedSnapshot(snapshot);
      notifySuccess('Settings saved.');
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : 'Save failed.');
    } finally {
      setIsSaving(false);
    }
  }, [
    diagnosticAiEnabled,
    diagnosticCacheDebugEnabled,
    diagnosticManageBookingEnabled,
    supportModuleEnabled,
    reviewsModuleEnabled,
    bookingSessionRoomLinksEnabled,
    diagnosticMaxRounds,
    diagnosticOptionsPerQuestion,
    diagnosticQuestionsPerRound,
    siteName,
    siteNameEnvDefault,
  ]);
  const executeReset = useCallback((): void => {
    if (savedSnapshot === null) {
      return;
    }
    setSiteName(savedSnapshot.siteName);
    setSiteNameEnvDefault(savedSnapshot.siteNameEnvDefault);
    setDiagnosticAiEnabled(savedSnapshot.diagnosticAiEnabled);
    setDiagnosticManageBookingEnabled(savedSnapshot.diagnosticManageBookingEnabled);
    setSupportModuleEnabled(savedSnapshot.supportModuleEnabled);
    setReviewsModuleEnabled(savedSnapshot.reviewsModuleEnabled);
    setBookingSessionRoomLinksEnabled(savedSnapshot.bookingSessionRoomLinksEnabled);
    setDiagnosticMaxRounds(savedSnapshot.diagnosticMaxRounds);
    setDiagnosticQuestionsPerRound(savedSnapshot.diagnosticQuestionsPerRound);
    setDiagnosticOptionsPerQuestion(savedSnapshot.diagnosticOptionsPerQuestion);
    setDiagnosticCacheDebugEnabled(savedSnapshot.diagnosticCacheDebugEnabled);
  }, [savedSnapshot]);
  useImperativeHandle(
    props.formRef,
    () => ({
      save: executeSave,
      reset: executeReset,
    }),
    [executeReset, executeSave],
  );
  useEffect(() => {
    onStateChangeRef.current?.({
      isDirty,
      isSaving,
      isLoading,
    });
  }, [isDirty, isLoading, isSaving]);
  if (isLoading) {
    return <AdminFormLoadingPanel label="Loading settings" variant="cards" />;
  }
  return (
    <div className="space-y-6">
      <SettingsCard
        icon={<Building2 className="size-5" aria-hidden />}
        title="Site"
        description="Public brand name used in transactional email sender names, message copy, and related customer-facing content."
      >
        <div className="space-y-2">
          <AdminSettingsLabel
            htmlFor="siteName"
            hint="Leave blank to use the environment default. Email From headers use this as the display name."
          >
            Site name
          </AdminSettingsLabel>
          <Input
            id="siteName"
            type="text"
            autoComplete="organization"
            placeholder={siteNameEnvDefault}
            value={siteName}
            onChange={(event) => {
              setSiteName(event.target.value);
            }}
          />
        </div>
      </SettingsCard>
      <SettingsCard
        icon={<LayoutTemplate className="size-5" aria-hidden />}
        title="Intake mode"
        description="Choose whether customers follow a fixed template or AI-generated follow-up questions on web and native."
      >
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-2xl border border-border bg-background p-4">
            <input
              id="diagnosticAiEnabled"
              type="checkbox"
              checked={diagnosticAiEnabled}
              onChange={(event) => {
                setDiagnosticAiEnabled(event.target.checked);
              }}
              className="mt-1 size-4 rounded border-input"
            />
            <div>
              <AdminSettingsLabel
                htmlFor="diagnosticAiEnabled"
                hint={
                  <>
                    When enabled, the quiz generates question blocks with AI. When disabled, customers use the active
                    diagnostic template from Templates.
                  </>
                }
              >
                AI diagnostic
              </AdminSettingsLabel>
            </div>
          </div>
          {diagnosticAiEnabled ? (
            <div className="space-y-4 rounded-2xl border border-border bg-background p-4">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-medium text-foreground">AI generation limits</h3>
                <AdminSettingsHint>Defaults: 4 rounds, 5 questions per round, 4 options per question.</AdminSettingsHint>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                  <AdminSettingsLabel
                    htmlFor="diagnosticMaxRounds"
                    hint={
                      <>
                        Completion required after this many rounds ({DIAGNOSTIC_MAX_ROUNDS_MIN}–
                        {DIAGNOSTIC_MAX_ROUNDS_MAX}).
                      </>
                    }
                  >
                    Maximum rounds
                  </AdminSettingsLabel>
                  <Input
                    id="diagnosticMaxRounds"
                    type="number"
                    min={DIAGNOSTIC_MAX_ROUNDS_MIN}
                    max={DIAGNOSTIC_MAX_ROUNDS_MAX}
                    value={diagnosticMaxRounds}
                    onChange={(event) => {
                      setDiagnosticMaxRounds(Number.parseInt(event.target.value, 10) || DIAGNOSTIC_MAX_ROUNDS_MIN);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <AdminSettingsLabel
                    htmlFor="diagnosticQuestionsPerRound"
                    hint={
                      <>
                        Range {DIAGNOSTIC_QUESTIONS_PER_ROUND_MIN}–{DIAGNOSTIC_QUESTIONS_PER_ROUND_MAX}.
                      </>
                    }
                  >
                    Questions per round
                  </AdminSettingsLabel>
                  <Input
                    id="diagnosticQuestionsPerRound"
                    type="number"
                    min={DIAGNOSTIC_QUESTIONS_PER_ROUND_MIN}
                    max={DIAGNOSTIC_QUESTIONS_PER_ROUND_MAX}
                    value={diagnosticQuestionsPerRound}
                    onChange={(event) => {
                      setDiagnosticQuestionsPerRound(
                        Number.parseInt(event.target.value, 10) || DIAGNOSTIC_QUESTIONS_PER_ROUND_MIN,
                      );
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <AdminSettingsLabel
                    htmlFor="diagnosticOptionsPerQuestion"
                    hint={
                      <>
                        Range {DIAGNOSTIC_OPTIONS_PER_QUESTION_MIN}–{DIAGNOSTIC_OPTIONS_PER_QUESTION_MAX}.
                      </>
                    }
                  >
                    Options per question
                  </AdminSettingsLabel>
                  <Input
                    id="diagnosticOptionsPerQuestion"
                    type="number"
                    min={DIAGNOSTIC_OPTIONS_PER_QUESTION_MIN}
                    max={DIAGNOSTIC_OPTIONS_PER_QUESTION_MAX}
                    value={diagnosticOptionsPerQuestion}
                    onChange={(event) => {
                      setDiagnosticOptionsPerQuestion(
                        Number.parseInt(event.target.value, 10) || DIAGNOSTIC_OPTIONS_PER_QUESTION_MIN,
                      );
                    }}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </SettingsCard>
      <SettingsCard
        icon={<CalendarDays className="size-5" aria-hidden />}
        title="Manage booking"
        description="Control whether guests can open the manage-booking page, look up reservations, and pay outstanding balances."
      >
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-background p-4">
          <input
            id="diagnosticManageBookingEnabled"
            type="checkbox"
            checked={diagnosticManageBookingEnabled}
            onChange={(event) => {
              setDiagnosticManageBookingEnabled(event.target.checked);
            }}
            className="mt-1 size-4 rounded border-input"
          />
          <div>
            <AdminSettingsLabel
              htmlFor="diagnosticManageBookingEnabled"
              hint={
                <>
                  When disabled, the manage-booking page returns 404, navigation links are hidden, and manage-booking
                  APIs reject requests.
                </>
              }
            >
              Enable manage booking
            </AdminSettingsLabel>
          </div>
        </div>
      </SettingsCard>
      <SettingsCard
        icon={<Video className="size-5" aria-hidden />}
        title="Video meeting links"
        description="Choose whether clients join through your branded session room or a direct Google Meet / Zoom / Teams link."
      >
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-background p-4">
          <input
            id="bookingSessionRoomLinksEnabled"
            type="checkbox"
            checked={bookingSessionRoomLinksEnabled}
            onChange={(event) => {
              setBookingSessionRoomLinksEnabled(event.target.checked);
            }}
            className="mt-1 size-4 rounded border-input"
          />
          <div>
            <AdminSettingsLabel
              htmlFor="bookingSessionRoomLinksEnabled"
              hint={
                <>
                  When enabled, confirmation emails, calendar invites, and booking success screens link to{' '}
                  <code className="text-xs">/book/session</code> so clients verify setup before joining. When disabled,
                  those links use the direct video meeting URL from Google Meet, Zoom, or Teams.
                </>
              }
            >
              Use session room for join links
            </AdminSettingsLabel>
          </div>
        </div>
      </SettingsCard>
      <SettingsCard
        icon={<Headphones className="size-5" aria-hidden />}
        title="Support reports"
        description="Control whether users can submit in-app support reports, view My reports, and send follow-up messages."
      >
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-background p-4">
          <input
            id="supportModuleEnabled"
            type="checkbox"
            checked={supportModuleEnabled}
            onChange={(event) => {
              setSupportModuleEnabled(event.target.checked);
            }}
            className="mt-1 size-4 rounded border-input"
          />
          <div>
            <AdminSettingsLabel
              htmlFor="supportModuleEnabled"
              hint={
                <>
                  When disabled, the Report button, My reports navigation, account report pages, and support APIs are
                  hidden or rejected. Admin support tools remain available.
                </>
              }
            >
              Enable support reports
            </AdminSettingsLabel>
          </div>
        </div>
      </SettingsCard>
      <SettingsCard
        icon={<MessageSquareQuote className="size-5" aria-hidden />}
        title="Marketing testimonials"
        description="Control whether the homepage can show a client testimonials section once published quotes exist."
      >
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-background p-4">
          <input
            id="reviewsModuleEnabled"
            type="checkbox"
            checked={reviewsModuleEnabled}
            onChange={(event) => {
              setReviewsModuleEnabled(event.target.checked);
            }}
            className="mt-1 size-4 rounded border-input"
          />
          <div>
            <AdminSettingsLabel
              htmlFor="reviewsModuleEnabled"
              hint={
                <>
                  When disabled, the homepage testimonials band stays hidden even if quotes are stored. When enabled,
                  the section appears only after at least one published testimonial exists in{' '}
                  <span className="font-medium text-foreground">Admin → Testimonials</span>.
                </>
              }
            >
              Enable marketing testimonials
            </AdminSettingsLabel>
          </div>
        </div>
      </SettingsCard>
      <SettingsCard
        icon={<Bug className="size-5" aria-hidden />}
        title="Developer"
        description="Optional tooling for cache provenance and API response debugging during development."
      >
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <input
            id="diagnosticCacheDebugEnabled"
            type="checkbox"
            checked={diagnosticCacheDebugEnabled}
            onChange={(event) => {
              setDiagnosticCacheDebugEnabled(event.target.checked);
            }}
            className="mt-1 size-4 rounded border-input"
          />
          <div>
            <AdminSettingsLabel
              htmlFor="diagnosticCacheDebugEnabled"
              hint={
                <>
                  Shows cache vs AI provenance on the public quiz. Successful API responses may include{' '}
                  <span className="font-mono text-[11px]">_diagnosticDebug</span>; headers always include tier/source.
                </>
              }
            >
              Diagnostic cache debug
            </AdminSettingsLabel>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}
