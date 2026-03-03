import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  acceptBookingRequestAction,
  createAvailabilityRuleAction,
  createAvailabilityDayAction,
  createCalendarBlockAction,
  declineBookingRequestAction,
  deleteAvailabilityRuleAction,
  deleteCalendarBlockAction,
  requestBookingAction
} from "@/app/actions";
import { RequestCard } from "@/components/blocks/request-card";
import { DayRangePicker } from "@/components/calendar/day-range-picker";
import { InteractiveTimelineLane } from "@/components/calendar/interactive-timeline-lane";
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
  href?: string;
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
  dayKey: string;
  key: string;
  label: string;
  meta: string;
  isSelected: boolean;
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

function parseTimelineHourParam(value: string | null) {
  if (!value || !/^\d{2}:00$/.test(value)) {
    return null;
  }

  const hour = Number.parseInt(value.slice(0, 2), 10);
  return Number.isInteger(hour) ? hour : null;
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
  includePendingLane,
  selectedDayKey
}: {
  days: Date[];
  rules: AvailabilityRule[];
  occupancy: CalendarOccupancyRow[];
  pendingRequests: BookingRequest[];
  includePendingLane: boolean;
  selectedDayKey: string;
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
      .map((entry, index) => buildTimelineSegment(dayDate, entry.start_at, entry.end_at, `Belegt ${formatTime(entry.start_at)}–${formatTime(entry.end_at)}`, "occupied", entry.source === "block" ? `block:${entry.start_at}|${entry.end_at}` : `${entry.source}-${entry.start_at}-${entry.end_at}-${index}`))
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

    const dayKey = toDayKey(dayDate);

    return {
      dayKey,
      key: dayKey,
      label: weekdayFormatter.format(dayDate),
      meta: dateFormatter.format(dayDate),
      isSelected: dayKey === selectedDayKey,
      isToday: dayKey === todayKey,
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
  const upcomingDays = buildUpcomingDays(CALENDAR_TIMELINE_DAY_COUNT);
  const fallbackDay = upcomingDays[0] ?? new Date();
  const dayParam = readSearchParam(searchParams, "day");
  const selectedDayKey = upcomingDays.some((day) => toDayKey(day) === dayParam) ? (dayParam as string) : toDayKey(fallbackDay);
  const timelineRows = buildTimelineRows({
    days: upcomingDays,
    includePendingLane: isOwner,
    occupancy,
    pendingRequests: requestedOwnerBookingItems,
    rules,
    selectedDayKey
  });
  const selectedTimelineRow = timelineRows.find((row) => row.dayKey === selectedDayKey) ?? timelineRows[0] ?? null;
  const selectedDayLabel = selectedTimelineRow ? `${selectedTimelineRow.label}, ${selectedTimelineRow.meta}` : "heute";
  const slotStartParam = parseTimelineHourParam(readSearchParam(searchParams, "slotStart"));
  const slotEndParam = parseTimelineHourParam(readSearchParam(searchParams, "slotEnd"));
  const selectedSlotStartHour =
    typeof slotStartParam === "number" && slotStartParam >= CALENDAR_TIMELINE_START_HOUR && slotStartParam < CALENDAR_TIMELINE_END_HOUR
      ? slotStartParam
      : null;
  const selectedSlotEndHour =
    typeof slotEndParam === "number" && slotEndParam > CALENDAR_TIMELINE_START_HOUR && slotEndParam <= CALENDAR_TIMELINE_END_HOUR
      ? slotEndParam
      : null;
  const selectedSlotLabel =
    selectedSlotStartHour !== null && selectedSlotEndHour !== null && selectedSlotEndHour > selectedSlotStartHour
      ? `${String(selectedSlotStartHour).padStart(2, "0")}:00 - ${String(selectedSlotEndHour).padStart(2, "0")}:00`
      : null;
  const focusRuleId = isOwner ? readSearchParam(searchParams, "focusRule") : null;
  const focusBlockId = isOwner ? readSearchParam(searchParams, "focusBlock") : null;
  const ownerBlockIdByRange = new Map(ownerBlocks.map((block) => [`${block.start_at}|${block.end_at}`, block.id]));
  const prioritizedRules =
    focusRuleId && rules.some((rule) => rule.id === focusRuleId)
      ? [...rules].sort((left, right) => Number(right.id === focusRuleId) - Number(left.id === focusRuleId))
      : rules;
  const prioritizedBlocks =
    focusBlockId && ownerBlocks.some((block) => block.id === focusBlockId)
      ? [...ownerBlocks].sort((left, right) => Number(right.id === focusBlockId) - Number(left.id === focusBlockId))
      : ownerBlocks;
  const decoratedTimelineRows = timelineRows.map((row) => ({
    ...row,
    lanes: row.lanes.map((lane) => ({
      ...lane,
      segments: lane.segments.map((segment) => {
        if (!isOwner) {
          return segment;
        }

        if (lane.key === "available") {
          return {
            ...segment,
            href: `/pferde/${horse.id}/kalender?day=${row.dayKey}&focusRule=${segment.key}#direktbearbeitung`
          };
        }

        if (lane.key === "occupied" && segment.key.startsWith("block:")) {
          const blockId = ownerBlockIdByRange.get(segment.key.slice(6));

          if (blockId) {
            return {
              ...segment,
              href: `/pferde/${horse.id}/kalender?day=${row.dayKey}&focusBlock=${blockId}#direktbearbeitung`
            };
          }
        }

        return segment;
      })
    }))
  }));

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
              <Badge tone={ownerPlan.key === "paid" ? "approved" : ownerPlan.key === "trial" ? "pending" : "neutral"}>{ownerPlan.label}</Badge>
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

          {isOwner ? (
            <p className="text-sm text-stone-600">
              Tipp: Klicke links auf einen Tag oder ziehe direkt ueber freie Stunden. Der Tageseditor wird sofort mit Datum und Uhrzeit vorbelegt.</p>
          ) : null}

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
                {decoratedTimelineRows.map((row) => (
                  <div className={`grid grid-cols-[180px_minmax(0,1fr)] ${row.isSelected ? "bg-sand/20" : ""}`} key={row.key}>
                    <div className={`border-r border-stone-200 px-4 py-4 ${row.isSelected ? "bg-sand/40" : ""}`}>
                      {isOwner ? (
                        <a className="block space-y-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700/30" href={`/pferde/${horse.id}/kalender?day=${row.dayKey}#tagesfenster`}>
                          <p className="text-sm font-semibold capitalize text-stone-900">{row.label}</p>
                          <p className="text-xs text-stone-500">{row.meta}</p>
                          <div className="flex flex-wrap gap-2">
                            {row.isToday ? <Badge tone="info">Heute</Badge> : null}
                            {row.isSelected ? <Badge tone="approved">Ausgewählt</Badge> : <Badge tone="neutral">Tag wählen</Badge>}
                          </div>
                        </a>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm font-semibold capitalize text-stone-900">{row.label}</p>
                          <p className="text-xs text-stone-500">{row.meta}</p>
                          {row.isToday ? <Badge tone="info">Heute</Badge> : null}
                        </div>
                      )}
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

                              {isOwner && lane.key === "available" ? (
                                <InteractiveTimelineLane dayKey={row.dayKey} horseId={horse.id} hourCount={timelineHours.length} hours={timelineHours} />
                              ) : null}
                              {lane.segments.length === 0 ? (
                                <div className="relative z-20 flex h-11 items-center text-xs text-stone-400">
                                  {isOwner && lane.key === "available" ? "Freie Stunden ziehen oder anklicken" : "Keine Eintraege"}
                                </div>
                              ) : (
                                lane.segments.map((segment) => {
                                  const segmentClassName = `absolute top-1/2 z-20 flex h-11 -translate-y-1/2 items-center overflow-hidden rounded-xl border px-3 text-xs font-semibold shadow-sm ${timelineToneClassName(segment.tone)}`;

                                  return segment.href ? (
                                    <a
                                      className={segmentClassName}
                                      href={segment.href}
                                      key={segment.key}
                                      style={{ left: `${segment.left}%`, width: `${segment.width}%` }}
                                      title={segment.title}
                                    >
                                      <span className="truncate">{segment.title}</span>
                                    </a>
                                  ) : (
                                    <div
                                      className={segmentClassName}
                                      key={segment.key}
                                      style={{ left: `${segment.left}%`, width: `${segment.width}%` }}
                                      title={segment.title}
                                    >
                                      <span className="truncate">{segment.title}</span>
                                    </div>
                                  );
                                })
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

      <div className="space-y-5">
        {isOwner ? (
          <>
            <SectionCard
              bodyClassName="space-y-5"
              subtitle="Pflege hier dein Wochenmuster und einzelne Ausnahmen. Das Raster oben zeigt dir sofort, wie sich die Einträge auswirken."
              title="Kalender bearbeiten"
            >
              <Card className="p-5 sm:p-6" id="tagesfenster">
                <form action={createAvailabilityDayAction} className="space-y-4">
                  <input name="horseId" type="hidden" value={horse.id} />
                  <input name="selectedDate" type="hidden" value={selectedDayKey} />
                  <div className="ui-subpanel">
                    <p className="ui-eyebrow">Schnell für einen Tag</p>
                    <p className="mt-2 ui-inline-meta">
                      Ausgewaehlt: {selectedDayLabel}{selectedSlotLabel ? `, ${selectedSlotLabel}` : ""}. Ziehe direkt im Raster ueber freie Stunden oder justiere unten den genauen Zeitraum.</p>
                  </div>
                  <DayRangePicker
                    dayLabel={selectedDayLabel}
                    endHour={CALENDAR_TIMELINE_END_HOUR}
                    initialEndHour={selectedSlotEndHour ?? undefined}
                    initialStartHour={selectedSlotStartHour ?? undefined}
                    key={`${selectedDayKey}-${selectedSlotLabel ?? "default"}`}
                    startHour={CALENDAR_TIMELINE_START_HOUR}
                  />
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <SubmitButton className={buttonVariants("primary", "w-full sm:w-auto px-5 py-3 text-base")} idleLabel="Tagesfenster speichern" pendingLabel="Wird gespeichert..." />
                    <a className={buttonVariants("secondary", "w-full sm:w-auto")} href={`/pferde/${horse.id}/kalender`}>
                      Auswahl zurücksetzen
                    </a>
                  </div>
                </form>
              </Card>

              <Card className="p-5 sm:p-6">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Aktive Zeitfenster</p>
                    <p className="mt-2 text-2xl font-semibold text-stone-900">{rules.length}</p>
                    <p className="mt-1 text-sm text-stone-600">Im Planer direkt als verfügbar sichtbar.</p>
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Belegte Zeiten</p>
                    <p className="mt-2 text-2xl font-semibold text-stone-900">{occupancy.length}</p>
                    <p className="mt-1 text-sm text-stone-600">Gebucht oder von dir gezielt blockiert.</p>
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Ausnahmen</p>
                    <p className="mt-2 text-2xl font-semibold text-stone-900">{ownerBlocks.length}</p>
                    <p className="mt-1 text-sm text-stone-600">Nur für kurzfristige Sperren außerhalb des Musters.</p>
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Offene Anfragen</p>
                    <p className="mt-2 text-2xl font-semibold text-stone-900">{requestedOwnerBookingItems.length}</p>
                    <p className="mt-1 text-sm text-stone-600">Direkt unterhalb des Editors zur Freigabe.</p>
                  </div>
                </div>
              </Card>

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
                <Card className="p-5 sm:p-6">
                  <form action={createAvailabilityRuleAction} className="ui-form-stack">
                    <input name="horseId" type="hidden" value={horse.id} />
                    <div className="ui-subpanel">
                      <p className="ui-eyebrow">Wiederkehrende Verfügbarkeit</p>
                      <p className="mt-2 ui-inline-meta">1. Wochenmuster wählen 2. Tage markieren 3. Uhrzeit speichern. Daraus werden für die nächsten 8 Wochen konkrete Zeitfenster erzeugt.</p>
                    </div>
                    <fieldset className="space-y-3">
                      <legend className="text-sm font-medium text-stone-900">Schnellauswahl</legend>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="block">
                          <input className="peer sr-only" defaultChecked name="availabilityPreset" type="radio" value="weekdays" />
                          <span className="flex min-h-[56px] flex-col justify-center rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-700 transition peer-checked:border-forest peer-checked:bg-sand peer-checked:text-stone-900">
                            <span>Werktage</span>
                            <span className="mt-1 text-xs text-stone-500 peer-checked:text-forest">Montag bis Freitag</span>
                          </span>
                        </label>
                        <label className="block">
                          <input className="peer sr-only" name="availabilityPreset" type="radio" value="daily" />
                          <span className="flex min-h-[56px] flex-col justify-center rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-700 transition peer-checked:border-forest peer-checked:bg-sand peer-checked:text-stone-900">
                            <span>Jeden Tag</span>
                            <span className="mt-1 text-xs text-stone-500 peer-checked:text-forest">Für die komplette Woche</span>
                          </span>
                        </label>
                        <label className="block">
                          <input className="peer sr-only" name="availabilityPreset" type="radio" value="weekends" />
                          <span className="flex min-h-[56px] flex-col justify-center rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-700 transition peer-checked:border-forest peer-checked:bg-sand peer-checked:text-stone-900">
                            <span>Wochenende</span>
                            <span className="mt-1 text-xs text-stone-500 peer-checked:text-forest">Samstag und Sonntag</span>
                          </span>
                        </label>
                        <label className="block">
                          <input className="peer sr-only" name="availabilityPreset" type="radio" value="custom" />
                          <span className="flex min-h-[56px] flex-col justify-center rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-700 transition peer-checked:border-forest peer-checked:bg-sand peer-checked:text-stone-900">
                            <span>Eigene Tage</span>
                            <span className="mt-1 text-xs text-stone-500 peer-checked:text-forest">Nur die Auswahl im Raster</span>
                          </span>
                        </label>
                      </div>
                    </fieldset>
                    <fieldset className="space-y-3">
                      <legend className="text-sm font-medium text-stone-900">Wochenraster</legend>
                      <p className="text-sm text-stone-600">Markiere die Tage, an denen das Pferd grundsätzlich verfügbar sein soll.</p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
                        <label className="block">
                          <input className="peer sr-only" name="weekday" type="checkbox" value="1" />
                          <span className="flex min-h-[92px] flex-col justify-between rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-700 transition peer-checked:border-forest peer-checked:bg-sand peer-checked:text-stone-900">
                            <span>Mo</span>
                            <span className="text-xs text-stone-500 peer-checked:text-forest">Montag</span>
                          </span>
                        </label>
                        <label className="block">
                          <input className="peer sr-only" name="weekday" type="checkbox" value="2" />
                          <span className="flex min-h-[92px] flex-col justify-between rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-700 transition peer-checked:border-forest peer-checked:bg-sand peer-checked:text-stone-900">
                            <span>Di</span>
                            <span className="text-xs text-stone-500 peer-checked:text-forest">Dienstag</span>
                          </span>
                        </label>
                        <label className="block">
                          <input className="peer sr-only" name="weekday" type="checkbox" value="3" />
                          <span className="flex min-h-[92px] flex-col justify-between rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-700 transition peer-checked:border-forest peer-checked:bg-sand peer-checked:text-stone-900">
                            <span>Mi</span>
                            <span className="text-xs text-stone-500 peer-checked:text-forest">Mittwoch</span>
                          </span>
                        </label>
                        <label className="block">
                          <input className="peer sr-only" name="weekday" type="checkbox" value="4" />
                          <span className="flex min-h-[92px] flex-col justify-between rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-700 transition peer-checked:border-forest peer-checked:bg-sand peer-checked:text-stone-900">
                            <span>Do</span>
                            <span className="text-xs text-stone-500 peer-checked:text-forest">Donnerstag</span>
                          </span>
                        </label>
                        <label className="block">
                          <input className="peer sr-only" name="weekday" type="checkbox" value="5" />
                          <span className="flex min-h-[92px] flex-col justify-between rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-700 transition peer-checked:border-forest peer-checked:bg-sand peer-checked:text-stone-900">
                            <span>Fr</span>
                            <span className="text-xs text-stone-500 peer-checked:text-forest">Freitag</span>
                          </span>
                        </label>
                        <label className="block">
                          <input className="peer sr-only" name="weekday" type="checkbox" value="6" />
                          <span className="flex min-h-[92px] flex-col justify-between rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-700 transition peer-checked:border-forest peer-checked:bg-sand peer-checked:text-stone-900">
                            <span>Sa</span>
                            <span className="text-xs text-stone-500 peer-checked:text-forest">Samstag</span>
                          </span>
                        </label>
                        <label className="block">
                          <input className="peer sr-only" name="weekday" type="checkbox" value="0" />
                          <span className="flex min-h-[92px] flex-col justify-between rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-700 transition peer-checked:border-forest peer-checked:bg-sand peer-checked:text-stone-900">
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
                    <SubmitButton idleLabel="Wochenmuster speichern" pendingLabel="Wird gespeichert..." />
                  </form>
                </Card>

                <Card className="p-5 sm:p-6">
                  <div className="space-y-5">
                    <form action={createCalendarBlockAction} className="ui-form-stack">
                      <input name="horseId" type="hidden" value={horse.id} />
                      <div className="ui-subpanel">
                        <p className="ui-eyebrow">Ausnahme blockieren</p>
                        <p className="mt-2 ui-inline-meta">Nutze Sperren nur dann, wenn das Pferd trotz Wochenmuster kurzfristig nicht verfügbar ist.</p>
                      </div>
                      <div>
                        <label htmlFor="blockStartAt">Beginn</label>
                        <input id="blockStartAt" name="startAt" required type="datetime-local" />
                      </div>
                      <div>
                        <label htmlFor="blockEndAt">Ende</label>
                        <input id="blockEndAt" name="endAt" required type="datetime-local" />
                      </div>
                      <SubmitButton idleLabel="Ausnahme speichern" pendingLabel="Wird gespeichert..." />
                    </form>

                    <div className="space-y-4 border-t border-stone-200 pt-5" id="direktbearbeitung">
                      <div className="space-y-1">
                        <h3 className="text-base font-semibold text-stone-900">Direktbearbeitung</h3>
                        <p className="text-sm text-stone-600">Hier entfernst du die nächsten Einträge direkt. Für die Gesamtübersicht bleibt das Raster oben die wichtigste Ansicht.</p>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <h4 className="text-sm font-semibold text-stone-900">Nächste Zeitfenster</h4>
                            <Badge tone="approved">{rules.length}</Badge>
                          </div>
                          {rules.length === 0 ? (
                            <p className="text-sm text-stone-500">Noch keine wiederkehrenden Zeitfenster vorhanden.</p>
                          ) : (
                            <div className="space-y-2">
                              {prioritizedRules.slice(0, 4).map((rule) => (
                                <div className={`rounded-2xl border px-3 py-3 ${focusRuleId === rule.id ? "border-emerald-300 bg-emerald-50/60" : "border-stone-200 bg-white"}`} key={rule.id}>
                                  <p className="text-sm font-semibold text-stone-900">{ruleLabel(rule)}</p>
                                  <form action={deleteAvailabilityRuleAction} className="mt-3">
                                    <input name="ruleId" type="hidden" value={rule.id} />
                                    <ConfirmSubmitButton
                                      className={buttonVariants("secondary", "w-full text-sm")}
                                      confirmMessage="Möchtest du dieses Verfügbarkeitsfenster wirklich entfernen?"
                                      idleLabel="Entfernen"
                                      pendingLabel="Wird entfernt..."
                                    />
                                  </form>
                                </div>
                              ))}
                              {rules.length > 4 ? <p className="text-xs text-stone-500">+ {rules.length - 4} weitere Einträge sind bereits im Planer sichtbar.</p> : null}
                            </div>
                          )}
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <h4 className="text-sm font-semibold text-stone-900">Nächste Sperren</h4>
                            <Badge tone="rejected">{ownerBlocks.length}</Badge>
                          </div>
                          {ownerBlocks.length === 0 ? (
                            <p className="text-sm text-stone-500">Aktuell sind keine Ausnahmen hinterlegt.</p>
                          ) : (
                            <div className="space-y-2">
                              {prioritizedBlocks.slice(0, 4).map((block) => (
                                <div className={`rounded-2xl border px-3 py-3 ${focusBlockId === block.id ? "border-rose-300 bg-rose-50/60" : "border-stone-200 bg-white"}`} key={block.id}>
                                  <p className="text-sm font-semibold text-stone-900">{formatDateRange(block.start_at, block.end_at)}</p>
                                  <form action={deleteCalendarBlockAction} className="mt-3">
                                    <input name="blockId" type="hidden" value={block.id} />
                                    <ConfirmSubmitButton
                                      className={buttonVariants("secondary", "w-full text-sm")}
                                      confirmMessage="Möchtest du diese Kalender-Sperre wirklich entfernen?"
                                      idleLabel="Entfernen"
                                      pendingLabel="Wird entfernt..."
                                    />
                                  </form>
                                </div>
                              ))}
                              {ownerBlocks.length > 4 ? <p className="text-xs text-stone-500">+ {ownerBlocks.length - 4} weitere Sperren sind bereits im Planer sichtbar.</p> : null}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </SectionCard>

            <SectionCard subtitle="Nimm angefragte Termine an oder lehne sie ab." title="Offene Terminanfragen">
              <div className="space-y-4">
                {requestedOwnerBookingItems.length === 0 ? (
                  <EmptyState description="Für dieses Pferd liegen derzeit keine offenen Terminanfragen vor." title="Keine offenen Terminanfragen" />
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
          </>
        ) : null}

        {isRider ? (
          <SectionCard
            bodyClassName="space-y-5"
            subtitle="Wähle ein verfügbares Zeitfenster aus dem Planer oben und fordere daraus einen konkreten Termin an."
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
                  <div className="ui-field-grid sm:grid-cols-2">
                    <div>
                      <label htmlFor="requestStartAt">Beginn</label>
                      <input id="requestStartAt" name="startAt" required type="datetime-local" />
                    </div>
                    <div>
                      <label htmlFor="requestEndAt">Ende</label>
                      <input id="requestEndAt" name="endAt" required type="datetime-local" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="recurrenceRrule">Wiederholung (optional)</label>
                    <input id="recurrenceRrule" name="recurrenceRrule" placeholder="FREQ=WEEKLY;INTERVAL=1;COUNT=6" type="text" />
                    <p className="mt-2 text-sm text-stone-600">Beispiel: jede Woche für sechs Termine.</p>
                  </div>
                  <SubmitButton idleLabel="Termin anfragen" pendingLabel="Wird gesendet..." />
                </form>
              ) : (
                <EmptyState description="Aktuell gibt es keine offenen Verfügbarkeitsfenster für dieses Pferd." title="Kein Zeitfenster verfügbar" />
              )
            ) : (
              <EmptyState description="Erst nach deiner Freischaltung kannst du einen Termin anfragen." title="Noch nicht freigeschaltet" />
            )}

            <div className="space-y-3 border-t border-stone-200 pt-5">
              <h3 className="text-base font-semibold text-stone-900">Meine Terminanfragen für dieses Pferd</h3>
              {riderBookingRequests.length === 0 ? (
                <EmptyState description="Sobald du eine Terminanfrage stellst, erscheint sie hier mit aktuellem Status." title="Noch keine Terminanfrage" />
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

        {!profile ? (
          <SectionCard subtitle="Melde dich an, um Verfügbarkeiten, Anfragen und deinen eigenen Status zu sehen." title="Kalender nutzen">
            <Link className={buttonVariants("primary", "w-full sm:w-auto")} href="/login">
              Anmelden, um den Kalender zu nutzen
            </Link>
          </SectionCard>
        ) : null}
      </div>
    </div>
  );
}
