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
  requestBookingAction,
  updateAvailabilityDayAction,
  updateCalendarBlockAction
} from "@/app/actions";
import { RequestCard } from "@/components/blocks/request-card";
import { DayRangePicker } from "@/components/calendar/day-range-picker";
import { DraggableTimelineSegment } from "@/components/calendar/draggable-timeline-segment";
import { InteractiveTimelineLane } from "@/components/calendar/interactive-timeline-lane";
import { HorseCalendarHero } from "@/components/calendar/horse-calendar-hero";
import { HorseCalendarRestrictedState } from "@/components/calendar/horse-calendar-restricted-state";
import { OwnerHorseCalendarV1 } from "@/components/calendar/owner-horse-calendar-v1";
import { OwnerTrialManager } from "@/components/calendar/owner-trial-manager";
import { RiderOperationalCalendar } from "@/components/calendar/rider-operational-calendar";
import { RiderBookingWindowForm } from "@/components/calendar/rider-booking-window-form";
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
import { getApprovalStatus } from "@/lib/approvals";
import { filterActiveOperationalBookings, getAcceptedOperationalBookingRequestIdSet } from "@/lib/active-operational-bookings";
import { getViewerContext } from "@/lib/auth";
import { canRescheduleOperationalBooking } from "@/lib/booking-guards";
import { formatBookingQuotaMinutes, formatWeeklyHoursLimit, type RiderWeeklyBookingQuota } from "@/lib/booking-limits";
import { HORSE_SELECT_FIELDS } from "@/lib/horses";
import { getUpcomingOperationalSlots, splitAvailabilityRulesByPhase, isTrialAvailabilityRule } from "@/lib/operational-slots";
import { buildOperationalWeekDays, parseOperationalWeekOffset } from "@/lib/operational-week";
import { getOwnerPlan, getOwnerPlanUsage } from "@/lib/plans";
import { canAccessOperationalCalendar, isActiveRelationship } from "@/lib/relationship-state";
import { ACTIVE_RELATIONSHIP_CALENDAR_V1, R1_CORE_MODE } from "@/lib/release-stage";
import { readSearchParam } from "@/lib/search-params";
import type { AvailabilityRule, Booking, BookingRequest, CalendarBlock, Horse, Profile, TrialRequest } from "@/types/database";

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
  endAt: string;
  entityId?: string;
  href?: string;
  key: string;
  left: number;
  startAt: string;
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

type MonthOverviewDay = {
  dayKey: string;
  dayNumber: string;
  inMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
  weekOffset: number;
};

type MonthOverviewWeek = {
  key: string;
  label: string;
  weekOffset: number;
  days: MonthOverviewDay[];
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

function getTimelineHourFromIso(value: string, roundUp = false) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const rawHour = date.getHours() + date.getMinutes() / 60;
  const roundedHour = roundUp ? Math.ceil(rawHour) : Math.floor(rawHour);
  return clampNumber(roundedHour, CALENDAR_TIMELINE_START_HOUR, CALENDAR_TIMELINE_END_HOUR);
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

function startOfWeek(date: Date) {
  const start = dayStart(date);
  const day = start.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + delta, 0, 0, 0, 0);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 0, 0, 0, 0);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1, 0, 0, 0, 0);
}

