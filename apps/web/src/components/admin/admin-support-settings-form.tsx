'use client';

import { Headphones } from 'lucide-react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactElement,
  type Ref,
} from 'react';
import { AdminFormLoadingPanel } from '@/components/admin/admin-form-loading-panel';
import { AdminSettingsHint, AdminSettingsLabel } from '@/components/admin/admin-settings-hint';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  DEFAULT_REPORTER_REPLY_MAX_PER_HOUR,
  DEFAULT_REPORTER_REPLY_MIN_INTERVAL_SECONDS,
  MAX_REPORTER_REPLY_INTERVAL_SECONDS,
  MAX_REPORTER_REPLY_MAX_PER_HOUR,
  MIN_REPORTER_REPLY_INTERVAL_SECONDS,
  MIN_REPORTER_REPLY_MAX_PER_HOUR,
} from '@/lib/marketing/support-settings-constants';
import { buildApiUrl } from '@/lib/config/build-api-url';
import { notifyError, notifySuccess } from '@/lib/notify';

const SUPPORT_SETTINGS_API_URL = buildApiUrl('/api/admin/support-settings');

type SettingsPayload = {
  readonly notificationEmails: string;
  readonly sendReporterConfirmationEmail: boolean;
  readonly sendReporterReplyEmail: boolean;
  readonly allowReporterFollowUpReplies: boolean;
  readonly reporterReplyMinIntervalSeconds: number;
  readonly reporterReplyMaxPerHour: number;
  readonly sendStaffEmailOnReporterFollowUp: boolean;
  readonly parsedNotificationEmails: readonly string[];
  readonly envFallbackEmails: readonly string[];
};

export type AdminSupportSettingsFormState = {
  readonly isDirty: boolean;
  readonly isSaving: boolean;
  readonly isLoading: boolean;
};

export type AdminSupportSettingsFormHandle = {
  readonly save: () => Promise<void>;
  readonly reset: () => void;
};

type AdminSupportSettingsFormProps = {
  readonly onStateChange?: (state: AdminSupportSettingsFormState) => void;
  readonly formRef?: Ref<AdminSupportSettingsFormHandle>;
};

