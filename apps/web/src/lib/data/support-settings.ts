import 'server-only';
import { COLLECTIONS } from '@/domain/collections';
import type { SupportSettingsDocument } from '@/domain/support-settings-types';
import { parseEmailList } from '@/lib/email/parse-email-list';
import { getDb } from '@/lib/mongodb';

import {
  DEFAULT_REPORTER_REPLY_MAX_PER_HOUR,
  DEFAULT_REPORTER_REPLY_MIN_INTERVAL_SECONDS,
  MAX_REPORTER_REPLY_INTERVAL_SECONDS,
  MAX_REPORTER_REPLY_MAX_PER_HOUR,
  MIN_REPORTER_REPLY_INTERVAL_SECONDS,
  MIN_REPORTER_REPLY_MAX_PER_HOUR,
} from '@/lib/marketing/support-settings-constants';

export const SUPPORT_SETTINGS_DOCUMENT_ID = 'default';

export {
  DEFAULT_REPORTER_REPLY_MAX_PER_HOUR,
  DEFAULT_REPORTER_REPLY_MIN_INTERVAL_SECONDS,
  MAX_REPORTER_REPLY_INTERVAL_SECONDS,
  MAX_REPORTER_REPLY_MAX_PER_HOUR,
  MIN_REPORTER_REPLY_INTERVAL_SECONDS,
  MIN_REPORTER_REPLY_MAX_PER_HOUR,
} from '@/lib/marketing/support-settings-constants';

export type SupportSettingsValues = {
  readonly notificationEmails: string;
  readonly sendReporterConfirmationEmail: boolean;
  readonly sendReporterReplyEmail: boolean;
  readonly allowReporterFollowUpReplies: boolean;
  readonly reporterReplyMinIntervalSeconds: number;
  readonly reporterReplyMaxPerHour: number;
  readonly sendStaffEmailOnReporterFollowUp: boolean;
};

export type SupportSettingsAdminView = SupportSettingsValues & {
  readonly parsedNotificationEmails: readonly string[];
  readonly envFallbackEmails: readonly string[];
};

function defaultSupportSettings(): SupportSettingsValues {
  return {
    notificationEmails: '',
    sendReporterConfirmationEmail: true,
    sendReporterReplyEmail: true,
    allowReporterFollowUpReplies: true,
    reporterReplyMinIntervalSeconds: DEFAULT_REPORTER_REPLY_MIN_INTERVAL_SECONDS,
    reporterReplyMaxPerHour: DEFAULT_REPORTER_REPLY_MAX_PER_HOUR,
    sendStaffEmailOnReporterFollowUp: true,
  };
}

function normalizeReporterReplyMinIntervalSeconds(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_REPORTER_REPLY_MIN_INTERVAL_SECONDS;
  }
  return Math.min(
    MAX_REPORTER_REPLY_INTERVAL_SECONDS,
    Math.max(MIN_REPORTER_REPLY_INTERVAL_SECONDS, Math.round(value)),
  );
}

function normalizeReporterReplyMaxPerHour(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_REPORTER_REPLY_MAX_PER_HOUR;
  }
  return Math.min(MAX_REPORTER_REPLY_MAX_PER_HOUR, Math.max(MIN_REPORTER_REPLY_MAX_PER_HOUR, Math.round(value)));
}

function readEnvFallbackNotificationEmails(): readonly string[] {
  const raw = process.env.SUPPORT_REPORT_TO?.trim() ?? '';
  return parseEmailList(raw);
}

function mergeDocument(doc: SupportSettingsDocument | null): SupportSettingsValues {
  const base = defaultSupportSettings();
  if (doc === null) {
    return base;
  }
  return {
    notificationEmails: typeof doc.notificationEmails === 'string' ? doc.notificationEmails : base.notificationEmails,
    sendReporterConfirmationEmail:
      typeof doc.sendReporterConfirmationEmail === 'boolean'
        ? doc.sendReporterConfirmationEmail
        : base.sendReporterConfirmationEmail,
    sendReporterReplyEmail:
      typeof doc.sendReporterReplyEmail === 'boolean' ? doc.sendReporterReplyEmail : base.sendReporterReplyEmail,
    allowReporterFollowUpReplies:
      typeof doc.allowReporterFollowUpReplies === 'boolean'
        ? doc.allowReporterFollowUpReplies
        : base.allowReporterFollowUpReplies,
    reporterReplyMinIntervalSeconds: normalizeReporterReplyMinIntervalSeconds(doc.reporterReplyMinIntervalSeconds),
    reporterReplyMaxPerHour: normalizeReporterReplyMaxPerHour(doc.reporterReplyMaxPerHour),
    sendStaffEmailOnReporterFollowUp:
      typeof doc.sendStaffEmailOnReporterFollowUp === 'boolean'
        ? doc.sendStaffEmailOnReporterFollowUp
        : base.sendStaffEmailOnReporterFollowUp,
  };
}

