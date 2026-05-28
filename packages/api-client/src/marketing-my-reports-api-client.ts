import { VISITOR_SESSION_CONFIG } from '@techmd/domain/visitor-session';

export type MarketingSupportReportReply = {
  readonly id: string;
  readonly message: string;
  readonly authorEmail: string;
  readonly isStaffReply: boolean;
  readonly createdAtIso: string;
};

export type MarketingSupportReportSummary = {
  readonly id: string;
  readonly messagePreview: string;
  readonly route: string;
  readonly source: 'native' | 'web';
  readonly hasScreenshot: boolean;
  readonly replyCount: number;
  readonly hasStaffReply: boolean;
  readonly hasUnreadStaffReply: boolean;
  readonly createdAtIso: string;
  readonly updatedAtIso: string;
};

export type MarketingSupportReportDetail = {
  readonly id: string;
  readonly message: string;
  readonly route: string;
  readonly source: 'native' | 'web';
  readonly hasScreenshot: boolean;
  readonly replies: readonly MarketingSupportReportReply[];
  readonly createdAtIso: string;
  readonly updatedAtIso: string;
};

export type MarketingMyReportsPage = {
  readonly reports: readonly MarketingSupportReportSummary[];
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
  readonly hasAnyReports: boolean;
  readonly unreadCount: number;
};

type MyReportsJson = MarketingMyReportsPage & {
  readonly error?: string;
};

export type MarketingSupportReportReplyPolicy = {
  readonly canReply: boolean;
  readonly allowReporterFollowUpReplies: boolean;
  readonly minIntervalSeconds: number;
  readonly maxPerHour: number;
  readonly cooldownRemainingSeconds: number;
  readonly hourlyCount: number;
  readonly hourlyRemaining: number;
  readonly blockReason: string | null;
};

export type MarketingSupportReportDetailWithPolicy = {
  readonly report: MarketingSupportReportDetail;
  readonly replyPolicy: MarketingSupportReportReplyPolicy;
};

type MyReportDetailJson = {
  readonly report?: MarketingSupportReportDetail;
  readonly replyPolicy?: MarketingSupportReportReplyPolicy;
  readonly error?: string;
};

export type MarketingSupportReportListStatusFilter = 'all' | 'awaiting_reply' | 'has_reply';

type FetchMyReportsParams = {
  readonly apiBaseUrl: string;
  readonly deviceId: string;
  readonly marketingSessionToken: string;
  readonly page?: number;
  readonly pageSize?: number;
  readonly search?: string;
  readonly status?: MarketingSupportReportListStatusFilter;
};

function buildAuthHeaders(deviceId: string, marketingSessionToken: string): HeadersInit {
  return {
    [VISITOR_SESSION_CONFIG.mobileDeviceIdHeaderName]: deviceId,
    Authorization: `Bearer ${marketingSessionToken}`,
  };
}

/**
 * Lists support reports filed by the signed-in marketing account.
 */
export async function fetchMarketingMyReports(params: FetchMyReportsParams): Promise<MarketingMyReportsPage> {
  const origin = params.apiBaseUrl.replace(/\/$/, '');
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  const search = params.search?.trim() ?? '';
  if (search.length > 0) {
    query.set('q', search);
  }
  if (params.status !== undefined && params.status !== 'all') {
    query.set('status', params.status);
  }
  const response = await fetch(`${origin}/api/support/my-reports?${query.toString()}`, {
    method: 'GET',
    headers: buildAuthHeaders(params.deviceId, params.marketingSessionToken),
  });
  const payload = (await response.json()) as MyReportsJson;
  if (!response.ok) {
    throw new Error(payload.error ?? 'Failed to load support reports.');
  }
  return {
    reports: payload.reports,
    totalCount: payload.totalCount,
    page: payload.page,
    pageSize: payload.pageSize,
    totalPages: payload.totalPages,
    hasAnyReports: payload.hasAnyReports,
    unreadCount: typeof payload.unreadCount === 'number' ? payload.unreadCount : 0,
  };
}

type UnreadCountJson = {
  readonly unreadCount?: number;
  readonly error?: string;
};

/**
 * Returns how many support reports have unread staff replies for the signed-in account.
 */
export async function fetchMarketingMyReportsUnreadCount(params: {
  readonly apiBaseUrl: string;
  readonly deviceId: string;
  readonly marketingSessionToken: string;
}): Promise<number> {
  const origin = params.apiBaseUrl.replace(/\/$/, '');
  const response = await fetch(`${origin}/api/support/my-reports/unread-count`, {
    method: 'GET',
    headers: buildAuthHeaders(params.deviceId, params.marketingSessionToken),
  });
  const payload = (await response.json()) as UnreadCountJson;
  if (!response.ok) {
    throw new Error(payload.error ?? 'Failed to load unread report count.');
  }
  return typeof payload.unreadCount === 'number' ? payload.unreadCount : 0;
}

/**
 * Loads one support report detail for the signed-in marketing account.
 */
export async function fetchMarketingMyReportById(params: {
  readonly apiBaseUrl: string;
  readonly deviceId: string;
  readonly marketingSessionToken: string;
  readonly reportId: string;
}): Promise<MarketingSupportReportDetailWithPolicy> {
  const origin = params.apiBaseUrl.replace(/\/$/, '');
  const response = await fetch(
    `${origin}/api/support/my-reports/${encodeURIComponent(params.reportId)}`,
    {
      method: 'GET',
      headers: buildAuthHeaders(params.deviceId, params.marketingSessionToken),
    },
  );
  const payload = (await response.json()) as MyReportDetailJson;
  if (!response.ok || payload.report === undefined || payload.replyPolicy === undefined) {
    throw new Error(payload.error ?? 'Failed to load support report.');
  }
  return {
    report: payload.report,
    replyPolicy: payload.replyPolicy,
  };
}

type PostMyReportReplyJson = {
  readonly ok?: boolean;
  readonly report?: MarketingSupportReportDetail;
  readonly replyPolicy?: MarketingSupportReportReplyPolicy;
  readonly error?: string;
  readonly code?: string;
  readonly retryAfterSeconds?: number;
};

/**
 * Sends a throttled follow-up message on a support report thread.
 */
export async function postMarketingMyReportReply(params: {
  readonly apiBaseUrl: string;
  readonly deviceId: string;
  readonly marketingSessionToken: string;
  readonly reportId: string;
  readonly message: string;
}): Promise<MarketingSupportReportDetailWithPolicy> {
  const origin = params.apiBaseUrl.replace(/\/$/, '');
  const response = await fetch(
    `${origin}/api/support/my-reports/${encodeURIComponent(params.reportId)}/reply`,
    {
      method: 'POST',
      headers: {
        ...buildAuthHeaders(params.deviceId, params.marketingSessionToken),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: params.message }),
    },
  );
  const payload = (await response.json()) as PostMyReportReplyJson;
  if (!response.ok || payload.report === undefined || payload.replyPolicy === undefined) {
    const error = new Error(payload.error ?? 'Failed to send follow-up message.');
    if (payload.code === 'rate_limited' && payload.retryAfterSeconds !== undefined) {
      (error as Error & { readonly retryAfterSeconds?: number }).retryAfterSeconds = payload.retryAfterSeconds;
    }
    throw error;
  }
  return {
    report: payload.report,
    replyPolicy: payload.replyPolicy,
  };
}