function AdminSupportSettingsFormInner(props: AdminSupportSettingsFormProps, ref: Ref<AdminSupportSettingsFormHandle>): ReactElement {
  const [loaded, setLoaded] = useState<SettingsPayload | null>(null);
  const [notificationEmails, setNotificationEmails] = useState('');
  const [sendReporterConfirmationEmail, setSendReporterConfirmationEmail] = useState(true);
  const [sendReporterReplyEmail, setSendReporterReplyEmail] = useState(true);
  const [allowReporterFollowUpReplies, setAllowReporterFollowUpReplies] = useState(true);
  const [reporterReplyMinIntervalSeconds, setReporterReplyMinIntervalSeconds] = useState(120);
  const [reporterReplyMaxPerHour, setReporterReplyMaxPerHour] = useState(6);
  const [sendStaffEmailOnReporterFollowUp, setSendStaffEmailOnReporterFollowUp] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const onStateChangeRef = useRef(props.onStateChange);
  useEffect(() => {
    onStateChangeRef.current = props.onStateChange;
  }, [props.onStateChange]);
  const executeLoad = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const response = await fetch(SUPPORT_SETTINGS_API_URL, { credentials: 'same-origin' });
      const payload = (await response.json()) as SettingsPayload & { readonly error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to load support settings.');
      }
      setLoaded(payload);
      setNotificationEmails(payload.notificationEmails);
      setSendReporterConfirmationEmail(payload.sendReporterConfirmationEmail);
      setSendReporterReplyEmail(payload.sendReporterReplyEmail);
      setAllowReporterFollowUpReplies(payload.allowReporterFollowUpReplies);
      setReporterReplyMinIntervalSeconds(payload.reporterReplyMinIntervalSeconds);
      setReporterReplyMaxPerHour(payload.reporterReplyMaxPerHour);
      setSendStaffEmailOnReporterFollowUp(payload.sendStaffEmailOnReporterFollowUp);
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : 'Failed to load support settings.');
    } finally {
      setIsLoading(false);
    }
  }, []);
  useEffect(() => {
    queueMicrotask(() => {
      void executeLoad();
    });
  }, [executeLoad]);
  const isDirty =
    loaded !== null &&
    (notificationEmails !== loaded.notificationEmails ||
      sendReporterConfirmationEmail !== loaded.sendReporterConfirmationEmail ||
      sendReporterReplyEmail !== loaded.sendReporterReplyEmail ||
      allowReporterFollowUpReplies !== loaded.allowReporterFollowUpReplies ||
      reporterReplyMinIntervalSeconds !== loaded.reporterReplyMinIntervalSeconds ||
      reporterReplyMaxPerHour !== loaded.reporterReplyMaxPerHour ||
      sendStaffEmailOnReporterFollowUp !== loaded.sendStaffEmailOnReporterFollowUp);
  useEffect(() => {
    onStateChangeRef.current?.({ isDirty, isSaving, isLoading });
  }, [isDirty, isLoading, isSaving]);
  const executeSave = useCallback(async (): Promise<void> => {
    setIsSaving(true);
    try {
      const response = await fetch(SUPPORT_SETTINGS_API_URL, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationEmails,
          sendReporterConfirmationEmail,
          sendReporterReplyEmail,
          allowReporterFollowUpReplies,
          reporterReplyMinIntervalSeconds,
          reporterReplyMaxPerHour,
          sendStaffEmailOnReporterFollowUp,
        }),
      });
      const payload = (await response.json()) as SettingsPayload & { readonly error?: string; readonly details?: string };
      if (!response.ok) {
        throw new Error(payload.details ?? payload.error ?? 'Failed to save support settings.');
      }
      setLoaded(payload);
      setNotificationEmails(payload.notificationEmails);
      setSendReporterConfirmationEmail(payload.sendReporterConfirmationEmail);
      setSendReporterReplyEmail(payload.sendReporterReplyEmail);
      setAllowReporterFollowUpReplies(payload.allowReporterFollowUpReplies);
      setReporterReplyMinIntervalSeconds(payload.reporterReplyMinIntervalSeconds);
      setReporterReplyMaxPerHour(payload.reporterReplyMaxPerHour);
      setSendStaffEmailOnReporterFollowUp(payload.sendStaffEmailOnReporterFollowUp);
      notifySuccess('Support settings saved.');
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : 'Failed to save support settings.');
    } finally {
      setIsSaving(false);
    }
  }, [
    allowReporterFollowUpReplies,
    notificationEmails,
    reporterReplyMaxPerHour,
    reporterReplyMinIntervalSeconds,
    sendReporterConfirmationEmail,
    sendReporterReplyEmail,
    sendStaffEmailOnReporterFollowUp,
  ]);
  const executeReset = useCallback((): void => {
    if (loaded === null) {
      return;
    }
    setNotificationEmails(loaded.notificationEmails);
    setSendReporterConfirmationEmail(loaded.sendReporterConfirmationEmail);
    setSendReporterReplyEmail(loaded.sendReporterReplyEmail);
    setAllowReporterFollowUpReplies(loaded.allowReporterFollowUpReplies);
    setReporterReplyMinIntervalSeconds(loaded.reporterReplyMinIntervalSeconds);
    setReporterReplyMaxPerHour(loaded.reporterReplyMaxPerHour);
    setSendStaffEmailOnReporterFollowUp(loaded.sendStaffEmailOnReporterFollowUp);
  }, [loaded]);
  useImperativeHandle(props.formRef ?? ref, () => ({ save: executeSave, reset: executeReset }), [executeReset, executeSave]);
  if (isLoading) {
    return <AdminFormLoadingPanel label="Loading support settings…" />;
  }
  const fallbackHint =
    loaded !== null && loaded.envFallbackEmails.length > 0
      ? ` When empty, falls back to SUPPORT_REPORT_TO (${loaded.envFallbackEmails.join(', ')}).`
      : ' When empty, set addresses here or configure SUPPORT_REPORT_TO in the server environment.';
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xs">
      <div className="flex gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40 text-muted-foreground">
          <Headphones className="size-5" aria-hidden />
        </div>
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-semibold text-foreground">Support reports</h2>
          <p className="text-sm text-muted-foreground">
            Configure who gets notified when users submit reports from the web or native app, and whether reporters
            receive email updates.
          </p>
        </div>
      </div>
      <div className="space-y-2">
        <AdminSettingsLabel htmlFor="support-notification-emails">Notification emails</AdminSettingsLabel>
        <Textarea
          id="support-notification-emails"
          rows={3}
          placeholder="support@example.com, ops@example.com"
          value={notificationEmails}
          onChange={(event) => setNotificationEmails(event.target.value)}
        />
        <AdminSettingsHint>
          Comma- or line-separated addresses. Each receives an email when a new report is submitted.{fallbackHint}
        </AdminSettingsHint>
        {loaded !== null && loaded.parsedNotificationEmails.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Active: {loaded.parsedNotificationEmails.join(', ')}
          </p>
        ) : null}
      </div>
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/70 bg-muted/20 p-4">
        <Checkbox
          checked={sendReporterConfirmationEmail}
          onCheckedChange={(checked) => setSendReporterConfirmationEmail(checked === true)}
        />
        <span className="space-y-1">
          <span className="block text-sm font-medium text-foreground">Confirmation email to reporter</span>
          <span className="block text-sm text-muted-foreground">
            When the user is signed in or provided an email, send a receipt with their message and report ID.
          </span>
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/70 bg-muted/20 p-4">
        <Checkbox
          checked={sendReporterReplyEmail}
          onCheckedChange={(checked) => setSendReporterReplyEmail(checked === true)}
        />
        <span className="space-y-1">
          <span className="block text-sm font-medium text-foreground">Email reporter on staff reply</span>
          <span className="block text-sm text-muted-foreground">
            Send the reply text to the reporter when you respond from Admin → Support reports.
          </span>
        </span>
      </label>
      <div className="space-y-3 rounded-xl border border-border/70 bg-muted/10 p-4">
        <p className="text-sm font-semibold text-foreground">Reporter follow-up messages</p>
        <p className="text-sm text-muted-foreground">
          Let signed-in users add messages in the report thread. Limits reduce spam and abuse.
        </p>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/70 bg-muted/20 p-4">
          <Checkbox
            checked={allowReporterFollowUpReplies}
            onCheckedChange={(checked) => setAllowReporterFollowUpReplies(checked === true)}
          />
          <span className="space-y-1">
            <span className="block text-sm font-medium text-foreground">Allow follow-up messages</span>
            <span className="block text-sm text-muted-foreground">
              When off, the conversation is read-only for reporters after they submit the initial report.
            </span>
          </span>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <AdminSettingsLabel htmlFor="support-reporter-reply-interval">Minimum seconds between messages</AdminSettingsLabel>
            <Input
              id="support-reporter-reply-interval"
              type="number"
              min={MIN_REPORTER_REPLY_INTERVAL_SECONDS}
              max={MAX_REPORTER_REPLY_INTERVAL_SECONDS}
              value={reporterReplyMinIntervalSeconds}
              onChange={(event) => setReporterReplyMinIntervalSeconds(Number(event.target.value))}
              disabled={!allowReporterFollowUpReplies}
            />
            <AdminSettingsHint>
              {MIN_REPORTER_REPLY_INTERVAL_SECONDS}–{MAX_REPORTER_REPLY_INTERVAL_SECONDS} seconds (default 120).
            </AdminSettingsHint>
          </div>
          <div className="space-y-2">
            <AdminSettingsLabel htmlFor="support-reporter-reply-hourly">Max follow-ups per hour (per report)</AdminSettingsLabel>
            <Input
              id="support-reporter-reply-hourly"
              type="number"
              min={MIN_REPORTER_REPLY_MAX_PER_HOUR}
              max={MAX_REPORTER_REPLY_MAX_PER_HOUR}
              value={reporterReplyMaxPerHour}
              onChange={(event) => setReporterReplyMaxPerHour(Number(event.target.value))}
              disabled={!allowReporterFollowUpReplies}
            />
            <AdminSettingsHint>
              Rolling 60-minute window per report thread (default 6).
            </AdminSettingsHint>
          </div>
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/70 bg-muted/20 p-4">
          <Checkbox
            checked={sendStaffEmailOnReporterFollowUp}
            onCheckedChange={(checked) => setSendStaffEmailOnReporterFollowUp(checked === true)}
            disabled={!allowReporterFollowUpReplies}
          />
          <span className="space-y-1">
            <span className="block text-sm font-medium text-foreground">Email staff on reporter follow-up</span>
            <span className="block text-sm text-muted-foreground">
              Notify the same inboxes as new reports when a user adds a message to an existing thread.
            </span>
          </span>
        </label>
      </div>
    </section>
  );
}

export const AdminSupportSettingsForm = forwardRef(AdminSupportSettingsFormInner);
