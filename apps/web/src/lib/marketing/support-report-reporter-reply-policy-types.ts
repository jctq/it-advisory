export type SupportReportReporterReplyPolicy = {
  readonly canReply: boolean;
  readonly allowReporterFollowUpReplies: boolean;
  readonly minIntervalSeconds: number;
  readonly maxPerHour: number;
  readonly cooldownRemainingSeconds: number;
  readonly hourlyCount: number;
  readonly hourlyRemaining: number;
  readonly blockReason: string | null;
};
