import { COLLECTIONS } from '@/domain/collections';
import {
  TRANSACTIONAL_EMAIL_PROVIDER_IDS,
  type EmailSettingsDocument,
  type TransactionalEmailActiveProvider,
  type TransactionalEmailProviderId,
} from '@/domain/email-types';
import type { EncryptedCredentialBlob, PaymentGatewayCredentialsPlain } from '@/domain/payment-types';
import {
  canEncryptEmailCredentials,
  decryptEmailCredentials,
  encryptEmailCredentials,
} from '@/lib/server/email-credentials-crypto';
import { maskCredentialHint } from '@/lib/server/payment-credentials-crypto';
import { getResolvedSiteName } from '@/lib/data/app-settings';
import { getDb } from '@/lib/mongodb';

export const EMAIL_SETTINGS_DOCUMENT_ID = 'default';

const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class EmailSettingsCredentialValidationError extends Error {
  public override readonly name = 'EmailSettingsCredentialValidationError';
}

const EMAIL_PROVIDER_CREDENTIAL_KEYS: Record<TransactionalEmailProviderId, readonly string[]> = {
  resend: ['apiKey', 'from'],
  postmark: ['serverToken', 'from'],
  sendgrid: ['apiKey', 'from'],
};

export type EmailProviderAdminStatus = {
  readonly id: TransactionalEmailProviderId;
  readonly label: string;
  readonly description: string;
  readonly configured: boolean;
  readonly credentialHint: string | null;
};

export type EmailSettingsAdminView = {
  readonly activeProvider: TransactionalEmailActiveProvider;
  readonly sandboxMode: boolean;
  readonly bookingConfirmationBcc: string;
  readonly fromDisplayName: string;
  readonly defaultFromDisplayName: string;
  readonly fromEmail: string;
  readonly bookingConfirmationSubject: string;
  readonly canStoreCredentials: boolean;
  readonly providers: readonly EmailProviderAdminStatus[];
  readonly envResendFallbackAvailable: boolean;
};

const DEFAULT_BOOKING_CONFIRMATION_SUBJECT_TEMPLATE = 'Booking confirmed — {{bookingReference}}';

export type TransactionalEmailDispatchContext =
  | {
      readonly kind: 'resend';
      readonly apiKey: string;
      readonly from: string;
      readonly bcc: readonly string[];
      readonly source: 'admin' | 'env';
    }
  | {
      readonly kind: 'postmark';
      readonly serverToken: string;
      readonly from: string;
      readonly bcc: readonly string[];
      readonly source: 'admin';
    }
  | {
      readonly kind: 'sendgrid';
      readonly apiKey: string;
      readonly from: string;
      readonly bcc: readonly string[];
      readonly source: 'admin';
    }
  | { readonly kind: 'audit_only' };

function defaultActiveProvider(): TransactionalEmailActiveProvider {
  return 'none';
}

function parseBccList(raw: string): readonly string[] {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return [];
  }
  return trimmed
    .split(',')
    .map((part) => part.trim())
    .filter((part) => EMAIL_ADDRESS_PATTERN.test(part));
}

function mergeBcc(adminBcc: string, envBcc: string | undefined): readonly string[] {
  const fromAdmin = parseBccList(adminBcc);
  if (fromAdmin.length > 0) {
    return fromAdmin;
  }
  return parseBccList(envBcc ?? '');
}

function readEnvResend(): { readonly apiKey: string; readonly from: string } | null {
  const apiKey = process.env.RESEND_API_KEY?.trim() ?? '';
  const from = process.env.EMAIL_FROM?.trim() ?? '';
  if (apiKey.length === 0 || from.length === 0) {
    return null;
  }
  return { apiKey, from };
}

function envResendFallbackAvailable(): boolean {
  return readEnvResend() !== null;
}

