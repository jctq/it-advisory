import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { buildApiUrl } from '@/lib/config/build-api-url';
import type { AdminClientDiagnosticReport } from '@/lib/data/admin-client-diagnostic';

export const ADMIN_CLIENT_DIAGNOSTIC_QUERY_KEY = 'admin-client-diagnostic' as const;

const ADMIN_CLIENT_DIAGNOSTIC_API_URL = buildApiUrl('/api/admin/client-diagnostic');

export type AdminClientDiagnosticQueryInput = {
  readonly diagnostic: string;
  readonly reference: string;
};

type AdminClientDiagnosticQueryResult = {
  readonly report: AdminClientDiagnosticReport;
};

function canRunAdminClientDiagnostic(input: AdminClientDiagnosticQueryInput): boolean {
  const diagnostic = input.diagnostic.trim();
  const reference = input.reference.trim();
  if (diagnostic.length === 0 && reference.length === 0) {
    return false;
  }
  if (reference.length > 0 && reference.length < 4) {
    return false;
  }
  return true;
}

async function fetchAdminClientDiagnostic(
  input: AdminClientDiagnosticQueryInput,
): Promise<AdminClientDiagnosticQueryResult> {
  const diagnostic = input.diagnostic.trim();
  const reference = input.reference.trim();
  const params = new URLSearchParams();
  if (diagnostic.length > 0) {
    params.set('diagnostic', diagnostic);
  }
  if (reference.length > 0) {
    params.set('reference', reference);
  }
  const response = await fetch(`${ADMIN_CLIENT_DIAGNOSTIC_API_URL}?${params.toString()}`, { cache: 'no-store' });
  const payload = (await response.json()) as {
    ok?: boolean;
    report?: AdminClientDiagnosticReport;
    error?: string;
  };
  if (payload.report !== undefined && response.ok && payload.ok === true) {
    return { report: payload.report };
  }
  throw new Error(typeof payload.error === 'string' ? payload.error : 'Diagnostic failed.');
}

export function useAdminClientDiagnosticQuery(
  input: AdminClientDiagnosticQueryInput,
  enabled: boolean,
): UseQueryResult<AdminClientDiagnosticQueryResult, Error> {
  const canRun = canRunAdminClientDiagnostic(input);
  return useQuery({
    queryKey: [ADMIN_CLIENT_DIAGNOSTIC_QUERY_KEY, input.diagnostic.trim(), input.reference.trim()],
    queryFn: () => fetchAdminClientDiagnostic(input),
    enabled: enabled && canRun,
  });
}

export function resolveAdminClientDiagnosticValidationError(input: AdminClientDiagnosticQueryInput): string | null {
  const diagnostic = input.diagnostic.trim();
  const reference = input.reference.trim();
  if (diagnostic.length === 0 && reference.length === 0) {
    return 'Enter a diagnostic session id/ref and/or a booking reference.';
  }
  if (reference.length > 0 && reference.length < 4) {
    return 'Booking reference must be at least four characters.';
  }
  return null;
}
