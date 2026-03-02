import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  acceptBookingRequestAction,
  createAvailabilityRuleAction,
  createCalendarBlockAction,
  declineBookingRequestAction,
  deleteAvailabilityRuleAction,
  deleteCalendarBlockAction,
  requestBookingAction
} from "@/app/actions";
import { RequestCard } from "@/components/blocks/request-card";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Notice } from "@/components/notice";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { isApproved } from "@/lib/approvals";
import { getViewerContext } from "@/lib/auth";
import { HORSE_SELECT_FIELDS } from "@/lib/horses";
import { getOwnerPlan, getOwnerPlanUsage } from "@/lib/plans";
import { readSearchParam } from "@/lib/search-params";
import type { AvailabilityRule, BookingRequest, CalendarBlock, Horse, Profile } from "@/types/database";

type PferdKalenderPageProps = {
  params: { id: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

type CalendarOccupancyRow = {
  source: "booking" | "block" | string;
  start_at: string;
  end_at: string;
};

type TimelineTone = "available" | "occupied" | "pending";

type TimelineSegment = {
  key: string;
  left: number;
  width: number;
  title: string;
  tone: TimelineTone;
};

type TimelineLane = {
  key: string;
  label: string;
  tone: TimelineTone;
  segments: TimelineSegment[];
};

type TimelineDayRow = {
  key: string;
  label: string;
  meta: string;
  isToday: boolean;
  lanes: TimelineLane[];
};

const CALENDAR_TIMELINE_DAY_COUNT = 7;
const CALENDAR_TIMELINE_START_HOUR = 8;
const CALENDAR_TIMELINE_END_HOUR = 22;

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "short"
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatDateRange(startAt: string, endAt: string) {
  return `${formatDateTime(startAt)} bis ${formatDateTime(endAt)}`;
}

function occupancyLabel(source: string) {
  return source === "booking" ? "Gebuchter Termin" : "Vom Pferdehalter blockiert";
}

function ruleLabel(rule: AvailabilityRule) {
  return formatDateRange(rule.start_at, rule.end_at);
}

function toDayKey(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function dayEnd(date: Date) {
  const start = dayStart(date);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1, 0, 0, 0, 0);
}

function overlapsDay(startAt: string, endAt: string, dayDate: Date) {
  const rangeStart = new Date(startAt).getTime();
  const rangeEnd = new Date(endAt).getTime();
  const dayRangeStart = dayStart(dayDate).getTime();
  const dayRangeEnd = dayEnd(dayDate).getTime();
  return rangeStart < dayRangeEnd && rangeEnd > dayRangeStart;
}

function buildUpcomingDays(count: number) {
  const days: Date[] = [];
  const start = dayStart(new Date());

  for (let index = 0; index < count; index += 1) {
    days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  }

  return days;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function buildTimelineHours() {
  const hours: number[] = [];

  for (let hour = CALENDAR_TIMELINE_START_HOUR; hour < CALENDAR_TIMELINE_END_HOUR; hour += 1) {
    hours.push(hour);
  }

  return hours;
}

function timelineToneClassName(tone: TimelineTone) {
  if (tone === "available") {
    return "border-emerald-200 bg-emerald-100 text-emerald-900";
  }

  if (tone === "pending") {
    return "border-amber-200 bg-amber-100 text-amber-900";
  }

  return "border-rose-200 bg-rose-100 text-rose-900";
}

function buildTimelineSegment(dayDate: Date, startAt: string, endAt: string, title: string, tone: TimelineTone, key: string) {
  const visibleWindowStart = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), CALENDAR_TIMELINE_START_HOUR, 0, 0, 0);
  const visibleWindowEnd = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), CALENDAR_TIMELINE_END_HOUR, 0, 0, 0);
  const startTime = Math.max(new Date(startAt).getTime(), visibleWindowStart.getTime());
  const endTime = Math.min(new Date(endAt).getTime(), visibleWindowEnd.getTime());

  if (endTime <= startTime) {
    return null;
  }

  const totalVisibleMinutes = (CALENDAR_TIMELINE_END_HOUR - CALENDAR_TIMELINE_START_HOUR) * 60;
  const startOffsetMinutes = (startTime - visibleWindowStart.getTime()) / 60000;
  const durationMinutes = (endTime - startTime) / 60000;

  return {
    key,
    left: clampNumber((startOffsetMinutes / totalVisibleMinutes) * 100, 0, 100),
    width: clampNumber((durationMinutes / totalVisibleMinutes) * 100, 2.5, 100),
    title,
    tone
  } satisfies TimelineSegment;
}

