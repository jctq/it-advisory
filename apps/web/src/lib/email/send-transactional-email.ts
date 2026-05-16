import { Resend } from 'resend';
import { getTransactionalEmailDispatchContext, getTransactionalEmailSandboxState } from '@/lib/data/email-settings';

export type TransactionalDispatchOutcome =
  | {
      readonly kind: 'sent';
      readonly provider: string;
      readonly providerMessageId: string;
      /** Envelope `To` used for the provider call (may be the Resend sandbox inbox). */
      readonly persistTo: string;
      readonly sandboxIntendedTo?: string;
    }
  | {
      readonly kind: 'failed';
      readonly errorMessage: string;
      readonly errorName?: string;
      readonly statusCode?: number | null;
      readonly persistTo: string;
      readonly sandboxIntendedTo?: string;
    }
  | { readonly kind: 'audit_only' };

type TransactionalSendResult =
  | { readonly ok: true; readonly provider: string; readonly providerMessageId: string }
  | { readonly ok: false; readonly errorMessage: string; readonly errorName?: string; readonly statusCode?: number | null };

function mapSendResult(
  send: TransactionalSendResult,
  meta: { readonly persistTo: string; readonly sandboxIntendedTo?: string },
): Extract<TransactionalDispatchOutcome, { kind: 'sent' } | { kind: 'failed' }> {
  if (send.ok) {
    return {
      kind: 'sent',
      provider: send.provider,
      providerMessageId: send.providerMessageId,
      persistTo: meta.persistTo,
      ...(meta.sandboxIntendedTo !== undefined ? { sandboxIntendedTo: meta.sandboxIntendedTo } : {}),
    };
  }
  return {
    kind: 'failed',
    errorMessage: send.errorMessage,
    errorName: send.errorName,
    statusCode: send.statusCode,
    persistTo: meta.persistTo,
    ...(meta.sandboxIntendedTo !== undefined ? { sandboxIntendedTo: meta.sandboxIntendedTo } : {}),
  };
}

function parseFromForSendGrid(from: string): { readonly email: string; readonly name?: string } {
  const trimmed = from.trim();
  const m = /^(.+)<([^>]+)>$/.exec(trimmed);
  if (m !== null) {
    const name = m[1]!.trim().replace(/^"|"$/g, '').trim();
    const email = m[2]!.trim();
    return name.length > 0 ? { email, name } : { email };
  }
  return { email: trimmed };
}

async function sendViaPostmark(input: {
  readonly serverToken: string;
  readonly from: string;
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  readonly bcc: readonly string[];
}): Promise<TransactionalSendResult> {
  const body: Record<string, unknown> = {
    From: input.from,
    To: input.to,
    Subject: input.subject,
    HtmlBody: input.html,
    MessageStream: 'outbound',
  };
  if (input.bcc.length > 0) {
    body.Bcc = input.bcc.join(',');
  }
  const response = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Postmark-Server-Token': input.serverToken,
    },
    body: JSON.stringify(body),
  });
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      json !== null && typeof json === 'object' && 'Message' in json && typeof (json as { Message: unknown }).Message === 'string'
        ? (json as { Message: string }).Message
        : `Postmark HTTP ${response.status}`;
    return { ok: false, errorMessage: message, statusCode: response.status };
  }
  if (json !== null && typeof json === 'object' && 'MessageID' in json && typeof (json as { MessageID: unknown }).MessageID === 'string') {
    return { ok: true, provider: 'postmark', providerMessageId: (json as { MessageID: string }).MessageID };
  }
  return { ok: true, provider: 'postmark', providerMessageId: `postmark_${Date.now()}` };
}

async function sendViaSendGrid(input: {
  readonly apiKey: string;
  readonly from: string;
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  readonly bcc: readonly string[];
}): Promise<TransactionalSendResult> {
  const fromParsed = parseFromForSendGrid(input.from);
  const personalization: Record<string, unknown> = {
    to: [{ email: input.to }],
  };
  if (input.bcc.length > 0) {
    personalization.bcc = input.bcc.map((email) => ({ email }));
  }
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [personalization],
      from: fromParsed.name !== undefined ? { email: fromParsed.email, name: fromParsed.name } : { email: fromParsed.email },
      subject: input.subject,
      content: [{ type: 'text/html', value: input.html }],
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    const clipped = text.length > 400 ? `${text.slice(0, 400)}…` : text;
    return { ok: false, errorMessage: clipped.length > 0 ? clipped : `SendGrid HTTP ${response.status}`, statusCode: response.status };
  }
  const messageId = response.headers.get('x-message-id') ?? `sendgrid_${Date.now()}`;
  return { ok: true, provider: 'sendgrid', providerMessageId: messageId };
}

