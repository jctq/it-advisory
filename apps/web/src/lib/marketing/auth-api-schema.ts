import { z } from 'zod';

export const authEmailPasswordBodySchema = z.object({
  email: z.string().trim().email({ message: 'Enter a valid email address.' }).max(254),
  password: z.string().min(8, 'Use at least 8 characters.').max(200),
  mergeGuestProgress: z.boolean().optional().default(true),
  /** When true, response includes `sessionToken` for native clients; guest merge uses `x-device-id` instead of the visitor cookie. */
  returnSessionToken: z.boolean().optional().default(false),
});