function buildTimelineRows({
  days,
  rules,
  occupancy,
  pendingRequests,
  includePendingLane
}: {
  days: Date[];
  rules: AvailabilityRule[];
  occupancy: CalendarOccupancyRow[];
  pendingRequests: BookingRequest[];
  includePendingLane: boolean;
}) {
  const weekdayFormatter = new Intl.DateTimeFormat("de-DE", { weekday: "long" });
  const dateFormatter = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "long" });
  const todayKey = toDayKey(new Date());

  return days.map((dayDate) => {
    // Feste Stundenraster machen freie Zeiten, Belegung und offene Anfragen direkt vergleichbar.
    const availableSegments = rules
      .filter((rule) => overlapsDay(rule.start_at, rule.end_at, dayDate))
      .map((rule) => buildTimelineSegment(dayDate, rule.start_at, rule.end_at, `Verfügbar ${formatTime(rule.start_at)}–${formatTime(rule.end_at)}`, "available", rule.id))
      .filter((segment): segment is TimelineSegment => Boolean(segment));

    const occupiedSegments = occupancy
      .filter((entry) => overlapsDay(entry.start_at, entry.end_at, dayDate))
      .map((entry, index) => buildTimelineSegment(dayDate, entry.start_at, entry.end_at, `Belegt ${formatTime(entry.start_at)}–${formatTime(entry.end_at)}`, "occupied", `${entry.source}-${entry.start_at}-${entry.end_at}-${index}`))
      .filter((segment): segment is TimelineSegment => Boolean(segment));

    const pendingSegments = pendingRequests
      .filter((request) => request.requested_start_at && request.requested_end_at && overlapsDay(request.requested_start_at, request.requested_end_at, dayDate))
      .map((request) => buildTimelineSegment(dayDate, request.requested_start_at as string, request.requested_end_at as string, `Anfrage ${formatTime(request.requested_start_at as string)}–${formatTime(request.requested_end_at as string)}`, "pending", request.id))
      .filter((segment): segment is TimelineSegment => Boolean(segment));

    const lanes: TimelineLane[] = [
      { key: "available", label: "Verfügbar", tone: "available", segments: availableSegments },
      { key: "occupied", label: "Belegt", tone: "occupied", segments: occupiedSegments }
    ];

    if (includePendingLane) {
      lanes.push({ key: "pending", label: "Anfragen", tone: "pending", segments: pendingSegments });
    }

    return {
      key: toDayKey(dayDate),
      label: weekdayFormatter.format(dayDate),
      meta: dateFormatter.format(dayDate),
      isToday: toDayKey(dayDate) === todayKey,
      lanes
    } satisfies TimelineDayRow;
  });
}

