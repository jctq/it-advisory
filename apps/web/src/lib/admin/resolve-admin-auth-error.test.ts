import { describe, expect, it } from 'vitest';
import {
  normalizeAdminAuthErrorCode,
  resolveAdminAuthErrorPresentation,
} from './resolve-admin-auth-error';

describe('resolveAdminAuthErrorPresentation', () => {
  it('normalizes AccessDenied/signin suffix', () => {
    expect(normalizeAdminAuthErrorCode('AccessDenied/signin')).toBe('AccessDenied');
  });

  it('returns user-facing copy for AccessDenied without technical details', () => {
    const presentation = resolveAdminAuthErrorPresentation('AccessDenied/signin');
    expect(presentation?.title).toBe('Access not approved');
    expect(presentation?.message).toContain('permission');
    expect(presentation?.message).not.toMatch(/ADMIN_|AUTH_|OAuth|allowlist/i);
  });
});
