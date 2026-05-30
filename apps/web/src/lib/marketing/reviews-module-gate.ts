import { getAppSettings } from '@/lib/data/app-settings';

/**
 * Whether the marketing testimonials / reviews section may be shown (admin general setting).
 * The homepage still requires at least one published testimonial before rendering the section.
 */
export async function readReviewsModuleEnabled(): Promise<boolean> {
  const settings = await getAppSettings();
  return settings.reviewsModuleEnabled;
}
