import 'server-only';
import { resolveConfiguredAppOrigin } from '@/lib/config/app-origin';
import { getAppSettings } from '@/lib/data/app-settings';
import type { SupportReportRecord } from '@/lib/data/support-reports';
import { getSupportSettings, resolveSupportNotificationEmails } from '@/lib/data/support-settings';
import {
  buildSupportEmailDetailRows,
  escapeSupportEmailHtml,
  wrapSupportEmailHtml,
} from '@/lib/email/support-report-email-html';
import { executeDispatchTransactionalEmail } from '@/lib/email/send-transactional-email';
import { resolveSiteName } from '@/lib/site/site-name';

function buildAdminReportUrl(reportId: string): string | null {
  const origin = resolveConfiguredAppOrigin();
  if (origin === null) {
    return null;
  }
  return `${origin.replace(/\/$/, '')}/admin/support-reports/${encodeURIComponent(reportId)}`;
}

function buildScreenshotAdminUrl(reportId: string): string | null {
  const origin = resolveConfiguredAppOrigin();
  if (origin === null) {
    return null;
  }
  return `${origin.replace(/\/$/, '')}/api/admin/support-reports/${encodeURIComponent(reportId)}/screenshot`;
}

async function resolveSiteNameForEmail(): Promise<string> {
  const appSettings = await getAppSettings();
  return resolveSiteName(appSettings.siteName);
}