function mergeDocument(doc: EmailSettingsDocument | null): Omit<EmailSettingsDocument, '_id' | 'updatedAt'> {
  const base: Omit<EmailSettingsDocument, '_id' | 'updatedAt'> = {
    activeProvider: defaultActiveProvider(),
    sandboxMode: false,
    bookingConfirmationBcc: '',
    fromDisplayName: '',
    fromEmail: '',
    bookingConfirmationSubject: '',
    providerCredentials: {},
  };
  if (doc === null) {
    return base;
  }
  const active: TransactionalEmailActiveProvider =
    doc.activeProvider === 'none' ||
    TRANSACTIONAL_EMAIL_PROVIDER_IDS.includes(doc.activeProvider as TransactionalEmailProviderId)
      ? doc.activeProvider
      : base.activeProvider;
  const bcc = typeof doc.bookingConfirmationBcc === 'string' ? doc.bookingConfirmationBcc : '';
  const fromDisplayName = typeof doc.fromDisplayName === 'string' ? doc.fromDisplayName : '';
  const fromEmail = typeof doc.fromEmail === 'string' ? doc.fromEmail : '';
  const bookingConfirmationSubject =
    typeof doc.bookingConfirmationSubject === 'string' ? doc.bookingConfirmationSubject : '';
  return {
    activeProvider: active,
    sandboxMode: typeof doc.sandboxMode === 'boolean' ? doc.sandboxMode : base.sandboxMode,
    bookingConfirmationBcc: bcc,
    fromDisplayName,
    fromEmail,
    bookingConfirmationSubject,
    providerCredentials: doc.providerCredentials ?? {},
  };
}

function hasFromDisplayName(from: string): boolean {
  return /^[^<]+<[^>]+>$/.test(from.trim());
}

function applyFromDisplayName(from: string, displayName: string): string {
  const trimmed = from.trim();
  if (trimmed.length === 0 || hasFromDisplayName(trimmed)) {
    return trimmed;
  }
  const name = displayName.trim();
  if (name.length === 0) {
    return trimmed;
  }
  return `${name} <${trimmed}>`;
}

async function resolveFromDisplayName(merged: Omit<EmailSettingsDocument, '_id' | 'updatedAt'>): Promise<string> {
  const emailOverride = merged.fromDisplayName.trim();
  if (emailOverride.length > 0) {
    return emailOverride;
  }
  return getResolvedSiteName();
}

async function resolveTransactionalFrom(
  merged: Omit<EmailSettingsDocument, '_id' | 'updatedAt'>,
  credentialFrom: string,
): Promise<string> {
  const displayName = await resolveFromDisplayName(merged);
  const globalFrom = merged.fromEmail.trim();
  if (globalFrom.length > 0 && isValidFromAddress(globalFrom)) {
    return applyFromDisplayName(globalFrom, displayName);
  }
  return applyFromDisplayName(credentialFrom, displayName);
}

export function formatBookingConfirmationSubject(
  bookingReference: string,
  subjectTemplate: string,
): string {
  const template =
    subjectTemplate.trim().length > 0 ? subjectTemplate.trim() : DEFAULT_BOOKING_CONFIRMATION_SUBJECT_TEMPLATE;
  return template.replace(/\{\{bookingReference\}\}/g, bookingReference);
}

export async function resolveBookingConfirmationSubject(bookingReference: string): Promise<string> {
  const merged = mergeDocument(await loadDocument());
  return formatBookingConfirmationSubject(bookingReference, merged.bookingConfirmationSubject);
}

const DEFAULT_RESEND_SANDBOX_RECIPIENT = 'delivered@resend.dev';

/**
 * When {@link EmailSettingsDocument.sandboxMode} is true, transactional sends use this inbox (Resend test delivery).
 * Override with env `EMAIL_SANDBOX_TO` (e.g. `delivered+bookings@resend.dev`).
 */
export async function getTransactionalEmailSandboxState(): Promise<{
  readonly enabled: boolean;
  readonly redirectTo: string;
}> {
  const merged = mergeDocument(await loadDocument());
  const raw = process.env.EMAIL_SANDBOX_TO?.trim();
  const redirectTo = raw !== undefined && raw.length > 0 ? raw : DEFAULT_RESEND_SANDBOX_RECIPIENT;
  return { enabled: merged.sandboxMode === true, redirectTo };
}

async function loadDocument(): Promise<EmailSettingsDocument | null> {
  if (!process.env.MONGODB_URI) {
    return null;
  }
  const db = await getDb();
  return db.collection<EmailSettingsDocument>(COLLECTIONS.emailSettings).findOne({ _id: EMAIL_SETTINGS_DOCUMENT_ID });
}

async function loadCredentialsMap(): Promise<
  Partial<Record<TransactionalEmailProviderId, EncryptedCredentialBlob>>
> {
  const doc = await loadDocument();
  return doc?.providerCredentials ?? {};
}

