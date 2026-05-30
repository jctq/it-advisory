import { VISITOR_SESSION_CONFIG } from '@techmd/domain/visitor-session';

type AuthEmailPasswordInput = {
  readonly email: string;
  readonly password: string;
  readonly mergeGuestProgress?: boolean;
};

type AuthRegisterInput = AuthEmailPasswordInput & {
  readonly acceptedLegalTerms: true;
};

export type MarketingAuthUser = {
  readonly id: string;
  readonly email: string;
  readonly fullName: string | null;
  readonly company: string | null;
  readonly phone: string | null;
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

function normalizeMarketingUser(raw: unknown): MarketingAuthUser | null {
  if (raw === null || typeof raw !== 'object') {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === 'string' ? row.id : '';
  const email = typeof row.email === 'string' ? row.email : '';
  if (id.length === 0 || email.length === 0) {
    return null;
  }
  return {
    id,
    email,
    fullName: typeof row.fullName === 'string' ? row.fullName : null,
    company: typeof row.company === 'string' ? row.company : null,
    phone: typeof row.phone === 'string' ? row.phone : null,
  };
}

export type MarketingPatchProfileInput = {
  readonly email: string;
  readonly fullName: string;
  readonly company: string;
  readonly phone: string;
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

  public async register(input: AuthRegisterInput): Promise<{ readonly user: MarketingAuthUser; readonly sessionToken: string }> {
    return this.executeAuthSuccessRequest({
      pathname: '/api/auth/register',
      body: {
        email: input.email,
        password: input.password,
        mergeGuestProgress: input.mergeGuestProgress ?? true,
        acceptedLegalTerms: input.acceptedLegalTerms,
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
    return { user: normalizeMarketingUser(payload.user) };
  }

  public async patchProfile(sessionToken: string, input: MarketingPatchProfileInput): Promise<MarketingAuthUser> {
    const response = await fetch(this.buildUrl('/api/auth/profile'), {
      method: 'PATCH',
      headers: this.buildHeaders(sessionToken, true),
      body: JSON.stringify({
        email: input.email,
        fullName: input.fullName,
        company: input.company,
        phone: input.phone,
      }),
    });
    const payload = (await response.json()) as { readonly user?: unknown } & ErrorJson;
    if (!response.ok) {
      const message = payload.error ?? 'Request failed.';
      throw new Error(message);
    }
    const user = normalizeMarketingUser(payload.user);
    if (user === null) {
      throw new Error('Invalid profile response.');
    }
    return user;
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
    const user = normalizeMarketingUser(payload.user);
    if (user === null) {
      throw new Error('Invalid user payload.');
    }
    return { user, sessionToken: payload.sessionToken };
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
