import { z } from 'zod';
import { isPasswordStrongEnough, PASSWORD_STRENGTH_MESSAGE } from '@/lib/server/password-strength';

const passwordFieldSchema = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(200)
  .refine((value) => isPasswordStrongEnough(value), { message: PASSWORD_STRENGTH_MESSAGE });

export const authEmailPasswordBodySchema = z.object({
  email: z.string().trim().email({ message: 'Enter a valid email address.' }).max(254),
  password: passwordFieldSchema,
  mergeGuestProgress: z.boolean().optional().default(true),
  /** When true, response includes `sessionToken` for native clients; guest merge uses `x-device-id` instead of the visitor cookie. */
  returnSessionToken: z.boolean().optional().default(false),
});

export const authRegisterBodySchema = authEmailPasswordBodySchema.extend({
  acceptedLegalTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the Terms of Use and Privacy Policy.' }),
  }),
});
