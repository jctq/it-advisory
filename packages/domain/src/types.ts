import type { ObjectId } from 'mongodb';

export type QuizAnswers = Readonly<Record<string, string | string[] | number | boolean>>;

export type QuizSessionDocument = {
  _id?: ObjectId;
  visitorId: string;
  answers: QuizAnswers;
  currentStep: number;
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
  meetingUrl?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type AvailabilitySlotDocument = {
  _id?: ObjectId;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  capacity: number;
  bookedCount: number;
};

export type EmailSendDocument = {
  _id?: ObjectId;
  to: string;
  templateKey: string;
  payload: Readonly<Record<string, unknown>>;
  status: 'mock_sent' | 'failed';
  createdAt: Date;
};

export type DiagnosticTemplateOptionDocument = {
  id: string;
  label: string;
  order: number;
};

export type DiagnosticTemplateQuestionDocument = {
  id: string;
  prompt: string;
  order: number;
  options: DiagnosticTemplateOptionDocument[];
};

export type DiagnosticTemplateRoundDocument = {
  id: string;
  title: string;
  guidance: string | null;
  order: number;
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