async function sendViaResend(input: {
  readonly apiKey: string;
  readonly from: string;
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  readonly bcc: readonly string[];
}): Promise<TransactionalSendResult> {
  const resend = new Resend(input.apiKey);
  const sendResult = await resend.emails.send({
    from: input.from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    ...(input.bcc.length > 0 ? { bcc: [...input.bcc] } : {}),
  });
  if (sendResult.error !== null) {
    return {
      ok: false,
      errorMessage: sendResult.error.message,
      errorName: sendResult.error.name,
      statusCode: sendResult.error.statusCode,
    };
  }
  return { ok: true, provider: 'resend', providerMessageId: sendResult.data.id };
}

function resolveDefaultTransactionalTestInbox(): string {
  const raw = process.env.EMAIL_SANDBOX_TO?.trim();
  return raw !== undefined && raw.length > 0 ? raw : 'delivered@resend.dev';
}

/**
 * Sends a minimal HTML message to the default test inbox (see `EMAIL_SANDBOX_TO`, default `delivered@resend.dev`)
 * using the given provider credentials — for Admin "Send test email" only.
 */
export async function executeSendTransactionalProviderTestEmail(
  input:
    | { readonly providerId: 'resend'; readonly apiKey: string; readonly from: string }
    | { readonly providerId: 'postmark'; readonly serverToken: string; readonly from: string }
    | { readonly providerId: 'sendgrid'; readonly apiKey: string; readonly from: string },
): Promise<{ readonly ok: true; readonly message: string } | { readonly ok: false; readonly message: string }> {
  const testTo = resolveDefaultTransactionalTestInbox();
  const subject = `TechMD email test (${input.providerId})`;
  const html = '<p>This is an admin test send from TechMD email settings.</p>';
  const bcc: readonly string[] = [];
  let send: TransactionalSendResult;
  if (input.providerId === 'resend') {
    send = await sendViaResend({
      apiKey: input.apiKey,
      from: input.from,
      to: testTo,
      subject,
      html,
      bcc,
    });
  } else if (input.providerId === 'postmark') {
    send = await sendViaPostmark({
      serverToken: input.serverToken,
      from: input.from,
      to: testTo,
      subject,
      html,
      bcc,
    });
  } else {
    send = await sendViaSendGrid({
      apiKey: input.apiKey,
      from: input.from,
      to: testTo,
      subject,
      html,
      bcc,
    });
  }
  if (send.ok) {
    return { ok: true, message: `Test email sent to ${testTo} (id: ${send.providerMessageId}).` };
  }
  return { ok: false, message: send.errorMessage };
}

/**
 * Sends one transactional HTML email using the configured admin provider, or Resend env fallback.
 */
export async function executeDispatchTransactionalEmail(input: {
  readonly to: string;
  readonly subject: string;
  readonly html: string;
}): Promise<TransactionalDispatchOutcome> {
  const ctx = await getTransactionalEmailDispatchContext();
  if (ctx.kind === 'audit_only') {
    return { kind: 'audit_only' };
  }
  const sandbox = await getTransactionalEmailSandboxState();
  const intended = input.to.trim();
  const redirect = sandbox.redirectTo.trim().toLowerCase();
  const useSandbox =
    sandbox.enabled && intended.length > 0 && intended.toLowerCase() !== redirect;
  const effectiveTo = useSandbox ? sandbox.redirectTo : input.to;
  const sandboxIntendedTo = useSandbox ? input.to : undefined;
  const effectiveBcc = useSandbox ? ([] as readonly string[]) : ctx.bcc;
  const meta = { persistTo: effectiveTo, sandboxIntendedTo };
  let send: TransactionalSendResult;
  if (ctx.kind === 'resend') {
    send = await sendViaResend({
      apiKey: ctx.apiKey,
      from: ctx.from,
      to: effectiveTo,
      subject: input.subject,
      html: input.html,
      bcc: effectiveBcc,
    });
  } else if (ctx.kind === 'postmark') {
    send = await sendViaPostmark({
      serverToken: ctx.serverToken,
      from: ctx.from,
      to: effectiveTo,
      subject: input.subject,
      html: input.html,
      bcc: effectiveBcc,
    });
  } else {
    send = await sendViaSendGrid({
      apiKey: ctx.apiKey,
      from: ctx.from,
      to: effectiveTo,
      subject: input.subject,
      html: input.html,
      bcc: effectiveBcc,
    });
  }
  return mapSendResult(send, meta);
}
