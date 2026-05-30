import { NextResponse } from 'next/server';
import { z } from 'zod';
import { deleteTestimonial, findTestimonialById, updateTestimonial } from '@/lib/data/testimonials';

export const dynamic = 'force-dynamic';

const testimonialStatusSchema = z.enum(['draft', 'published']);

const updateTestimonialSchema = z.object({
  quote: z.string().trim().max(500).optional(),
  name: z.string().trim().max(120).optional(),
  role: z.string().trim().max(120).optional(),
  status: testimonialStatusSchema.optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

type RouteContext = {
  readonly params: Promise<{ readonly testimonialId: string }>;
};

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  const { testimonialId } = await context.params;
  try {
    const testimonial = await findTestimonialById(testimonialId);
    if (testimonial === null) {
      return NextResponse.json({ error: 'Testimonial not found.' }, { status: 404 });
    }
    return NextResponse.json({ testimonial });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load testimonial.', details: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  const { testimonialId } = await context.params;
  let json: unknown = {};
  try {
    json = await request.json();
  } catch {}
  const parsed = updateTestimonialSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const testimonial = await updateTestimonial(testimonialId, parsed.data);
    return NextResponse.json({ testimonial });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message === 'Testimonial not found.' ? 404 : 500;
    return NextResponse.json({ error: 'Failed to update testimonial.', details: message }, { status });
  }
}

export async function DELETE(_request: Request, context: RouteContext): Promise<NextResponse> {
  const { testimonialId } = await context.params;
  try {
    await deleteTestimonial(testimonialId);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message === 'Testimonial not found.' ? 404 : 500;
    return NextResponse.json({ error: 'Failed to delete testimonial.', details: message }, { status });
  }
}
