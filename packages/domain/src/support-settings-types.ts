/** Singleton `_id: 'default'` — support report notification and reporter email policy. */
export type SupportSettingsDocument = {
  _id: string;
  /** Comma-separated inbox addresses notified on new reports. */
  notificationEmails: string;
  /** Send a confirmation email to the reporter when an address is known. */
  sendReporterConfirmationEmail: boolean;
  /** Send an email to the reporter when staff replies in admin. */
  sendReporterReplyEmail: boolean;
  /** Allow signed-in reporters to send follow-up messages in the report thread. */
  allowReporterFollowUpReplies: boolean;
  /** Minimum seconds between reporter follow-up messages on the same report. */
  reporterReplyMinIntervalSeconds: number;
  /** Maximum reporter follow-up messages per report per rolling hour. */
  reporterReplyMaxPerHour: number;
  /** Email staff when a reporter adds a follow-up in the thread. */
  sendStaffEmailOnReporterFollowUp: boolean;
  updatedAt: Date;
};
