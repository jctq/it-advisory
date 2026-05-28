import 'server-only';
import type { SupportReportRecord, SupportReportReplyRecord } from '@/lib/data/support-reports';
import type { SupportSettingsValues } from '@/lib/data/support-settings';
import type { SupportReportReporterReplyPolicy } from '@/lib/marketing/support-report-reporter-reply-policy-types';

const ONE_HOUR_MS = 60 * 60 * 1000;

export type { SupportReportReporterReplyPolicy } from '@/lib/marketing/support-report-reporter-reply-policy-types';

export class SupportReportReporterReplyThrottledError extends Error {
  readonly retryAfterSeconds: number;
  readonly policy: SupportReportReporterReplyPolicy;

  constructor(message: string, retryAfterSeconds: number, policy: SupportReportReporterReplyPolicy) {
    super(message);
    this.name = 'SupportReportReporterReplyThrottledError';
    this.retryAfterSeconds = retryAfterSeconds;
    this.policy = policy;
  }
}

function listReporterFollowUpReplies(replies: readonly SupportReportReplyRecord[]): readonly SupportReportReplyRecord[] {
  return replies.filter((reply) => !reply.isStaffReply);
}

function listReporterFollowUpsInLastHour(
  replies: readonly SupportReportReplyRecord[],
  nowMs: number,
): readonly SupportReportReplyRecord[] {
  const hourAgoMs = nowMs - ONE_HOUR_MS;
  return listReporterFollowUpReplies(replies).filter((reply) => new Date(reply.createdAtIso).getTime() > hourAgoMs);
}

/**
 * Computes whether a reporter may send another follow-up on this report.
 */
export function computeSupportReportReporterReplyPolicy(
  report: SupportReportRecord,
  settings: SupportSettingsValues,
  now: Date = new Date(),
): SupportReportReporterReplyPolicy {
  const nowMs = now.getTime();
  const minIntervalSeconds = settings.reporterReplyMinIntervalSeconds;
  const maxPerHour = settings.reporterReplyMaxPerHour;
  const followUps = listReporterFollowUpReplies(report.replies);
  const inLastHour = listReporterFollowUpsInLastHour(report.replies, nowMs);
  const hourlyCount = inLastHour.length;
  const hourlyRemaining = Math.max(0, maxPerHour - hourlyCount);
  if (!settings.allowReporterFollowUpReplies) {
    return {
      canReply: false,
      allowReporterFollowUpReplies: false,
      minIntervalSeconds,
      maxPerHour,
      cooldownRemainingSeconds: 0,
      hourlyCount,
      hourlyRemaining,
      blockReason: 'Follow-up messages are turned off for support reports.',
    };
  }
  if (hourlyCount >= maxPerHour) {
    const oldestMs = Math.min(...inLastHour.map((reply) => new Date(reply.createdAtIso).getTime()));
    const cooldownRemainingSeconds = Math.max(1, Math.ceil((oldestMs + ONE_HOUR_MS - nowMs) / 1000));
    return {
      canReply: false,
      allowReporterFollowUpReplies: true,
      minIntervalSeconds,
      maxPerHour,
      cooldownRemainingSeconds,
      hourlyCount,
      hourlyRemaining: 0,
      blockReason: `You can send up to ${maxPerHour} follow-ups per hour on this report. Try again later.`,
    };
  }
  const lastFollowUp = followUps.at(-1);
  if (lastFollowUp !== undefined) {
    const elapsedSeconds = (nowMs - new Date(lastFollowUp.createdAtIso).getTime()) / 1000;
    if (elapsedSeconds < minIntervalSeconds) {
      const cooldownRemainingSeconds = Math.max(1, Math.ceil(minIntervalSeconds - elapsedSeconds));
      return {
        canReply: false,
        allowReporterFollowUpReplies: true,
        minIntervalSeconds,
        maxPerHour,
        cooldownRemainingSeconds,
        hourlyCount,
        hourlyRemaining,
        blockReason: `Please wait ${cooldownRemainingSeconds} second${cooldownRemainingSeconds === 1 ? '' : 's'} before sending another message.`,
      };
    }
  }
  return {
    canReply: true,
    allowReporterFollowUpReplies: true,
    minIntervalSeconds,
    maxPerHour,
    cooldownRemainingSeconds: 0,
    hourlyCount,
    hourlyRemaining,
    blockReason: null,
  };
}

export function assertReporterCanSendFollowUp(
  report: SupportReportRecord,
  settings: SupportSettingsValues,
  now: Date = new Date(),
): SupportReportReporterReplyPolicy {
  const policy = computeSupportReportReporterReplyPolicy(report, settings, now);
  if (!policy.canReply) {
    throw new SupportReportReporterReplyThrottledError(
      policy.blockReason ?? 'You cannot send a follow-up message right now.',
      policy.cooldownRemainingSeconds,
      policy,
    );
  }
  return policy;
}
