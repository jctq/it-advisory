import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createTestimonial, listTestimonials } from '@/lib/data/testimonials';

export const dynamic = 'force-dynamic';

const testimonialStatusSchema = z.enum(['draft', 'published']);

const createTestimonialSchema = z.object({
  quote: z.string().trim().max(500).optional(),
  name: z.string().trim().max(120).optional(),
  role: z.string().trim().max(120).optional(),
  status: testimonialStatusSchema.optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

export async function GET(): Promise<NextResponse> {
  try {
    const testimonials = await listTestimonials();
    return NextResponse.json({ testimonials });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load testimonials.', details: message }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  let json: unknown = {};
  try {
    json = await request.json();
  } catch {}
  const parsed = createTestimonialSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const testimonial = await createTestimonial(parsed.data);
    return NextResponse.json({ testimonial }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to create testimonial.', details: message }, { status: 500 });
  }
}
