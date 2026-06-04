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
  TrendingUp,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AdminDashboardActivityLayout } from '@/components/admin/admin-dashboard-activity-layout';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AdminScrollArea } from '@/components/admin/admin-scroll-area';
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
  readonly generatedAtIso: string;
};

type StatCardConfig = {
  readonly label: string;
  readonly value: number;
  readonly detail: string;
  readonly href: string;
  readonly icon: LucideIcon;
  readonly accentClassName: string;
};

type QuickActionConfig = {
  readonly href: string;
  readonly label: string;
  readonly description: string;
  readonly icon: LucideIcon;
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

const QUICK_ACTIONS: readonly QuickActionConfig[] = [
  {
    href: '/admin/bookings',
    label: 'Bookings',
    description: 'Payment status and session details',
    icon: CalendarDays,
  },
  {
    href: '/admin/schedule',
    label: 'Schedule',
    description: 'Availability and slot generation',
    icon: CalendarClock,
  },
  {
    href: '/admin/leads',
    label: 'Leads',
    description: 'Captured contacts and journeys',
    icon: Users,
  },
  {
    href: '/admin/diagnostic-templates',
    label: 'Templates',
    description: 'Diagnostic structure and rounds',
    icon: FileStack,
  },
  {
    href: '/admin/sessions',
    label: 'Sessions',
    description: 'Visitor diagnostics and completion',
    icon: ClipboardList,
  },
  {
    href: '/admin/settings',
    label: 'Settings',
    description: 'Branding and operational config',
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
      icon: Users,
      accentClassName: 'border-l-sky-500/80 bg-sky-500/5',
    },
    {
      label: 'Bookings',
      value: stats.bookingsTotal,
      detail: `${bookingsThisWeekCount} this week · ${stats.bookingsUpcoming} upcoming`,
      href: '/admin/bookings',
      icon: CalendarDays,
      accentClassName: 'border-l-primary/80 bg-primary/5',
    },
    {
      label: 'Sessions',
      value: stats.diagnosticSessionsTotal,
      detail: `${stats.diagnosticSessionsCompleted} completed`,
      href: '/admin/sessions',
      icon: ClipboardList,
      accentClassName: 'border-l-violet-500/80 bg-violet-500/5',
    },
    {
      label: 'Marketing users',
      value: stats.marketingUsersTotal,
      detail: 'Registered accounts',
      href: '/admin/users',
      icon: CircleUser,
      accentClassName: 'border-l-emerald-500/80 bg-emerald-500/5',
    },
    {
      label: 'Templates',
      value: stats.templatesTotal,
      detail: `${stats.templatesActive} active`,
      href: '/admin/diagnostic-templates',
      icon: FileStack,
      accentClassName: 'border-l-amber-500/80 bg-amber-500/5',
    },
  ];
}

function resolveSessionCompletionPercent(stats: AdminDashboardStats): number | null {
  if (stats.diagnosticSessionsTotal <= 0) {
    return null;
  }
  return Math.round((stats.diagnosticSessionsCompleted / stats.diagnosticSessionsTotal) * 100);
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

function resolveLeadInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter((part) => part.length > 0);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase();
}

function DashboardMetricChip(props: {
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
}) {
  return (
    <div className="flex min-w-[9rem] flex-1 flex-col rounded-lg border border-border/80 bg-card px-4 py-3 shadow-xs">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{props.label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-foreground">{props.value}</p>
      {props.hint !== undefined ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{props.hint}</p>
      ) : null}
    </div>
  );
}