function isValidFromAddress(from: string): boolean {
  const t = from.trim();
  if (t.length === 0) {
    return false;
  }
  const angle = /^[^<]+<([^>]+)>$/.exec(t);
  const emailPart = angle !== null ? angle[1]!.trim() : t;
  return EMAIL_ADDRESS_PATTERN.test(emailPart);
}

function mergeCredentialFields(
  keys: readonly string[],
  incoming: Record<string, string>,
  existingBlob: EncryptedCredentialBlob | undefined,
): PaymentGatewayCredentialsPlain {
  let previous: PaymentGatewayCredentialsPlain = {};
  if (existingBlob !== undefined) {
    try {
      previous = decryptEmailCredentials(existingBlob);
    } catch {
      previous = {};
    }
  }
  const merged: Record<string, string> = {};
  for (const key of keys) {
    const inc = incoming[key]?.trim() ?? '';
    if (inc.length > 0) {
      merged[key] = inc;
    } else {
      const fromPrev = typeof previous[key] === 'string' ? previous[key].trim() : '';
      if (fromPrev.length > 0) {
        merged[key] = fromPrev;
      }
    }
  }
  return merged;
}

function encryptValidatedEmailProviderBlob(
  providerId: TransactionalEmailProviderId,
  filtered: Record<string, string>,
  existingBlob: EncryptedCredentialBlob | undefined,
): EncryptedCredentialBlob {
  const merged = mergeCredentialFields(EMAIL_PROVIDER_CREDENTIAL_KEYS[providerId], filtered, existingBlob);
  if (extractPlainForProvider(providerId, merged) === null) {
    const label = providerId === 'postmark' ? 'server token and From address' : 'API key and From address';
    throw new EmailSettingsCredentialValidationError(
      `${providerId === 'resend' ? 'Resend' : providerId === 'postmark' ? 'Postmark' : 'SendGrid'} credentials must include a valid ${label}.`,
    );
  }
  return encryptEmailCredentials(merged);
}

function extractPlainForProvider(
  providerId: TransactionalEmailProviderId,
  plain: PaymentGatewayCredentialsPlain,
): { readonly apiKey?: string; readonly serverToken?: string; readonly from: string } | null {
  const from = typeof plain.from === 'string' ? plain.from.trim() : '';
  if (from.length === 0 || !isValidFromAddress(from)) {
    return null;
  }
  if (providerId === 'resend' || providerId === 'sendgrid') {
    const apiKey = typeof plain.apiKey === 'string' ? plain.apiKey.trim() : '';
    if (apiKey.length === 0) {
      return null;
    }
    return { apiKey, from };
  }
  const serverToken = typeof plain.serverToken === 'string' ? plain.serverToken.trim() : '';
  if (serverToken.length === 0) {
    return null;
  }
  return { serverToken, from };
}

export async function getTransactionalEmailDispatchContext(): Promise<TransactionalEmailDispatchContext> {
  const merged = mergeDocument(await loadDocument());
  const bcc = mergeBcc(merged.bookingConfirmationBcc, process.env.BOOKING_CONFIRMATION_BCC);
  if (merged.activeProvider !== 'none') {
    const blobs = await loadCredentialsMap();
    const blob = blobs[merged.activeProvider];
    if (blob !== undefined) {
      try {
        const plain = decryptEmailCredentials(blob);
        const extracted = extractPlainForProvider(merged.activeProvider, plain);
        if (extracted !== null) {
          if (merged.activeProvider === 'resend' && extracted.apiKey !== undefined) {
            return {
              kind: 'resend',
              apiKey: extracted.apiKey,
              from: await resolveTransactionalFrom(merged, extracted.from),
              bcc,
              source: 'admin',
            };
          }
          if (merged.activeProvider === 'postmark' && extracted.serverToken !== undefined) {
            return {
              kind: 'postmark',
              serverToken: extracted.serverToken,
              from: await resolveTransactionalFrom(merged, extracted.from),
              bcc,
              source: 'admin',
            };
          }
          if (merged.activeProvider === 'sendgrid' && extracted.apiKey !== undefined) {
            return {
              kind: 'sendgrid',
              apiKey: extracted.apiKey,
              from: await resolveTransactionalFrom(merged, extracted.from),
              bcc,
              source: 'admin',
            };
          }
        }
      } catch {
        return { kind: 'audit_only' };
      }
    }
    return { kind: 'audit_only' };
  }
  const env = readEnvResend();
  if (env !== null) {
    return {
      kind: 'resend',
      apiKey: env.apiKey,
      from: await resolveTransactionalFrom(merged, env.from),
      bcc,
      source: 'env',
    };
  }
  return { kind: 'audit_only' };
}