function parseRelativeOffset(value: string | null) {
  if (!value || !/^-?\d{1,3}$/.test(value)) {
    return 0;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : 0;
}

function parseCalendarRange(value: string | null) {
  if (value === "1") {
    return 1;
  }

  if (value === "30") {
    return 30;
  }

  return 7;
}

function buildWeekDays(startDate: Date, count: number) {
  const days: Date[] = [];

  for (let index = 0; index < count; index += 1) {
    days.push(addDays(startDate, index));
  }

  return days;
}

function toMonthKey(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const year = date.getFullYear();
  const month = `${String(date.getMonth() + 1).padStart(2, "0")}`;
  return `${year}-${month}`;
}

function getRelativeWeekOffset(targetWeekStart: Date) {
  const currentWeekStart = startOfWeek(new Date());
  const differenceMs = targetWeekStart.getTime() - currentWeekStart.getTime();
  return Math.round(differenceMs / (7 * 24 * 60 * 60 * 1000));
}

function buildMonthOverviewWeeks(monthDate: Date, selectedDayKey: string) {
  const monthStart = startOfMonth(monthDate);
  const weekdayFormatter = new Intl.DateTimeFormat("de-DE", { weekday: "short" });
  const weekLabelFormatter = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "short" });
  const todayKey = toDayKey(new Date());
  const weeks: MonthOverviewWeek[] = [];
  let weekStart = startOfWeek(monthStart);

  for (let index = 0; index < 6; index += 1) {
    const weekDays = buildWeekDays(weekStart, 7);
    const hasVisibleMonthDay = weekDays.some(
      (day) => day.getMonth() === monthStart.getMonth() && day.getFullYear() === monthStart.getFullYear()
    );

    if (!hasVisibleMonthDay && index > 0) {
      break;
    }

    weeks.push({
      days: weekDays.map((day) => ({
        dayKey: toDayKey(day),
        dayNumber: String(day.getDate()),
        inMonth: day.getMonth() === monthStart.getMonth() && day.getFullYear() === monthStart.getFullYear(),
        isSelected: toDayKey(day) === selectedDayKey,
        isToday: toDayKey(day) === todayKey,
        weekOffset: getRelativeWeekOffset(weekStart)
      })),
      key: toDayKey(weekStart),
      label: `${weekLabelFormatter.format(weekDays[0])} - ${weekLabelFormatter.format(weekDays[6])}`,
      weekOffset: getRelativeWeekOffset(weekStart)
    });

    weekStart = addDays(weekStart, 7);
  }

  return {
    weekdayLabels: buildWeekDays(startOfWeek(monthStart), 7).map((day) => weekdayFormatter.format(day)),
    weeks
  };
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
    endAt,
    key,
    left: clampNumber((startOffsetMinutes / totalVisibleMinutes) * 100, 0, 100),
    startAt,
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
      .map((rule) => buildTimelineSegment(dayDate, rule.start_at, rule.end_at, `Verfügbar ${formatTime(rule.start_at)}-${formatTime(rule.end_at)}`, "available", rule.id))
      .filter((segment): segment is TimelineSegment => Boolean(segment));

    const occupiedSegments = occupancy
      .filter((entry) => overlapsDay(entry.start_at, entry.end_at, dayDate))
      .map((entry, index) => buildTimelineSegment(dayDate, entry.start_at, entry.end_at, `Belegt ${formatTime(entry.start_at)}-${formatTime(entry.end_at)}`, "occupied", entry.source === "block" ? `block:${entry.start_at}|${entry.end_at}` : `${entry.source}-${entry.start_at}-${entry.end_at}-${index}`))
      .filter((segment): segment is TimelineSegment => Boolean(segment));

    const pendingSegments = pendingRequests
      .filter((request) => request.requested_start_at && request.requested_end_at && overlapsDay(request.requested_start_at, request.requested_end_at, dayDate))
      .map((request) => buildTimelineSegment(dayDate, request.requested_start_at as string, request.requested_end_at as string, `Anfrage ${formatTime(request.requested_start_at as string)}-${formatTime(request.requested_end_at as string)}`, "pending", request.id))
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

  const horseId = horse.id;
  const detailHref = `/pferde/${horseId}` as Route;
  const isOwner = profile?.role === "owner" && user?.id === horse.owner_id;
  const isRider = profile?.role === "rider" && Boolean(user);
  const ownerTrialOnlyMode = isOwner && R1_CORE_MODE && !ACTIVE_RELATIONSHIP_CALENDAR_V1;
  const simpleCalendarV1Mode = R1_CORE_MODE && ACTIVE_RELATIONSHIP_CALENDAR_V1;
  const approvalStatus = isRider && user ? await getApprovalStatus(horse.id, user.id, supabase) : null;
  const riderApproved = isActiveRelationship(approvalStatus);
  const canUseCalendar = canAccessOperationalCalendar({
    approvalStatus,
    isHorseOwner: isOwner,
    viewerRole: profile?.role
  });

  if (!canUseCalendar) {
    const restrictedCalendarSubtitle =
      profile?.role === "rider"
        ? "Operative Slots sind nur fuer aktiv freigeschaltete Reitbeteiligungen sichtbar."
        : profile
          ? "Fuer dieses Pferd ist der operative Kalender nur fuer den Pferdehalter und aktive Reitbeteiligungen sichtbar."
          : "Melde dich an, um Verfuegbarkeiten, Buchungen und deinen eigenen Status zu sehen.";

    return (
      <HorseCalendarRestrictedState
        detailHref={detailHref}
        error={error}
        isAuthenticated={Boolean(profile)}
        message={message}
        showLoadError={false}
        subtitle={restrictedCalendarSubtitle}
        title={"Kalender fuer " + horse.title}
      />
    );
  }

  const { data: ownerProfileData } = !isOwner
    ? await supabase
        .from("profiles")
        .select("role, is_premium, created_at, trial_started_at")
        .eq("id", horse.owner_id)
        .maybeSingle()
    : { data: null as Pick<Profile, "created_at" | "is_premium" | "role" | "trial_started_at"> | null };
  const ownerProfile = (isOwner ? profile : null) || ((ownerProfileData as Pick<Profile, "created_at" | "is_premium" | "role" | "trial_started_at"> | null) ?? null);
  const ownerPlanUsage = !ownerTrialOnlyMode && isOwner && user ? await getOwnerPlanUsage(supabase, user.id) : { approvedRiderCount: 0, horseCount: 1 };
  const ownerPlan = getOwnerPlan(ownerProfile, ownerPlanUsage);
  const now = new Date();
  const nowIso = now.toISOString();

  const [occupancyResult, rulesResult, ownerBlocksResult, ownerBookingRequestsResult, riderBookingRequestsResult, ownerNextTrialResult] = await Promise.all([
    ownerTrialOnlyMode
      ? Promise.resolve({ data: [] as CalendarOccupancyRow[] | null, error: null })
      : supabase.rpc("get_horse_calendar_occupancy", {
          p_horse_id: horse.id
        }),
    supabase
      .from("availability_rules")
      .select("id, horse_id, slot_id, start_at, end_at, active, is_trial_slot, created_at")
      .eq("horse_id", horse.id)
      .eq("active", true)
      .order("start_at", { ascending: true }),
    isOwner && !ownerTrialOnlyMode
      ? supabase
          .from("calendar_blocks")
          .select("id, horse_id, title, start_at, end_at, created_at")
          .eq("horse_id", horse.id)
          .order("start_at", { ascending: true })
      : Promise.resolve({ data: [] as CalendarBlock[] | null }),
    isOwner && !R1_CORE_MODE
      ? supabase
          .from("booking_requests")
          .select("id, slot_id, availability_rule_id, horse_id, rider_id, status, requested_start_at, requested_end_at, recurrence_rrule, created_at")
          .eq("horse_id", horse.id)
          .order("created_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] as BookingRequest[] | null }),
    !R1_CORE_MODE && isRider && user
      ? supabase
          .from("booking_requests")
          .select("id, slot_id, availability_rule_id, horse_id, rider_id, status, requested_start_at, requested_end_at, recurrence_rrule, created_at")
          .eq("horse_id", horse.id)
          .eq("rider_id", user.id)
          .order("created_at", { ascending: false })
          .limit(12)
      : Promise.resolve({ data: [] as BookingRequest[] | null }),
    isOwner
      ? supabase
          .from("trial_requests")
          .select("id, horse_id, rider_id, status, message, availability_rule_id, requested_start_at, requested_end_at, created_at")
          .eq("horse_id", horse.id)
          .in("status", ["requested", "accepted"])
          .not("requested_start_at", "is", null)
          .gte("requested_start_at", nowIso)
          .order("requested_start_at", { ascending: true })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null as TrialRequest | null })
  ]);

  const occupancy = ((occupancyResult.data as CalendarOccupancyRow[] | null) ?? []).sort(
    (left, right) => new Date(left.start_at).getTime() - new Date(right.start_at).getTime()
  );
  const occupancyError = occupancyResult.error;
  const rules = (rulesResult.data as AvailabilityRule[] | null) ?? [];
  const ownerBlocks = (ownerBlocksResult.data as CalendarBlock[] | null) ?? [];
  const ownerBookingRequests = (ownerBookingRequestsResult.data as BookingRequest[] | null) ?? [];
  const riderBookingRequests = (riderBookingRequestsResult.data as BookingRequest[] | null) ?? [];
  const nextTrialRequest = (ownerNextTrialResult.data as TrialRequest | null) ?? null;
  const quickRequestableRules = rules.slice(0, 6);
  const { operationalRules, trialRules } = splitAvailabilityRulesByPhase(rules);
  const trialSlotCount = trialRules.length;
  const ruleMap = new Map(rules.map((rule) => [rule.id, rule]));
  const requestedOwnerBookingItems = ownerBookingRequests.filter((request) => request.status === "requested");

  const [
    activeRelationshipCountResult,
    ownerUpcomingBookingsResult,
    riderUpcomingBookingsResult,
    bookingRequestStatusesResult,
    ownerHistoryBookingRequestsResult,
    riderHistoryBookingRequestsResult,
    riderWeeklyQuotaResult
  ] = await Promise.all([
    simpleCalendarV1Mode && isOwner
      ? supabase.from("approvals").select("horse_id", { count: "exact", head: true }).eq("horse_id", horse.id).eq("status", "approved")
      : Promise.resolve({ count: 0 as number | null }),
    simpleCalendarV1Mode && isOwner
      ? supabase
          .from("bookings")
          .select("id, booking_request_id, availability_rule_id, slot_id, horse_id, rider_id, start_at, end_at, created_at")
          .eq("horse_id", horse.id)
          .gte("end_at", nowIso)
          .order("start_at", { ascending: true })
          .limit(8)
      : Promise.resolve({ data: [] as Booking[] | null }),
    simpleCalendarV1Mode && isRider && riderApproved && user
      ? supabase
          .from("bookings")
          .select("id, booking_request_id, availability_rule_id, slot_id, horse_id, rider_id, start_at, end_at, created_at")
          .eq("horse_id", horse.id)
          .eq("rider_id", user.id)
          .gte("end_at", nowIso)
          .order("start_at", { ascending: true })
          .limit(8)
      : Promise.resolve({ data: [] as Booking[] | null }),
    simpleCalendarV1Mode
      ? supabase
          .from("booking_requests")
          .select("id, status")
          .eq("horse_id", horse.id)
          .limit(2000)
      : Promise.resolve({ data: [] as Pick<BookingRequest, "id" | "status">[] | null }),
    simpleCalendarV1Mode && isOwner
      ? supabase
          .from("booking_requests")
          .select("id, slot_id, availability_rule_id, horse_id, rider_id, status, requested_start_at, requested_end_at, recurrence_rrule, rescheduled_from_booking_request_id, created_at")
          .eq("horse_id", horse.id)
          .in("status", ["canceled", "rescheduled"])
          .order("created_at", { ascending: false })
          .limit(16)
      : Promise.resolve({ data: [] as BookingRequest[] | null }),
    simpleCalendarV1Mode && isRider && riderApproved && user
      ? supabase
          .from("booking_requests")
          .select("id, slot_id, availability_rule_id, horse_id, rider_id, status, requested_start_at, requested_end_at, recurrence_rrule, rescheduled_from_booking_request_id, created_at")
          .eq("horse_id", horse.id)
          .eq("rider_id", user.id)
          .in("status", ["canceled", "rescheduled"])
          .order("created_at", { ascending: false })
          .limit(16)
      : Promise.resolve({ data: [] as BookingRequest[] | null }),
    isRider && riderApproved && user
      ? supabase.rpc("get_rider_weekly_booking_quota", {
          p_horse_id: horse.id,
          p_reference_at: nowIso,
          p_rider_id: user.id
        })
      : Promise.resolve({ data: null as RiderWeeklyBookingQuota | RiderWeeklyBookingQuota[] | null })
  ]);
  const activeRelationshipCount = activeRelationshipCountResult.count ?? 0;
  const acceptedBookingRequestIds = getAcceptedOperationalBookingRequestIdSet(
    (bookingRequestStatusesResult.data as Pick<BookingRequest, "id" | "status">[] | null) ?? []
  );
  const ownerUpcomingBookings = filterActiveOperationalBookings(
    (ownerUpcomingBookingsResult.data as Booking[] | null) ?? [],
    acceptedBookingRequestIds
  );
  const riderUpcomingBookings = filterActiveOperationalBookings(
    (riderUpcomingBookingsResult.data as Booking[] | null) ?? [],
    acceptedBookingRequestIds
  );
  const ownerHistoryBookings = (ownerHistoryBookingRequestsResult.data as BookingRequest[] | null) ?? [];
  const riderHistoryBookings = (riderHistoryBookingRequestsResult.data as BookingRequest[] | null) ?? [];
  const ownerCanceledBookings = ownerHistoryBookings.filter((booking) => booking.status === "canceled");
  const riderCanceledBookings = riderHistoryBookings.filter((booking) => booking.status === "canceled");
  const ownerRescheduledBookings = ownerHistoryBookings.filter((booking) => booking.status === "rescheduled");
  const riderRescheduledBookings = riderHistoryBookings.filter((booking) => booking.status === "rescheduled");
  const riderWeeklyQuotaRaw = (riderWeeklyQuotaResult.data as RiderWeeklyBookingQuota | RiderWeeklyBookingQuota[] | null) ?? null;
  const riderWeeklyQuota = Array.isArray(riderWeeklyQuotaRaw) ? (riderWeeklyQuotaRaw[0] ?? null) : riderWeeklyQuotaRaw;
  const ownerBookingRiderIds = isOwner
    ? [
    ...new Set([
      ...(nextTrialRequest ? [nextTrialRequest.rider_id] : []),
      ...ownerUpcomingBookings.map((booking) => booking.rider_id),
      ...ownerCanceledBookings.map((booking) => booking.rider_id),
      ...ownerRescheduledBookings.map((booking) => booking.rider_id)
    ])
  ]
    : [];
  const { data: ownerBookingProfilesData } = isOwner && ownerBookingRiderIds.length > 0
    ? await supabase.from("profiles").select("id, display_name").in("id", ownerBookingRiderIds)
    : { data: [] as Pick<Profile, "id" | "display_name">[] };
  const ownerBookingProfileMap = new Map(
    (((ownerBookingProfilesData as Pick<Profile, "id" | "display_name">[] | null) ?? [])).map((profile) => [profile.id, profile.display_name?.trim() || null])
  );
  const nextTrialRiderName = nextTrialRequest ? ownerBookingProfileMap.get(nextTrialRequest.rider_id) ?? null : null;
  const ownerUpcomingBookingItems = ownerUpcomingBookings.map((booking) => ({
    ...booking,
    riderName: ownerBookingProfileMap.get(booking.rider_id) ?? null
  }));
  const ownerCanceledBookingItems = ownerCanceledBookings.map((booking) => ({
    ...booking,
    riderName: ownerBookingProfileMap.get(booking.rider_id) ?? null
  }));
  const ownerRescheduledBookingItems = ownerRescheduledBookings.map((booking) => ({
    ...booking,
    riderName: ownerBookingProfileMap.get(booking.rider_id) ?? null
  }));
  const rescheduleBookingParam = readSearchParam(searchParams, "rescheduleBooking");
  const ownerRescheduleBooking =
    simpleCalendarV1Mode && isOwner && rescheduleBookingParam
      ? ownerUpcomingBookingItems.find(
          (booking) =>
            booking.id === rescheduleBookingParam &&
            canRescheduleOperationalBooking({ startAt: booking.start_at, status: "accepted" })
        ) ?? null
      : null;
  const riderRescheduleBooking =
    simpleCalendarV1Mode && isRider && riderApproved && rescheduleBookingParam
      ? riderUpcomingBookings.find(
          (booking) =>
            booking.id === rescheduleBookingParam &&
            canRescheduleOperationalBooking({ startAt: booking.start_at, status: "accepted" })
        ) ?? null
      : null;
  const openOperationalSlots = getUpcomingOperationalSlots({
    disallowedRange:
      ownerRescheduleBooking || riderRescheduleBooking
        ? {
            end_at: (ownerRescheduleBooking ?? riderRescheduleBooking)?.end_at as string,
            start_at: (ownerRescheduleBooking ?? riderRescheduleBooking)?.start_at as string
          }
        : null,
    excludedRange:
      ownerRescheduleBooking || riderRescheduleBooking
        ? {
            end_at: (ownerRescheduleBooking ?? riderRescheduleBooking)?.end_at as string,
            start_at: (ownerRescheduleBooking ?? riderRescheduleBooking)?.start_at as string
          }
        : null,
    occupiedRanges: occupancy,
    rules: operationalRules
  });
  const simpleWeekOffset = parseOperationalWeekOffset(readSearchParam(searchParams, "weekOffset"));
  const simpleWeekDays = buildOperationalWeekDays({
    now,
    occupancy,
    rules,
    weekOffset: simpleWeekOffset
  });

  function buildSimpleWeekHref(weekOffset: number) {
    const nextSearchParams = new URLSearchParams();

    nextSearchParams.set("weekOffset", String(weekOffset));

    if (rescheduleBookingParam) {
      nextSearchParams.set("rescheduleBooking", rescheduleBookingParam);
    }

    return `/pferde/${horseId}/kalender?${nextSearchParams.toString()}#wochenansicht` as Route;
  }

  const previousSimpleWeekHref = buildSimpleWeekHref(simpleWeekOffset - 1);
  const nextSimpleWeekHref = buildSimpleWeekHref(simpleWeekOffset + 1);
  const simpleTodayHref = buildSimpleWeekHref(0);

  if (ownerTrialOnlyMode) {
    return (
      <OwnerTrialManager
        defaultSlotDate={toDayKey(new Date())}
        detailHref={detailHref}
        error={error}
        horse={horse}
        message={message}
        nextTrialRequest={nextTrialRequest}
        nextTrialRiderName={nextTrialRiderName}
        rules={rules}
      />
    );
  }

  if (simpleCalendarV1Mode && isOwner) {
    return (
      <OwnerHorseCalendarV1
        activeRelationshipCount={activeRelationshipCount}
        defaultOperationalDate={toDayKey(now)}
        defaultTrialDate={toDayKey(now)}
        detailHref={detailHref}
        error={error}
        horse={horse}
        message={message}
        nextTrialRequest={nextTrialRequest}
        nextTrialRiderName={nextTrialRiderName}
        nextWeekHref={nextSimpleWeekHref}
        operationalRules={operationalRules}
        calendarBlocks={ownerBlocks}
        canceledBookings={ownerCanceledBookingItems}
        openSlots={openOperationalSlots}
        previousWeekHref={previousSimpleWeekHref}
        rescheduleBooking={ownerRescheduleBooking}
        rescheduledBookings={ownerRescheduledBookingItems}
        todayWeekHref={simpleTodayHref}
        trialRules={trialRules}
        upcomingBookings={ownerUpcomingBookingItems}
        weekDays={simpleWeekDays}
      />
    );
  }

  if (simpleCalendarV1Mode && isRider && riderApproved) {
    return (
      <RiderOperationalCalendar
        detailHref={detailHref}
        error={error}
        horse={horse}
        message={message}
        canceledBookings={riderCanceledBookings}
        nextWeekHref={nextSimpleWeekHref}
        openSlots={openOperationalSlots}
        previousWeekHref={previousSimpleWeekHref}
        rescheduleBooking={riderRescheduleBooking}
        rescheduledBookings={riderRescheduledBookings}
        todayWeekHref={simpleTodayHref}
        upcomingBookings={riderUpcomingBookings}
        weekDays={simpleWeekDays}
        weeklyQuota={riderWeeklyQuota}
      />
    );
  }

  const timelineHours = ownerTrialOnlyMode ? [] : buildTimelineHours();
  const weekOffset = parseRelativeOffset(readSearchParam(searchParams, "weekOffset"));
  const monthOffset = parseRelativeOffset(readSearchParam(searchParams, "monthOffset"));
  const selectedRange = parseCalendarRange(readSearchParam(searchParams, "range"));
  const viewedWeekStart = addDays(startOfWeek(new Date()), weekOffset * selectedRange);
  const viewedMonthStart = startOfMonth(addMonths(new Date(), monthOffset));
  const weekDays = buildWeekDays(viewedWeekStart, selectedRange);
  const fallbackDay = weekDays[0] ?? viewedWeekStart;
  const dayParam = readSearchParam(searchParams, "day");
  const todayDayKey = toDayKey(new Date());
  const defaultSelectedDayKey = weekDays.some((day) => toDayKey(day) === todayDayKey) ? todayDayKey : toDayKey(fallbackDay);
  const selectedDayKey = weekDays.some((day) => toDayKey(day) === dayParam) ? (dayParam as string) : defaultSelectedDayKey;
  const timelineRows = ownerTrialOnlyMode
    ? []
    : buildTimelineRows({
        days: weekDays,
        includePendingLane: isOwner,
        occupancy,
        pendingRequests: requestedOwnerBookingItems,
        rules,
        selectedDayKey
      });
  const monthOverview = ownerTrialOnlyMode ? { weekdayLabels: [] as string[], weeks: [] as MonthOverviewWeek[] } : buildMonthOverviewWeeks(viewedMonthStart, selectedDayKey);
  const monthFormatter = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" });
  const weekRangeFormatter = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "short" });
  const currentViewQuery = `weekOffset=${weekOffset}&monthOffset=${monthOffset}&range=${selectedRange}`;
  const prevWeekStart = addDays(viewedWeekStart, -selectedRange);
  const nextWeekStart = addDays(viewedWeekStart, selectedRange);
  const previousWeekHref = `/pferde/${horse.id}/kalender?weekOffset=${weekOffset - 1}&monthOffset=${monthOffset}&range=${selectedRange}&day=${toDayKey(prevWeekStart)}` as Route;
  const nextWeekHref = `/pferde/${horse.id}/kalender?weekOffset=${weekOffset + 1}&monthOffset=${monthOffset}&range=${selectedRange}&day=${toDayKey(nextWeekStart)}` as Route;
  const previousMonthHref = `/pferde/${horse.id}/kalender?weekOffset=${weekOffset}&monthOffset=${monthOffset - 1}&range=${selectedRange}&day=${selectedDayKey}` as Route;
  const nextMonthHref = `/pferde/${horse.id}/kalender?weekOffset=${weekOffset}&monthOffset=${monthOffset + 1}&range=${selectedRange}&day=${selectedDayKey}` as Route;
  const todayHref = `/pferde/${horse.id}/kalender?weekOffset=0&monthOffset=0&range=${selectedRange}&day=${toDayKey(new Date())}` as Route;
  const nextDayHref = `/pferde/${horse.id}/kalender?weekOffset=0&monthOffset=0&range=1&day=${toDayKey(new Date())}#wochenplanung` as Route;
  const nextSevenDaysHref = `/pferde/${horse.id}/kalender?weekOffset=0&monthOffset=0&range=7&day=${toDayKey(new Date())}#wochenplanung` as Route;
  const nextThirtyDaysHref = `/pferde/${horse.id}/kalender?weekOffset=0&monthOffset=0&range=30&day=${toDayKey(new Date())}#wochenplanung` as Route;
  const timelineRowsLabel = `${weekRangeFormatter.format(weekDays[0] ?? viewedWeekStart)} - ${weekRangeFormatter.format(weekDays[weekDays.length - 1] ?? viewedWeekStart)}`;
  const selectedTimelineRow = ownerTrialOnlyMode ? null : timelineRows.find((row) => row.dayKey === selectedDayKey) ?? timelineRows[0] ?? null;
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
  const prioritizedTrialRules = prioritizedRules.filter((rule) => isTrialAvailabilityRule(rule));
  const prioritizedBlocks =
    focusBlockId && ownerBlocks.some((block) => block.id === focusBlockId)
      ? [...ownerBlocks].sort((left, right) => Number(right.id === focusBlockId) - Number(left.id === focusBlockId))
      : ownerBlocks;
  const focusedRule = focusRuleId ? rules.find((rule) => rule.id === focusRuleId) ?? null : null;
  const focusedBlock = focusBlockId ? ownerBlocks.find((block) => block.id === focusBlockId) ?? null : null;
  const focusedStartHour = focusedRule
    ? getTimelineHourFromIso(focusedRule.start_at)
    : focusedBlock
      ? getTimelineHourFromIso(focusedBlock.start_at)
      : null;
  const focusedEndHourRaw = focusedRule
    ? getTimelineHourFromIso(focusedRule.end_at, true)
    : focusedBlock
      ? getTimelineHourFromIso(focusedBlock.end_at, true)
      : null;
  const resolvedFocusedStartHour = typeof focusedStartHour === "number" ? focusedStartHour : null;
  const resolvedFocusedEndHour =
    typeof focusedEndHourRaw === "number" && (resolvedFocusedStartHour === null || focusedEndHourRaw > resolvedFocusedStartHour)
      ? focusedEndHourRaw
      : resolvedFocusedStartHour !== null
        ? Math.min(CALENDAR_TIMELINE_END_HOUR, resolvedFocusedStartHour + 1)
        : null;
  const editorInitialStartHour = selectedSlotStartHour ?? resolvedFocusedStartHour ?? undefined;
  const editorInitialEndHour = selectedSlotEndHour ?? resolvedFocusedEndHour ?? undefined;
  const dayEditorAction = focusedRule
    ? updateAvailabilityDayAction
    : focusedBlock
      ? updateCalendarBlockAction
      : createAvailabilityDayAction;
  const dayEditorModeLabel = focusedRule
    ? "Zeitfenster bearbeiten"
    : focusedBlock
      ? "Sperre bearbeiten"
      : "Schnell f\u00fcr einen Tag";
  const focusedEntrySummary = focusedRule
    ? ruleLabel(focusedRule)
    : focusedBlock
      ? [focusedBlock.title, formatDateRange(focusedBlock.start_at, focusedBlock.end_at)].filter(Boolean).join(" ? ")
      : null;
  const dayEditorDescription = focusedRule
    ? `Markiert: ${focusedEntrySummary}. Passe Beginn und Ende direkt im Tageseditor an.`
    : focusedBlock
      ? `Markiert: ${focusedEntrySummary}. Passe diese Sperre direkt im Tageseditor an.`
      : `Gew\u00e4hlt: ${selectedDayLabel}${selectedSlotLabel ? `, ${selectedSlotLabel}` : ""}. Ziehe im Raster \u00fcber freie Stunden oder justiere unten den genauen Zeitraum.`;
  const dayEditorSubmitLabel = focusedRule
    ? "Zeitfenster aktualisieren"
    : focusedBlock
      ? "Sperre aktualisieren"
      : "Tagesfenster speichern";
  const dayEditorPendingLabel = focusedRule || focusedBlock ? "Wird aktualisiert..." : "Wird gespeichert...";
  const resetEditorHref = `/pferde/${horse.id}/kalender?${currentViewQuery}&day=${selectedDayKey}#tagesfenster`;
  const decoratedTimelineRows = ownerTrialOnlyMode ? [] : timelineRows.map((row) => ({
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
            entityId: segment.key,
            href: `/pferde/${horse.id}/kalender?${currentViewQuery}&day=${row.dayKey}&focusRule=${segment.key}#tagesfenster`
          };
        }

        if (lane.key === "occupied" && segment.key.startsWith("block:")) {
          const blockId = ownerBlockIdByRange.get(segment.key.slice(6));

          if (blockId) {
            return {
              ...segment,
              entityId: blockId,
              href: `/pferde/${horse.id}/kalender?${currentViewQuery}&day=${row.dayKey}&focusBlock=${blockId}#tagesfenster`
            };
          }
        }

        return segment;
      })
    }))
  }));

  const nextTrialRangeLabel = nextTrialRequest
    ? formatDateRange(nextTrialRequest.requested_start_at as string, nextTrialRequest.requested_end_at as string)
    : null;
  const horseDescription =
    horse.description?.trim() || "Hier steuerst du Verf\u00fcgbarkeiten, Sperren und eingehende Terminanfragen f\u00fcr dieses Pferd.";
  const horseLocationLine = (horse.location_address ?? "PLZ " + horse.plz) + " " + (horse.active ? "- Aktiv" : "- Inaktiv");
  const ownerPlanTone = ownerPlan.key === "paid" ? "approved" : ownerPlan.key === "trial" ? "pending" : "neutral";

  return (
    <div className="space-y-6 sm:space-y-8">
      <Link className={buttonVariants("ghost", "min-h-0 justify-start px-0 py-0 text-sm font-semibold text-forest hover:bg-transparent hover:text-clay")} href={detailHref}>
        {"Zur\u00fcck zum Pferdeprofil"}
      </Link>

      <PageHeader
        subtitle="Kalender, Verf\u00fcgbarkeiten und Terminanfragen auf einen Blick."
        title={`Kalender f\u00fcr ${horse.title}`}
      />

      <div className="space-y-3" id="kalender-feedback">
        <Notice text={error} tone="error" />
        <Notice text={message} tone="success" />
        {occupancyError ? <Notice text="Der Kalender konnte nicht geladen werden." tone="error" /> : null}
      </div>

      <HorseCalendarHero
        description={horseDescription}
        detailHref={detailHref}
        isOwner={isOwner}
        locationLine={horseLocationLine}
        nextTrialRangeLabel={nextTrialRangeLabel}
        nextTrialRiderName={nextTrialRiderName}
        nextTrialStatus={nextTrialRequest?.status ?? null}
        ownerPlanLabel={ownerPlan.label}
        ownerPlanTone={ownerPlanTone}
        title={horse.title}
      />

      {isOwner ? (
        <SectionCard
          id="kalender-liste"
          subtitle={"Hier pflegst du nur explizite Probetermine. Standardzeiten, Ausnahmen und die gro\u00dfe Wochenplanung bleiben bewusst ausgeblendet."}
          title="Probetermine pflegen"
        >
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
            <Card className="p-5 sm:p-6">
              <div className="space-y-5">
                <div className="space-y-1">
                  <p className="ui-eyebrow">Eingestellte Probetermine</p>
                  <p className="text-sm text-stone-600">Nur diese Termine sehen Reiter in der Suche und auf dem Pferdeprofil.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="pending">{trialSlotCount} aktive Probetermine</Badge>
                  <Badge tone="neutral">Direkt aktiv</Badge>
                </div>
                {prioritizedTrialRules.length === 0 ? (
                  <p className="text-sm text-stone-500">Noch keine Probetermine eingestellt.</p>
                ) : (
                  <div className="space-y-2">
                    {prioritizedTrialRules.slice(0, 6).map((rule) => (
                        <div className="rounded-2xl border border-stone-200 bg-white px-3 py-3" key={rule.id}>
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-stone-900">{ruleLabel(rule)}</p>
                              <p className="text-xs text-stone-500">Direkt als Probetermin sichtbar</p>
                            </div>
                            <form action={deleteAvailabilityRuleAction} className="w-full sm:w-auto">
                              <input name="ruleId" type="hidden" value={rule.id} />
                              <ConfirmSubmitButton
                                className={buttonVariants("secondary", "w-full text-sm sm:w-auto")}
                                confirmMessage="Möchtest du diesen Probetermin wirklich entfernen?"
                                idleLabel="Entfernen"
                                pendingLabel="Wird entfernt..."
                              />
                            </form>
                          </div>
                        </div>
                      ))}
                    {prioritizedTrialRules.length > 6 ? (
                      <p className="text-xs text-stone-500">+ {prioritizedTrialRules.length - 6} weitere Probetermine sind bereits aktiv.</p>
                    ) : null}
                  </div>
                )}

                <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
                  <form action={createAvailabilityRuleAction} className="space-y-4">
                    <input name="horseId" type="hidden" value={horse.id} />
                    <input name="selectedDate" type="hidden" value={selectedDayKey} />
                    <input name="weekOffset" type="hidden" value={String(weekOffset)} />
                    <input name="monthOffset" type="hidden" value={String(monthOffset)} />
                    <input name="availabilityPreset" type="hidden" value="custom" />
                    <input name="isTrialSlot" type="hidden" value="on" />
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-stone-900">Neuen Probetermin anlegen</p>
                      <p className="text-sm text-stone-600">Wähle Tage und Uhrzeit. Daraus werden für die nächsten 8 Wochen konkrete Probetermine erzeugt.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
                      <label className="block">
                        <input className="peer sr-only" name="weekday" type="checkbox" value="1" />
                        <span className="flex min-h-[52px] items-center justify-center rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm font-medium text-stone-700 transition peer-checked:border-forest peer-checked:bg-sand peer-checked:text-stone-900">Mo</span>
                      </label>
                      <label className="block">
                        <input className="peer sr-only" name="weekday" type="checkbox" value="2" />
                        <span className="flex min-h-[52px] items-center justify-center rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm font-medium text-stone-700 transition peer-checked:border-forest peer-checked:bg-sand peer-checked:text-stone-900">Di</span>
                      </label>
                      <label className="block">
                        <input className="peer sr-only" name="weekday" type="checkbox" value="3" />
                        <span className="flex min-h-[52px] items-center justify-center rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm font-medium text-stone-700 transition peer-checked:border-forest peer-checked:bg-sand peer-checked:text-stone-900">Mi</span>
                      </label>
                      <label className="block">
                        <input className="peer sr-only" name="weekday" type="checkbox" value="4" />
                        <span className="flex min-h-[52px] items-center justify-center rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm font-medium text-stone-700 transition peer-checked:border-forest peer-checked:bg-sand peer-checked:text-stone-900">Do</span>
                      </label>
                      <label className="block">
                        <input className="peer sr-only" name="weekday" type="checkbox" value="5" />
                        <span className="flex min-h-[52px] items-center justify-center rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm font-medium text-stone-700 transition peer-checked:border-forest peer-checked:bg-sand peer-checked:text-stone-900">Fr</span>
                      </label>
                      <label className="block">
                        <input className="peer sr-only" name="weekday" type="checkbox" value="6" />
                        <span className="flex min-h-[52px] items-center justify-center rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm font-medium text-stone-700 transition peer-checked:border-forest peer-checked:bg-sand peer-checked:text-stone-900">Sa</span>
                      </label>
                      <label className="block">
                        <input className="peer sr-only" name="weekday" type="checkbox" value="0" />
                        <span className="flex min-h-[52px] items-center justify-center rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm font-medium text-stone-700 transition peer-checked:border-forest peer-checked:bg-sand peer-checked:text-stone-900">So</span>
                      </label>
                    </div>
                    <div className="ui-field-grid sm:grid-cols-2">
                      <div>
                        <label htmlFor="trialStartTime">Von</label>
                        <input defaultValue="17:00" id="trialStartTime" name="startTime" required step={900} type="time" />
                      </div>
                      <div>
                        <label htmlFor="trialEndTime">Bis</label>
                        <input defaultValue="18:00" id="trialEndTime" name="endTime" required step={900} type="time" />
                      </div>
                    </div>
                    <SubmitButton idleLabel="Probetermine speichern" pendingLabel="Wird gespeichert..." />
                  </form>
                </div>
              </div>
            </Card>

            <Card className="p-5 sm:p-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="ui-eyebrow">So funktioniert diese Seite</p>
                  <p className="text-sm text-stone-600">Diese Seite bleibt bewusst klein und klar, damit du Probetermine schnell pflegen kannst.</p>
                </div>
                <ul className="space-y-2 text-sm text-stone-700">
                  <li>- Reiter finden nur Pferde mit echten Probeterminen.</li>
                  <li>- Du stellst Probetermine hier gezielt ein und entfernst sie wieder.</li>
                  <li>- Standardzeiten, Ausnahmen und große Kalenderplanung folgen später.</li>
                </ul>
                <Link className={buttonVariants("secondary", "w-full justify-center text-sm")} href={detailHref}>
                  Zum Pferdeprofil
                </Link>
                <Link className={buttonVariants("ghost", "w-full justify-center text-sm")} href={"/owner/anfragen" as Route}>
                  Zu den Probeanfragen
                </Link>
              </div>
            </Card>
          </div>
        </SectionCard>
      ) : null}

      {!isOwner ? (
        <SectionCard
          subtitle={"Kalender, Verfügbarkeiten und Terminanfragen auf einen Blick."}
          title="Kalender anzeigen"
        >
        <div className="space-y-4">
          <div className="rounded-2xl border border-stone-200 bg-white/80 px-4 py-4">
            <div className="grid gap-2 sm:grid-cols-4">
              <Link className={buttonVariants(selectedRange === 1 ? "primary" : "secondary", "w-full justify-center text-sm")} href={nextDayHref}>{"N\u00e4chster Tag"}</Link>
              <Link className={buttonVariants(selectedRange === 7 ? "primary" : "secondary", "w-full justify-center text-sm")} href={nextSevenDaysHref}>{"Nächste 7 Tage"}</Link>
              <Link className={buttonVariants(selectedRange === 30 ? "primary" : "secondary", "w-full justify-center text-sm")} href={nextThirtyDaysHref}>{"Nächste 30 Tage"}</Link>
              
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-stone-900">{monthFormatter.format(viewedMonthStart)}</p>
              <p className="text-sm text-stone-600">{"Jede Zeile steht für eine Woche. Ein Klick öffnet direkt die Detailansicht dieser Woche."}</p>
            </div>
            <div className="flex gap-2">
              <Link className={buttonVariants("secondary", "min-h-[40px] px-4 py-2 text-sm")} href={previousMonthHref}>
                Vorheriger Monat
              </Link>
              <Link className={buttonVariants("secondary", "min-h-[40px] px-4 py-2 text-sm")} href={nextMonthHref}>
                {"N\u00e4chster Monat"}
              </Link>
              <Link className={buttonVariants("ghost", "min-h-[40px] px-4 py-2 text-sm")} href={todayHref}>
                Heute
              </Link>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[720px] rounded-2xl border border-stone-200 bg-white shadow-sm">
              <div className="grid grid-cols-[140px_repeat(7,minmax(0,1fr))] border-b border-stone-200 bg-stone-50/80">
                <div className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Woche</div>
                {monthOverview.weekdayLabels.map((label) => (
                  <div className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.12em] text-stone-500" key={label}>
                    {label}
                  </div>
                ))}
              </div>
              <div className="divide-y divide-stone-200">
                {monthOverview.weeks.map((week) => (
                  <div className="grid grid-cols-[140px_repeat(7,minmax(0,1fr))]" key={week.key}>
                    <div className="border-r border-stone-200 px-3 py-3">
                      <Link
                        className={buttonVariants(week.weekOffset === weekOffset ? "primary" : "ghost", "min-h-[40px] w-full justify-center px-3 py-2 text-xs")}
                        href={`/pferde/${horse.id}/kalender?weekOffset=${week.weekOffset}&monthOffset=${monthOffset}&range=${selectedRange}&day=${week.key}` as Route}
                      >
                        {week.label}
                      </Link>
                    </div>
                    {week.days.map((day) => (
                      <Link
                        className={`flex min-h-[52px] items-center justify-center border-r border-stone-200 text-sm font-medium last:border-r-0 ${day.inMonth ? "bg-white text-stone-800" : "bg-stone-50/70 text-stone-400"} ${day.isSelected ? "ring-2 ring-forest/20 ring-inset" : ""}`}
                        href={`/pferde/${horse.id}/kalender?weekOffset=${day.weekOffset}&monthOffset=${monthOffset}&range=${selectedRange}&day=${day.dayKey}` as Route}
                        key={day.dayKey}
                      >
                        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${day.isToday ? "bg-stone-900 text-white" : day.isSelected ? "bg-sand text-forest" : ""}`}>
                          {day.dayNumber}
                        </span>
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        </SectionCard>
      ) : null}

      {!isOwner ? (
        <SectionCard
          id="wochenplanung"
        subtitle={`Aktiver Zeitraum: ${timelineRowsLabel}. Tage links, Uhrzeiten oben und freie, belegte oder angefragte Zeiten direkt in einer Zeitleiste.`}
        title={`Kalenderzeitraum für ${horse.title}`}
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <Badge tone="approved">{"Verfügbare Zeiten"}</Badge>
              <Badge tone="rejected">Belegte Zeiten</Badge>
              {isOwner ? <Badge tone="pending">Offene Anfragen</Badge> : null}
            </div>
            <div className="flex gap-2">
              <Link className={buttonVariants("secondary", "min-h-[40px] px-4 py-2 text-sm")} href={previousWeekHref}>
                Vorheriger Zeitraum
              </Link>
              <Link className={buttonVariants("secondary", "min-h-[40px] px-4 py-2 text-sm")} href={nextWeekHref}>
                {"Nächste Woche"}
              </Link>
              <Link className={buttonVariants("ghost", "min-h-[40px] px-4 py-2 text-sm")} href={todayHref}>
                Heute
              </Link>
            </div>
          </div>

          {isOwner ? (
            <p className="text-sm text-stone-600">
              Tipp: Klicke links auf einen Tag oder ziehe direkt über freie Stunden. Der Tageseditor wird sofort mit Datum und Uhrzeit vorbelegt.</p>
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
                        <a className="block space-y-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700/30" href={`/pferde/${horse.id}/kalender?${currentViewQuery}&day=${row.dayKey}#tagesfenster`}>
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
                                <div className="pointer-events-none relative z-20 flex h-11 items-center text-xs text-stone-400">
                                  {isOwner && lane.key === "available" ? "Freie Stunden ziehen oder anklicken" : "Keine Einträge"}
                                </div>
                              ) : (
                                lane.segments.map((segment) => {
                                  const isEditableAvailability = lane.key === "available" && Boolean(segment.entityId);
                                  const isEditableBlock = lane.key === "occupied" && Boolean(segment.entityId);
                                  const isActiveSegment =
                                    (isEditableAvailability && segment.entityId === focusRuleId) ||
                                    (isEditableBlock && segment.entityId === focusBlockId);
                                  const segmentClassName = `absolute top-1/2 z-20 h-11 -translate-y-1/2 overflow-visible rounded-xl border text-xs font-semibold shadow-sm ${timelineToneClassName(segment.tone)} ${isActiveSegment ? "ring-2 ring-forest/20" : ""}`;
                                  const segmentContentClassName = "flex h-full w-full items-center px-3";

                                  if (isEditableAvailability && segment.entityId && segment.href) {
                                    return (
                                      <DraggableTimelineSegment
                                        dayKey={row.dayKey}
                                        editHref={segment.href}
                                        endAt={segment.endAt}
                                        fieldName="ruleId"
                                        id={segment.entityId}
                                        isActive={Boolean(isActiveSegment)}
                                        key={segment.key}
                                        label={segment.title}
                                        startAt={segment.startAt}
                                        submitAction={updateAvailabilityDayAction}
                                        timelineEndHour={CALENDAR_TIMELINE_END_HOUR}
                                        timelineStartHour={CALENDAR_TIMELINE_START_HOUR}
                                        title={segment.title}
                                        toneClassName={timelineToneClassName(segment.tone)}
                                      />
                                    );
                                  }

                                  if (isEditableBlock && segment.entityId && segment.href) {
                                    return (
                                      <DraggableTimelineSegment
                                        dayKey={row.dayKey}
                                        editHref={segment.href}
                                        endAt={segment.endAt}
                                        fieldName="blockId"
                                        id={segment.entityId}
                                        isActive={Boolean(isActiveSegment)}
                                        key={segment.key}
                                        label={segment.title}
                                        startAt={segment.startAt}
                                        submitAction={updateCalendarBlockAction}
                                        timelineEndHour={CALENDAR_TIMELINE_END_HOUR}
                                        timelineStartHour={CALENDAR_TIMELINE_START_HOUR}
                                        title={segment.title}
                                        toneClassName={timelineToneClassName(segment.tone)}
                                      />
                                    );
                                  }

                                  return (
                                    <div
                                      className={segmentClassName}
                                      key={segment.key}
                                      style={{ left: `${segment.left}%`, width: `${segment.width}%` }}
                                      title={segment.title}
                                    >
                                      {segment.href ? (
                                        <a className={segmentContentClassName} href={segment.href} title={segment.title}>
                                          <span className="truncate">{segment.title}</span>
                                        </a>
                                      ) : (
                                        <div className={segmentContentClassName} title={segment.title}>
                                          <span className="truncate">{segment.title}</span>
                                        </div>
                                      )}
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
      ) : null}

      <div className="space-y-5">
        {isOwner && !R1_CORE_MODE ? (
          <>
            <SectionCard
              subtitle={"Prüfe zuerst bestehende Standardzeiten und Ausnahmen. Änderungen nimmst du erst im nächsten Abschnitt vor."}
              title="Kalender bearbeiten"
            >
              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="p-4">
                  <p className="ui-eyebrow">Standardzeiten</p>
                  <p className="mt-2 text-sm text-stone-600">{"Das Wochenmuster ist der wichtigste Hebel für den Alltag."}</p>
                  <a className={buttonVariants("ghost", "mt-4 w-full justify-center text-sm")} href="#serienfreigaben-form">Zu Standardzeiten</a>
                </Card>
                <Card className="p-4">
                  <p className="ui-eyebrow">Ausnahmen</p>
                  <p className="mt-2 text-sm text-stone-600">Kurzfristige Sperren bleiben getrennt vom Wochenmuster.</p>
                  <a className={buttonVariants("ghost", "mt-4 w-full justify-center text-sm")} href="#ausnahmen-form">Zu Ausnahmen</a>
                </Card>
                <Card className="p-4">
                  <p className="ui-eyebrow">Einzelner Tag</p>
                  <p className="mt-2 text-sm text-stone-600">Wenn Regel und Ausnahme nicht reichen, nutzt du den Tageseditor.</p>
                  <a className={buttonVariants("ghost", "mt-4 w-full justify-center text-sm")} href="#tagesfenster">Zum Tageseditor</a>
                </Card>
              </div>
            </SectionCard>

            <SectionCard
              bodyClassName="flex flex-col gap-5"
              id="kalender-bearbeiten"
              subtitle="Pflege hier zuerst Standardzeiten, dann Ausnahmen und nur zuletzt einzelne Tage. Das Raster oben bleibt die Referenz."
              title="Kalender pflegen"
            >
              <Card className="order-3 p-5 sm:p-6" id="tagesfenster">
                <form action={dayEditorAction} className="space-y-4">
                  <input name="horseId" type="hidden" value={horse.id} />
                  <input name="selectedDate" type="hidden" value={selectedDayKey} />
                  <input name="weekOffset" type="hidden" value={String(weekOffset)} />
                  <input name="monthOffset" type="hidden" value={String(monthOffset)} />
                  {focusedRule ? <input name="ruleId" type="hidden" value={focusedRule.id} /> : null}
                  {focusedBlock ? <input name="blockId" type="hidden" value={focusedBlock.id} /> : null}
                  <div className="ui-subpanel">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="ui-eyebrow">{focusedRule || focusedBlock ? dayEditorModeLabel : "Einzelnen Tag bearbeiten"}</p>
                        <p className="mt-2 ui-inline-meta">{dayEditorDescription}</p>
                        {!focusedRule && !focusedBlock ? <p className="mt-2 text-xs text-stone-500">Nutze diesen Bereich erst, wenn Wochenmuster und Ausnahmen nicht ausreichen.</p> : null}
                      </div>
                      {focusedRule ? <Badge tone="approved">Zeitfenster</Badge> : null}
                      {!focusedRule && focusedBlock ? <Badge tone="rejected">Sperre</Badge> : null}
                    </div>
                  </div>
                  <DayRangePicker
                    dayLabel={selectedDayLabel}
                    endHour={CALENDAR_TIMELINE_END_HOUR}
                    initialEndHour={editorInitialEndHour}
                    initialStartHour={editorInitialStartHour}
                    key={`${selectedDayKey}-${focusedRule?.id ?? focusedBlock?.id ?? selectedSlotLabel ?? "default"}`}
                    startHour={CALENDAR_TIMELINE_START_HOUR}
                  />
                  {focusedBlock ? (
                    <div>
                      <label htmlFor="blockTitle">Titel der Sperre (optional)</label>
                      <input defaultValue={focusedBlock.title ?? ""} id="blockTitle" name="blockTitle" placeholder="z. B. Hufschmied oder Stallruhe" type="text" />
                    </div>
                  ) : null}
                  {!focusedBlock ? (
                    <label className="flex min-h-[44px] items-center gap-3 rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900">
                      <input
                        className="h-4 w-4 rounded border-stone-300"
                        defaultChecked={focusedRule?.is_trial_slot ?? false}
                        name="isTrialSlot"
                        type="checkbox"
                      />
                      Dieses Zeitfenster auch als Probetermin anbieten
                    </label>
                  ) : null}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <SubmitButton
                      className={buttonVariants("primary", "w-full sm:w-auto px-5 py-3 text-base")}
                      idleLabel={dayEditorSubmitLabel}
                      pendingLabel={dayEditorPendingLabel}
                    />
                    <a className={buttonVariants("secondary", "w-full sm:w-auto")} href={resetEditorHref}>
                      Neue Auswahl starten
                    </a>
                  </div>
                </form>
              </Card>

              <Card className="order-1 p-5 sm:p-6">
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
                  <div className="rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Probetermin-Slots</p>
                    <p className="mt-2 text-2xl font-semibold text-stone-900">{trialSlotCount}</p>
                    <p className="mt-1 text-sm text-stone-600">{"Nur diese Zeitfenster werden Reitern für Probetermine angeboten."}</p>
                  </div>
                </div>
              </Card>

              <div className="order-2 grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
                <Card className="p-5 sm:p-6" id="serienfreigaben-form">
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
                        <input defaultValue="17:00" id="availabilityStartTime" name="startTime" required step={900} type="time" />
                      </div>
                      <div>
                        <label htmlFor="availabilityEndTime">Bis</label>
                        <input defaultValue="19:00" id="availabilityEndTime" name="endTime" required step={900} type="time" />
                      </div>
                    </div>
                    <label className="flex min-h-[44px] items-center gap-3 rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900">
                      <input className="h-4 w-4 rounded border-stone-300" name="isTrialSlot" type="checkbox" />
                      Die erzeugten Zeitfenster auch als Probetermine anbieten
                    </label>
                    <SubmitButton idleLabel="Wochenmuster speichern" pendingLabel="Wird gespeichert..." />
                  </form>
                </Card>

                <Card className="p-5 sm:p-6" id="ausnahmen-form">
                  <div className="space-y-5">
                    <form action={createCalendarBlockAction} className="ui-form-stack">
                      <input name="horseId" type="hidden" value={horse.id} />
                      <div className="ui-subpanel">
                        <p className="ui-eyebrow">Ausnahme blockieren</p>
                        <p className="mt-2 ui-inline-meta">Nutze Sperren nur dann, wenn das Pferd trotz Wochenmuster kurzfristig nicht verfügbar ist.</p>
                      </div>
                      <div>
                        <label htmlFor="blockTitleNew">Titel der Sperre (optional)</label>
                        <input id="blockTitleNew" name="blockTitle" placeholder="z. B. Hufschmied oder Stallruhe" type="text" />
                      </div>
                      <div>
                        <label htmlFor="blockStartAt">Beginn</label>
                        <input id="blockStartAt" name="startAt" required step={900} type="datetime-local" />
                      </div>
                      <div>
                        <label htmlFor="blockEndAt">Ende</label>
                        <input id="blockEndAt" name="endAt" required step={900} type="datetime-local" />
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
                                  <a className={buttonVariants("ghost", "mt-3 w-full justify-center text-sm")} href={`/pferde/${horse.id}/kalender?${currentViewQuery}&day=${rule.start_at.slice(0, 10)}&focusRule=${rule.id}#tagesfenster`}>
                                    {"Im Editor \u00f6ffnen"}
                                  </a>
                                  <form action={deleteAvailabilityRuleAction} className="mt-2">
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
                                  <p className="text-sm font-semibold text-stone-900">{block.title?.trim() || "Sperre"}</p>
                                  <p className="mt-1 text-sm text-stone-600">{formatDateRange(block.start_at, block.end_at)}</p>
                                  <a className={buttonVariants("ghost", "mt-3 w-full justify-center text-sm")} href={`/pferde/${horse.id}/kalender?${currentViewQuery}&day=${block.start_at.slice(0, 10)}&focusBlock=${block.id}#tagesfenster`}>
                                    {"Im Editor \u00f6ffnen"}
                                  </a>
                                  <form action={deleteCalendarBlockAction} className="mt-2">
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

            {!R1_CORE_MODE ? (
            <SectionCard id="offene-terminanfragen" subtitle="Nimm angefragte Termine an oder lehne sie ab." title="Offene Terminanfragen">
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
                                  : "Zeitpunkt wird gepr\u00fcft"}
                              </p>
                              <p className="text-sm text-stone-600">Reiter</p>
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
            ) : null}
          </>
        ) : null}

        {isRider ? (
          <SectionCard
            bodyClassName="space-y-5"
            id="reiter-planung"
            subtitle={"W\u00e4hle ein offenes Zeitfenster direkt aus oder passe darunter einen eigenen Zeitraum innerhalb eines offenen Fensters an."}
            title="Reitbeteiligung planen"
          >
            {riderApproved ? (
              rules.length > 0 ? (
                <>
                  {riderWeeklyQuota && typeof riderWeeklyQuota.weekly_hours_limit === "number" ? (
                    <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
                      <p className="text-sm font-semibold text-stone-900">{"Dein Wochenkontingent f\u00fcr dieses Pferd"}</p>
                      <p className="mt-1 text-sm text-stone-600">Gezaehlt wird nur, was in dieser Kalenderwoche noch aktiv operativ gebucht ist.</p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Limit</p>
                          <p className="mt-1 text-sm font-semibold text-stone-900">
                            {formatWeeklyHoursLimit(riderWeeklyQuota.weekly_hours_limit)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Belegt</p>
                          <p className="mt-1 text-sm font-semibold text-stone-900">
                            {formatBookingQuotaMinutes(riderWeeklyQuota.booked_minutes)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Verbleibend</p>
                          <p className="mt-1 text-sm font-semibold text-stone-900">
                            {formatBookingQuotaMinutes(riderWeeklyQuota.remaining_minutes ?? 0)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-stone-900">Offene Zeitfenster direkt anfragen</p>
                      <p className="text-sm text-stone-600">{"F\u00fcr das Tagesgesch\u00e4ft kannst du freie Zeitfenster sofort \u00fcbernehmen. Nur wenn du davon abweichen willst, nutzt du das Formular darunter."}</p>
                    </div>
                    <div className="space-y-3">
                      {quickRequestableRules.map((rule) => (
                        <Card className="p-4" key={rule.id}>
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-stone-900">{ruleLabel(rule)}</p>
                              <p className="text-sm text-stone-600">{"Dieses offene Zeitfenster wird direkt als konkrete Terminanfrage \u00fcbernommen."}</p>
                            </div>
                            <form action={requestBookingAction} className="w-full sm:w-auto">
                              <input name="horseId" type="hidden" value={horse.id} />
                              <input name="ruleId" type="hidden" value={rule.id} />
                              <input name="startAt" type="hidden" value={rule.start_at} />
                              <input name="endAt" type="hidden" value={rule.end_at} />
                              <input name="recurrenceRrule" type="hidden" value="" />
                              <Button className="w-full sm:w-auto" type="submit" variant="primary">
                                Dieses Zeitfenster anfragen
                              </Button>
                            </form>
                          </div>
                        </Card>
                      ))}
                    </div>
                    {rules.length > quickRequestableRules.length ? (
                      <p className="text-sm text-stone-600">Weitere offene Zeitfenster siehst du weiterhin direkt im Wochenplan oben.</p>
                    ) : null}
                  </div>
                  <Card className="p-5 sm:p-6">
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-stone-900">Eigenen Zeitraum innerhalb eines offenen Fensters anfragen</p>
                        <p className="text-sm text-stone-600">{"Nutze das nur, wenn du nicht das komplette offene Zeitfenster \u00fcbernehmen willst."}</p>
                      </div>
                      <form action={requestBookingAction} className="space-y-4">
                        <input name="horseId" type="hidden" value={horse.id} />
                        <RiderBookingWindowForm
                          rules={rules.map((rule) => ({
                            endAt: rule.end_at,
                            id: rule.id,
                            label: ruleLabel(rule),
                            startAt: rule.start_at
                          }))}
                        />
                        <SubmitButton idleLabel="Termin anfragen" pendingLabel="Wird gesendet..." />
                      </form>
                    </div>
                  </Card>
                </>
              ) : (
                <EmptyState description={"Aktuell gibt es keine offenen Verf\u00fcgbarkeitsfenster f\u00fcr dieses Pferd."} title={"Kein Zeitfenster verf\u00fcgbar"} />
              )
            ) : (
              <EmptyState description="Erst nach deiner Freischaltung kannst du einen Termin anfragen." title="Noch nicht freigeschaltet" />
            )}

            <div className="space-y-3 border-t border-stone-200 pt-5" id="meine-terminanfragen">
              <h3 className="text-base font-semibold text-stone-900">{"Meine Terminanfragen f\u00fcr dieses Pferd"}</h3>
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
                          : "Zeitpunkt wird gepr\u00fcft"
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
          <SectionCard subtitle={"Melde dich an, um Verf\u00fcgbarkeiten, Anfragen und deinen eigenen Status zu sehen."} title="Kalender nutzen">
            <Link className={buttonVariants("primary", "w-full sm:w-auto")} href="/login">
              Anmelden, um den Kalender zu nutzen
            </Link>
          </SectionCard>
        ) : null}
      </div>
    </div>
  );
}
