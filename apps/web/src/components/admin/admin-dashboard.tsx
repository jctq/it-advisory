import Link from 'next/link';
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  CircleUser,
  ClipboardList,
  FileStack,
  LifeBuoy,
  Settings,
  Users,
} from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type {
  AdminDashboardData,
  AdminDashboardRecentBooking,
  AdminDashboardRecentLead,
  AdminDashboardStats,
  AdminDashboardWeekRange,
} from '@/lib/data/admin-dashboard';
import { cn } from '@/lib/utils';

type AdminDashboardProps = {
  readonly data: AdminDashboardData;
};

type StatCardConfig = {
  readonly label: string;
  readonly value: number;
  readonly detail: string;
  readonly href: string;
};

type FeatureLinkConfig = {
  readonly href: string;
  readonly label: string;
  readonly description: string;
  readonly icon: typeof FileStack;
};

const ADMIN_TIMEZONE = 'Asia/Manila';

const ADMIN_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: ADMIN_TIMEZONE,
});

const ADMIN_WEEKDAY_FORMATTER = new Intl.DateTimeFormat('en-PH', {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
  timeZone: ADMIN_TIMEZONE,
});

const ADMIN_WEEK_RANGE_FORMATTER = new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: ADMIN_TIMEZONE,
});

const FEATURE_LINKS: readonly FeatureLinkConfig[] = [
  {
    href: '/admin/diagnostic-templates',
    label: 'Templates',
    description: 'Diagnostic quiz structure, rounds, and visibility rules.',
    icon: FileStack,
  },
  {
    href: '/admin/sessions',
    label: 'Sessions',
    description: 'Visitor diagnostics, completion state, and booking links.',
    icon: ClipboardList,
  },
  {
    href: '/admin/leads',
    label: 'Leads',
    description: 'Contacts captured from web and native booking journeys.',
    icon: Users,
  },
  {
    href: '/admin/users',
    label: 'Marketing users',
    description: 'Signed-in accounts, auth sessions, and quiz snapshots.',
    icon: CircleUser,
  },
  {
    href: '/admin/schedule',
    label: 'Schedule',
    description: 'Advisor availability windows, caps, and slot generation.',
    icon: CalendarClock,
  },
  {
    href: '/admin/bookings',
    label: 'Bookings',
    description: 'Confirmed sessions with payment and diagnostic snapshots.',
    icon: CalendarDays,
  },
  {
    href: '/admin/advisor',
    label: 'Advisor',
    description: 'AI assistant for internal review and customer context.',
    icon: LifeBuoy,
  },
  {
    href: '/admin/settings',
    label: 'Settings',
    description: 'Quiz tuning, branding, and operational configuration.',
    icon: Settings,
  },
] as const;

function formatAdminDateTime(isoTimestamp: string): string {
  return ADMIN_DATE_TIME_FORMATTER.format(new Date(isoTimestamp));
}

function formatWeekRangeLabel(weekRange: AdminDashboardWeekRange): string {
  if (weekRange.startYmd.length === 0 || weekRange.endYmd.length === 0) {
    return 'This week';
  }
  const startLabel = ADMIN_WEEK_RANGE_FORMATTER.format(new Date(`${weekRange.startYmd}T12:00:00`));
  const endLabel = ADMIN_WEEK_RANGE_FORMATTER.format(new Date(`${weekRange.endYmd}T12:00:00`));
  return `${startLabel} – ${endLabel}`;
}

function resolveBookingDayKey(startsAtIso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: ADMIN_TIMEZONE,
  }).format(new Date(startsAtIso));
}

function groupBookingsByDay(
  bookings: readonly AdminDashboardRecentBooking[],
): readonly { readonly dayKey: string; readonly bookings: readonly AdminDashboardRecentBooking[] }[] {
  const groups = new Map<string, AdminDashboardRecentBooking[]>();
  for (const booking of bookings) {
    const dayKey = resolveBookingDayKey(booking.startsAtIso);
    const existing = groups.get(dayKey);
    if (existing !== undefined) {
      existing.push(booking);
      continue;
    }
    groups.set(dayKey, [booking]);
  }
  return [...groups.entries()].map(([dayKey, dayBookings]) => ({
    dayKey,
    bookings: dayBookings,
  }));
}

function buildStatCards(
  stats: AdminDashboardStats,
  bookingsThisWeekCount: number,
): readonly StatCardConfig[] {
  return [
    {
      label: 'Leads',
      value: stats.leadsTotal,
      detail: 'Captured contacts',
      href: '/admin/leads',
    },
    {
      label: 'Bookings',
      value: stats.bookingsTotal,
      detail: `${bookingsThisWeekCount} this week · ${stats.bookingsUpcoming} upcoming`,
      href: '/admin/bookings',
    },
    {
      label: 'Sessions',
      value: stats.quizSessionsTotal,
      detail: `${stats.quizSessionsCompleted} completed`,
      href: '/admin/sessions',
    },
    {
      label: 'Marketing users',
      value: stats.marketingUsersTotal,
      detail: 'Registered accounts',
      href: '/admin/users',
    },
    {
      label: 'Templates',
      value: stats.templatesTotal,
      detail: `${stats.templatesActive} active`,
      href: '/admin/diagnostic-templates',
    },
  ];
}