export async function getEmailSettingsAdminView(): Promise<EmailSettingsAdminView> {
  const merged = mergeDocument(await loadDocument());
  const blobs = await loadCredentialsMap();
  const providers: EmailProviderAdminStatus[] = (
    [
      {
        id: 'resend' as const,
        label: 'Resend',
        description: 'HTTP API with simple DNS verification for your sending domain.',
      },
      {
        id: 'postmark' as const,
        label: 'Postmark',
        description: 'Transactional email via Postmark server token.',
      },
      {
        id: 'sendgrid' as const,
        label: 'SendGrid',
        description: 'SendGrid Web API v3 with a full-access or restricted API key.',
      },
    ] as const satisfies readonly Omit<EmailProviderAdminStatus, 'configured' | 'credentialHint'>[]
  ).map((row) => {
    const blob = blobs[row.id];
    let configured = false;
    let credentialHint: string | null = null;
    if (blob !== undefined) {
      try {
        const plain = decryptEmailCredentials(blob);
        configured = extractPlainForProvider(row.id, plain) !== null;
        const hintSource =
          row.id === 'postmark'
            ? (typeof plain.serverToken === 'string' ? plain.serverToken : '')
            : (typeof plain.apiKey === 'string' ? plain.apiKey : '');
        if (hintSource.trim().length > 0) {
          credentialHint = maskCredentialHint({ key: hintSource.trim() });
        }
      } catch {
        configured = false;
      }
    }
    return { ...row, configured, credentialHint };
  });
  const defaultFromDisplayName = await getResolvedSiteName();
  return {
    activeProvider: merged.activeProvider,
    sandboxMode: merged.sandboxMode,
    bookingConfirmationBcc: merged.bookingConfirmationBcc,
    fromDisplayName: merged.fromDisplayName,
    defaultFromDisplayName,
    fromEmail: merged.fromEmail,
    bookingConfirmationSubject: merged.bookingConfirmationSubject,
    canStoreCredentials: canEncryptEmailCredentials(),
    providers,
    envResendFallbackAvailable: envResendFallbackAvailable(),
  };
}

export type UpdateEmailSettingsPatch = Partial<{
  activeProvider: TransactionalEmailActiveProvider;
  sandboxMode: boolean;
  bookingConfirmationBcc: string;
  fromDisplayName: string;
  fromEmail: string;
  bookingConfirmationSubject: string;
  providerCredentials: Partial<Record<TransactionalEmailProviderId, Record<string, string> | null>>;
}>;