async function executeSendToRecipient(input: {
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}): Promise<{ readonly sent: boolean; readonly errorMessage?: string }> {
  const outcome = await executeDispatchTransactionalEmail({
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
  if (outcome.kind === 'sent') {
    return { sent: true };
  }
  if (outcome.kind === 'failed') {
    return { sent: false, errorMessage: outcome.errorMessage };
  }
  return { sent: false, errorMessage: 'Transactional email is in audit-only mode.' };
}

/**
 * Notifies configured staff inboxes about a new support report.
 */
export async function executeSendSupportReportStaffEmails(
  report: SupportReportRecord,
): Promise<{ readonly attempted: number; readonly sent: number }> {
  const recipients = await resolveSupportNotificationEmails();
  if (recipients.length === 0) {
    return { attempted: 0, sent: 0 };
  }
  const siteName = await resolveSiteNameForEmail();
  const adminUrl = buildAdminReportUrl(report.id);
  const screenshotUrl = report.hasScreenshot ? buildScreenshotAdminUrl(report.id) : null;
  const detailRows: readonly (readonly [label: string, value: string])[] = [
    ['Source', report.source],
    ['Route', report.route],
    ['Report ID', report.id],
    ['Submitted', report.createdAtIso],
    ...(report.reporterName !== null ? ([['Reporter name', report.reporterName]] as const) : []),
    ...(report.reporterEmail !== null ? ([['Reporter email', report.reporterEmail]] as const) : []),
    ...(report.reporterMobile !== null ? ([['Reporter mobile', report.reporterMobile]] as const) : []),
    ...(report.reporterUserId !== null ? ([['Reporter user ID', report.reporterUserId]] as const) : []),
    ...(adminUrl !== null ? ([['Open in admin', adminUrl]] as const) : []),
    ...(screenshotUrl !== null ? ([['Screenshot', screenshotUrl]] as const) : []),
  ];
  const detailRowsHtml = buildSupportEmailDetailRows(detailRows);
  const html = wrapSupportEmailHtml({
    siteName,
    title: 'New support report',
    introHtml: '<p>A user submitted a new support report.</p>',
    detailRowsHtml,
    messageLabel: 'Message',
    message: report.message,
  });
  const text = [
    `${siteName} — new support report`,
    '',
    ...detailRows.map(([label, value]) => `${label}: ${value}`),
    '',
    'Message:',
    report.message,
  ].join('\n');
  const subject = `[${siteName}] Support report — ${report.source} — ${report.route}`;
  let sent = 0;
  for (const to of recipients) {
    const result = await executeSendToRecipient({ to, subject, html, text });
    if (result.sent) {
      sent += 1;
    }
  }
  return { attempted: recipients.length, sent };
}

/**
 * Sends a confirmation email to the reporter when we know their address.
 */
export async function executeSendSupportReportReporterConfirmationEmail(
  report: SupportReportRecord,
): Promise<{ readonly sent: boolean; readonly reason?: string }> {
  const settings = await getSupportSettings();
  if (!settings.sendReporterConfirmationEmail) {
    return { sent: false, reason: 'Reporter confirmation emails are disabled in support settings.' };
  }
  const reporterEmail = report.reporterEmail?.trim().toLowerCase() ?? '';
  if (reporterEmail.length === 0) {
    return { sent: false, reason: 'No reporter email on file.' };
  }
  const siteName = await resolveSiteNameForEmail();
  const adminUrl = buildAdminReportUrl(report.id);
  const detailRows: readonly (readonly [label: string, value: string])[] = [
    ['Report ID', report.id],
    ['Submitted', report.createdAtIso],
    ['Route', report.route],
  ];
  const html = wrapSupportEmailHtml({
    siteName,
    title: 'We received your report',
    introHtml: `<p>Hi,</p><p>Thanks for contacting ${escapeSupportEmailHtml(siteName)} support. We received your message and will follow up by email when there is an update.</p><p style="font-size:14px;color:#52525b;">Please keep report ID <strong>${escapeSupportEmailHtml(report.id)}</strong> for reference.</p>`,
    detailRowsHtml: buildSupportEmailDetailRows(detailRows),
    messageLabel: 'Your message',
    message: report.message,
  });
  const text = [
    `${siteName} — we received your support report`,
    '',
    `Report ID: ${report.id}`,
    `Submitted: ${report.createdAtIso}`,
    '',
    'Your message:',
    report.message,
    '',
    'We will email you when our team replies.',
  ].join('\n');
  const result = await executeSendToRecipient({
    to: reporterEmail,
    subject: `[${siteName}] Support report received — ${report.id}`,
    html,
    text,
  });
  if (result.sent) {
    return { sent: true };
  }
  return { sent: false, reason: result.errorMessage };
}

/**
 * Emails the reporter when staff adds a reply in admin.
 */
export async function executeSendSupportReportReporterReplyEmail(input: {
  readonly report: SupportReportRecord;
  readonly replyMessage: string;
}): Promise<{ readonly sent: boolean; readonly reason?: string }> {
  const settings = await getSupportSettings();
  if (!settings.sendReporterReplyEmail) {
    return { sent: false, reason: 'Reporter reply emails are disabled in support settings.' };
  }
  const reporterEmail = input.report.reporterEmail?.trim().toLowerCase() ?? '';
  if (reporterEmail.length === 0) {
    return { sent: false, reason: 'No reporter email on file.' };
  }
  const siteName = await resolveSiteNameForEmail();
  const detailRows = [['Report ID', input.report.id]] as const;
  const html = wrapSupportEmailHtml({
    siteName,
    title: 'Reply to your support report',
    introHtml: `<p>Hi,</p><p>Our team replied to your support report <strong>${escapeSupportEmailHtml(input.report.id)}</strong>.</p>`,
    detailRowsHtml: buildSupportEmailDetailRows(detailRows),
    messageLabel: 'Reply',
    message: input.replyMessage,
  });
  const text = [
    `${siteName} — reply to your support report`,
    '',
    `Report ID: ${input.report.id}`,
    '',
    'Reply:',
    input.replyMessage,
  ].join('\n');
  const result = await executeSendToRecipient({
    to: reporterEmail,
    subject: `[${siteName}] Re: support report ${input.report.id}`,
    html,
    text,
  });
  if (result.sent) {
    return { sent: true };
  }
  return { sent: false, reason: result.errorMessage };
}

/**
 * Emails staff when a reporter adds a follow-up in the thread.
 */
export async function executeSendSupportReportStaffFollowUpEmail(input: {
  readonly report: SupportReportRecord;
  readonly followUpMessage: string;
}): Promise<{ readonly attempted: number; readonly sent: number }> {
  const settings = await getSupportSettings();
  if (!settings.sendStaffEmailOnReporterFollowUp) {
    return { attempted: 0, sent: 0 };
  }
  const recipients = await resolveSupportNotificationEmails();
  if (recipients.length === 0) {
    return { attempted: 0, sent: 0 };
  }
  const siteName = await resolveSiteNameForEmail();
  const adminUrl = buildAdminReportUrl(input.report.id);
  const detailRows: readonly (readonly [label: string, value: string])[] = [
    ['Report ID', input.report.id],
    ['Route', input.report.route],
    ['Source', input.report.source],
    ...(input.report.reporterName !== null ? ([['Reporter name', input.report.reporterName]] as const) : []),
    ...(input.report.reporterEmail !== null ? ([['Reporter email', input.report.reporterEmail]] as const) : []),
    ...(input.report.reporterMobile !== null ? ([['Reporter mobile', input.report.reporterMobile]] as const) : []),
    ...(adminUrl !== null ? ([['Open in admin', adminUrl]] as const) : []),
  ];
  const html = wrapSupportEmailHtml({
    siteName,
    title: 'Reporter follow-up on support report',
    introHtml: '<p>A user added a follow-up message to an existing support report.</p>',
    detailRowsHtml: buildSupportEmailDetailRows(detailRows),
    messageLabel: 'Follow-up message',
    message: input.followUpMessage,
  });
  const text = [
    `${siteName} — reporter follow-up on support report ${input.report.id}`,
    '',
    ...detailRows.map(([label, value]) => `${label}: ${value}`),
    '',
    'Follow-up message:',
    input.followUpMessage,
  ].join('\n');
  const subject = `[${siteName}] Support follow-up — ${input.report.id}`;
  let sent = 0;
  for (const to of recipients) {
    const result = await executeSendToRecipient({ to, subject, html, text });
    if (result.sent) {
      sent += 1;
    }
  }
  return { attempted: recipients.length, sent };
}

/**
 * Staff notification + optional reporter confirmation after a new report is filed.
 */
export async function executeSendSupportReportSubmissionEmails(report: SupportReportRecord): Promise<void> {
  await executeSendSupportReportStaffEmails(report).catch(() => undefined);
  await executeSendSupportReportReporterConfirmationEmail(report).catch(() => undefined);
}
