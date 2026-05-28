import { normalizePhilippineMobileNationalDigits } from '@techmd/domain/philippine-mobile-phone';
import { parseGuestSupportReportContact } from '@techmd/domain/support-report-guest-contact';

type SubmitSupportReportInput = {
  readonly apiBaseUrl: string;
  readonly message: string;
  readonly route: string;
  readonly screenshotUri: string | null;
  readonly deviceId: string | null;
  readonly reporterEmail?: string | null;
  readonly reporterName?: string | null;
  readonly reporterMobile?: string | null;
  readonly sessionToken?: string | null;
};

type SubmitSupportReportResult =
  | { readonly ok: true; readonly reportId: string }
  | { readonly ok: false; readonly error: string };

/**
 * Submits a support report with optional screenshot to the web API.
 */
export async function submitSupportReport(input: SubmitSupportReportInput): Promise<SubmitSupportReportResult> {
  const formData = new FormData();
  formData.append('message', input.message.trim());
  formData.append('route', input.route.trim());
  formData.append('source', 'native');
  if (input.reporterEmail !== undefined && input.reporterEmail !== null && input.reporterEmail.trim().length > 0) {
    formData.append('reporterEmail', input.reporterEmail.trim());
  }
  if (input.reporterName !== undefined && input.reporterName !== null && input.reporterName.trim().length > 0) {
    formData.append('reporterName', input.reporterName.trim());
  }
  if (input.reporterMobile !== undefined && input.reporterMobile !== null && input.reporterMobile.trim().length > 0) {
    formData.append('reporterMobile', input.reporterMobile.trim());
  }
  if (input.deviceId !== null && input.deviceId.trim().length > 0) {
    formData.append('deviceId', input.deviceId.trim());
  }
  if (input.screenshotUri !== null && input.screenshotUri.length > 0) {
    formData.append('screenshot', {
      uri: input.screenshotUri,
      name: 'report.png',
      type: 'image/png',
    } as unknown as Blob);
  }
  const headers: Record<string, string> = {};
  if (input.deviceId !== null && input.deviceId.trim().length > 0) {
    headers['X-Device-Id'] = input.deviceId.trim();
  }
  if (input.sessionToken !== undefined && input.sessionToken !== null && input.sessionToken.trim().length > 0) {
    headers.Authorization = `Bearer ${input.sessionToken.trim()}`;
  }
  const apiUrl = `${input.apiBaseUrl.replace(/\/$/, '')}/api/support/report`;
  const response = await fetch(apiUrl, {
    method: 'POST',
    body: formData,
    headers,
  });
  const payload = (await response.json()) as {
    readonly reportId?: string;
    readonly error?: string;
    readonly details?: string;
  };
  if (!response.ok) {
    return { ok: false, error: payload.details ?? payload.error ?? 'Failed to submit report.' };
  }
  if (payload.reportId === undefined || payload.reportId.length === 0) {
    return { ok: false, error: 'Invalid response from server.' };
  }
  return { ok: true, reportId: payload.reportId };
}

export { normalizePhilippineMobileNationalDigits, parseGuestSupportReportContact };
