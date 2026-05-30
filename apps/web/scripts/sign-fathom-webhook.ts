/**
 * Print Fathom webhook verification headers for local POST testing.
 *
 * Run from apps/web:
 *   pnpm sign:fathom-webhook
 *   pnpm sign:fathom-webhook ./payload.json
 *
 * Requires .env.local (MongoDB + MEETINGS_CREDENTIALS_MASTER_KEY) or FATHOM_WEBHOOK_SECRET.
 */
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolveFathomCredentialsForRuntime } from '../src/lib/data/recording-settings';
import type { FathomCredentials } from '../src/lib/data/recording-settings';
import { signFathomWebhook } from '../src/lib/fathom/verify-fathom-webhook';

const DEFAULT_RAW_BODY = JSON.stringify({
  recording_id: '149718746',
  title: 'TeqMD · Automation Scoping Session — C492B59D',
  share_url: 'https://fathom.video/share/JUoscpHas4ga8sD_s_BFBQYJdSpz28do',
  recording_start_time: '2026-05-27T00:00:59Z',
  summary: 'TeqMD · Automation Scoping Session — C492B59D',
});

function readRawBodyFromArgv(): string {
  const bodyPath = process.argv[2]?.trim();
  if (bodyPath === undefined || bodyPath.length === 0) {
    return DEFAULT_RAW_BODY;
  }
  return readFileSync(bodyPath, 'utf8').trim();
}

function readFathomCredentialsFromEnv(): FathomCredentials | null {
  const apiKey = process.env.FATHOM_API_KEY?.trim() ?? '';
  const webhookSecret = process.env.FATHOM_WEBHOOK_SECRET?.trim() ?? '';
  const hostEmail = process.env.FATHOM_HOST_EMAIL?.trim() ?? '';
  if (apiKey.length === 0 || webhookSecret.length === 0) {
    return null;
  }
  return { apiKey, webhookSecret, hostEmail };
}

async function resolveCredentialsForSigning(): Promise<FathomCredentials> {
  const fromEnv = readFathomCredentialsFromEnv();
  if (fromEnv !== null) {
    return fromEnv;
  }
  const fromRuntime = await resolveFathomCredentialsForRuntime();
  if (fromRuntime === null) {
    throw new Error(
      'Fathom credentials not found. Set FATHOM_WEBHOOK_SECRET in .env.local or configure Admin → Settings → Recordings.',
    );
  }
  return fromRuntime;
}

function resolveWebhookUrl(): string {
  const fromEnv = process.env.FATHOM_WEBHOOK_URL?.trim() ?? '';
  if (fromEnv.length > 0) {
    return fromEnv;
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '') ?? 'http://localhost:3000';
  return `${appUrl}/api/webhooks/fathom`;
}

async function executeSignFathomWebhookScript(): Promise<void> {
  const rawBody = readRawBodyFromArgv();
  JSON.parse(rawBody);
  const credentials = await resolveCredentialsForSigning();
  const webhookId = process.env.FATHOM_WEBHOOK_ID?.trim() || `msg_test_${randomBytes(4).toString('hex')}`;
  const webhookTimestamp = String(Math.floor(Date.now() / 1000));
  const webhookSignature = signFathomWebhook({
    webhookSecret: credentials.webhookSecret,
    webhookId,
    webhookTimestamp,
    rawBody,
  });
  const webhookUrl = resolveWebhookUrl();
  const escapedBody = rawBody.replace(/'/g, `'\\''`);
  console.log('webhook-id:', webhookId);
  console.log('webhook-timestamp:', webhookTimestamp);
  console.log('webhook-signature:', webhookSignature);
  console.log('');
  console.log('curl:');
  console.log(
    `curl -sS -X POST '${webhookUrl}' \\\n` +
      `  -H 'Content-Type: application/json' \\\n` +
      `  -H 'webhook-id: ${webhookId}' \\\n` +
      `  -H 'webhook-timestamp: ${webhookTimestamp}' \\\n` +
      `  -H 'webhook-signature: ${webhookSignature}' \\\n` +
      `  --data-raw '${escapedBody}'`,
  );
  console.log('');
  console.log('Next: open a new terminal, paste the curl block above, and run it within 5 minutes.');
  console.log('Postman: set the three webhook-* headers, Body → raw → JSON (must match the signed body exactly).');
}

void executeSignFathomWebhookScript()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
