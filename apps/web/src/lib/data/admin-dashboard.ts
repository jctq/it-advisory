import {
  listSunToSatYmdsForWeekContaining,
  resolveAdvisorSchedulePreviewAnchorYmd,
} from '@it-advisory/domain/booking-schedule';
import { addDays, parse } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { COLLECTIONS } from '@/domain/collections';
import type { BookingDocument, LeadDocument, QuizSessionDocument } from '@/domain/types';
import { getDb } from '@/lib/mongodb';

const ADMIN_TIMEZONE = 'Asia/Manila';
const RECENT_LEADS_LIMIT = 5;
const RECENT_BOOKINGS_LIMIT = 5;
const THIS_WEEK_BOOKINGS_LIMIT = 100;

export type AdminDashboardStats = {
  readonly leadsTotal: number;
  readonly bookingsTotal: number;
  readonly bookingsUpcoming: number;
  readonly quizSessionsTotal: number;
  readonly quizSessionsCompleted: number;
  readonly marketingUsersTotal: number;
  readonly templatesTotal: number;
  readonly templatesActive: number;
};

export type AdminDashboardRecentLead = {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly createdAtIso: string;
};

export type AdminDashboardRecentBooking = {
  readonly id: string;
  readonly serviceKey: string;
  readonly startsAtIso: string;
  readonly status: BookingDocument['status'];
};

export type AdminDashboardWeekRange = {
  readonly startYmd: string;
  readonly endYmd: string;
};

export type AdminDashboardData = {
  readonly stats: AdminDashboardStats;
  readonly weekRange: AdminDashboardWeekRange;
  readonly bookingsThisWeek: readonly AdminDashboardRecentBooking[];
  readonly recentLeads: readonly AdminDashboardRecentLead[];
  readonly recentBookings: readonly AdminDashboardRecentBooking[];
};

const EMPTY_STATS: AdminDashboardStats = {
  leadsTotal: 0,
  bookingsTotal: 0,
  bookingsUpcoming: 0,
  quizSessionsTotal: 0,
  quizSessionsCompleted: 0,
  marketingUsersTotal: 0,
  templatesTotal: 0,
  templatesActive: 0,
};

function mapRecentLead(
  doc: LeadDocument & { _id: { toString: () => string } },
): AdminDashboardRecentLead {
  const emailRaw = doc.email;
  const email = typeof emailRaw === 'string' && emailRaw.trim().length > 0 ? emailRaw.trim() : '—';
  return {
    id: doc._id.toString(),
    name: doc.name,
    email,
    createdAtIso: doc.createdAt.toISOString(),
  };
}

function mapRecentBooking(
  doc: BookingDocument & { _id: { toString: () => string } },
): AdminDashboardRecentBooking {
  return {
    id: doc._id.toString(),
    serviceKey: doc.serviceKey,
    startsAtIso: doc.startsAt.toISOString(),
    status: doc.status,
  };
}

function resolveCurrentWeekBoundsUtc(nowUtc: Date): {
  readonly startUtc: Date;
  readonly endExclusiveUtc: Date;
  readonly weekRange: AdminDashboardWeekRange;
} {
  const anchorYmd = resolveAdvisorSchedulePreviewAnchorYmd(nowUtc, ADMIN_TIMEZONE);
  const weekYmds = listSunToSatYmdsForWeekContaining(anchorYmd, ADMIN_TIMEZONE);
  const startYmd = weekYmds[0]!;
  const endYmd = weekYmds[6]!;
  const startUtc = fromZonedTime(parse(`${startYmd} 00:00:00`, 'yyyy-MM-dd HH:mm:ss', new Date(0)), ADMIN_TIMEZONE);
  const endExclusiveUtc = addDays(startUtc, 7);
  return {
    startUtc,
    endExclusiveUtc,
    weekRange: { startYmd, endYmd },
  };
}

/**
 * Aggregated counts and recent activity for the admin home dashboard.
 */
export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  if (!process.env.MONGODB_URI) {
    return {
      stats: EMPTY_STATS,
      weekRange: { startYmd: '', endYmd: '' },
      bookingsThisWeek: [],
      recentLeads: [],
      recentBookings: [],
    };
  }
  const db = await getDb();
  const now = new Date();
  const { startUtc: weekStartUtc, endExclusiveUtc: weekEndExclusiveUtc, weekRange } = resolveCurrentWeekBoundsUtc(now);
  const [
    leadsTotal,
    bookingsTotal,
    bookingsUpcoming,
    quizSessionsTotal,
    quizSessionsCompleted,
    marketingUsersTotal,
    templatesTotal,
    templatesActive,
    recentLeadDocs,
    recentBookingDocs,
    thisWeekBookingDocs,
  ] = await Promise.all([
    db.collection(COLLECTIONS.leads).countDocuments(),
    db.collection(COLLECTIONS.bookings).countDocuments(),
    db.collection<BookingDocument>(COLLECTIONS.bookings).countDocuments({
      status: { $in: ['pending', 'confirmed'] },
      startsAt: { $gte: now },
    }),
    db.collection(COLLECTIONS.quizSessions).countDocuments(),
    db.collection<QuizSessionDocument>(COLLECTIONS.quizSessions).countDocuments({
      completedAt: { $exists: true },
    }),
    db.collection(COLLECTIONS.users).countDocuments(),
    db.collection(COLLECTIONS.diagnosticTemplates).countDocuments(),
    db.collection(COLLECTIONS.diagnosticTemplates).countDocuments({ isActive: true }),
    db
      .collection<LeadDocument>(COLLECTIONS.leads)
      .find()
      .sort({ createdAt: -1 })
      .limit(RECENT_LEADS_LIMIT)
      .toArray(),
    db
      .collection<BookingDocument>(COLLECTIONS.bookings)
      .find()
      .sort({ startsAt: -1 })
      .limit(RECENT_BOOKINGS_LIMIT)
      .toArray(),
    db
      .collection<BookingDocument>(COLLECTIONS.bookings)
      .find({
        startsAt: { $gte: weekStartUtc, $lt: weekEndExclusiveUtc },
      })
      .sort({ startsAt: 1 })
      .limit(THIS_WEEK_BOOKINGS_LIMIT)
      .toArray(),
  ]);
  return {
    stats: {
      leadsTotal,
      bookingsTotal,
      bookingsUpcoming,
      quizSessionsTotal,
      quizSessionsCompleted,
      marketingUsersTotal,
      templatesTotal,
      templatesActive,
    },
    weekRange,
    bookingsThisWeek: thisWeekBookingDocs.map((doc) =>
      mapRecentBooking(doc as BookingDocument & { _id: { toString: () => string } }),
    ),
    recentLeads: recentLeadDocs.map((doc) =>
      mapRecentLead(doc as LeadDocument & { _id: { toString: () => string } }),
    ),
    recentBookings: recentBookingDocs.map((doc) =>
      mapRecentBooking(doc as BookingDocument & { _id: { toString: () => string } }),
    ),
  };
}
