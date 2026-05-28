import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';
import {
  createSupportReport,
  getMaxSupportReportMessageLength,
  getMaxSupportReportScreenshotBytes,
  getMinSupportReportMessageLength,
  isAllowedSupportReportScreenshotContentType,
  type SupportReportSource,
} from '@/lib/data/support-reports';
import { findUserById } from '@/lib/data/users';
import { executeSendSupportReportSubmissionEmails } from '@/lib/email/execute-support-report-emails';
import { parseGuestSupportReportContact } from '@/lib/marketing/support-report-guest-contact';
import { assertSupportModuleEnabled } from '@/lib/marketing/support-module-gate';
import { getAuthenticatedMarketingUser } from '@/lib/server/marketing-auth';

export const dynamic = 'force-dynamic';

const ALLOWED_SOURCES: ReadonlySet<string> = new Set(['native', 'web']);

function parseSource(value: string): SupportReportSource | null {
  const trimmed = value.trim();
  if (!ALLOWED_SOURCES.has(trimmed)) {
    return null;
  }
  return trimmed as SupportReportSource;
}

function readOptionalFormString(formData: FormData, key: string): string | null {
  const entry = formData.get(key);
  if (typeof entry !== 'string') {
    return null;
  }
  const trimmed = entry.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildCorsHeaders(request: Request): Headers {
  const headers = new Headers();
  const origin = request.headers.get('origin')?.trim();
  if (origin !== undefined && origin.length > 0) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
    headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Device-Id, Authorization');
  }
  return headers;
}

export async function OPTIONS(request: Request): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: buildCorsHeaders(request) });
}

export async function POST(request: Request): Promise<NextResponse> {
  const corsHeaders = buildCorsHeaders(request);
  const disabledResponse = await assertSupportModuleEnabled();
  if (disabledResponse !== null) {
    return new NextResponse(disabledResponse.body, {
      status: disabledResponse.status,
      headers: corsHeaders,
    });
  }
  try {
    const formData = await request.formData();
    const messageEntry = formData.get('message');
    const routeEntry = formData.get('route');
    const sourceEntry = formData.get('source');
    if (typeof messageEntry !== 'string' || typeof routeEntry !== 'string' || typeof sourceEntry !== 'string') {
      return NextResponse.json(
        { error: 'Missing message, route, or source.' },
        { status: 400, headers: corsHeaders },
      );
    }
    const source = parseSource(sourceEntry);
    if (source === null) {
      return NextResponse.json({ error: 'Invalid source. Use native or web.' }, { status: 400, headers: corsHeaders });
    }
    const authUser = await getAuthenticatedMarketingUser(request);
    let reporterEmail: string | null = null;
    let reporterName: string | null = null;
    let reporterMobile: string | null = null;
    const reporterUserId = authUser?.id ?? null;
    if (authUser !== null) {
      reporterEmail = authUser.email;
      const userDoc = await findUserById(new ObjectId(authUser.id));
      if (userDoc !== null) {
        const fullName = userDoc.fullName?.trim() ?? '';
        reporterName = fullName.length > 0 ? fullName : null;
        const phone = userDoc.phone?.trim() ?? '';
        reporterMobile = phone.length > 0 ? phone : null;
      }
    } else {
      const parsedContact = parseGuestSupportReportContact({
        reporterName: readOptionalFormString(formData, 'reporterName') ?? '',
        reporterEmail: readOptionalFormString(formData, 'reporterEmail') ?? '',
        reporterMobile: readOptionalFormString(formData, 'reporterMobile') ?? '',
      });
      if (!parsedContact.ok) {
        return NextResponse.json({ error: parsedContact.error }, { status: 400, headers: corsHeaders });
      }
      reporterEmail = parsedContact.contact.reporterEmail;
      reporterName = parsedContact.contact.reporterName;
      reporterMobile = parsedContact.contact.reporterMobile;
    }
    const deviceIdHeader = request.headers.get('x-device-id')?.trim() ?? '';
    const deviceIdForm = formData.get('deviceId');
    const deviceIdFromForm = typeof deviceIdForm === 'string' ? deviceIdForm.trim() : '';
    const deviceId =
      deviceIdHeader.length > 0 ? deviceIdHeader : deviceIdFromForm.length > 0 ? deviceIdFromForm : null;
    const userAgent = request.headers.get('user-agent');
    let screenshot: { readonly contentType: string; readonly buffer: Buffer } | null = null;
    const screenshotEntry = formData.get('screenshot');
    if (screenshotEntry instanceof File && screenshotEntry.size > 0) {
      const contentType = screenshotEntry.type.trim();
      if (!isAllowedSupportReportScreenshotContentType(contentType)) {
        return NextResponse.json(
          { error: 'Unsupported screenshot type. Use JPEG, PNG, or WebP.' },
          { status: 400, headers: corsHeaders },
        );
      }
      if (screenshotEntry.size > getMaxSupportReportScreenshotBytes()) {
        return NextResponse.json(
          { error: 'Screenshot is too large. Maximum size is 5 MB.' },
          { status: 400, headers: corsHeaders },
        );
      }
      screenshot = {
        contentType,
        buffer: Buffer.from(await screenshotEntry.arrayBuffer()),
      };
    }
    const report = await createSupportReport({
      message: messageEntry,
      route: routeEntry,
      source,
      reporterEmail,
      reporterUserId,
      reporterName,
      reporterMobile,
      deviceId,
      userAgent,
      screenshot,
    });
    void executeSendSupportReportSubmissionEmails(report).catch(() => undefined);
    return NextResponse.json({ ok: true, reportId: report.id }, { status: 201, headers: corsHeaders });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status =
      message.includes('at least') ||
      message.includes('at most') ||
      message.includes('required') ||
      message.includes('Unsupported') ||
      message.includes('too large') ||
      message.includes('empty')
        ? 400
        : 500;
    return NextResponse.json({ error: 'Failed to submit report.', details: message }, { status, headers: corsHeaders });
  }
}

export async function GET(): Promise<NextResponse> {
  const disabledResponse = await assertSupportModuleEnabled();
  if (disabledResponse !== null) {
    return disabledResponse;
  }
  return NextResponse.json({
    minMessageLength: getMinSupportReportMessageLength(),
    maxMessageLength: getMaxSupportReportMessageLength(),
    maxScreenshotBytes: getMaxSupportReportScreenshotBytes(),
  });
}
