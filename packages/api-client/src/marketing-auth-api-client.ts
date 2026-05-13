import { VISITOR_SESSION_CONFIG } from '@it-advisory/domain/visitor-session';

type AuthEmailPasswordInput = {
  readonly email: string;
  readonly password: string;
  readonly mergeGuestProgress?: boolean;
};

export type MarketingAuthUser = {
  readonly id: string;
  readonly email: string;
};

type AuthSuccessJson = {
  readonly ok: true;
  readonly user: MarketingAuthUser;
  readonly sessionToken?: string;
  readonly sessionExpiresAt?: string;
};

type MeJson = {
  readonly user: MarketingAuthUser | null;
};

type ErrorJson = {
  readonly error?: string;
  readonly details?: unknown;
};

/**
 * HTTP client for marketing login, registration, session introspection, and logout (native Bearer flow).
 */
export class MarketingAuthApiClient {
  private readonly apiOrigin: string;

  private readonly deviceId: string;

  public constructor(input: { readonly apiOrigin: string; readonly deviceId: string }) {
    this.apiOrigin = input.apiOrigin.replace(/\/$/, '');
    this.deviceId = input.deviceId;
  }

  public async login(input: AuthEmailPasswordInput): Promise<{ readonly user: MarketingAuthUser; readonly sessionToken: string }> {
    return this.executeAuthSuccessRequest({
      pathname: '/api/auth/login',
      body: {
        email: input.email,
        password: input.password,
        mergeGuestProgress: input.mergeGuestProgress ?? true,
        returnSessionToken: true,
      },
    });
  }

  public async register(input: AuthEmailPasswordInput): Promise<{ readonly user: MarketingAuthUser; readonly sessionToken: string }> {
    return this.executeAuthSuccessRequest({
      pathname: '/api/auth/register',
      body: {
        email: input.email,
        password: input.password,
        mergeGuestProgress: input.mergeGuestProgress ?? true,
        returnSessionToken: true,
      },
    });
  }

  public async fetchMe(sessionToken: string): Promise<MeJson> {
    const response = await fetch(this.buildUrl('/api/auth/me'), {
      method: 'GET',
      headers: this.buildHeaders(sessionToken, false),
    });
    const payload = (await response.json()) as MeJson & ErrorJson;
    if (!response.ok) {
      const message = payload.error ?? 'Request failed.';
      throw new Error(message);
    }
    return { user: payload.user };
  }

  public async logout(sessionToken: string): Promise<void> {
    const response = await fetch(this.buildUrl('/api/auth/logout'), {
      method: 'POST',
      headers: this.buildHeaders(sessionToken, false),
    });
    const payload = (await response.json()) as { readonly ok?: boolean } & ErrorJson;
    if (!response.ok) {
      const message = payload.error ?? 'Request failed.';
      throw new Error(message);
    }
  }

  private async executeAuthSuccessRequest(params: {
    readonly pathname: string;
    readonly body: Record<string, unknown>;
  }): Promise<{ readonly user: MarketingAuthUser; readonly sessionToken: string }> {
    const response = await fetch(this.buildUrl(params.pathname), {
      method: 'POST',
      headers: this.buildHeaders(undefined, true),
      body: JSON.stringify(params.body),
    });
    const payload = (await response.json()) as AuthSuccessJson & ErrorJson;
    if (!response.ok) {
      const message = payload.error ?? 'Request failed.';
      throw new Error(message);
    }
    if (payload.sessionToken === undefined || payload.sessionToken.length === 0) {
      throw new Error('The server did not return a session token.');
    }
    return { user: payload.user, sessionToken: payload.sessionToken };
  }

  private buildHeaders(sessionToken: string | undefined, includeJson: boolean): Headers {
    const headers = new Headers();
    headers.set(VISITOR_SESSION_CONFIG.mobileDeviceIdHeaderName, this.deviceId);
    if (sessionToken !== undefined && sessionToken.length > 0) {
      headers.set('Authorization', `Bearer ${sessionToken}`);
    }
    if (includeJson) {
      headers.set('Content-Type', 'application/json');
    }
    return headers;
  }

  private buildUrl(pathname: string): string {
    const normalizedPathname = pathname.startsWith('/') ? pathname : `/${pathname}`;
    return `${this.apiOrigin}${normalizedPathname}`;
  }
}
