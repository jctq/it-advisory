type QuizAnswers = Readonly<Record<string, string | string[] | number | boolean>>;

type PublicDiagnosticTemplateQuestionType = 'multiple-choice' | 'nested-options' | 'ranked-options';

type PublicDiagnosticTemplateVisibilityRule = {
  readonly sourceQuestionId: string;
  readonly optionIds: readonly string[];
  readonly match: 'any' | 'all';
} | null;

type PublicDiagnosticTemplateValue = {
  readonly id: string;
  readonly name: string;
  readonly rounds: readonly {
    readonly id: string;
    readonly title: string;
    readonly guidance: string | null;
    readonly showWhen: PublicDiagnosticTemplateVisibilityRule;
    readonly questions: readonly {
      readonly id: string;
      readonly prompt: string;
      readonly description: string | null;
      readonly showWhen: PublicDiagnosticTemplateVisibilityRule;
      readonly type: PublicDiagnosticTemplateQuestionType;
      readonly rankedOptionLimit: number | null;
      readonly selectionMode: 'single' | 'multiple';
      readonly options: readonly {
        readonly id: string;
        readonly label: string;
        readonly description: string | null;
        readonly requestDetailNoteWhenSelected: boolean;
        readonly showWhen: PublicDiagnosticTemplateVisibilityRule;
        readonly presentation: {
          readonly icon: string | null;
          readonly badgeText: string | null;
          readonly eyebrow: string | null;
          readonly title: string | null;
          readonly supportingText: string | null;
          readonly exampleBullets: readonly string[];
          readonly panelTitle: string | null;
        };
        readonly childQuestion: {
          readonly id: string;
          readonly prompt: string;
          readonly description: string | null;
          readonly selectionMode: 'single' | 'multiple';
          readonly options: readonly {
            readonly id: string;
            readonly label: string;
            readonly description: string | null;
          }[];
        } | null;
      }[];
    }[];
  }[];
};

type DiagnosticThreadRound = {
  readonly roundIndex: number;
  readonly qa: readonly {
    readonly questionId: string;
    readonly question: string;
    readonly answer: string;
  }[];
};

type QuizSessionLinkedBookingSlot = {
  readonly status: 'pending' | 'confirmed' | 'cancelled';
  readonly startsAtIso: string;
  readonly timezone: string;
  readonly serviceKey: string;
  readonly meetingUrl: string | null;
};

type QuizSessionPayload = {
  readonly session: {
    readonly answers: QuizAnswers;
    readonly currentStep: number;
  } | null;
  /** Encoded ref for `/diagnostic/[sessionRef]` and scoped template loads; omitted when no row or legacy response. */
  readonly sessionId?: string | null;
  readonly readOnly?: boolean;
  readonly linkedBookingSlot?: QuizSessionLinkedBookingSlot | null;
};

type SaveQuizSessionInput = {
  readonly answers: QuizAnswers;
  readonly currentStep: number;
  readonly completed: boolean;
};

type SaveQuizSessionPayload = {
  readonly sessionId: string | null;
  readonly persisted: boolean;
};

type DiagnosticRoundInput = {
  readonly initialPrompt: string;
  readonly rounds: readonly DiagnosticThreadRound[];
};

