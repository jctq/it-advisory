'use client';

import { ImageIcon, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactElement } from 'react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AppImageLightboxCard } from '@/components/ui/app-image-lightbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { buildApiUrl } from '@/lib/config/build-api-url';
import type { SupportReportRecord, SupportReportReplyRecord } from '@/lib/data/support-reports';
import { notifyError, notifySuccess } from '@/lib/notify';
import { cn } from '@/lib/utils';

type AdminSupportReportDetailProps = {
  readonly report: SupportReportRecord;
};

type AdminSupportChatMessage = {
  readonly id: string;
  readonly role: 'reporter' | 'staff' | 'attachment';
  readonly label: string;
  readonly meta: string | null;
  readonly body: string | null;
  readonly createdAtIso: string;
  readonly screenshotUrl: string | null;
};

type ReplyApiResponse = {
  readonly ok?: boolean;
  readonly report?: SupportReportRecord;
  readonly error?: string;
  readonly details?: string;
};

const CHAT_TIME_FORMATTER = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Manila',
});

function formatChatTime(iso: string): string {
  return CHAT_TIME_FORMATTER.format(new Date(iso));
}

function resolveReporterLabel(report: SupportReportRecord): string {
  const name = report.reporterName?.trim();
  if (name !== undefined && name.length > 0) {
    return name;
  }
  return 'Reporter';
}

function buildAdminSupportChatMessages(
  report: SupportReportRecord,
  screenshotUrl: string | null,
): readonly AdminSupportChatMessage[] {
  const reporterLabel = resolveReporterLabel(report);
  const reporterMeta = report.reporterEmail ?? report.reporterMobile ?? null;
  const messages: AdminSupportChatMessage[] = [
    {
      id: `report-${report.id}`,
      role: 'reporter',
      label: reporterLabel,
      meta: reporterMeta,
      body: report.message,
      createdAtIso: report.createdAtIso,
      screenshotUrl: null,
    },
  ];
  if (screenshotUrl !== null) {
    messages.push({
      id: `screenshot-${report.id}`,
      role: 'attachment',
      label: reporterLabel,
      meta: reporterMeta,
      body: null,
      createdAtIso: report.createdAtIso,
      screenshotUrl,
    });
  }
  for (const reply of report.replies) {
    messages.push(mapReplyToAdminChatMessage(reply));
  }
  return messages;
}

function mapReplyToAdminChatMessage(reply: SupportReportReplyRecord): AdminSupportChatMessage {
  return {
    id: reply.id,
    role: reply.isStaffReply ? 'staff' : 'reporter',
    label: reply.isStaffReply ? 'Support team' : 'Reporter',
    meta: reply.authorEmail,
    body: reply.message,
    createdAtIso: reply.createdAtIso,
    screenshotUrl: null,
  };
}