export async function getSupportSettings(): Promise<SupportSettingsValues> {
  if (!process.env.MONGODB_URI) {
    return defaultSupportSettings();
  }
  const db = await getDb();
  const doc = await db
    .collection<SupportSettingsDocument>(COLLECTIONS.supportSettings)
    .findOne({ _id: SUPPORT_SETTINGS_DOCUMENT_ID });
  return mergeDocument(doc);
}

export async function getSupportSettingsAdminView(): Promise<SupportSettingsAdminView> {
  const values = await getSupportSettings();
  const parsedNotificationEmails = parseEmailList(values.notificationEmails);
  return {
    ...values,
    parsedNotificationEmails,
    envFallbackEmails: readEnvFallbackNotificationEmails(),
  };
}

/**
 * Resolves staff inboxes: admin-configured emails, else `SUPPORT_REPORT_TO` env.
 */
export async function resolveSupportNotificationEmails(): Promise<readonly string[]> {
  const settings = await getSupportSettings();
  const fromSettings = parseEmailList(settings.notificationEmails);
  if (fromSettings.length > 0) {
    return fromSettings;
  }
  return readEnvFallbackNotificationEmails();
}

export async function updateSupportSettings(patch: Partial<SupportSettingsValues>): Promise<SupportSettingsAdminView> {
  if (!process.env.MONGODB_URI) {
    throw new Error('MongoDB is not configured. Set MONGODB_URI to save support settings.');
  }
  const current = await getSupportSettings();
  const next: SupportSettingsValues = {
    notificationEmails: patch.notificationEmails ?? current.notificationEmails,
    sendReporterConfirmationEmail: patch.sendReporterConfirmationEmail ?? current.sendReporterConfirmationEmail,
    sendReporterReplyEmail: patch.sendReporterReplyEmail ?? current.sendReporterReplyEmail,
    allowReporterFollowUpReplies: patch.allowReporterFollowUpReplies ?? current.allowReporterFollowUpReplies,
    reporterReplyMinIntervalSeconds:
      patch.reporterReplyMinIntervalSeconds ?? current.reporterReplyMinIntervalSeconds,
    reporterReplyMaxPerHour: patch.reporterReplyMaxPerHour ?? current.reporterReplyMaxPerHour,
    sendStaffEmailOnReporterFollowUp:
      patch.sendStaffEmailOnReporterFollowUp ?? current.sendStaffEmailOnReporterFollowUp,
  };
  if (parseEmailList(next.notificationEmails).length === 0 && next.notificationEmails.trim().length > 0) {
    throw new Error('Enter valid email addresses separated by commas.');
  }
  if (
    next.reporterReplyMinIntervalSeconds < MIN_REPORTER_REPLY_INTERVAL_SECONDS ||
    next.reporterReplyMinIntervalSeconds > MAX_REPORTER_REPLY_INTERVAL_SECONDS
  ) {
    throw new Error(
      `Minimum interval must be between ${MIN_REPORTER_REPLY_INTERVAL_SECONDS} and ${MAX_REPORTER_REPLY_INTERVAL_SECONDS} seconds.`,
    );
  }
  if (
    next.reporterReplyMaxPerHour < MIN_REPORTER_REPLY_MAX_PER_HOUR ||
    next.reporterReplyMaxPerHour > MAX_REPORTER_REPLY_MAX_PER_HOUR
  ) {
    throw new Error(
      `Hourly limit must be between ${MIN_REPORTER_REPLY_MAX_PER_HOUR} and ${MAX_REPORTER_REPLY_MAX_PER_HOUR} messages.`,
    );
  }
  const db = await getDb();
  const row: SupportSettingsDocument = {
    _id: SUPPORT_SETTINGS_DOCUMENT_ID,
    notificationEmails: next.notificationEmails.trim(),
    sendReporterConfirmationEmail: next.sendReporterConfirmationEmail,
    sendReporterReplyEmail: next.sendReporterReplyEmail,
    allowReporterFollowUpReplies: next.allowReporterFollowUpReplies,
    reporterReplyMinIntervalSeconds: next.reporterReplyMinIntervalSeconds,
    reporterReplyMaxPerHour: next.reporterReplyMaxPerHour,
    sendStaffEmailOnReporterFollowUp: next.sendStaffEmailOnReporterFollowUp,
    updatedAt: new Date(),
  };
  await db.collection<SupportSettingsDocument>(COLLECTIONS.supportSettings).replaceOne({ _id: SUPPORT_SETTINGS_DOCUMENT_ID }, row, {
    upsert: true,
  });
  return getSupportSettingsAdminView();
}