type DiagnosticRoundPayload =
  | {
      readonly complete: true;
      readonly mappedSituation: string;
      readonly summaryForAdvisor: string;
      readonly briefAssessment?: string;
      readonly sessionTitle?: string;
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

type DiagnosticConfigPayload = {
  readonly diagnosticAiEnabled: boolean;
  readonly diagnosticMaxRounds: number;
  readonly diagnosticQuestionsPerRound: number;
  readonly diagnosticOptionsPerQuestion: number;
  readonly diagnosticCacheDebugEnabled: boolean;
};

type DiagnosticTemplatePayload = {
  readonly template: PublicDiagnosticTemplateValue | null;
};

type DiagnosticTemplateSummaryInput = {
  readonly templateName: string;
  readonly initialPrompt: string;
  readonly rounds: readonly DiagnosticThreadRound[];
};

type DiagnosticTemplateSummaryPayload = {
  readonly mappedSituation: string;
  readonly summaryForAdvisor: string;
  readonly briefAssessment: string;
  readonly sessionTitle: string;
  readonly goodFitBullets: readonly string[];
  readonly source: 'ai' | 'cache' | 'fallback';
  readonly model: string | null;
};

type JsonRequestOptions = {
  readonly body?: unknown;
  readonly method?: 'GET' | 'PATCH' | 'POST';
  readonly pathname: string;
};

const MOBILE_DEVICE_ID_HEADER_NAME = 'x-device-id';

/**
 * Shared HTTP client for the public diagnostic experience.
 */
export class DiagnosticApiClient {
  private readonly apiOrigin: string;

  private readonly deviceId: string;

  private readonly marketingSessionToken: string | null;

  public constructor(input: {
    readonly apiOrigin: string;
    readonly deviceId: string;
    readonly marketingSessionToken?: string | null;
  }) {
    this.apiOrigin = input.apiOrigin.replace(/\/$/, '');
    this.deviceId = input.deviceId;
    this.marketingSessionToken = input.marketingSessionToken ?? null;
  }

  /**
   * Loads the persisted diagnostic session for this anonymous visitor.
   */
  public async fetchQuizSession(): Promise<QuizSessionPayload> {
    return this.executeJsonRequest<QuizSessionPayload>({
      pathname: '/api/quiz/session',
    });
  }

  /**
   * Loads a specific quiz session by opaque marketing ref (must belong to the current visitor or account).
   */
  public async fetchQuizSessionBySessionRef(sessionRef: string): Promise<QuizSessionPayload> {
    const trimmed = sessionRef.trim();
    const query = trimmed.length > 0 ? `?sessionId=${encodeURIComponent(trimmed)}` : '';
    return this.executeJsonRequest<QuizSessionPayload>({
      pathname: `/api/quiz/session${query}`,
    });
  }

  /**
   * Saves the current diagnostic progress for this anonymous visitor.
   */
  public async saveQuizSession(input: SaveQuizSessionInput): Promise<SaveQuizSessionPayload> {
    return this.executeJsonRequest<SaveQuizSessionPayload>({
      pathname: '/api/quiz/session',
      method: 'PATCH',
      body: {
        answers: input.answers,
        currentStep: input.currentStep,
        completed: input.completed,
      },
    });
  }

  /**
   * Requests the next diagnostic round or final recommendation outcome.
   */
  public async createDiagnosticRound(input: DiagnosticRoundInput): Promise<DiagnosticRoundPayload> {
    return this.executeJsonRequest<DiagnosticRoundPayload>({
      pathname: '/api/quiz/diagnostic-round',
      method: 'POST',
      body: input,
    });
  }

  /**
   * Loads customer-safe diagnostic configuration for mobile flows.
   */
  public async fetchDiagnosticConfig(): Promise<DiagnosticConfigPayload> {
    return this.executeJsonRequest<DiagnosticConfigPayload>({
      pathname: '/api/quiz/diagnostic-config',
    });
  }

  /**
   * Loads the diagnostic template for template mode: pinned to `marketingSessionRef` when provided,
   * otherwise the visitor’s latest session pin (if any), otherwise the globally active template.
   */
  public async fetchActiveDiagnosticTemplate(marketingSessionRef?: string | null): Promise<DiagnosticTemplatePayload> {
    const trimmed = marketingSessionRef?.trim() ?? '';
    const query = trimmed.length > 0 ? `?sessionId=${encodeURIComponent(trimmed)}` : '';
    return this.executeJsonRequest<DiagnosticTemplatePayload>({
      pathname: `/api/quiz/diagnostic-template${query}`,
    });
  }

  /**
   * Requests the final advisor summary for a completed template-based diagnostic flow.
   */
  public async createDiagnosticTemplateSummary(
    input: DiagnosticTemplateSummaryInput,
  ): Promise<DiagnosticTemplateSummaryPayload> {
    return this.executeJsonRequest<DiagnosticTemplateSummaryPayload>({
      pathname: '/api/quiz/diagnostic-template-summary',
      method: 'POST',
      body: input,
    });
  }

  private async executeJsonRequest<TResponse>(options: JsonRequestOptions): Promise<TResponse> {
    const response = await fetch(this.buildUrl(options.pathname), {
      method: options.method ?? 'GET',
      headers: this.buildHeaders(options.body !== undefined),
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    const payload = (await response.json()) as TResponse & {
      readonly details?: string;
      readonly error?: string;
    };
    if (!response.ok) {
      const message = payload.error ?? 'Request failed.';
      const detail = payload.details !== undefined ? ` ${payload.details}` : '';
      throw new Error(`${message}${detail}`);
    }
    return payload;
  }

  private buildHeaders(includeJsonContentType: boolean): Headers {
    const headers = new Headers();
    headers.set(MOBILE_DEVICE_ID_HEADER_NAME, this.deviceId);
    if (this.marketingSessionToken !== null && this.marketingSessionToken.length > 0) {
      headers.set('Authorization', `Bearer ${this.marketingSessionToken}`);
    }
    if (includeJsonContentType) {
      headers.set('Content-Type', 'application/json');
    }
    return headers;
  }

  private buildUrl(pathname: string): string {
    const normalizedPathname = pathname.startsWith('/') ? pathname : `/${pathname}`;
    return `${this.apiOrigin}${normalizedPathname}`;
  }
}
