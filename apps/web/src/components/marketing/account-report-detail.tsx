'use client';

import Link from 'next/link';
import { ImageIcon, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactElement } from 'react';
import { AppImageLightboxCard } from '@/components/ui/app-image-lightbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { buildApiUrl } from '@/lib/config/build-api-url';
import type { SupportReportRecord, SupportReportReplyRecord } from '@/lib/data/support-reports';
import type { SupportReportReporterReplyPolicy } from '@/lib/marketing/support-report-reporter-reply-policy-types';
import { cn } from '@/lib/utils';

type AccountReportDetailProps = {
  readonly report: SupportReportRecord;
  readonly initialReplyPolicy: SupportReportReporterReplyPolicy;
};

type SupportChatMessage = {
  readonly id: string;
  readonly role: 'user' | 'staff' | 'attachment';
  readonly label: string;
  readonly body: string | null;
  readonly createdAtIso: string;
  readonly screenshotUrl: string | null;
};

type ReplyApiResponse = {
  readonly ok?: boolean;
  readonly report?: SupportReportRecord;
  readonly replyPolicy?: SupportReportReporterReplyPolicy;
  readonly error?: string;
  readonly code?: string;
  readonly retryAfterSeconds?: number;
};

const CHAT_TIME_FORMATTER = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Manila',
});

function formatChatTime(iso: string): string {
  return CHAT_TIME_FORMATTER.format(new Date(iso));
}

function buildSupportChatMessages(report: SupportReportRecord, screenshotUrl: string | null): readonly SupportChatMessage[] {
  const messages: SupportChatMessage[] = [
    {
      id: `report-${report.id}`,
      role: 'user',
      label: 'You',
      body: report.message,
      createdAtIso: report.createdAtIso,
      screenshotUrl: null,
    },
  ];
  if (screenshotUrl !== null) {
    messages.push({
      id: `screenshot-${report.id}`,
      role: 'attachment',
      label: 'You',
      body: null,
      createdAtIso: report.createdAtIso,
      screenshotUrl,
    });
  }
  for (const reply of report.replies) {
    messages.push(mapReplyToChatMessage(reply));
  }
  return messages;
}

function mapReplyToChatMessage(reply: SupportReportReplyRecord): SupportChatMessage {
  return {
    id: reply.id,
    role: reply.isStaffReply ? 'staff' : 'user',
    label: reply.isStaffReply ? 'Support team' : 'You',
    body: reply.message,
    createdAtIso: reply.createdAtIso,
    screenshotUrl: null,
  };
}

