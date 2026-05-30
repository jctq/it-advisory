#!/usr/bin/env node
/**
 * Generates docs/provider-costing.pdf — third-party provider pricing reference.
 * Run: node docs/generate-provider-costing-pdf.mjs
 */
import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(__dirname, 'provider-costing.pdf');

const doc = new PDFDocument({
  margin: 50,
  size: 'A4',
  info: {
    Title: 'TeqMD Provider Costing Reference',
    Author: 'TeqMD',
    Subject: 'Third-party service pricing for CDN, database, payments, email, meetings, AI, and analytics',
  },
});

doc.pipe(fs.createWriteStream(outputPath));

const colors = {
  primary: '#001F3F',
  muted: '#555555',
  border: '#CCCCCC',
  headerBg: '#F0F4F8',
  accent: '#0066CC',
};

function ensureSpace(height) {
  if (doc.y + height > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
}

function drawSection(num, title) {
  ensureSpace(40);
  doc.moveDown(0.6);
  doc.fontSize(13).fillColor(colors.primary).font('Helvetica-Bold').text(`${num}. ${title}`);
  doc.moveDown(0.2);
  doc.fontSize(10).fillColor('#000000').font('Helvetica');
}

function drawSubsection(title) {
  ensureSpace(30);
  doc.moveDown(0.3);
  doc.fontSize(11).fillColor(colors.accent).font('Helvetica-Bold').text(title);
  doc.moveDown(0.15);
  doc.fontSize(10).fillColor('#000000').font('Helvetica');
}

function drawParagraph(text) {
  doc.fontSize(10).fillColor('#000000').font('Helvetica').text(text, { lineGap: 3 });
  doc.moveDown(0.15);
}

function drawBullet(text) {
  doc.fontSize(9.5).text(`  •  ${text}`, { lineGap: 2, indent: 10, paragraphGap: 2 });
}

function drawTable(headers, rows, colWidths) {
  const startX = doc.page.margins.left;
  const rowHeight = 18;
  let y = doc.y;

  ensureSpace(rowHeight * Math.min(rows.length + 2, 6));

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

  doc.y = y + 6;
}

// Cover
doc.fontSize(22).fillColor(colors.primary).font('Helvetica-Bold').text('TeqMD', { align: 'center' });
doc.moveDown(0.3);
doc.fontSize(16).text('Provider Costing Reference', { align: 'center' });
doc.moveDown(0.5);
doc.fontSize(10).fillColor(colors.muted).font('Helvetica').text(
  'Pricing summary for CDN, database, payments, email, video meetings, AI note-taking, OpenAI, and marketing analytics.',
  { align: 'center' },
);
doc.moveDown(0.3);
doc.text('Generated: May 31, 2026  •  Prices are indicative — verify on each provider site before budgeting.', {
  align: 'center',
});
doc.moveDown(1.2);

drawSubsection('Executive summary — typical TeqMD stack');
drawTable(
  ['Provider', 'Role', 'Typical monthly cost'],
  [
    ['Cloudflare', 'CDN, DNS, SSL, WAF', '$0 (Free) – $20 (Pro)'],
    ['MongoDB Atlas', 'Database', '$0 (M0) – $30 (Flex) – $57+ (M10)'],
    ['PayMongo', 'Payment gateway (PH)', 'Pay-per-transaction only'],
    ['Resend', 'Transactional email', '$0 – $20'],
    ['Google Meet', 'Video meetings (via Workspace)', '$7 – $22 / user'],
    ['Fathom AI', 'Meeting recordings & notes', '$0 – $20 / user'],
    ['OpenAI', 'Diagnostic & advisor AI', 'Usage-based (~$5 – $50+)'],
    ['Google Analytics 4', 'Marketing analytics', '$0'],
  ],
  [95, 175, 220],
);

drawSubsection('Estimated monthly totals (excluding payment fees & OpenAI usage)');
drawTable(
  ['Scenario', 'Assumptions', 'Est. fixed monthly'],
  [
    ['MVP / dev', 'Free tiers + 1 Meet user + Fathom Free', '$0 – $7'],
    ['Small launch', 'Atlas Flex, Resend Pro, 2 Meet users, Fathom Premium', '~$60 – $90 + transactions'],
    ['Growing ops', 'Atlas M10, Cloudflare Pro, 5 Meet users, Fathom Team (2+)', '~$200 – $350 + transactions'],
  ],
  [80, 250, 165],
);

doc.addPage();

// 1. Cloudflare
drawSection('1', 'Cloudflare — CDN, security & analytics');
drawParagraph('Website: https://www.cloudflare.com/');
drawTable(
  ['Plan', 'Monthly price', 'Highlights'],
  [
    ['Free', '$0', 'CDN, DNS, Universal SSL, basic DDoS protection'],
    ['Pro', '$20/mo (annual) or $25/mo', 'Advanced WAF, more rules, enhanced analytics, image optimization'],
    ['Business', '$200/mo (annual) or $250/mo', '100% uptime SLA, custom SSL, 24/7 email support, advanced bot mitigation'],
    ['Enterprise', 'Custom', 'Dedicated support, custom contracts, advanced security bundles'],
  ],
  [70, 115, 305],
);
drawSubsection('Common add-ons');
drawBullet('Argo Smart Routing — from $5/mo');
drawBullet('Load Balancing — from $5/mo');
drawBullet('Rate Limiting — usage-based');
drawBullet('Log Explorer — $1/GB ingested (first 10 GB free)');
drawBullet('Web Analytics — included on all plans (privacy-friendly, no cookie banner required for CF analytics)');
drawParagraph('Recommendation for TeqMD: Free tier is sufficient at launch; upgrade to Pro ($20/mo) if you need advanced WAF rules or deeper CDN analytics.');

// 2. MongoDB
drawSection('2', 'MongoDB Atlas — database');
drawParagraph('Website: https://www.mongodb.com/pricing');
drawTable(
  ['Tier', 'Monthly price', 'Specs / notes'],
  [
    ['M0 (Free)', '$0 forever', '512 MB storage, shared resources, 100 ops/sec — good for dev'],
    ['Flex', '$8 – $30/mo (capped)', '5 GB storage, 100–500 ops/sec burst, includes Vector Search'],
    ['M10 (Dedicated)', '~$57/mo', '2 GB RAM, 10 GB storage — small production baseline'],
    ['M30', '~$210/mo', '8 GB RAM, 40 GB — recommended production baseline'],
    ['M40+', '$390+/mo', 'Mid-size to enterprise workloads'],
  ],
  [95, 115, 280],
);
drawSubsection('Flex tier breakdown (usage-based, capped at $30/mo)');
drawTable(
  ['Throughput', 'Monthly cost'],
  [
    ['0 – 100 ops/sec (base)', '$8'],
    ['100 – 200 ops/sec', '$15'],
    ['200 – 300 ops/sec', '$21'],
    ['300 – 400 ops/sec', '$26'],
    ['400 – 500 ops/sec', '$30 (max)'],
  ],
  [250, 245],
);
drawParagraph('Recommendation for TeqMD: M0 for development; Flex ($8–30) or M10 (~$57) for production depending on traffic and Vector Search needs.');

doc.addPage();

// 3. PayMongo
drawSection('3', 'PayMongo — payment gateway (Philippines)');
drawParagraph('Website: https://www.paymongo.com/pricing  •  All rates exclusive of 12% VAT');
drawParagraph('Standard checkout: no setup fee, no monthly platform fee. Pay only per successful transaction.');
drawTable(
  ['Payment method', 'Fee'],
  [
    ['Cards (Visa/Mastercard, local)', '3.125% + ₱13.39 per transaction'],
    ['Cards (international)', '4.02% + ₱13.39 per transaction'],
    ['GCash', '2.23%'],
    ['Maya', '1.79%'],
    ['GrabPay', '1.96%'],
    ['ShopeePay / SPayLater / MariBank', '1.70%'],
    ['QR Ph (online & in-store)', '1.34%'],
    ['Direct online banking (BDO, UBP, BPI, etc.)', '0.71% or ₱13.39 (whichever is higher)'],
    ['BillEase BNPL', '1.34%'],
  ],
  [280, 215],
);
drawSubsection('Example transaction costs (excluding VAT)');
drawTable(
  ['Amount', 'Card (local)', 'GCash', 'QR Ph'],
  [
    ['₱1,000', '₱44.64', '₱22.30', '₱13.40'],
    ['₱5,000', '₱169.64', '₱111.50', '₱67.00'],
    ['₱10,000', '₱325.89', '₱223.00', '₱134.00'],
  ],
  [100, 145, 120, 130],
);
drawSubsection('Optional extras (not required for standard checkout)');
drawBullet('Instant settlement — up to 2% (QR/bank) or 3% (cards/BNPL)');
drawBullet('Payouts / disbursements — ₱10 per InstaPay/PesoNET transfer');
drawBullet('PayMongo Protect (fraud) — ₱120,000/mo platform + per-screen fee');
drawBullet('Storefront AI builder — ₱349/mo (separate product)');

doc.addPage();

// 4. Resend
drawSection('4', 'Resend — transactional email');
drawParagraph('Website: https://resend.com/pricing');
drawTable(
  ['Plan', 'Price', 'Volume', 'Overage'],
  [
    ['Free', '$0/mo', '3,000 emails/mo (100/day max)', 'Not available'],
    ['Pro', '$20/mo', '50,000 emails/mo', '$0.90 / 1,000'],
    ['Pro', '$35/mo', '100,000 emails/mo', '$0.90 / 1,000'],
    ['Scale', '$90/mo', '100,000 emails/mo', '$0.90 / 1,000'],
    ['Scale', '$350/mo', '500,000 emails/mo', '$0.70 / 1,000'],
    ['Enterprise', 'Custom', '3M+ emails/mo', 'Custom'],
  ],
  [70, 70, 175, 175],
);
drawSubsection('Marketing email (contact-based, separate product)');
drawTable(
  ['Plan', 'Price', 'Contacts'],
  [
    ['Free', '$0/mo', '1,000 contacts'],
    ['Pro Marketing', '$40/mo', '5,000 contacts'],
    ['Pro Marketing', '$250/mo', '50,000 contacts'],
  ],
  [110, 90, 295],
);
drawBullet('Dedicated IP add-on — $30/mo (Scale plan, 500+ emails/day)');
drawBullet('Automation runs — 10,000/mo included; $0.0015 per run overage on paid plans');
drawParagraph('Recommendation for TeqMD: Free tier covers early booking confirmations; Pro ($20/mo) when exceeding 3,000 emails/month.');

// 5. Google Meet
drawSection('5', 'Google Meet — video meetings');
drawParagraph('Website: https://meet.google.com/  •  Business features require Google Workspace (not sold separately).');
drawParagraph('Pricing effective March 2025 (Gemini AI included in paid plans).');
drawTable(
  ['Plan', 'Annual billing', 'Flexible (monthly)', 'Meet limits'],
  [
    ['Free (personal)', '$0', '$0', '100 participants, 60 min (group calls)'],
    ['Business Starter', '$7/user/mo', '$8.40/user/mo', '100 participants, 24 hr, dial-in'],
    ['Business Standard', '$14/user/mo', '$16.80/user/mo', '150 participants, recording, breakout rooms'],
    ['Business Plus', '$22/user/mo', '$26.40/user/mo', '500 participants, attendance tracking, Vault'],
    ['Enterprise', 'Custom', 'Custom', '1,000 participants, live streaming, DLP'],
  ],
  [105, 95, 105, 195],
);
drawParagraph('Google Meet API integration (Calendar API + OAuth) uses the same Workspace account — no separate Meet API fee.');
drawParagraph('Recommendation for TeqMD: Business Starter ($7/user/mo) for 1–2 hosts; Standard ($14) if you need meeting recordings natively in Google (Fathom provides separate recording).');

doc.addPage();

// 6. Fathom
drawSection('6', 'Fathom AI — meeting note taker & recordings');
drawParagraph('Website: https://www.fathom.ai/pricing');
drawParagraph('Chrome extension: https://chromewebstore.google.com/detail/fathom-ai-note-taker-for/nhocmlminaplaendbabmoemehbpgdemn');
drawParagraph('The Chrome extension is free — it is a companion to the Fathom desktop/web app. Pricing is per Fathom account, not per extension install.');
drawTable(
  ['Plan', 'Monthly', 'Annual (per mo)', 'Min users', 'Key features'],
  [
    ['Free', '$0', '$0', '1', 'Unlimited recordings & transcription; limited advanced AI summaries'],
    ['Premium', '$20/user', '$16/user', '1', 'Unlimited AI summaries, action items, Ask Fathom'],
    ['Team', '$19/user', '$15/user', '2', 'SSO, team search, keyword alerts, shared playlists'],
    ['Business', '$34/user', '$25/user', '2', 'CRM field sync, Deal View, coaching metrics'],
  ],
  [60, 65, 75, 55, 245],
);
drawSubsection('Team cost examples (annual billing)');
drawTable(
  ['Team size', 'Team plan/mo', 'Business plan/mo'],
  [
    ['2 users', '$30', '$50'],
    ['5 users', '$75', '$125'],
    ['10 users', '$150', '$250'],
  ],
  [120, 185, 185],
);
drawParagraph('Recommendation for TeqMD: Free tier for testing; Premium ($16/user/mo annual) for solo consultants; Team if multiple staff need shared call libraries.');

// 7. OpenAI
drawSection('7', 'OpenAI — AI models (diagnostic & advisor)');
drawParagraph('Website: https://openai.com/api/pricing  •  Pay-as-you-go per token; no monthly platform fee.');
drawSubsection('Models relevant to TeqMD (from apps/web defaults)');
drawTable(
  ['Model', 'Input / 1M tokens', 'Output / 1M tokens', 'Use case'],
  [
    ['gpt-4o-mini', '$0.15', '$0.60', 'Guided diagnostic rounds (default)'],
    ['gpt-4.1', '$2.00', '$8.00', 'Admin advisor chat (default)'],
    ['gpt-4.1-mini', '$0.40', '$1.60', 'Lower-cost alternative'],
    ['gpt-4.1-nano', '$0.10', '$0.40', 'Cheapest OpenAI option'],
    ['gpt-5.4 mini', '$0.75', '$4.50', 'Newer mini model'],
    ['gpt-5 nano', '$0.05', '$0.40', 'Lowest-cost GPT-5 family'],
  ],
  [90, 110, 110, 185],
);
drawSubsection('Usage cost examples (gpt-4o-mini diagnostic)');
drawTable(
  ['Monthly diagnostic sessions', 'Est. tokens/session', 'Est. monthly cost'],
  [
    ['100 sessions', '~2,000 in + 1,000 out', '~$0.09'],
    ['1,000 sessions', '~2,000 in + 1,000 out', '~$0.90'],
    ['10,000 sessions', '~2,000 in + 1,000 out', '~$9.00'],
  ],
  [155, 155, 180],
);
drawParagraph('Cached input tokens are discounted up to 90% on supported models. Batch API saves 50% for non-real-time workloads.');
drawParagraph('Recommendation for TeqMD: Budget $5–20/mo at launch with gpt-4o-mini; scale with traffic. Enable OpenAI billing alerts.');

doc.addPage();

// 8. Google Analytics
drawSection('8', 'Google Analytics 4 — marketing analytics');
drawParagraph('Website: https://developers.google.com/analytics  •  Property setup: https://analytics.google.com/');
drawTable(
  ['Edition', 'Price', 'Best for'],
  [
    ['GA4 (Standard)', '$0', 'Small to mid-size businesses — full core analytics'],
    ['GA4 360 (Enterprise)', 'From ~$50,000/year', 'High-volume enterprises (25M+ events/mo, SLA, BigQuery SLAs)'],
  ],
  [120, 130, 245],
);
drawSubsection('GA4 Free tier limits (typical)');
drawBullet('Up to 10 million events per month (most SMBs never hit this)');
drawBullet('500 distinct event types, 50 custom dimensions, 50 custom metrics');
drawBullet('BigQuery export: up to 1 million events/day free');
drawSubsection('Potential indirect costs (optional)');
drawBullet('BigQuery storage & queries beyond free tier — pay-as-you-go via Google Cloud');
drawBullet('Google Analytics 360 — contract-based, typically $50K–$175K/year for mid-market');
drawParagraph('Recommendation for TeqMD: GA4 Standard ($0) with NEXT_PUBLIC_GA_MEASUREMENT_ID — sufficient for marketing funnel tracking.');

// Combined budget
drawSection('9', 'Combined budget worksheet');
drawTable(
  ['Line item', 'Conservative (MVP)', 'Small business', 'Notes'],
  [
    ['Cloudflare', '$0', '$20', 'Free → Pro when needed'],
    ['MongoDB Atlas', '$8', '$57', 'Flex base → M10 production'],
    ['PayMongo', 'Variable', 'Variable', '3.125% + ₱13.39 per card txn (+ VAT)'],
    ['Resend', '$0', '$20', 'Free → Pro at 3K+ emails/mo'],
    ['Google Workspace (Meet)', '$7', '$28', '1 user → 2 users on Starter'],
    ['Fathom', '$0', '$16', 'Free → Premium (1 user)'],
    ['OpenAI', '$5', '$20', 'Usage estimate'],
    ['Google Analytics', '$0', '$0', 'Always free for standard GA4'],
    ['Fixed subtotal', '~$20/mo', '~$161/mo', 'Excludes hosting, domain, txn fees'],
  ],
  [95, 95, 95, 205],
);

doc.moveDown(0.8);
drawSubsection('Sources & disclaimer');
drawParagraph(
  'Pricing compiled from official provider pages on May 31, 2026. Exchange rate for PHP estimates not applied to USD items. Payment gateway fees exclude 12% VAT. Google Workspace and Fathom offer ~15–22% discounts on annual billing. Always confirm current rates before procurement.',
);
drawBullet('Cloudflare: cloudflare.com/plans');
drawBullet('MongoDB: mongodb.com/pricing');
drawBullet('PayMongo: paymongo.com/pricing');
drawBullet('Resend: resend.com/pricing');
drawBullet('Google Workspace: workspace.google.com/pricing');
drawBullet('Fathom: fathom.ai/pricing');
drawBullet('OpenAI: openai.com/api/pricing');
drawBullet('Google Analytics: analytics.google.com (GA4 free; GA 360 via Google sales)');

doc.moveDown(0.5);
doc.fontSize(8).fillColor(colors.muted).text(
  'TeqMD / it-advisory monorepo — docs/provider-costing.pdf',
  { align: 'center' },
);

doc.end();

doc.on('finish', () => {
  console.log(`PDF written to ${outputPath}`);
});