function AdminSupportChatBubble(props: { readonly message: AdminSupportChatMessage }): ReactElement {
  const isStaff = props.message.role === 'staff';
  const isReporter = props.message.role === 'reporter';
  const isAttachment = props.message.role === 'attachment';
  if (isAttachment && props.message.screenshotUrl !== null) {
    return (
      <div className="flex w-full justify-start">
        <div className="max-w-[min(100%,22rem)] space-y-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{props.message.label}</span>
            {props.message.meta !== null ? <span>· {props.message.meta}</span> : null}
            <time dateTime={props.message.createdAtIso}>{formatChatTime(props.message.createdAtIso)}</time>
          </div>
          <AppImageLightboxCard
            alt="Screenshot attached to support report"
            caption="Submitted screenshot"
            frameClassName="min-h-[160px]"
            label="Screenshot"
            src={props.message.screenshotUrl}
          />
        </div>
      </div>
    );
  }
  return (
    <div className={cn('flex w-full', isStaff ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[min(100%,36rem)] space-y-1.5 rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-xs',
          isStaff
            ? 'border-primary bg-primary text-primary-foreground'
            : isReporter
              ? 'border-border bg-card text-foreground'
              : 'border-border bg-muted/30 text-foreground',
        )}
      >
        <div
          className={cn(
            'flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs',
            isStaff ? 'text-primary-foreground/80' : 'text-muted-foreground',
          )}
        >
          <span className={cn('font-semibold', isStaff ? 'text-primary-foreground' : 'text-foreground')}>
            {props.message.label}
          </span>
          {props.message.meta !== null ? <span>{props.message.meta}</span> : null}
          <time dateTime={props.message.createdAtIso}>{formatChatTime(props.message.createdAtIso)}</time>
        </div>
        {props.message.body !== null ? (
          <p className={cn('whitespace-pre-wrap', isStaff ? 'text-primary-foreground' : 'text-foreground')}>
            {props.message.body}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function AdminSupportReportDetail(props: AdminSupportReportDetailProps): ReactElement {
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const [report, setReport] = useState<SupportReportRecord>(props.report);
  const [replyMessage, setReplyMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const screenshotUrl = report.hasScreenshot
    ? buildApiUrl(`/api/admin/support-reports/${encodeURIComponent(report.id)}/screenshot`)
    : null;
  const chatMessages = useMemo(() => buildAdminSupportChatMessages(report, screenshotUrl), [report, screenshotUrl]);
  const hasStaffReply = report.replies.some((reply) => reply.isStaffReply);
  const canSend = replyMessage.trim().length > 0 && !isSubmitting;
  useEffect(() => {
    queueMicrotask(() => {
      setReport(props.report);
    });
  }, [props.report]);
  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chatMessages.length]);
  const executeSubmitReply = useCallback(async (): Promise<void> => {
    const trimmed = replyMessage.trim();
    if (trimmed.length === 0 || isSubmitting) {
      notifyError('Enter a reply message.');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch(
        buildApiUrl(`/api/admin/support-reports/${encodeURIComponent(report.id)}/reply`),
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: trimmed }),
        },
      );
      const payload = (await response.json()) as ReplyApiResponse;
      if (!response.ok) {
        throw new Error(payload.details ?? payload.error ?? 'Failed to send reply.');
      }
      if (payload.report !== undefined) {
        setReport(payload.report);
      }
      notifySuccess('Reply sent.');
      setReplyMessage('');
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : 'Failed to send reply.');
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, replyMessage, report.id]);
  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void executeSubmitReply();
  };
  return (
    <section className="mx-auto w-full space-y-8">
      <AdminPageHeader
        eyebrow="Support"
        title={`Report ${report.id}`}
        description="Review the conversation and reply to the reporter. Email notifications follow Settings → Support."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-h-[min(640px,calc(100dvh-14rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
          <header className="space-y-3 border-b border-border bg-muted/30 px-4 py-4 md:px-5">
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
              <AdminSupportChatBubble key={message.id} message={message} />
            ))}
            <div ref={scrollAnchorRef} aria-hidden className="h-px shrink-0" />
          </div>
          <footer className="border-t border-border bg-muted/20 px-4 py-4 md:px-5">
            <form className="space-y-3" onSubmit={handleSubmit}>
              <Textarea
                rows={3}
                placeholder="Reply to reporter…"
                value={replyMessage}
                onChange={(event) => setReplyMessage(event.target.value)}
                disabled={isSubmitting}
                aria-label="Reply to reporter"
                className="min-h-[88px] resize-y bg-background"
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={!canSend}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Sending…
                    </>
                  ) : (
                    'Send reply'
                  )}
                </Button>
              </div>
            </form>
          </footer>
        </div>
        <aside className="space-y-4">
          <article className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-xs">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Reporter</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Name</dt>
                <dd className="font-medium text-foreground">{report.reporterName ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Email</dt>
                <dd className="break-all">{report.reporterEmail ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Mobile</dt>
                <dd>{report.reporterMobile ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Submitted</dt>
                <dd>
                  {new Date(report.createdAtIso).toLocaleString('en-PH', {
                    timeZone: 'Asia/Manila',
                    dateStyle: 'full',
                    timeStyle: 'short',
                  })}
                </dd>
              </div>
            </dl>
          </article>
          {screenshotUrl !== null ? (
            <AppImageLightboxCard
              alt="Report screenshot"
              caption="Support report screenshot"
              frameClassName="aspect-[9/16] min-h-[200px]"
              label="Screenshot"
              sizes="300px"
              src={screenshotUrl}
            />
          ) : (
            <p className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              No screenshot attached.
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}
