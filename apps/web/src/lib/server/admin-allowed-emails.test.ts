import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAdminEmailAllowed, listAdminAllowedEmails } from './admin-allowed-emails';

describe('admin allowed emails', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('parses comma-separated allowlist in lowercase', () => {
    vi.stubEnv('ADMIN_ALLOWED_EMAILS', ' Admin@Example.com , ops@teqmd.com ');
    expect(listAdminAllowedEmails()).toEqual(['admin@example.com', 'ops@teqmd.com']);
  });

  it('returns false for empty or missing email', () => {
    vi.stubEnv('ADMIN_ALLOWED_EMAILS', 'admin@example.com');
    expect(isAdminEmailAllowed(null)).toBe(false);
    expect(isAdminEmailAllowed('')).toBe(false);
  });

  it('allows only emails on the list', () => {
    vi.stubEnv('ADMIN_ALLOWED_EMAILS', 'admin@example.com');
    expect(isAdminEmailAllowed('admin@example.com')).toBe(true);
    expect(isAdminEmailAllowed('other@example.com')).toBe(false);
  });
});
