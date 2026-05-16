import type { EncryptedCredentialBlob } from './payment-types.js';

/** Providers that can send transactional email (only one active at a time). */
export const TRANSACTIONAL_EMAIL_PROVIDER_IDS = ['resend', 'postmark', 'sendgrid'] as const;

export type TransactionalEmailProviderId = (typeof TRANSACTIONAL_EMAIL_PROVIDER_IDS)[number];

export type TransactionalEmailActiveProvider = 'none' | TransactionalEmailProviderId;

/** Singleton `_id: 'default'` — admin transactional email configuration. */
export type EmailSettingsDocument = {
  _id: string;
  activeProvider: TransactionalEmailActiveProvider;
  /**
   * When true, transactional `To` is replaced with the Resend test inbox (default `delivered@resend.dev`) and BCC is omitted.
   * @see https://resend.com/docs/dashboard/emails/send-test-emails
   */
  sandboxMode: boolean;
  /** Comma-separated BCC addresses for booking confirmations (optional). */
  bookingConfirmationBcc: string;
  providerCredentials: Partial<Record<TransactionalEmailProviderId, EncryptedCredentialBlob>>;
  updatedAt: Date;
};