function StatCard(props: StatCardConfig) {
  const Icon = props.icon;
  return (
    <Link
      href={props.href}
      className={cn(
        'group flex flex-col rounded-xl border border-border/80 border-l-4 bg-card p-4 shadow-xs transition-colors duration-200',
        props.accentClassName,
        'hover:border-primary/30 hover:bg-card/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{props.label}</p>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background/80 text-muted-foreground ring-1 ring-border/60 transition-colors group-hover:text-primary">
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground tabular-nums sm:text-3xl">
        {props.value}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{props.detail}</p>
      <span className="mt-3 inline-flex min-h-11 items-center gap-1 text-xs font-medium text-primary">
        Open
        <ArrowRight className="size-3 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  );
}

function DashboardPanelHeader(props: {
  readonly title: string;
  readonly description: string;
  readonly href: string;
  readonly linkLabel: string;
  readonly countLabel?: string;
}) {
  return (
    <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 border-b border-border/60 pb-4">
      <div className="min-w-0 space-y-1">
        <CardTitle className="text-base font-semibold">{props.title}</CardTitle>
        <CardDescription>{props.description}</CardDescription>
      </div>
      <Link
        href={props.href}
        className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md px-2 text-sm font-medium text-primary transition-colors hover:bg-primary/5 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        {props.countLabel ?? props.linkLabel}
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    </CardHeader>
  );
}

function RecentLeadsList(props: { readonly leads: readonly AdminDashboardRecentLead[] }) {
  if (props.leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-10 text-center">
        <Users className="size-8 text-muted-foreground/60" aria-hidden />
        <p className="text-sm text-muted-foreground">
          No leads yet. They appear when customers complete a booking or diagnostic journey.
        </p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border/70">
      {props.leads.map((lead) => (
        <li key={lead.id}>
          <Link
            href="/admin/leads"
            className="flex items-center gap-3 py-3 transition-colors duration-200 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-md px-1 -mx-1"
          >
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
              aria-hidden
            >
              {resolveLeadInitials(lead.name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{lead.name}</p>
              <p className="truncate text-xs text-muted-foreground">{lead.email}</p>
            </div>
            <time className="shrink-0 text-xs tabular-nums text-muted-foreground" dateTime={lead.createdAtIso}>
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
      className="flex items-center justify-between gap-3 rounded-md py-3 pr-1 transition-colors duration-200 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      <div className="min-w-0 space-y-0.5">
        <p className="truncate text-sm font-medium text-foreground" title={props.booking.title}>
          {props.booking.title}
        </p>
        <time className="text-xs tabular-nums text-muted-foreground" dateTime={props.booking.startsAtIso}>
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
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-12 text-center">
        <CalendarDays className="size-8 text-muted-foreground/60" aria-hidden />
        <p className="text-sm text-muted-foreground">
          No sessions scheduled for {formatWeekRangeLabel(props.weekRange).toLowerCase()} yet.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-2">
          <Link href="/admin/schedule">Manage schedule</Link>
        </Button>
      </div>
    );
  }
  const dayGroups = groupBookingsByDay(props.bookings);
  return (
    <div className="space-y-5">
      {dayGroups.map((group) => (
        <div key={group.dayKey}>
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {ADMIN_WEEKDAY_FORMATTER.format(new Date(`${group.dayKey}T12:00:00`))}
            </h3>
            <Badge variant="outline" className="tabular-nums">
              {group.bookings.length}
            </Badge>
          </div>
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
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-10 text-center">
        <CalendarDays className="size-8 text-muted-foreground/60" aria-hidden />
        <p className="text-sm text-muted-foreground">
          No bookings yet. Scheduled sessions will show here once customers book a slot.
        </p>
      </div>
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

function QuickActionLink(props: QuickActionConfig) {
  const Icon = props.icon;
  return (
    <Link
      href={props.href}
      className={cn(
        'flex min-h-11 items-center gap-3 rounded-lg border border-border/80 bg-muted/15 px-3 py-2.5 transition-colors duration-200',
        'hover:border-primary/25 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{props.label}</span>
        <span className="block truncate text-xs text-muted-foreground">{props.description}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}

export function AdminDashboard(props: AdminDashboardProps) {
  const statCards = buildStatCards(props.data.stats, props.data.bookingsThisWeek.length);
  const weekRangeLabel = formatWeekRangeLabel(props.data.weekRange);
  const sessionCompletionPercent = resolveSessionCompletionPercent(props.data.stats);
  const refreshedLabel = formatAdminDateTime(props.generatedAtIso);
  return (
    <section className="mx-auto w-full space-y-6">
      <AdminPageHeader
        eyebrow="Operations"
        title="Dashboard"
        description="Live snapshot of diagnostics, leads, scheduling, and customer accounts."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm" className="min-h-11">
              <Link href="/admin/bookings">Bookings</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="min-h-11">
              <Link href="/admin/schedule">Schedule</Link>
            </Button>
            <Button asChild size="sm" className="min-h-11">
              <Link href="/admin/advisor">
                <LifeBuoy className="size-4" aria-hidden />
                Advisor
              </Link>
            </Button>
          </div>
        }
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Refreshed{' '}
          <time dateTime={props.generatedAtIso} className="tabular-nums">
            {refreshedLabel}
          </time>{' '}
          · Manila time
        </p>
        <div className="flex flex-wrap gap-2">
          <DashboardMetricChip
            label="This week"
            value={String(props.data.bookingsThisWeek.length)}
            hint="Scheduled sessions"
          />
          <DashboardMetricChip
            label="Upcoming"
            value={String(props.data.stats.bookingsUpcoming)}
            hint="Pending or confirmed"
          />
          <DashboardMetricChip
            label="Completion"
            value={sessionCompletionPercent === null ? '—' : `${sessionCompletionPercent}%`}
            hint={
              sessionCompletionPercent === null
                ? 'No sessions yet'
                : `${props.data.stats.diagnosticSessionsCompleted} of ${props.data.stats.diagnosticSessionsTotal}`
            }
          />
        </div>
      </div>
      <div data-admin-tour="page-dashboard-stats" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {statCards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>
      <AdminDashboardActivityLayout
        schedule={
          <Card className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border-border/80 shadow-xs [&>[data-slot=card-content]]:min-h-0">
            <DashboardPanelHeader
              title="This week's schedule"
              description={`${weekRangeLabel} · Sun–Sat, Manila time`}
              href="/admin/bookings"
              linkLabel="All bookings"
              countLabel={`${props.data.bookingsThisWeek.length} scheduled`}
            />
            <CardContent className="flex min-h-0 flex-1 flex-col pt-0 pr-2">
              <AdminScrollArea className="min-h-0 flex-1">
                <ThisWeekBookingsList bookings={props.data.bookingsThisWeek} weekRange={props.data.weekRange} />
              </AdminScrollArea>
            </CardContent>
          </Card>
        }
        leads={
          <Card className="overflow-hidden rounded-xl border-border/80 shadow-xs">
            <DashboardPanelHeader
              title="Recent leads"
              description="Latest contacts from marketing journeys."
              href="/admin/leads"
              linkLabel="All leads"
            />
            <CardContent className="pt-0">
              <RecentLeadsList leads={props.data.recentLeads} />
            </CardContent>
          </Card>
        }
        bookings={
          <Card className="overflow-hidden rounded-xl border-border/80 shadow-xs">
            <DashboardPanelHeader
              title="Recent bookings"
              description="Latest sessions by slot time."
              href="/admin/bookings"
              linkLabel="All bookings"
            />
            <CardContent className="pt-0">
              <RecentBookingsList bookings={props.data.recentBookings} />
            </CardContent>
          </Card>
        }
      />
      <Card className="rounded-xl border-border/80 shadow-xs">
        <CardHeader className="space-y-1 border-b border-border/60 pb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-primary" aria-hidden />
            <CardTitle className="text-base font-semibold">Quick actions</CardTitle>
          </div>
          <CardDescription>Shortcuts to the areas you manage most often.</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {QUICK_ACTIONS.map((action) => (
              <QuickActionLink key={action.href} {...action} />
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
