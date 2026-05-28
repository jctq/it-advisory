import { describe, expect, it } from 'vitest';
import { buildMarketingLeadContactFromAccountUser } from './account-profile-lead-contact';

describe('buildMarketingLeadContactFromAccountUser', () => {
  it('returns contact when account has email', () => {
    const contact = buildMarketingLeadContactFromAccountUser({
      emailNormalized: 'user@example.com',
      fullName: 'Ana Reyes',
      company: 'Acme',
      phone: '+639171234567',
    });
    expect(contact).toEqual({
      name: 'Ana Reyes',
      email: 'user@example.com',
      company: 'Acme',
      phone: '+639171234567',
    });
  });

  it('returns null when email is empty', () => {
    expect(buildMarketingLeadContactFromAccountUser({ emailNormalized: '   ' })).toBeNull();
  });
});
