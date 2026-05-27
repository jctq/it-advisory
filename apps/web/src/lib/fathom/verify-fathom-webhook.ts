import { createHmac, timingSafeEqual } from 'node:crypto';

const WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = 300 as const;

function extractSignatures(webhookSignatureHeader: string): string[] {
  return webhookSignatureHeader.split(' ').map((segment) => {
    const parts = segment.split(',');
    return parts.length > 1 ? parts[1]! : parts[0]!;
  });
}

function decodeWebhookSecretBytes(webhookSecret: string): Buffer | null {
  const trimmed = webhookSecret.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const encoded = trimmed.startsWith('whsec_') ? trimmed.slice('whsec_'.length) : trimmed;
  try {
    return Buffer.from(encoded, 'base64');
  } catch {
    return null;
  }
}

export function signFathomWebhook(input: {
  readonly webhookSecret: string;
  readonly webhookId: string;
  readonly webhookTimestamp: string;
  readonly rawBody: string;
}): string {
  const secretBytes = decodeWebhookSecretBytes(input.webhookSecret);
  if (secretBytes === null) {
    throw new Error('Invalid Fathom webhook secret.');
  }
  const signedContent = `${input.webhookId}.${input.webhookTimestamp}.${input.rawBody}`;
  const signature = createHmac('sha256', secretBytes).update(signedContent).digest('base64');
  return `v1,${signature}`;
}

export function verifyFathomWebhook(input: {
  readonly webhookSecret: string;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly rawBody: string;
}): boolean {
  const webhookId = input.headers['webhook-id']?.trim() ?? '';
  const webhookTimestamp = input.headers['webhook-timestamp']?.trim() ?? '';
  const webhookSignature = input.headers['webhook-signature']?.trim() ?? '';
  if (webhookId.length === 0 || webhookTimestamp.length === 0 || webhookSignature.length === 0) {
    return false;
  }
  const timestamp = Number.parseInt(webhookTimestamp, 10);
  if (!Number.isFinite(timestamp)) {
    return false;
  }
  const currentTimestamp = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTimestamp - timestamp) > WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS) {
    return false;
  }
  const secretBytes = decodeWebhookSecretBytes(input.webhookSecret);
  if (secretBytes === null) {
    return false;
  }
  const signedContent = `${webhookId}.${webhookTimestamp}.${input.rawBody}`;
  const expectedSignature = createHmac('sha256', secretBytes).update(signedContent).digest('base64');
  const signatures = extractSignatures(webhookSignature);
  const expectedBuffer = Buffer.from(expectedSignature);
  return signatures.some((signature) => {
    try {
      const receivedBuffer = Buffer.from(signature);
      if (receivedBuffer.length !== expectedBuffer.length) {
        return false;
      }
      return timingSafeEqual(receivedBuffer, expectedBuffer);
    } catch {
      return false;
    }
  });
}
