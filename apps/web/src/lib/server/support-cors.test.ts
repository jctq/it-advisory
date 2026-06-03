import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildSupportCorsHeaders, listSupportCorsAllowedOrigins } from './support-cors';

describe('support-cors', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('lists configured app and checkout origins', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.com');
    vi.stubEnv('CHECKOUT_ALLOWED_APP_BASE_URLS', 'https://native.example.com');
    const origins = listSupportCorsAllowedOrigins();
    expect(origins).toContain('https://app.example.com');
    expect(origins).toContain('https://native.example.com');
  });

  it('echoes allowlisted origins only', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.com');
    const allowed = buildSupportCorsHeaders(
      new Request('https://app.example.com/api/support/report', {
        headers: { Origin: 'https://app.example.com' },
      }),
    );
    expect(allowed.get('Access-Control-Allow-Origin')).toBe('https://app.example.com');
    const blocked = buildSupportCorsHeaders(
      new Request('https://app.example.com/api/support/report', {
        headers: { Origin: 'https://evil.example.com' },
      }),
    );
    expect(blocked.get('Access-Control-Allow-Origin')).toBeNull();
  });
});
