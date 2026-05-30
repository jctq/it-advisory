#!/usr/bin/env node
/**
 * One-off generator for docs/teqmd-registration-checklist.pdf
 * Run: node docs/generate-registration-checklist-pdf.mjs
 * Requires: npm install pdfkit (or run from temp dir with pdfkit installed)
 */
import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(__dirname, 'teqmd-registration-checklist.pdf');

const doc = new PDFDocument({
  margin: 50,
  size: 'A4',
  info: {
    Title: 'TeqMD Registration & Setup Checklist',
    Author: 'TeqMD',
    Subject: 'Third-party registrations and environment configuration',
  },
});

doc.pipe(fs.createWriteStream(outputPath));

const colors = {
  primary: '#001F3F',
  muted: '#555555',
  border: '#CCCCCC',
  headerBg: '#F0F4F8',
};

function drawTitle(text) {
  doc.moveDown(0.5);
  doc.fontSize(16).fillColor(colors.primary).font('Helvetica-Bold').text(text, { underline: false });
  doc.moveDown(0.3);
  doc.font('Helvetica').fillColor('#000000');
}

function drawSection(num, title) {
  doc.moveDown(0.8);
  doc.fontSize(13).fillColor(colors.primary).font('Helvetica-Bold').text(`${num}. ${title}`);
  doc.moveDown(0.25);
  doc.fontSize(10).fillColor('#000000').font('Helvetica');
}

function drawParagraph(text) {
  doc.fontSize(10).fillColor('#000000').font('Helvetica').text(text, { lineGap: 3 });
  doc.moveDown(0.2);
}

function drawBullet(text) {
  doc.fontSize(10).text(`  •  ${text}`, { lineGap: 2, indent: 10, paragraphGap: 2 });
}

function drawTable(headers, rows, colWidths) {
  const startX = doc.page.margins.left;
  const rowHeight = 18;
  let y = doc.y;

  if (y + rowHeight * (rows.length + 2) > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
    y = doc.page.margins.top;
  }

  doc.fontSize(9).font('Helvetica-Bold');
  let x = startX;
  headers.forEach((header, index) => {
    doc.rect(x, y, colWidths[index], rowHeight).fillAndStroke(colors.headerBg, colors.border);
    doc.fillColor(colors.primary).text(header, x + 4, y + 5, { width: colWidths[index] - 8, lineBreak: false });
    x += colWidths[index];
  });
  y += rowHeight;

  doc.font('Helvetica').fillColor('#000000');
  rows.forEach((row) => {
    if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    x = startX;
    const cellHeights = row.map((cell, index) => {
      doc.fontSize(8);
      return doc.heightOfString(cell, { width: colWidths[index] - 8 });
    });
    const maxHeight = Math.max(rowHeight, ...cellHeights.map((h) => h + 8));

    row.forEach((cell, index) => {
      doc.rect(x, y, colWidths[index], maxHeight).stroke(colors.border);
      doc.fillColor('#000000').text(cell, x + 4, y + 4, { width: colWidths[index] - 8 });
      x += colWidths[index];
    });
    y += maxHeight;
  });

  doc.y = y + 8;
}

// Cover
doc.fontSize(22).fillColor(colors.primary).font('Helvetica-Bold').text('TeqMD', { align: 'center' });
doc.moveDown(0.3);
doc.fontSize(16).text('Registration & Setup Checklist', { align: 'center' });
doc.moveDown(0.5);
doc.fontSize(10).fillColor(colors.muted).font('Helvetica').text(
  'Philippines-first technology advisory platform — quiz, booking, payments, email, meetings, recordings.',
  { align: 'center' },
);
doc.moveDown(0.3);
doc.text('Generated: May 30, 2026', { align: 'center' });
doc.moveDown(1.5);

drawSection('1', 'Core platform (required for production)');
drawTable(
  ['Service', 'Purpose', 'Configure via'],
  [
    ['MongoDB Atlas', 'All persisted data', 'MONGODB_URI, MONGODB_DB_NAME'],
    ['Hosting (Railway)', 'Next.js API + admin', 'NEXT_PUBLIC_APP_URL'],
    ['Domain', 'Webhooks, emails, redirects', 'NEXT_PUBLIC_APP_URL'],
  ],
  [100, 180, 215],
);
drawParagraph('Server secrets (generate yourself):');
drawBullet('ADMIN_TOKEN — admin login (required in production)');
drawBullet('PAYMENT_CREDENTIALS_MASTER_KEY (32+ chars) — Admin → Payments');
drawBullet('EMAIL_CREDENTIALS_MASTER_KEY (32+ chars) — Admin → Email');
drawBullet('MEETINGS_CREDENTIALS_MASTER_KEY (32+ chars) — Meetings + Fathom');
drawBullet('CRON_SECRET — optional; protects POST /api/cron/payment-holds');
drawParagraph('Scheduler: Railway Cron running: pnpm --filter web cron:payment-holds');