export async function updateEmailSettings(patch: UpdateEmailSettingsPatch): Promise<EmailSettingsAdminView> {
  const current = mergeDocument(await loadDocument());
  const blobs: Partial<Record<TransactionalEmailProviderId, EncryptedCredentialBlob>> = {
    ...current.providerCredentials,
  };
  const nextActive: TransactionalEmailActiveProvider =
    patch.activeProvider !== undefined &&
    (patch.activeProvider === 'none' || TRANSACTIONAL_EMAIL_PROVIDER_IDS.includes(patch.activeProvider))
      ? patch.activeProvider
      : current.activeProvider;
  const nextBcc =
    patch.bookingConfirmationBcc !== undefined ? patch.bookingConfirmationBcc : current.bookingConfirmationBcc;
  const nextFromDisplayName =
    patch.fromDisplayName !== undefined ? patch.fromDisplayName.trim() : current.fromDisplayName;
  const nextFromEmail = patch.fromEmail !== undefined ? patch.fromEmail.trim() : current.fromEmail;
  if (nextFromEmail.length > 0 && !isValidFromAddress(nextFromEmail)) {
    throw new EmailSettingsCredentialValidationError('From email must be a valid address (e.g. bookings@yourdomain.com or Name <bookings@yourdomain.com>).');
  }
  const nextBookingConfirmationSubject =
    patch.bookingConfirmationSubject !== undefined
      ? patch.bookingConfirmationSubject.trim()
      : current.bookingConfirmationSubject;
  const nextSandbox = patch.sandboxMode !== undefined ? patch.sandboxMode : current.sandboxMode;
  if (patch.providerCredentials !== undefined) {
    for (const providerId of TRANSACTIONAL_EMAIL_PROVIDER_IDS) {
      const incoming = patch.providerCredentials[providerId];
      if (incoming === undefined) {
        continue;
      }
      if (incoming === null) {
        delete blobs[providerId];
        continue;
      }
      const filtered: Record<string, string> = {};
      for (const [key, value] of Object.entries(incoming)) {
        if (typeof value === 'string' && value.trim().length > 0) {
          filtered[key] = value.trim();
        }
      }
      if (Object.keys(filtered).length === 0) {
        continue;
      }
      blobs[providerId] = encryptValidatedEmailProviderBlob(providerId, filtered, blobs[providerId]);
    }
  }
  if (!process.env.MONGODB_URI) {
    return getEmailSettingsAdminView();
  }
  const db = await getDb();
  const row: EmailSettingsDocument = {
    _id: EMAIL_SETTINGS_DOCUMENT_ID,
    activeProvider: nextActive,
    sandboxMode: nextSandbox,
    bookingConfirmationBcc: nextBcc,
    fromDisplayName: nextFromDisplayName,
    fromEmail: nextFromEmail,
    bookingConfirmationSubject: nextBookingConfirmationSubject,
    providerCredentials: blobs,
    updatedAt: new Date(),
  };
  await db.collection<EmailSettingsDocument>(COLLECTIONS.emailSettings).replaceOne({ _id: EMAIL_SETTINGS_DOCUMENT_ID }, row, {
    upsert: true,
  });
  return getEmailSettingsAdminView();
}

/**
 * Sends a minimal test message using saved credentials for the provider (or Resend env vars when no Resend blob).
 * Uses dynamic import so this module does not statically depend on {@link send-transactional-email} (circular import).
 */
export async function executeTransactionalEmailProviderConnectionTest(
  providerId: TransactionalEmailProviderId,
): Promise<{ readonly ok: boolean; readonly message: string }> {
  const { executeSendTransactionalProviderTestEmail } = await import('@/lib/email/send-transactional-email');
  const merged = mergeDocument(await loadDocument());
  if (providerId === 'resend') {
    const blobs = await loadCredentialsMap();
    const blob = blobs.resend;
    if (blob !== undefined) {
      try {
        const plain = decryptEmailCredentials(blob);
        const extracted = extractPlainForProvider('resend', plain);
        if (extracted?.apiKey !== undefined) {
          return executeSendTransactionalProviderTestEmail({
            providerId: 'resend',
            apiKey: extracted.apiKey,
            from: await resolveTransactionalFrom(merged, extracted.from),
          });
        }
      } catch {
        return { ok: false, message: 'Could not decrypt saved Resend credentials.' };
      }
    }
    const env = readEnvResend();
    if (env !== null) {
      return executeSendTransactionalProviderTestEmail({
        providerId: 'resend',
        apiKey: env.apiKey,
        from: await resolveTransactionalFrom(merged, env.from),
      });
    }
    return {
      ok: false,
      message: 'Save credentials below or set RESEND_API_KEY and EMAIL_FROM to run this test.',
    };
  }
  const blobs = await loadCredentialsMap();
  const blob = blobs[providerId];
  if (blob === undefined) {
    return { ok: false, message: 'No saved credentials for this provider. Save first, then send a test.' };
  }
  try {
    const plain = decryptEmailCredentials(blob);
    const extracted = extractPlainForProvider(providerId, plain);
    if (providerId === 'postmark') {
      if (extracted?.serverToken === undefined) {
        return { ok: false, message: 'Saved Postmark credentials are incomplete (server token or From address).' };
      }
      return executeSendTransactionalProviderTestEmail({
        providerId: 'postmark',
        serverToken: extracted.serverToken,
        from: await resolveTransactionalFrom(merged, extracted.from),
      });
    }
    if (extracted?.apiKey === undefined) {
      return { ok: false, message: 'Saved SendGrid credentials are incomplete (API key or From address).' };
    }
    return executeSendTransactionalProviderTestEmail({
      providerId: 'sendgrid',
      apiKey: extracted.apiKey,
      from: await resolveTransactionalFrom(merged, extracted.from),
    });
  } catch {
    return { ok: false, message: 'Could not decrypt saved credentials.' };
  }
}
