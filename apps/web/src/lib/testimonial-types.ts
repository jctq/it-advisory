import type { TestimonialStatus } from '@/domain/testimonial-types';

export type TestimonialValue = {
  readonly id: string;
  readonly quote: string;
  readonly name: string;
  readonly role: string;
  readonly status: TestimonialStatus;
  readonly sortOrder: number;
  readonly createdAtIso: string;
  readonly updatedAtIso: string;
};

export type PublishedMarketingTestimonial = {
  readonly quote: string;
  readonly name: string;
  readonly role: string;
};

export type CreateTestimonialInput = {
  readonly quote?: string;
  readonly name?: string;
  readonly role?: string;
  readonly status?: TestimonialStatus;
  readonly sortOrder?: number;
};

export type UpdateTestimonialInput = {
  readonly quote?: string;
  readonly name?: string;
  readonly role?: string;
  readonly status?: TestimonialStatus;
  readonly sortOrder?: number;
};
