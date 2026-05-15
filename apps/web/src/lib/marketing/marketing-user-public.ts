import type { ObjectId } from 'mongodb';
import type { UserAccountDocument } from '@/domain/types';

export type MarketingUserPublicJson = {
  readonly id: string;
  readonly email: string;
  readonly fullName: string | null;
  readonly company: string | null;
  readonly phone: string | null;
};

/**
 * Builds the public marketing user payload returned by auth and profile APIs.
 */
export function buildMarketingUserPublicFromDocument(user: UserAccountDocument & { _id: ObjectId }): MarketingUserPublicJson {
  return {
    id: user._id.toHexString(),
    email: user.emailNormalized,
    fullName: user.fullName !== undefined && user.fullName.trim().length > 0 ? user.fullName.trim() : null,
    company: user.company !== undefined && user.company.trim().length > 0 ? user.company.trim() : null,
    phone: user.phone !== undefined && user.phone.trim().length > 0 ? user.phone.trim() : null,
  };
}

/**
 * Builds a public user payload for a freshly created account (no profile fields yet).
 */
export function buildMarketingUserPublicFromNewAccount(params: {
  readonly idHex: string;
  readonly emailNormalized: string;
}): MarketingUserPublicJson {
  return {
    id: params.idHex,
    email: params.emailNormalized,
    fullName: null,
    company: null,
    phone: null,
  };
}
