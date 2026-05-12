type QuizAnswers = Readonly<Record<string, string | string[] | number | boolean>>;

type DiagnosticThreadRound = {
  readonly roundIndex: number;
  readonly qa: readonly {
    readonly questionId: string;
    readonly question: string;
    readonly answer: string;
  }[];
};

type QuizSessionPayload = {
  readonly session: {
    readonly answers: QuizAnswers;
    readonly currentStep: number;
  } | null;
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

  public constructor(input: { readonly apiOrigin: string; readonly deviceId: string }) {
    this.apiOrigin = input.apiOrigin.replace(/\/$/, '');
    this.deviceId = input.deviceId;
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