function resolveBookingStatusVariant(
  status: AdminDashboardRecentBooking['status'],
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'confirmed') {
    return 'default';
  }
  if (status === 'pending') {
    return 'secondary';
  }
  return 'destructive';
}

function StatCard(props: StatCardConfig) {
  return (
    <Link
      href={props.href}
      className={cn(
        'group block rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition-colors',
        'hover:border-primary/25 hover:bg-card/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
      )}
    >
      <p className="text-sm font-medium text-muted-foreground">{props.label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground tabular-nums">{props.value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{props.detail}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        View
        <ArrowRight className="size-3" aria-hidden />
      </span>
    </Link>
  );
}

function RecentLeadsList(props: { readonly leads: readonly AdminDashboardRecentLead[] }) {
  if (props.leads.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No leads yet. They appear here when customers complete a booking or quiz journey.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border/70">
      {props.leads.map((lead) => (
        <li key={lead.id}>
          <Link
            href="/admin/leads"
            className="flex items-center justify-between gap-3 py-3 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{lead.name}</p>
              <p className="truncate text-xs text-muted-foreground">{lead.email}</p>
            </div>
            <time className="shrink-0 text-xs text-muted-foreground" dateTime={lead.createdAtIso}>
              {formatAdminDateTime(lead.createdAtIso)}
            </time>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function BookingRowLink(props: { readonly booking: AdminDashboardRecentBooking }) {
  return (
    <Link
      href={`/admin/bookings/${props.booking.id}`}
      className="flex items-center justify-between gap-3 py-3 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      <div className="min-w-0 space-y-1">
        <p className="truncate text-sm font-medium text-foreground">{props.booking.serviceKey}</p>
        <time className="text-xs text-muted-foreground" dateTime={props.booking.startsAtIso}>
          {formatAdminDateTime(props.booking.startsAtIso)}
        </time>
      </div>
      <Badge variant={resolveBookingStatusVariant(props.booking.status)} className="shrink-0 capitalize">
        {props.booking.status}
      </Badge>
    </Link>
  );
}

function ThisWeekBookingsList(props: {
  readonly bookings: readonly AdminDashboardRecentBooking[];
  readonly weekRange: AdminDashboardWeekRange;
}) {
  if (props.bookings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No sessions scheduled for {formatWeekRangeLabel(props.weekRange).toLowerCase()} yet.
      </p>
    );
  }
  const dayGroups = groupBookingsByDay(props.bookings);
  return (
    <div className="space-y-6">
      {dayGroups.map((group) => (
        <div key={group.dayKey}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {ADMIN_WEEKDAY_FORMATTER.format(new Date(`${group.dayKey}T12:00:00`))}
          </h3>
          <ul className="mt-2 divide-y divide-border/70">
            {group.bookings.map((booking) => (
              <li key={booking.id}>
                <BookingRowLink booking={booking} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function RecentBookingsList(props: { readonly bookings: readonly AdminDashboardRecentBooking[] }) {
  if (props.bookings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No bookings yet. Scheduled sessions will show here once customers book a slot.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border/70">
      {props.bookings.map((booking) => (
        <li key={booking.id}>
          <BookingRowLink booking={booking} />
        </li>
      ))}
    </ul>
  );
}

export function AdminDashboard(props: AdminDashboardProps) {
  const statCards = buildStatCards(props.data.stats, props.data.bookingsThisWeek.length);
  const weekRangeLabel = formatWeekRangeLabel(props.data.weekRange);
  return (
    <section className="mx-auto space-y-10">
      <AdminPageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="Operational snapshot across diagnostics, leads, scheduling, and customer accounts."
      />
      <div
        data-admin-tour="page-dashboard-stats"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"
      >
        {statCards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>
      <Card className="rounded-2xl border-border/80 shadow-xs">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">This week&apos;s bookings</CardTitle>
            <CardDescription>
              {weekRangeLabel} (Sun–Sat, Manila time). Sorted by session start time.
            </CardDescription>
          </div>
          <Link
            href="/admin/bookings"
            className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            {props.data.bookingsThisWeek.length} scheduled
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </CardHeader>
        <CardContent className="pt-0">
          <ThisWeekBookingsList bookings={props.data.bookingsThisWeek} weekRange={props.data.weekRange} />
        </CardContent>
      </Card>
      <div data-admin-tour="page-dashboard-activity" className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl border-border/80 shadow-xs">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">Recent leads</CardTitle>
              <CardDescription>Latest contacts from marketing journeys.</CardDescription>
            </div>
            <Link
              href="/admin/leads"
              className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              All leads
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            <RecentLeadsList leads={props.data.recentLeads} />
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/80 shadow-xs">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">Recent bookings</CardTitle>
              <CardDescription>Latest scheduled sessions by slot time.</CardDescription>
            </div>
            <Link
              href="/admin/bookings"
              className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              All bookings
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            <RecentBookingsList bookings={props.data.recentBookings} />
          </CardContent>
        </Card>
      </div>
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Workspace</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Jump to any area of the admin console. Each module maps to a feature in your customer funnel.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {FEATURE_LINKS.map((feature) => {
            const Icon = feature.icon;
            return (
              <Link
                key={feature.href}
                href={feature.href}
                className={cn(
                  'flex min-h-30 flex-col rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition-colors',
                  'hover:border-primary/25 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                )}
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="mt-4 text-sm font-semibold text-foreground">{feature.label}</span>
                <span className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {feature.description}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
