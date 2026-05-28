import {
  buildPhilippineMobileE164FromNationalDigits,
  parsePhilippineMobileE164,
} from '@techmd/domain/philippine-mobile-phone';

const MAX_REPORTER_NAME_LENGTH = 150;
const MAX_REPORTER_EMAIL_LENGTH = 320;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type GuestSupportReportContactInput = {
  readonly reporterName: string;
  readonly reporterEmail: string;
  readonly reporterMobile: string;
};

export type ParsedGuestSupportReportContact = {
  readonly reporterName: string;
  readonly reporterEmail: string;
  readonly reporterMobile: string;
};

export function parseGuestSupportReportContact(
  input: GuestSupportReportContactInput,
): { readonly ok: true; readonly contact: ParsedGuestSupportReportContact } | { readonly ok: false; readonly error: string } {
  const reporterName = input.reporterName.trim();
  if (reporterName.length < 2) {
    return { ok: false, error: 'Enter your full name (at least 2 characters).' };
  }
  if (reporterName.length > MAX_REPORTER_NAME_LENGTH) {
    return { ok: false, error: `Name must be at most ${MAX_REPORTER_NAME_LENGTH} characters.` };
  }
  const reporterEmail = input.reporterEmail.trim().toLowerCase();
  if (reporterEmail.length === 0) {
    return { ok: false, error: 'Enter your email address.' };
  }
  if (reporterEmail.length > MAX_REPORTER_EMAIL_LENGTH || !EMAIL_PATTERN.test(reporterEmail)) {
    return { ok: false, error: 'Enter a valid email address.' };
  }
  const reporterMobile =
    parsePhilippineMobileE164(input.reporterMobile.trim()) ??
    buildPhilippineMobileE164FromNationalDigits(input.reporterMobile.replace(/\D/g, '').replace(/^0+(?=9)/, ''));
  if (reporterMobile === null) {
    return { ok: false, error: 'Enter a valid Philippine mobile number (+63 9xx xxx xxxx).' };
  }
  return {
    ok: true,
    contact: {
      reporterName,
      reporterEmail,
      reporterMobile,
    },
  };
}
