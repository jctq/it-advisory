import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core';

const MIN_PASSWORD_SCORE = 2 as const;

zxcvbnOptions.setOptions({
  dictionary: {},
  graphs: {},
});

/**
 * Returns true when the password meets minimum zxcvbn score for marketing accounts.
 */
export function isPasswordStrongEnough(plainPassword: string): boolean {
  const result = zxcvbn(plainPassword);
  return result.score >= MIN_PASSWORD_SCORE;
}

export const PASSWORD_STRENGTH_MESSAGE = 'Choose a stronger password (mix letters, numbers, and symbols).';
