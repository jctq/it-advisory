import type { ObjectId } from 'mongodb';
import type { PaymentGatewayId, PaymentStatus } from './payment-types.js';

export type QuizAnswers = Readonly<Record<string, string | string[] | number | boolean>>;

export type QuizSessionDocument = {
  _id?: ObjectId;
  visitorId: string;
  answers: QuizAnswers;
  currentStep: number;
  /**
   * Diagnostic template row pinned to this session (first save / blank insert).
   * Public template loads use this id so admin “activate another template” does not break in-flight sessions.
   */
  diagnosticTemplateId?: ObjectId;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

/** Immutable audit row for every quiz submission / step advance. */
export type QuizAuditDocument = {
  _id?: ObjectId;
  visitorId: string;
  sessionId: ObjectId;
  step: number;
  answersSnapshot: QuizAnswers;
  createdAt: Date;
};

/** Latest quiz pointer per anonymous or logged-in visitor. */
export type VisitorSessionDocument = {
  _id?: ObjectId;
  visitorId: string;
  latestSessionId: ObjectId;
  updatedAt: Date;
};

export type RecommendationDocument = {
  _id?: ObjectId;
  visitorId: string;
  sessionId: ObjectId;
  serviceKey: string;
  summary: string;
  createdAt: Date;
};

export type LeadDocument = {
  _id?: ObjectId;
  visitorId: string;
  name: string;
  /** Set when the visitor completes the marketing checkout form; omitted on legacy placeholder leads. */
  email?: string;
  company: string;
  phone: string;
  source: string;
  createdAt: Date;
};

export type BookingDocument = {
  _id?: ObjectId;
  leadId: ObjectId;
  visitorId: string;
  serviceKey: string;
  startsAt: Date;
  timezone: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  /** Human-readable payment method from checkout (e.g. GCash); optional for legacy bookings. */
  paymentMethodLabel?: string | null;
  paymentStatus?: PaymentStatus | null;
  paymentGatewayId?: PaymentGatewayId | null;
  paymentTransactionId?: ObjectId | null;
  paymentProviderRef?: string | null;
  paymentExpiresAt?: Date | null;
  meetingUrl?: string;
  /** Raw guided diagnostic JSON (string or legacy object stringified) at booking time — full rounds, questions, options. */
  guidedDiagnosticSnapshot?: string | null;
  quizSessionId?: ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Legacy discrete slot inventory shape — not used by the rule-based advisor schedule.
 * Prefer {@link AdvisorBookingSettingsDocument} and `COLLECTIONS.advisorBookingSettings`.
 */
export type AvailabilitySlotDocument = {
  _id?: ObjectId;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  capacity: number;
  bookedCount: number;
};

/** `HH:mm` 24-hour strings, inclusive start, exclusive end semantics for generated slot starts. */
export type AdvisorDayTimeWindow = {
  readonly start: string;
  readonly end: string;
};

export type AdvisorWeekdayOverride =
  | { readonly kind: 'closed' }
  | { readonly kind: 'window'; readonly start: string; readonly end: string };

/**
 * Singleton persisted advisor availability for marketing booking (`_id` is the string `default`).
 */
export type AdvisorBookingSettingsDocument = {
  readonly _id: 'default';
  readonly timezone: string;
  /** JavaScript convention: 0 = Sunday … 6 = Saturday. Treated as non-working unless overridden. */
  readonly weekendDayIndices: readonly number[];
  readonly defaultWeekdayWindow: AdvisorDayTimeWindow;
  /** Sparse overrides by JS day-of-week (`'0'` … `'6'`). */
  readonly weekdayOverrides?: Readonly<Partial<Record<string, AdvisorWeekdayOverride>>>;
  /**
   * Calendar-date overrides in `timezone` (`yyyy-MM-dd` → closed or custom window).
   * Takes precedence over weekend and weekday rules for that date.
   */
  readonly dateWindowOverrides?: Readonly<Partial<Record<string, AdvisorWeekdayOverride>>>;
  readonly slotIntervalMinutes: 30 | 45 | 60 | 90;
  /** `yyyy-MM-dd` (calendar date in `timezone`) → max bookings that day; omitted keys = unlimited. */
  readonly dailyBookingCapOverrides?: Readonly<Record<string, number>>;
  /** ISO week key `RRRR-'W'II` in `timezone` → max bookings that week; omitted = unlimited. */
  readonly weeklyBookingCapOverrides?: Readonly<Record<string, number>>;
  readonly bookingHorizonDays: number;
  readonly updatedAt: Date;
};

export type EmailSendDocument = {
  _id?: ObjectId;
  to: string;
  templateKey: string;
  payload: Readonly<Record<string, unknown>>;
  /** `mock_sent` when no provider API key (audit-only). */
  status: 'mock_sent' | 'sent' | 'failed';
  /** Resend (or other provider) message id when `status` is `sent`. */
  providerMessageId?: string;
  createdAt: Date;
};

/** Marketing-site account (optional sign-in; diagnostics still work anonymously). */
export type UserAccountDocument = {
  _id?: ObjectId;
  emailNormalized: string;
  /** scrypt-derived key, hex-encoded salt + hash segments (see web app password helper). */
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
  /** Display name for bookings and profile (optional). */
  fullName?: string;
  company?: string;
  /** Philippine mobile in E.164 form (+639xxxxxxxxx), optional. */
  phone?: string;
};

/** Server-side session row backing the `it_auth_session` HTTP-only cookie. */
export type UserAuthSessionDocument = {
  _id?: ObjectId;
  userId: ObjectId;
  /** SHA-256 (hex) of the raw secret token bytes issued to the browser. */
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
};

export type DiagnosticTemplateChildQuestionOptionDocument = {
  id: string;
  label: string;
  description?: string | null;
  order: number;
};

export type DiagnosticTemplateQuestionType = 'multiple-choice' | 'nested-options' | 'ranked-options';

export type DiagnosticTemplateVisibilityMatchMode = 'any' | 'all';

export type DiagnosticTemplateVisibilityRuleDocument = {
  sourceQuestionId: string;
  optionIds: string[];
  match: DiagnosticTemplateVisibilityMatchMode;
};

export type DiagnosticTemplateOptionPresentationDocument = {
  icon?: string | null;
  badgeText?: string | null;
  eyebrow?: string | null;
  title?: string | null;
  supportingText?: string | null;
  exampleBullets?: string[];
  panelTitle?: string | null;
};

export type DiagnosticTemplateOptionDocument = {
  id: string;
  label: string;
  description?: string | null;
  order: number;
  /** When true, customers see the optional detail textbox only if this option is selected. At most one option per question should be true. */
  requestDetailNoteWhenSelected?: boolean;
  showWhen?: DiagnosticTemplateVisibilityRuleDocument | null;
  presentation?: DiagnosticTemplateOptionPresentationDocument;
  childQuestion?: DiagnosticTemplateChildQuestionDocument | null;
};

export type DiagnosticTemplateSelectionMode = 'single' | 'multiple';

export type DiagnosticTemplateChildQuestionDocument = {
  id: string;
  prompt: string;
  description?: string | null;
  selectionMode: DiagnosticTemplateSelectionMode;
  options: DiagnosticTemplateChildQuestionOptionDocument[];
};

export type DiagnosticTemplateQuestionDocument = {
  id: string;
  prompt: string;
  description?: string | null;
  order: number;
  showWhen?: DiagnosticTemplateVisibilityRuleDocument | null;
  type?: DiagnosticTemplateQuestionType;
  rankedOptionLimit?: number | null;
  selectionMode: DiagnosticTemplateSelectionMode;
  options: DiagnosticTemplateOptionDocument[];
};

export type DiagnosticTemplateRoundDocument = {
  id: string;
  title: string;
  guidance: string | null;
  order: number;
  showWhen?: DiagnosticTemplateVisibilityRuleDocument | null;
  questions: DiagnosticTemplateQuestionDocument[];
};

export type DiagnosticTemplateDocument = {
  _id?: ObjectId;
  name: string;
  isActive: boolean;
  rounds: DiagnosticTemplateRoundDocument[];
  createdAt: Date;
  updatedAt: Date;
};

/** How the diagnostic response was resolved (exact hash, vector neighbor, or fresh AI). */
export type DiagnosticRoundMatchTier = 'exact' | 'semantic' | 'ai';

/** Server/client metadata: cache vs AI and optional semantic/exact tier. */
export type DiagnosticRoundDebugMeta = {
  readonly source: 'cache' | 'ai';
  readonly matchTier: DiagnosticRoundMatchTier;
  /** Hash of the cache document served (exact key or semantic neighbor). */
  readonly threadHash: string;
  /** Hash for this request’s normalized thread (differs from `threadHash` when `matchTier` is `semantic`). */
  readonly queryThreadHash: string;
  readonly cacheVersion: string;
  /** Model id used when `source` is `ai`, or the model recorded when the cache row was written. */
  readonly model: string | null;
  /** Atlas vector similarity score when `matchTier` is `semantic`. */
  readonly semanticScore: number | null;
};

/** Stored JSON body for diagnostic-round responses (after server normalization). */
export type DiagnosticRoundCachedPayload =
  | {
      readonly complete: true;
      readonly mappedSituation: string;
      readonly summaryForAdvisor: string;
      /** Customer-facing hero line for the recommended session; omitted on legacy cache rows. */
      readonly briefAssessment?: string;
      /** Personalized headline; omitted on legacy cache rows. */
      readonly sessionTitle?: string;
      /** Three "good fit if" lines; omitted on legacy cache rows. */
      readonly goodFitBullets?: readonly string[];
      readonly guidance: string | null;
      readonly questions: readonly [];
    }
  | {
      readonly complete: false;
      readonly guidance: string | null;
      readonly questions: ReadonlyArray<{
        readonly id: string;
        readonly prompt: string;
        readonly options: readonly string[];
      }>;
    };

/** Cached AI output for template-based diagnostic completion (same inputs → same hash → no model call). */
export type DiagnosticTemplateSummaryCachedPayload = {
  readonly summaryForAdvisor: string;
  readonly briefAssessment: string;
  readonly sessionTitle: string;
  readonly mappedSituation: string;
  readonly goodFitBullets: readonly string[];
};

export type DiagnosticTemplateSummaryCacheDocument = {
  _id?: ObjectId;
  threadHash: string;
  cacheVersion: string;
  templateName: string;
  normalizedThread: string;
  model: string;
  response: DiagnosticTemplateSummaryCachedPayload;
  createdAt: Date;
  updatedAt: Date;
  hitCount: number;
};

/** Singleton document `_id: app` — persisted via admin `/admin/settings`. */
export type AppSettingsDocument = {
  _id: string;
  /** Added after initial deploy; defaults to true when omitted. */
  diagnosticAiEnabled?: boolean;
  diagnosticMaxRounds: number;
  diagnosticQuestionsPerRound: number;
  /** Added after initial deploy; omitted on older rows. */
  diagnosticOptionsPerQuestion?: number;
  diagnosticCacheDebugEnabled: boolean;
  updatedAt: Date;
};

/** Exact + semantic cache for diagnostic AI rounds — keyed by SHA-256 of normalized thread + cache version. */
export type DiagnosticRoundCacheDocument = {
  _id?: ObjectId;
  threadHash: string;
  cacheVersion: string;
  /** Number of completed rounds when this row was written (vector filter). Omitted on legacy rows. */
  roundsCompleted?: number;
  normalizedThread: string;
  model: string;
  response: DiagnosticRoundCachedPayload;
  /** OpenAI embedding of `normalizedThread`; dimensions match `embeddingModel`. */
  embedding?: readonly number[];
  embeddingModel?: string;
  createdAt: Date;
  updatedAt: Date;
  hitCount: number;
};