export default async function PferdKalenderPage({ params, searchParams }: PferdKalenderPageProps) {
  const { profile, supabase, user } = await getViewerContext();
  const error = readSearchParam(searchParams, "error");
  const message = readSearchParam(searchParams, "message");
  const { data } = await supabase.from("horses").select(HORSE_SELECT_FIELDS).eq("id", params.id).maybeSingle();
  const horse = (data as Horse | null) ?? null;

  if (!horse) {
    notFound();
  }

  const detailHref = `/pferde/${horse.id}` as Route;
  const isOwner = profile?.role === "owner" && user?.id === horse.owner_id;
  const isRider = profile?.role === "rider" && Boolean(user);
  const { data: ownerProfileData } = await supabase
    .from("profiles")
    .select("id, role, is_premium, created_at, display_name, phone")
    .eq("id", horse.owner_id)
    .maybeSingle();
  const ownerProfile = ((ownerProfileData as Profile | null) ?? null) || (isOwner ? profile : null);
  const ownerPlanUsage = isOwner && user ? await getOwnerPlanUsage(supabase, user.id) : { approvedRiderCount: 0, horseCount: 1 };
  const ownerPlan = getOwnerPlan(ownerProfile, ownerPlanUsage);
  const riderApproved = isRider && user ? await isApproved(horse.id, user.id, supabase) : false;

  const [occupancyResult, rulesResult, ownerBlocksResult, ownerBookingRequestsResult, riderBookingRequestsResult] = await Promise.all([
    supabase.rpc("get_horse_calendar_occupancy", {
      p_horse_id: horse.id
    }),
    supabase
      .from("availability_rules")
      .select("id, horse_id, slot_id, start_at, end_at, active, created_at")
      .eq("horse_id", horse.id)
      .order("start_at", { ascending: true }),
    isOwner
      ? supabase
          .from("calendar_blocks")
          .select("id, horse_id, start_at, end_at, created_at")
          .eq("horse_id", horse.id)
          .order("start_at", { ascending: true })
      : Promise.resolve({ data: [] as CalendarBlock[] | null }),
    isOwner
      ? supabase
          .from("booking_requests")
          .select("id, slot_id, availability_rule_id, horse_id, rider_id, status, requested_start_at, requested_end_at, recurrence_rrule, created_at")
          .eq("horse_id", horse.id)
          .order("created_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] as BookingRequest[] | null }),
    isRider && user
      ? supabase
          .from("booking_requests")
          .select("id, slot_id, availability_rule_id, horse_id, rider_id, status, requested_start_at, requested_end_at, recurrence_rrule, created_at")
          .eq("horse_id", horse.id)
          .eq("rider_id", user.id)
          .order("created_at", { ascending: false })
          .limit(12)
      : Promise.resolve({ data: [] as BookingRequest[] | null })
  ]);

  const occupancy = ((occupancyResult.data as CalendarOccupancyRow[] | null) ?? []).sort(
    (left, right) => new Date(left.start_at).getTime() - new Date(right.start_at).getTime()
  );
  const occupancyError = occupancyResult.error;
  const rules = ((rulesResult.data as AvailabilityRule[] | null) ?? []).filter((rule) => rule.active);
  const ownerBlocks = (ownerBlocksResult.data as CalendarBlock[] | null) ?? [];
  const ownerBookingRequests = (ownerBookingRequestsResult.data as BookingRequest[] | null) ?? [];
  const riderBookingRequests = (riderBookingRequestsResult.data as BookingRequest[] | null) ?? [];
  const ruleMap = new Map(rules.map((rule) => [rule.id, rule]));
  const requestedOwnerBookingItems = ownerBookingRequests.filter((request) => request.status === "requested");
  const timelineHours = buildTimelineHours();
  const timelineRows = buildTimelineRows({
    days: buildUpcomingDays(CALENDAR_TIMELINE_DAY_COUNT),
    includePendingLane: isOwner,
    occupancy,
    pendingRequests: requestedOwnerBookingItems,
    rules
  });

  return (
    <div className="space-y-6 sm:space-y-8">
      <Link className={buttonVariants("ghost", "min-h-0 justify-start px-0 py-0 text-sm font-semibold text-forest hover:bg-transparent hover:text-clay")} href={detailHref}>
        Zurück zum Pferdeprofil
      </Link>

      <PageHeader
        subtitle="Kalender, Verfügbarkeiten und Terminanfragen auf einen Blick."
        title={`Kalender für ${horse.title}`}
      />

      <Notice text={error} tone="error" />
      <Notice text={message} tone="success" />
      {occupancyError ? <Notice text="Der Kalender konnte nicht geladen werden." tone="error" /> : null}

      <div className="ui-horse-context">
        <div className="ui-horse-context-grid">
          <div className="space-y-2">
            <p className="ui-eyebrow">Pferdeprofil</p>
            <h2 className="font-serif text-2xl text-stone-900 sm:text-3xl">{horse.title}</h2>
            <p className="ui-inline-meta">PLZ {horse.plz} {horse.active ? "· Aktiv" : "· Inaktiv"}</p>
            <p className="text-sm leading-6 text-stone-600">
              {horse.description?.trim() || "Hier steuerst du Verfügbarkeiten, Sperren und eingehende Terminanfragen für dieses Pferd."}
            </p>
          </div>
          <div className="flex flex-col gap-3 lg:items-end">
            <div className="ui-kpi-row">
              <Badge tone={horse.active ? "approved" : "neutral"}>{horse.active ? "Aktiv" : "Inaktiv"}</Badge>
              <Badge tone={ownerPlan.key === "premium" ? "approved" : "neutral"}>{ownerPlan.key === "premium" ? "Premium" : "Kostenlos inklusive"}</Badge>
            </div>
            <Link className={buttonVariants("secondary", "w-full lg:w-auto")} href={detailHref}>
              Pferdeprofil öffnen
            </Link>
          </div>
        </div>
      </div>

      <SectionCard
        subtitle="Wie im Planungsassistenten: Tage links, Uhrzeiten oben und freie, belegte oder angefragte Zeiten direkt in einer Zeitleiste."
        title={`Wochenplanung für ${horse.title}`}
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge tone="approved">Verfügbare Zeiten</Badge>
            <Badge tone="rejected">Belegte Zeiten</Badge>
            {isOwner ? <Badge tone="pending">Offene Anfragen</Badge> : null}
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[980px] rounded-2xl border border-stone-200 bg-white shadow-sm">
              <div className="grid grid-cols-[180px_minmax(0,1fr)] border-b border-stone-200 bg-stone-50/80">
                <div className="border-r border-stone-200 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Tag & Spur</p>
                </div>
                <div className="grid" style={{ gridTemplateColumns: `repeat(${timelineHours.length}, minmax(72px, 1fr))` }}>
                  {timelineHours.map((hour) => (
                    <div className="border-r border-stone-200/70 px-3 py-3 text-xs font-semibold text-stone-500 last:border-r-0" key={hour}>
                      {`${String(hour).padStart(2, "0")}:00`}
                    </div>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-stone-200">
                {timelineRows.map((row) => (
                  <div className="grid grid-cols-[180px_minmax(0,1fr)]" key={row.key}>
                    <div className="border-r border-stone-200 px-4 py-4">
                      <div className="space-y-2">
                        <p className="text-sm font-semibold capitalize text-stone-900">{row.label}</p>
                        <p className="text-xs text-stone-500">{row.meta}</p>
                        {row.isToday ? <Badge tone="info">Heute</Badge> : null}
                      </div>
                    </div>

                    <div className="divide-y divide-stone-200/80">
                      {row.lanes.map((lane) => (
                        <div className="grid grid-cols-[108px_minmax(0,1fr)]" key={`${row.key}-${lane.key}`}>
                          <div className="border-r border-stone-200 bg-stone-50/60 px-3 py-4">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">{lane.label}</span>
                          </div>
                          <div className="px-3 py-3">
                            <div className="relative min-h-[44px]">
                              <div className="pointer-events-none absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${timelineHours.length}, minmax(0, 1fr))` }}>
                                {timelineHours.map((hour) => (
                                  <div className="border-r border-stone-100 last:border-r-0" key={`${row.key}-${lane.key}-${hour}`} />
                                ))}
                              </div>

                              {lane.segments.length === 0 ? (
                                <div className="relative z-10 flex h-11 items-center text-xs text-stone-400">Keine Einträge</div>
                              ) : (
                                lane.segments.map((segment) => (
                                  <div
                                    className={`absolute top-1/2 z-10 flex h-11 -translate-y-1/2 items-center overflow-hidden rounded-xl border px-3 text-xs font-semibold shadow-sm ${timelineToneClassName(segment.tone)}`}
                                    key={segment.key}
                                    style={{ left: `${segment.left}%`, width: `${segment.width}%` }}
                                    title={segment.title}
                                  >
                                    <span className="truncate">{segment.title}</span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
        <div className="space-y-5">
          <SectionCard
            subtitle="Gebuchte Termine und blockierte Zeiten werden hier gesammelt als belegt dargestellt."
            title="Belegte Zeiträume"
          >
            <div className="space-y-3">
              {occupancy.length === 0 ? (
                <EmptyState description="Aktuell sind keine belegten Zeiträume eingetragen." title="Noch nichts belegt" />
              ) : (
                occupancy.map((entry, index) => (
                  <Card className="p-4" key={`${entry.source}-${entry.start_at}-${entry.end_at}-${index}`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-stone-900">{formatDateRange(entry.start_at, entry.end_at)}</p>
                        <p className="text-sm text-stone-600">{occupancyLabel(entry.source)}</p>
                      </div>
                      <Badge tone="rejected">Belegt</Badge>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </SectionCard>

          <SectionCard
            subtitle="Innerhalb dieser Zeitfenster können freigeschaltete Reiter einen einzelnen Termin anfragen."
            title="Verfügbare Zeitfenster"
          >
            <div className="space-y-3">
              {rules.length === 0 ? (
                <EmptyState
                  description="Aktuell gibt es noch keine offenen Verfügbarkeitsfenster."
                  title="Noch keine Zeitfenster"
                />
              ) : (
                rules.map((rule) => (
                  <Card className="p-4" key={rule.id}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-stone-900">{ruleLabel(rule)}</p>
                        <p className="text-sm text-stone-600">Freies Zeitfenster für Terminanfragen</p>
                      </div>
                      <Badge tone="approved">Verfügbar</Badge>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-5">
          {isRider ? (
            <SectionCard
              bodyClassName="space-y-5"
              subtitle="Wähle ein verfügbares Zeitfenster und fordere einen konkreten Termin an."
              title="Termin anfragen"
            >
              {riderApproved ? (
                rules.length > 0 ? (
                  <form action={requestBookingAction} className="space-y-4">
                    <input name="horseId" type="hidden" value={horse.id} />
                    <div>
                      <label htmlFor="ruleId">Verfügbarkeitsfenster</label>
                      <select defaultValue="" id="ruleId" name="ruleId" required>
                        <option value="">Bitte wählen</option>
                        {rules.map((rule) => (
                          <option key={rule.id} value={rule.id}>
                            {ruleLabel(rule)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="requestStartAt">Beginn</label>
                      <input id="requestStartAt" name="startAt" required type="datetime-local" />
                    </div>
                    <div>
                      <label htmlFor="requestEndAt">Ende</label>
                      <input id="requestEndAt" name="endAt" required type="datetime-local" />
                    </div>
                    <div>
                      <label htmlFor="recurrenceRrule">Wiederholung (optional)</label>
                      <input id="recurrenceRrule" name="recurrenceRrule" placeholder="FREQ=WEEKLY;INTERVAL=1;COUNT=6" type="text" />
                      <p className="mt-2 text-sm text-stone-600">Beispiel: jede Woche für sechs Termine.</p>
                    </div>
                    <SubmitButton idleLabel="Termin anfragen" pendingLabel="Wird gesendet..." />
                  </form>
                ) : (
                  <EmptyState
                    description="Aktuell gibt es keine offenen Verfügbarkeitsfenster für dieses Pferd."
                    title="Kein Zeitfenster verfügbar"
                  />
                )
              ) : (
                <EmptyState
                  description="Erst nach deiner Freischaltung kannst du einen Termin anfragen."
                  title="Noch nicht freigeschaltet"
                />
              )}

              <div className="space-y-3 border-t border-stone-200 pt-5">
                <h3 className="text-base font-semibold text-stone-900">Meine Terminanfragen für dieses Pferd</h3>
                {riderBookingRequests.length === 0 ? (
                  <EmptyState
                    description="Sobald du eine Terminanfrage stellst, erscheint sie hier mit aktuellem Status."
                    title="Noch keine Terminanfrage"
                  />
                ) : (
                  riderBookingRequests.map((request) => {
                    const rule = request.availability_rule_id ? ruleMap.get(request.availability_rule_id) ?? null : null;

                    return (
                      <RequestCard
                        description={
                          request.recurrence_rrule
                            ? `Wiederholung: ${request.recurrence_rrule}`
                            : rule
                              ? `Fenster: ${ruleLabel(rule)}`
                              : "Kein Zeitfenster mehr vorhanden."
                        }
                        eyebrow={
                          request.requested_start_at && request.requested_end_at
                            ? formatDateRange(request.requested_start_at, request.requested_end_at)
                            : "Zeitpunkt wird geprüft"
                        }
                        key={request.id}
                        meta={formatDateTime(request.created_at)}
                        status={request.status}
                        timeline
                        title="Terminanfrage"
                      />
                    );
                  })
                )}
              </div>
            </SectionCard>
          ) : null}

          {isOwner ? (
              <>
                <SectionCard subtitle="Lege wiederkehrende Standardzeiten fest und nutze Sperren nur noch für Ausnahmen." title="Standardzeiten & Ausnahmen">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <Card className="p-5">
                      <form action={createAvailabilityRuleAction} className="ui-form-stack">
                        <input name="horseId" type="hidden" value={horse.id} />
                        <div className="ui-subpanel">
                          <p className="ui-eyebrow">Standardzeiten</p>
                          <p className="mt-2 ui-inline-meta">Das gewählte Wochenmuster wird für die nächsten 8 Wochen als Verfügbarkeit angelegt.</p>
                        </div>
                        <fieldset className="space-y-3">
                          <legend className="text-sm font-medium text-stone-900">Wochenmuster</legend>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <label className="block">
                              <input className="peer sr-only" defaultChecked name="availabilityPreset" type="radio" value="weekdays" />
                              <span className="flex min-h-[52px] flex-col justify-center rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-700 transition peer-checked:border-forest peer-checked:bg-sand peer-checked:text-stone-900">
                                <span>Werktage</span>
                                <span className="mt-1 text-xs text-stone-500 peer-checked:text-forest">Montag bis Freitag</span>
                              </span>
                            </label>
                            <label className="block">
                              <input className="peer sr-only" name="availabilityPreset" type="radio" value="daily" />
                              <span className="flex min-h-[52px] flex-col justify-center rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-700 transition peer-checked:border-forest peer-checked:bg-sand peer-checked:text-stone-900">
                                <span>Jeden Tag</span>
                                <span className="mt-1 text-xs text-stone-500 peer-checked:text-forest">Für die komplette Woche</span>
                              </span>
                            </label>
                            <label className="block">
                              <input className="peer sr-only" name="availabilityPreset" type="radio" value="weekends" />
                              <span className="flex min-h-[52px] flex-col justify-center rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-700 transition peer-checked:border-forest peer-checked:bg-sand peer-checked:text-stone-900">
                                <span>Wochenende</span>
                                <span className="mt-1 text-xs text-stone-500 peer-checked:text-forest">Samstag und Sonntag</span>
                              </span>
                            </label>
                            <label className="block">
                              <input className="peer sr-only" name="availabilityPreset" type="radio" value="custom" />
                              <span className="flex min-h-[52px] flex-col justify-center rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-700 transition peer-checked:border-forest peer-checked:bg-sand peer-checked:text-stone-900">
                                <span>Eigene Tage</span>
                                <span className="mt-1 text-xs text-stone-500 peer-checked:text-forest">Nur die Auswahl unten</span>
                              </span>
                            </label>
                          </div>
                        </fieldset>
                        <fieldset className="space-y-3">
                          <legend className="text-sm font-medium text-stone-900">Wochenraster für eigene Tage</legend>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                            <label className="block">
                              <input className="peer sr-only" name="weekday" type="checkbox" value="1" />
                              <span className="flex min-h-[84px] flex-col justify-between rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-700 transition peer-checked:border-forest peer-checked:bg-sand peer-checked:text-stone-900">
                                <span>Mo</span>
                                <span className="text-xs text-stone-500 peer-checked:text-forest">Montag</span>
                              </span>
                            </label>
                            <label className="block">
                              <input className="peer sr-only" name="weekday" type="checkbox" value="2" />
                              <span className="flex min-h-[84px] flex-col justify-between rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-700 transition peer-checked:border-forest peer-checked:bg-sand peer-checked:text-stone-900">
                                <span>Di</span>
                                <span className="text-xs text-stone-500 peer-checked:text-forest">Dienstag</span>
                              </span>
                            </label>
                            <label className="block">
                              <input className="peer sr-only" name="weekday" type="checkbox" value="3" />
                              <span className="flex min-h-[84px] flex-col justify-between rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-700 transition peer-checked:border-forest peer-checked:bg-sand peer-checked:text-stone-900">
                                <span>Mi</span>
                                <span className="text-xs text-stone-500 peer-checked:text-forest">Mittwoch</span>
                              </span>
                            </label>
                            <label className="block">
                              <input className="peer sr-only" name="weekday" type="checkbox" value="4" />
                              <span className="flex min-h-[84px] flex-col justify-between rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-700 transition peer-checked:border-forest peer-checked:bg-sand peer-checked:text-stone-900">
                                <span>Do</span>
                                <span className="text-xs text-stone-500 peer-checked:text-forest">Donnerstag</span>
                              </span>
                            </label>
                            <label className="block">
                              <input className="peer sr-only" name="weekday" type="checkbox" value="5" />
                              <span className="flex min-h-[84px] flex-col justify-between rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-700 transition peer-checked:border-forest peer-checked:bg-sand peer-checked:text-stone-900">
                                <span>Fr</span>
                                <span className="text-xs text-stone-500 peer-checked:text-forest">Freitag</span>
                              </span>
                            </label>
                            <label className="block">
                              <input className="peer sr-only" name="weekday" type="checkbox" value="6" />
                              <span className="flex min-h-[84px] flex-col justify-between rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-700 transition peer-checked:border-forest peer-checked:bg-sand peer-checked:text-stone-900">
                                <span>Sa</span>
                                <span className="text-xs text-stone-500 peer-checked:text-forest">Samstag</span>
                              </span>
                            </label>
                            <label className="block">
                              <input className="peer sr-only" name="weekday" type="checkbox" value="0" />
                              <span className="flex min-h-[84px] flex-col justify-between rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-700 transition peer-checked:border-forest peer-checked:bg-sand peer-checked:text-stone-900">
                                <span>So</span>
                                <span className="text-xs text-stone-500 peer-checked:text-forest">Sonntag</span>
                              </span>
                            </label>
                          </div>
                        </fieldset>
                        <div className="ui-field-grid sm:grid-cols-2">
                          <div>
                            <label htmlFor="availabilityStartTime">Von</label>
                            <input defaultValue="17:00" id="availabilityStartTime" name="startTime" required type="time" />
                          </div>
                          <div>
                            <label htmlFor="availabilityEndTime">Bis</label>
                            <input defaultValue="19:00" id="availabilityEndTime" name="endTime" required type="time" />
                          </div>
                        </div>
                        <SubmitButton idleLabel="Standardzeiten speichern" pendingLabel="Wird gespeichert..." />
                      </form>
                    </Card>
                    <Card className="p-5">
                      <form action={createCalendarBlockAction} className="ui-form-stack">
                        <input name="horseId" type="hidden" value={horse.id} />
                        <div className="ui-subpanel">
                          <p className="ui-eyebrow">Ausnahme sperren</p>
                          <p className="mt-2 ui-inline-meta">Nutze Sperren nur dann, wenn das Pferd trotz Standardzeit kurzfristig nicht verfügbar ist.</p>
                        </div>
                        <div>
                          <label htmlFor="blockStartAt">Beginn</label>
                          <input id="blockStartAt" name="startAt" required type="datetime-local" />
                        </div>
                        <div>
                          <label htmlFor="blockEndAt">Ende</label>
                          <input id="blockEndAt" name="endAt" required type="datetime-local" />
                        </div>
                        <SubmitButton idleLabel="Ausnahme sperren" pendingLabel="Wird gespeichert..." />
                      </form>
                    </Card>
                  </div>
                </SectionCard>

                <SectionCard subtitle="Nimm angefragte Termine an oder lehne sie ab." title="Offene Terminanfragen">
                  <div className="space-y-4">
                    {requestedOwnerBookingItems.length === 0 ? (
                      <EmptyState
                        description="Für dieses Pferd liegen derzeit keine offenen Terminanfragen vor."
                        title="Keine offenen Terminanfragen"
                      />
                    ) : (
                      requestedOwnerBookingItems.map((request) => {
                        const rule = request.availability_rule_id ? ruleMap.get(request.availability_rule_id) ?? null : null;

                        return (
                          <Card className="p-4 sm:p-5" key={request.id}>
                            <div className="space-y-4">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="space-y-1">
                                  <p className="text-sm font-semibold text-stone-900">
                                    {request.requested_start_at && request.requested_end_at
                                      ? formatDateRange(request.requested_start_at, request.requested_end_at)
                                      : "Zeitpunkt wird geprüft"}
                                  </p>
                                  <p className="text-sm text-stone-600">Reiter-ID {request.rider_id.slice(0, 8)}</p>
                                  <p className="text-sm text-stone-600">{rule ? `Fenster: ${ruleLabel(rule)}` : "Kein Zeitfenster mehr vorhanden."}</p>
                                </div>
                                <StatusBadge status={request.status} />
                              </div>
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <form action={acceptBookingRequestAction}>
                                  <input name="requestId" type="hidden" value={request.id} />
                                  <Button className="w-full" type="submit" variant="primary">
                                    Annehmen
                                  </Button>
                                </form>
                                <form action={declineBookingRequestAction}>
                                  <input name="requestId" type="hidden" value={request.id} />
                                  <Button
                                    className="w-full border-rose-300 text-rose-700 hover:border-rose-400 hover:bg-rose-50 hover:text-rose-700"
                                    type="submit"
                                    variant="secondary"
                                  >
                                    Ablehnen
                                  </Button>
                                </form>
                              </div>
                            </div>
                          </Card>
                        );
                      })
                    )}
                  </div>
                </SectionCard>

                <div className="grid gap-5 lg:grid-cols-2">
                  <SectionCard
                    subtitle="Beim Entfernen werden offene Terminanfragen in diesem Fenster automatisch gelöscht."
                    title="Eigene Verfügbarkeitsfenster"
                  >
                    <div className="space-y-3">
                      {rules.length === 0 ? (
                        <EmptyState
                          description="Lege zuerst ein Verfügbarkeitsfenster an, damit Reiter Termine anfragen können."
                          title="Noch keine Verfügbarkeiten"
                        />
                      ) : (
                        rules.map((rule) => (
                          <Card className="p-4" key={rule.id}>
                            <p className="text-sm font-semibold text-stone-900">{ruleLabel(rule)}</p>
                            <form action={deleteAvailabilityRuleAction} className="mt-3">
                              <input name="ruleId" type="hidden" value={rule.id} />
                              <ConfirmSubmitButton
                                className={buttonVariants("secondary", "w-full")}
                                confirmMessage="Möchtest du dieses Verfügbarkeitsfenster wirklich entfernen?"
                                idleLabel="Fenster löschen"
                                pendingLabel="Wird entfernt..."
                              />
                            </form>
                          </Card>
                        ))
                      )}
                    </div>
                  </SectionCard>

                  <SectionCard subtitle="Nur diese selbst gesetzten Sperren kannst du wieder entfernen." title="Eigene Sperren">
                    <div className="space-y-3">
                      {ownerBlocks.length === 0 ? (
                        <EmptyState
                          description="Nutze Sperren für Ausnahmen, wenn das Pferd kurzfristig nicht verfügbar ist."
                          title="Noch keine Sperren"
                        />
                      ) : (
                        ownerBlocks.map((block) => (
                          <Card className="p-4" key={block.id}>
                            <p className="text-sm font-semibold text-stone-900">{formatDateRange(block.start_at, block.end_at)}</p>
                            <form action={deleteCalendarBlockAction} className="mt-3">
                              <input name="blockId" type="hidden" value={block.id} />
                              <ConfirmSubmitButton
                                className={buttonVariants("secondary", "w-full")}
                                confirmMessage="Möchtest du diese Kalender-Sperre wirklich entfernen?"
                                idleLabel="Sperre entfernen"
                                pendingLabel="Wird entfernt..."
                              />
                            </form>
                          </Card>
                        ))
                      )}
                    </div>
                  </SectionCard>
                </div>
              </>
          ) : null}

          {!profile ? (
            <SectionCard subtitle="Melde dich an, um Verfügbarkeiten, Anfragen und deinen eigenen Status zu sehen." title="Kalender nutzen">
              <Link className={buttonVariants("primary", "w-full sm:w-auto")} href="/login">
                Anmelden, um den Kalender zu nutzen
              </Link>
            </SectionCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}