drawSection('2', 'Payment gateways (pick one or more)');
drawParagraph('Supported: PayMongo, Xendit, HitPay, PayPal');
drawTable(
  ['Gateway', 'Webhook URL'],
  [
    ['PayMongo', '{APP_URL}/api/webhooks/paymongo'],
    ['Xendit', '{APP_URL}/api/webhooks/xendit'],
    ['HitPay', '{APP_URL}/api/webhooks/hitpay'],
    ['PayPal', '{APP_URL}/api/webhooks/paypal'],
  ],
  [120, 375],
);
drawParagraph('Admin → Settings → Payments credential fields:');
drawBullet('PayMongo: secretKey, secretKeyTest (optional), webhookSecret');
drawBullet('Xendit: secretKey, webhookToken');
drawBullet('HitPay: apiKey, apiKeyTest (optional), salt');
drawBullet('PayPal: clientId, clientSecret');

doc.addPage();

drawSection('3', 'Transactional email (pick one)');
drawTable(
  ['Provider', 'Register', 'Admin fields'],
  [
    ['Resend', 'Account + verified domain', 'apiKey, from'],
    ['Postmark', 'Server + verified domain', 'serverToken, from'],
    ['SendGrid', 'Account + verified sender', 'apiKey, from'],
  ],
  [80, 180, 235],
);
drawParagraph('Env fallback (Resend only): RESEND_API_KEY + EMAIL_FROM when active provider is None.');
drawParagraph('Optional: BOOKING_CONFIRMATION_BCC, EMAIL_SANDBOX_TO (sandbox mode).');
drawParagraph('Emails: booking confirmation, payment reminder, Fathom notes, support notifications.');

drawSection('4', 'Video meetings (one active provider)');
drawTable(
  ['Provider', 'Register', 'Key admin fields'],
  [
    ['Zoom', 'Server-to-Server OAuth app', 'accountId, clientId, clientSecret, hostUserId'],
    ['Google Meet', 'Google Cloud + Calendar API + OAuth', 'clientId, clientSecret, refreshToken'],
    ['Microsoft Teams', 'Azure AD app + admin consent', 'tenantId, clientId, clientSecret, organizerUserId'],
  ],
  [90, 175, 230],
);
drawParagraph('Only the active provider in Admin → Meetings creates links for paid bookings.');
drawParagraph('See docs/google-meet-oauth-setup.md for Google Meet OAuth steps.');

drawSection('5', 'Consultation recordings (Fathom)');
drawBullet('Fathom account — connect Zoom/Meet/Teams; enable visible notetaker');
drawBullet('API key from User Settings → API Access');
drawBullet('Webhook: {APP_URL}/api/webhooks/fathom');
drawBullet('Admin fields: apiKey, webhookSecret, hostEmail');
drawParagraph('See docs/fathom-setup.md for full setup.');

drawSection('6', 'AI — OpenAI (optional)');
drawBullet('OPENAI_API_KEY — required for diagnostic rounds and admin advisor');
drawBullet('OPENAI_DIAGNOSTIC_MODEL (default gpt-4o-mini)');
drawBullet('OPENAI_ADVISOR_MODEL (default gpt-4.1)');
drawBullet('Semantic cache: Atlas Vector Search + DIAGNOSTIC_CACHE_VECTOR_INDEX_NAME');

drawSection('7', 'Analytics');
drawBullet('Google Analytics 4 → NEXT_PUBLIC_GA_MEASUREMENT_ID (loads after cookie consent)');

drawSection('8', 'Support reports');
drawBullet('Admin → Settings → Support notification emails');
drawBullet('Env fallback: SUPPORT_REPORT_TO');

doc.addPage();

drawSection('9', 'Customer accounts');
drawParagraph('Built-in email/password auth in MongoDB. No Clerk or Auth0 required.');

drawSection('10', 'Native app (Expo)');
drawBullet('Apple Developer Program — EXPO_PUBLIC_IOS_BUNDLE_ID');
drawBullet('Google Play Console — EXPO_PUBLIC_ANDROID_PACKAGE');
drawBullet('EXPO_PUBLIC_API_BASE_URL → deployed web API');

drawSection('11', 'CMS / legal');
drawBullet('Blog managed in Admin → Blog (MongoDB)');
drawBullet('Optional: PRIVACY_POLICY_BLOG_POST_ID, TERMS_OF_USE_BLOG_POST_ID');

drawSection('', 'Admin Settings quick reference');
drawTable(
  ['Tab', 'External services'],
  [
    ['General', 'Brand name (database only)'],
    ['Pricing', 'None'],
    ['Payments', 'PayMongo / Xendit / HitPay / PayPal'],
    ['Email', 'Resend / Postmark / SendGrid'],
    ['Support', 'Email provider (same as above)'],
    ['Meetings', 'Zoom / Google Cloud / Microsoft Entra'],
    ['Recordings', 'Fathom'],
  ],
  [80, 415],
);

drawTitle('Recommended go-live order');
[
  '1. Atlas + hosting + NEXT_PUBLIC_APP_URL + master keys + ADMIN_TOKEN',
  '2. One payment gateway + webhooks + Payments settings + payment-holds cron',
  '3. One email provider + verified domain + Email settings',
  '4. One meeting provider + test booking end-to-end',
  '5. OpenAI for live diagnostics and advisor chat',
  '6. GA4 for marketing analytics',
  '7. Fathom if offering recording opt-in',
  '8. App Store / Play Store for native builds',
].forEach((step) => drawBullet(step));

doc.moveDown(1);
doc.fontSize(8).fillColor(colors.muted).text(
  'Source: apps/web/.env.example and docs/ in the it-advisory monorepo.',
  { align: 'center' },
);

doc.end();

doc.on('finish', () => {
  console.log(`PDF written to ${outputPath}`);
});