function SupportChatBubble(props: { readonly message: SupportChatMessage }): ReactElement {
  const isUser = props.message.role === 'user';
  const isStaff = props.message.role === 'staff';
  const isAttachment = props.message.role === 'attachment';
  if (isAttachment && props.message.screenshotUrl !== null) {
    return (
      <div className="flex w-full justify-end">
        <div className="max-w-[min(100%,22rem)] space-y-2">
          <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{props.message.label}</span>
            <time dateTime={props.message.createdAtIso}>{formatChatTime(props.message.createdAtIso)}</time>
          </div>
          <AppImageLightboxCard
            alt="Screenshot attached to your report"
            caption="Submitted screenshot"
            frameClassName="min-h-[160px]"
            label="Screenshot"
            src={props.message.screenshotUrl}
            className="border-primary/20"
          />
        </div>
      </div>
    );
  }
  return (
    <div className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[min(100%,36rem)] space-y-1.5 rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-xs',
          isUser
            ? 'border-primary bg-primary text-primary-foreground'
            : isStaff
              ? 'border-primary/25 bg-primary/5 text-foreground'
              : 'border-border bg-card text-foreground',
        )}
      >
        <div
          className={cn(
            'flex flex-wrap items-center justify-between gap-2 text-xs',
            isUser ? 'text-primary-foreground/80' : 'text-muted-foreground',
          )}
        >
          <span className={cn('font-semibold', isUser ? 'text-primary-foreground' : 'text-foreground')}>
            {props.message.label}
          </span>
          <time dateTime={props.message.createdAtIso}>{formatChatTime(props.message.createdAtIso)}</time>
        </div>
        {props.message.body !== null ? (
          <p className={cn('whitespace-pre-wrap', isUser ? 'text-primary-foreground' : 'text-foreground')}>
            {props.message.body}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function formatCooldownLabel(seconds: number): string {
  if (seconds >= 60) {
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} min`;
  }
  return `${seconds}s`;
}

/**
 * Support report detail as a chat thread with throttled follow-up replies.
 */
export function AccountReportDetail(props: AccountReportDetailProps): ReactElement {
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const [report, setReport] = useState<SupportReportRecord>(props.report);
  const [replyPolicy, setReplyPolicy] = useState<SupportReportReporterReplyPolicy>(props.initialReplyPolicy);
  const [draftMessage, setDraftMessage] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(props.initialReplyPolicy.cooldownRemainingSeconds);
  const screenshotUrl = report.hasScreenshot
    ? buildApiUrl(`/api/support/my-reports/${encodeURIComponent(report.id)}/screenshot`)
    : null;
  const chatMessages = useMemo(() => buildSupportChatMessages(report, screenshotUrl), [report, screenshotUrl]);
  const hasStaffReply = report.replies.some((reply) => reply.isStaffReply);
  const canSend =
    replyPolicy.allowReporterFollowUpReplies &&
    replyPolicy.canReply &&
    cooldownSeconds <= 0 &&
    draftMessage.trim().length > 0 &&
    !isSubmitting;
  useEffect(() => {
    queueMicrotask(() => {
      setReport(props.report);
      setReplyPolicy(props.initialReplyPolicy);
      setCooldownSeconds(props.initialReplyPolicy.cooldownRemainingSeconds);
    });
  }, [props.initialReplyPolicy, props.report]);
  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chatMessages.length]);
  useEffect(() => {
    if (cooldownSeconds <= 0) {
      return;
    }
    const intervalId = window.setInterval(() => {
      setCooldownSeconds((previous) => {
        if (previous <= 1) {
          setReplyPolicy((current) =>
            current.canReply ? current : { ...current, canReply: true, cooldownRemainingSeconds: 0, blockReason: null },
          );
          return 0;
        }
        return previous - 1;
      });
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [cooldownSeconds]);
  const executeSubmitFollowUp = useCallback(async (): Promise<void> => {
    const trimmed = draftMessage.trim();
    if (trimmed.length === 0 || isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch(
        buildApiUrl(`/api/support/my-reports/${encodeURIComponent(report.id)}/reply`),
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: trimmed }),
        },
      );
      const payload = (await response.json()) as ReplyApiResponse;
      if (!response.ok) {
        if (payload.replyPolicy !== undefined) {
          setReplyPolicy(payload.replyPolicy);
          setCooldownSeconds(payload.replyPolicy.cooldownRemainingSeconds);
        } else if (payload.retryAfterSeconds !== undefined) {
          setCooldownSeconds(payload.retryAfterSeconds);
        }
        throw new Error(payload.error ?? 'Failed to send message.');
      }
      if (payload.report !== undefined) {
        setReport(payload.report);
      }
      if (payload.replyPolicy !== undefined) {
        setReplyPolicy(payload.replyPolicy);
        setCooldownSeconds(payload.replyPolicy.cooldownRemainingSeconds);
      }
      setDraftMessage('');
    } catch (submitError: unknown) {
      setSubmitError(submitError instanceof Error ? submitError.message : 'Failed to send message.');
    } finally {
      setIsSubmitting(false);
    }
  }, [draftMessage, isSubmitting, report.id]);
  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void executeSubmitFollowUp();
  };
  return (
    <div className="flex flex-col gap-4 md:gap-6 max-w-4xl mx-auto">
      <Link href="/account/reports" className="inline-flex text-sm font-medium text-primary hover:underline md:hidden">
        ← Back to My reports
      </Link>
      <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xs md:min-h-[min(720px,calc(100dvh-14rem))]">
        <header className="space-y-3 border-b border-border bg-muted/30 px-4 py-4 md:px-5">
          <Link
            href="/account/reports"
            className="hidden text-sm font-medium text-primary hover:underline md:inline-flex"
          >
            ← Back to My reports
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{report.source}</Badge>
            {hasStaffReply ? (
              <Badge className="bg-primary/15 text-primary hover:bg-primary/15">Has reply</Badge>
            ) : (
              <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100">
                Awaiting reply
              </Badge>
            )}
            {report.hasScreenshot ? (
              <Badge variant="outline" className="gap-1">
                <ImageIcon className="size-3" aria-hidden />
                Screenshot
              </Badge>
            ) : null}
          </div>
          <div className="space-y-1">
            <p className="line-clamp-2 text-base font-semibold text-foreground">{report.message}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">{report.route}</p>
          </div>
        </header>
        <div
          className="flex min-h-[min(320px,45dvh)] flex-1 flex-col gap-4 overflow-y-auto px-4 py-5 md:min-h-0 md:px-5"
          role="log"
          aria-label="Support conversation"
          aria-live="polite"
        >
          {chatMessages.map((message) => (
            <SupportChatBubble key={message.id} message={message} />
          ))}
          <div ref={scrollAnchorRef} aria-hidden className="h-px shrink-0" />
        </div>
        <footer className="border-t border-border bg-muted/20 px-4 py-4 md:px-5">
          {!replyPolicy.allowReporterFollowUpReplies ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Follow-up messages in this thread are currently disabled. Email support if you need to add more context.
            </p>
          ) : (
            <form className="space-y-3" onSubmit={handleSubmit}>
              <Textarea
                name="followUpMessage"
                value={draftMessage}
                onChange={(event) => setDraftMessage(event.target.value)}
                placeholder="Add a follow-up message…"
                rows={3}
                disabled={isSubmitting || cooldownSeconds > 0}
                aria-label="Follow-up message"
                className="min-h-[88px] resize-y bg-background"
              />
              {submitError !== null ? (
                <p className="text-sm text-destructive" role="alert">
                  {submitError}
                </p>
              ) : null}
              {!replyPolicy.canReply && replyPolicy.blockReason !== null && cooldownSeconds <= 0 ? (
                <p className="text-xs text-muted-foreground">{replyPolicy.blockReason}</p>
              ) : null}
              {cooldownSeconds > 0 ? (
                <p className="text-xs text-muted-foreground">
                  You can send again in {formatCooldownLabel(cooldownSeconds)}.
                  {replyPolicy.hourlyRemaining <= 0
                    ? ' Hourly limit reached for this report.'
                    : ` ${replyPolicy.hourlyRemaining} follow-up${replyPolicy.hourlyRemaining === 1 ? '' : 's'} left this hour.`}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Up to {replyPolicy.maxPerHour} follow-ups per hour · wait at least{' '}
                  {formatCooldownLabel(replyPolicy.minIntervalSeconds)} between messages.
                </p>
              )}
              <div className="flex justify-end">
                <Button type="submit" disabled={!canSend}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Sending…
                    </>
                  ) : (
                    'Send message'
                  )}
                </Button>
              </div>
            </form>
          )}
        </footer>
      </div>
    </div>
  );
}
