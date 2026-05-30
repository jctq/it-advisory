import { AdminTestimonialsList } from '@/components/admin/admin-testimonials-list';
import { listTestimonials } from '@/lib/data/testimonials';

export const metadata = {
  title: 'Testimonials — TeqMD Admin',
};

export const dynamic = 'force-dynamic';

export default async function AdminTestimonialsPage() {
  let testimonials: Awaited<ReturnType<typeof listTestimonials>> = [];
  let loadError: string | null = null;
  try {
    testimonials = await listTestimonials();
  } catch (error: unknown) {
    loadError = error instanceof Error ? error.message : 'Failed to load testimonials.';
  }
  return <AdminTestimonialsList initialTestimonials={testimonials} loadError={loadError} />;
}
