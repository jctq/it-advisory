import { VISITOR_SESSION_CONFIG } from '@techmd/domain/visitor-session';

export type MarketingDiagnosticSessionSummary = {
  readonly id: string;
  readonly marketingSessionRef: string;
  readonly currentStep: number;
  readonly updatedAtIso: string;
  readonly completedAtIso: string | null;
  readonly sessionTitlePreview: string | null;
  readonly situationPreview: string | null;
  readonly situationLabel: string | null;
  readonly hasGuidedDiagnostic: boolean;
  readonly isBooked: boolean;
  readonly bookingId: string | null;
  readonly bookingReferenceId: string | null;
  readonly bookingStatus: 'pending' | 'confirmed' | 'cancelled' | null;
  readonly bookingStartsAtIso: string | null;
  readonly bookingTimezone: string | null;
  readonly bookingServiceKey: string | null;
  readonly bookingMeetingUrl: string | null;
};

export type MarketingMyDiagnosticsPage = {
  readonly sessions: readonly MarketingDiagnosticSessionSummary[];
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
  readonly hasAnySessions: boolean;
};

type MySessionsJson = MarketingMyDiagnosticsPage & {
  readonly error?: string;
};

type FetchMyDiagnosticsParams = {
  readonly apiBaseUrl: string;
  readonly deviceId: string;
  readonly marketingSessionToken: string;
  readonly page?: number;
  readonly pageSize?: number;
  readonly status?: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'all';
};

/**
 * Lists diagnostic quiz sessions for the signed-in marketing account.
 */
export async function fetchMarketingMyDiagnosticSessions(params: FetchMyDiagnosticsParams): Promise<MarketingMyDiagnosticsPage> {
  const origin = params.apiBaseUrl.replace(/\/$/, '');
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 50;
  const status = params.status ?? 'all';
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    status,
  });
  const response = await fetch(`${origin}/api/quiz/my-sessions?${query.toString()}`, {
    method: 'GET',
    headers: {
      [VISITOR_SESSION_CONFIG.mobileDeviceIdHeaderName]: params.deviceId,
      Authorization: `Bearer ${params.marketingSessionToken}`,
    },
  });
  const payload = (await response.json()) as MySessionsJson;
  if (!response.ok) {
    throw new Error(payload.error ?? 'Failed to load diagnostic sessions.');
  }
  return {
    sessions: payload.sessions,
    totalCount: payload.totalCount,
    page: payload.page,
    pageSize: payload.pageSize,
    totalPages: payload.totalPages,
    hasAnySessions: payload.hasAnySessions,
  };
}
