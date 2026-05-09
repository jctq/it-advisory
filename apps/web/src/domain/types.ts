import type { ObjectId } from 'mongodb';

export type QuizAnswers = Readonly<Record<string, string | string[] | number | boolean>>;

export type QuizSessionDocument = {
  _id?: ObjectId;
  visitorId: string;
  answers: QuizAnswers;
  currentStep: number;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

/** Immutable audit row for every quiz submission / step advance. */
export type QuizAuditDocument = {
  _id?: ObjectId;
  visitorId: string;
  sessionId: ObjectId;
  step: number;
  answersSnapshot: QuizAnswers;
  createdAt: Date;
};

/** Latest quiz pointer per anonymous or logged-in visitor. */
export type VisitorSessionDocument = {
  _id?: ObjectId;
  visitorId: string;
  latestSessionId: ObjectId;
  updatedAt: Date;
};

export type RecommendationDocument = {
  _id?: ObjectId;
  visitorId: string;
  sessionId: ObjectId;
  serviceKey: string;
  summary: string;
  createdAt: Date;
};

export type LeadDocument = {
  _id?: ObjectId;
  visitorId: string;
  name: string;
  company: string;
  phone: string;
  source: string;
  createdAt: Date;
};

export type BookingDocument = {
  _id?: ObjectId;
  leadId: ObjectId;
  visitorId: string;
  serviceKey: string;
  startsAt: Date;
  timezone: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  meetingUrl?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type AvailabilitySlotDocument = {
  _id?: ObjectId;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  capacity: number;
  bookedCount: number;
};

export type EmailSendDocument = {
  _id?: ObjectId;
  to: string;
  templateKey: string;
  payload: Readonly<Record<string, unknown>>;
  status: 'mock_sent' | 'failed';
  createdAt: Date;
};
