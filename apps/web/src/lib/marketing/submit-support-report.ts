import { buildApiUrl } from '@/lib/config/build-api-url';

export type SubmitSupportReportInput = {
  readonly message: string;
  readonly route: string;
  readonly source: 'native' | 'web';
  readonly screenshot: Blob | null;
  readonly reporterEmail?: string | null;
  readonly reporterName?: string | null;
  readonly reporterMobile?: string | null;
  readonly deviceId?: string | null;
};

export type SubmitSupportReportResult =
  | { readonly ok: true; readonly reportId: string }
  | { readonly ok: false; readonly error: string };

/**
 * Submits a support report with optional screenshot attachment.
 */
export async function submitSupportReport(input: SubmitSupportReportInput): Promise<SubmitSupportReportResult> {
  const formData = new FormData();
  formData.append('message', input.message.trim());
  formData.append('route', input.route.trim());
  formData.append('source', input.source);
  if (input.reporterEmail !== undefined && input.reporterEmail !== null && input.reporterEmail.trim().length > 0) {
    formData.append('reporterEmail', input.reporterEmail.trim());
  }
  if (input.reporterName !== undefined && input.reporterName !== null && input.reporterName.trim().length > 0) {
    formData.append('reporterName', input.reporterName.trim());
  }
  if (input.reporterMobile !== undefined && input.reporterMobile !== null && input.reporterMobile.trim().length > 0) {
    formData.append('reporterMobile', input.reporterMobile.trim());
  }
  if (input.deviceId !== undefined && input.deviceId !== null && input.deviceId.trim().length > 0) {
    formData.append('deviceId', input.deviceId.trim());
  }
  if (input.screenshot !== null) {
    const extension =
      input.screenshot.type === 'image/jpeg'
        ? 'jpg'
        : input.screenshot.type === 'image/webp'
          ? 'webp'
          : 'png';
    formData.append('screenshot', input.screenshot, `report.${extension}`);
  }
  const headers: HeadersInit = {};
  if (input.deviceId !== undefined && input.deviceId !== null && input.deviceId.trim().length > 0) {
    headers['X-Device-Id'] = input.deviceId.trim();
  }
  const response = await fetch(buildApiUrl('/api/support/report'), {
    method: 'POST',
    body: formData,
    credentials: 'include',
    headers,
  });
  const payload = (await response.json()) as { readonly ok?: boolean; readonly reportId?: string; readonly error?: string; readonly details?: string };
  if (!response.ok) {
    const message = payload.details ?? payload.error ?? 'Failed to submit report.';
    return { ok: false, error: message };
  }
  if (payload.reportId === undefined || payload.reportId.length === 0) {
    return { ok: false, error: 'Invalid response from server.' };
  }
  return { ok: true, reportId: payload.reportId };
}
