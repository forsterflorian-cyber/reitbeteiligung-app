import {
  type BookingFailureReason,
  getAcceptBookingErrorMessage,
  getCancelBookingErrorMessage,
  getBookingConflictMessage,
  getDirectBookingErrorMessage,
  getRescheduleBookingErrorMessageForReason,
  getRescheduleBookingErrorReason,
  getRescheduleBookingErrorMessage,
  OPERATIONAL_RECURRENCE_NOT_ENABLED_MESSAGE,
  shouldDirectBookOperationalSlot,
  canCancelOperationalBooking,
  canRescheduleOperationalBooking,
  isFutureOperationalStartAt
} from "../booking-guards.ts";
import { canCreateBooking } from "../booking-mode.ts";
import { asOptionalString, asString } from "../forms.ts";
import { filterActiveOperationalBookings, getAcceptedOperationalBookingRequestIdSet } from "../active-operational-bookings.ts";
import { getApprovalStatus } from "../approvals.ts";
import { isActiveRelationship, isRevokedRelationship } from "../relationship-state.ts";
import { BOOKING_REQUEST_STATUS } from "../statuses.ts";
import type { createClient } from "../supabase/server.ts";
import type { AvailabilityRule, Booking, BookingRequest, CalendarBlock, HorseBookingMode } from "../../types/database";
import { emitDomainEvent } from "../domain-events.ts";
import { createNotification } from "../notifications.ts";
import { hasWindowConflict, isQuarterHourAligned, type CalendarBookingWindow as BookingWindow } from "./calendar.ts";
import { getOwnedHorse } from "./horse.ts";

const RECURRENCE_HORIZON_WEEKS = 12;
const MAX_RECURRENCE_OCCURRENCES = 100;
const RRULE_WEEKDAYS: Record<string, number> = {
  FR: 5,
  MO: 1,
  SA: 6,
  SU: 0,
  TH: 4,
  TU: 2,
  WE: 3
};

type SupabaseClient = ReturnType<typeof createClient>;
type SupabaseErrorLike = {
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  message: string;
};
type LogSupabaseError = (context: string, error: SupabaseErrorLike) => void;
type AvailabilityRuleRecord = Pick<AvailabilityRule, "id" | "horse_id" | "slot_id" | "start_at" | "end_at" | "active" | "is_trial_slot" | "created_at">;
type BookingRequestRecord = Pick<
  BookingRequest,
  "id" | "slot_id" | "availability_rule_id" | "horse_id" | "rider_id" | "status" | "requested_start_at" | "requested_end_at" | "recurrence_rrule" | "created_at"
>;
type BookingRequestStatusRecord = Pick<BookingRequest, "id" | "status">;
type BookingPlanningRecord = Pick<Booking, "id" | "booking_request_id" | "start_at" | "end_at">;
type BookingRecord = Pick<Booking, "id" | "booking_request_id" | "horse_id" | "rider_id" | "start_at" | "end_at"> & {
  recurrence_rrule: string | null;
  request_status: BookingRequest["status"] | null;
};
type TimeRangeRecord = Pick<CalendarBlock, "start_at" | "end_at">;
type ParsedRecurrenceRule = {
  byDays: number[] | null;
  count: number | null;
  freq: "DAILY" | "WEEKLY";
  interval: number;
  until: Date | null;
};

type BookingMutationResult =
  | {
      message: string;
      ok: false;
      reason: BookingFailureReason;
      redirectPath: string;
    }
  | {
      message: string;
      ok: true;
      paths: readonly string[];
      redirectPath: string;
    };

function errorResult(
  redirectPath: string,
  message: string,
  reason: BookingFailureReason = "unknown"
): BookingMutationResult {
  return {
    message,
    ok: false,
    reason,
    redirectPath
  };
}

function successResult(redirectPath: string, message: string, paths: readonly string[]): BookingMutationResult {
  return {
    message,
    ok: true,
    paths,
    redirectPath
  };
}

function addDaysUtc(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function parseRruleDate(value: string) {
  if (/^\d{8}$/.test(value)) {
    const year = Number.parseInt(value.slice(0, 4), 10);
    const month = Number.parseInt(value.slice(4, 6), 10) - 1;
    const day = Number.parseInt(value.slice(6, 8), 10);

    return new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
  }

  if (/^\d{8}T\d{6}Z$/.test(value)) {
    const year = Number.parseInt(value.slice(0, 4), 10);
    const month = Number.parseInt(value.slice(4, 6), 10) - 1;
    const day = Number.parseInt(value.slice(6, 8), 10);
    const hours = Number.parseInt(value.slice(9, 11), 10);
    const minutes = Number.parseInt(value.slice(11, 13), 10);
    const seconds = Number.parseInt(value.slice(13, 15), 10);

    return new Date(Date.UTC(year, month, day, hours, minutes, seconds, 0));
  }

  return null;
}

export function parseRecurrenceRule(value: string, baseStart: Date): ParsedRecurrenceRule {
  const parts = value
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    throw new Error("INVALID_RRULE");
  }

  const options = new Map<string, string>();

  for (const part of parts) {
    const [rawKey, ...rawValueParts] = part.split("=");
    const key = rawKey?.trim().toUpperCase();
    const optionValue = rawValueParts.join("=").trim();

    if (!key || !optionValue || options.has(key)) {
      throw new Error("INVALID_RRULE");
    }

    if (!["FREQ", "INTERVAL", "COUNT", "UNTIL", "BYDAY"].includes(key)) {
      throw new Error("UNSUPPORTED_RRULE");
    }

    options.set(key, optionValue.toUpperCase());
  }

  const freq = options.get("FREQ");

  if (freq !== "DAILY" && freq !== "WEEKLY") {
    throw new Error("UNSUPPORTED_RRULE");
  }

  const intervalRaw = options.get("INTERVAL");
  const interval = intervalRaw ? Number.parseInt(intervalRaw, 10) : 1;

  if (!Number.isInteger(interval) || interval < 1) {
    throw new Error("INVALID_RRULE");
  }

  const countRaw = options.get("COUNT");
  const count = countRaw ? Number.parseInt(countRaw, 10) : null;

  if (count !== null && (!Number.isInteger(count) || count < 1)) {
    throw new Error("INVALID_RRULE");
  }

  const untilRaw = options.get("UNTIL");
  const until = untilRaw ? parseRruleDate(untilRaw) : null;

  if (untilRaw && !until) {
    throw new Error("INVALID_RRULE");
  }

  if (until && until.getTime() < baseStart.getTime()) {
    throw new Error("INVALID_RRULE");
  }

  const byDayRaw = options.get("BYDAY");
  let byDays: number[] | null = null;

  if (byDayRaw) {
    if (freq !== "WEEKLY") {
      throw new Error("UNSUPPORTED_RRULE");
    }

    const dayValues = [...new Set(byDayRaw.split(",").map((part) => part.trim()).filter(Boolean))];

    if (dayValues.length === 0) {
      throw new Error("INVALID_RRULE");
    }

    byDays = dayValues
      .map((dayValue) => RRULE_WEEKDAYS[dayValue])
      .filter((dayValue): dayValue is number => Number.isInteger(dayValue))
      .sort((left, right) => left - right);

    if (byDays.length !== dayValues.length) {
      throw new Error("INVALID_RRULE");
    }

    if (!byDays.includes(baseStart.getUTCDay())) {
      throw new Error("INVALID_RRULE");
    }
  }

  return {
    byDays,
    count,
    freq,
    interval,
    until
  };
}

export function buildBookingWindows(request: BookingRequestRecord): BookingWindow[] {
  if (!request.requested_start_at || !request.requested_end_at) {
    throw new Error("INVALID_RANGE");
  }

  const baseStart = new Date(request.requested_start_at);
  const baseEnd = new Date(request.requested_end_at);

  if (Number.isNaN(baseStart.getTime()) || Number.isNaN(baseEnd.getTime()) || baseEnd <= baseStart) {
    throw new Error("INVALID_RANGE");
  }

  const durationMs = baseEnd.getTime() - baseStart.getTime();
  const starts: Date[] = [baseStart];

  if (request.recurrence_rrule) {
    const recurrence = parseRecurrenceRule(request.recurrence_rrule, baseStart);
    const horizonEnd = addDaysUtc(baseStart, RECURRENCE_HORIZON_WEEKS * 7).getTime();
    const absoluteEnd = recurrence.until ? Math.min(horizonEnd, recurrence.until.getTime()) : horizonEnd;

    if (recurrence.freq === "DAILY") {
      for (let step = 1; starts.length < MAX_RECURRENCE_OCCURRENCES; step += 1) {
        if (recurrence.count !== null && starts.length >= recurrence.count) {
          break;
        }

        const next = addDaysUtc(baseStart, step * recurrence.interval);

        if (next.getTime() > absoluteEnd) {
          break;
        }

        starts.push(next);
      }
    } else {
      const byDays = recurrence.byDays ?? [baseStart.getUTCDay()];
      const seen = new Set<number>([baseStart.getTime()]);

      for (let cycle = 0; starts.length < MAX_RECURRENCE_OCCURRENCES; cycle += 1) {
        if (recurrence.count !== null && starts.length >= recurrence.count) {
          break;
        }

        const cycleDayOffset = cycle * recurrence.interval * 7;
        let hasFutureWindow = false;

        for (const weekday of byDays) {
          const dayOffset = weekday - baseStart.getUTCDay() + cycleDayOffset;

          if (dayOffset <= 0) {
            continue;
          }

          const next = addDaysUtc(baseStart, dayOffset);
          const timestamp = next.getTime();

          if (timestamp > absoluteEnd) {
            continue;
          }

          hasFutureWindow = true;

          if (seen.has(timestamp)) {
            continue;
          }

          starts.push(next);
          seen.add(timestamp);

          if (recurrence.count !== null && starts.length >= recurrence.count) {
            break;
          }
        }

        const nextCycleStart = addDaysUtc(baseStart, (cycle + 1) * recurrence.interval * 7).getTime();

        if (!hasFutureWindow && nextCycleStart > absoluteEnd) {
          break;
        }
      }
    }

    if (recurrence.count !== null && starts.length !== recurrence.count && starts.length === MAX_RECURRENCE_OCCURRENCES) {
      throw new Error("RECURRENCE_LIMIT");
    }
  }

  const windows = starts
    .sort((left, right) => left.getTime() - right.getTime())
    .map((startDate) => ({
      endAt: new Date(startDate.getTime() + durationMs).toISOString(),
      startAt: startDate.toISOString()
    }));

  for (let index = 1; index < windows.length; index += 1) {
    if (windows[index - 1].endAt > windows[index].startAt) {
      throw new Error("TIME_UNAVAILABLE");
    }
  }

  return windows;
}

export function getRecurrenceErrorMessage(error: Error) {
  switch (error.message) {
    case "UNSUPPORTED_RRULE":
      return "Aktuell werden nur einfache RRULEs mit FREQ=DAILY oder FREQ=WEEKLY unterstuetzt.";
    case "RECURRENCE_LIMIT":
      return "Die Wiederholung ueberschreitet den maximalen Horizont von 12 Wochen.";
    default:
      return "Die Wiederholung ist ungueltig. Nutze zum Beispiel FREQ=WEEKLY;INTERVAL=1;COUNT=6.";
  }
}

function getRiderBookingPaths(horseId: string) {
  return [`/pferde/${horseId}/kalender`, "/anfragen", "/owner/reitbeteiligungen"] as const;
}

function getDirectBookingPaths(horseId: string) {
  return [`/pferde/${horseId}/kalender`, "/anfragen", "/owner/reitbeteiligungen", "/dashboard", `/pferde/${horseId}`] as const;
}

function isSameBookingWindow(leftStartAt: string, leftEndAt: string, rightStartAt: string, rightEndAt: string) {
  return leftStartAt === rightStartAt && leftEndAt === rightEndAt;
}

function getRelationshipFailureReason(
  approvalStatus: Awaited<ReturnType<typeof getApprovalStatus>>
): BookingFailureReason | null {
  if (isActiveRelationship(approvalStatus)) {
    return null;
  }

  if (isRevokedRelationship(approvalStatus)) {
    return "revoked";
  }

  return "inactive_relationship";
}

async function getOperationalBooking(supabase: SupabaseClient, bookingId: string) {
  const { data } = await supabase
    .from("bookings")
    .select("id, booking_request_id, horse_id, rider_id, start_at, end_at")
    .eq("id", bookingId)
    .maybeSingle();
  const booking = (data as Omit<BookingRecord, "recurrence_rrule" | "request_status"> | null) ?? null;

  if (!booking) {
    return null;
  }

  const { data: requestData } = await supabase
    .from("booking_requests")
    .select("id, status, recurrence_rrule")
    .eq("id", booking.booking_request_id)
    .maybeSingle();
  const request = (requestData as Pick<BookingRequest, "id" | "status" | "recurrence_rrule"> | null) ?? null;

  return {
    ...booking,
    recurrence_rrule: request?.recurrence_rrule ?? null,
    request_status: request?.status ?? null
  };
}

function getOwnerBookingPaths(horseId: string) {
  return ["/owner/reitbeteiligungen", "/anfragen", "/dashboard", `/pferde/${horseId}`, `/pferde/${horseId}/kalender`] as const;
}

async function getManagedBookingRequest(supabase: SupabaseClient, requestId: string, ownerId: string) {
  const { data } = await supabase
    .from("booking_requests")
    .select("id, slot_id, availability_rule_id, horse_id, rider_id, status, requested_start_at, requested_end_at, recurrence_rrule, created_at")
    .eq("id", requestId)
    .maybeSingle();

  const request = (data as BookingRequestRecord | null) ?? null;

  if (!request) {
    return null;
  }

  const horse = await getOwnedHorse(supabase, request.horse_id, ownerId);

  if (!horse) {
    return null;
  }

  return request;
}

async function loadBookingPlanningData(
  supabase: SupabaseClient,
  horseId: string,
  excludedBookingId?: string
) {
  const [{ data: existingBookingsData }, { data: blocksData }, { data: requestStatusesData }] = await Promise.all([
    supabase.from("bookings").select("id, start_at, end_at").eq("horse_id", horseId),
    supabase.from("calendar_blocks").select("start_at, end_at").eq("horse_id", horseId),
    supabase.from("booking_requests").select("id, status").eq("horse_id", horseId)
  ]);
  const acceptedRequestIds = getAcceptedOperationalBookingRequestIdSet(
    (requestStatusesData as BookingRequestStatusRecord[] | null) ?? []
  );
  const existingBookings = filterActiveOperationalBookings(
    (existingBookingsData as BookingPlanningRecord[] | null) ?? [],
    acceptedRequestIds
  ).filter((booking) => booking.id !== excludedBookingId);

  return {
    existingBlocks: (blocksData as TimeRangeRecord[] | null) ?? [],
    existingBookings
  };
}

async function loadOperationalAvailabilityRule(supabase: SupabaseClient, horseId: string, ruleId: string) {
  const { data: ruleData } = await supabase
    .from("availability_rules")
    .select("id, horse_id, slot_id, start_at, end_at, active, is_trial_slot, created_at")
    .eq("id", ruleId)
    .eq("horse_id", horseId)
    .maybeSingle();

  return (ruleData as AvailabilityRuleRecord | null) ?? null;
}

export async function requestBookingForRider(input: {
  formData: FormData;
  logSupabaseError: LogSupabaseError;
  supabase: SupabaseClient;
  userId: string;
}): Promise<BookingMutationResult> {
  const horseId = asString(input.formData.get("horseId"));
  const ruleId = asString(input.formData.get("ruleId"));
  const recurrenceRrule = asOptionalString(input.formData.get("recurrenceRrule"));

  if (!horseId || !ruleId) {
    return errorResult("/suchen", "Das Verfuegbarkeitsfenster konnte nicht gefunden werden.");
  }

  const redirectPath = `/pferde/${horseId}/kalender`;
  const startAtValue = asString(input.formData.get("startAt"));
  const endAtValue = asString(input.formData.get("endAt"));
  const startAt = new Date(startAtValue);
  const endAt = new Date(endAtValue);

  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    return errorResult(redirectPath, "Bitte gib einen gueltigen Termin an.");
  }

  if (!isQuarterHourAligned(startAt) || !isQuarterHourAligned(endAt)) {
    return errorResult(redirectPath, "Bitte waehle Beginn und Ende im 15-Minuten-Raster.");
  }

  if (endAt <= startAt) {
    return errorResult(redirectPath, "Das Ende muss nach dem Beginn liegen.");
  }

  if (recurrenceRrule) {
    return errorResult(redirectPath, OPERATIONAL_RECURRENCE_NOT_ENABLED_MESSAGE);
  }

  if (!isFutureOperationalStartAt({ startAt: startAtValue })) {
    return errorResult(redirectPath, "Nur zukuenftige Termine koennen direkt gebucht werden.");
  }

  const requestedStartIso = startAt.toISOString();
  const requestedEndIso = endAt.toISOString();

  const approvalStatus = await getApprovalStatus(horseId, input.userId, input.supabase);

  if (!isActiveRelationship(approvalStatus)) {
    return errorResult(redirectPath, "Nur freigeschaltete Reiter koennen einen Termin anfragen.");
  }

  const rule = await loadOperationalAvailabilityRule(input.supabase, horseId, ruleId);

  if (!rule || !rule.active) {
    return errorResult(redirectPath, "Dieses Verfuegbarkeitsfenster ist nicht mehr verfuegbar.");
  }

  if (rule.is_trial_slot) {
    return errorResult(redirectPath, "Dieser Slot gehoert zur Probephase und kann nicht direkt operativ gebucht werden.");
  }

  const ruleStart = new Date(rule.start_at);
  const ruleEnd = new Date(rule.end_at);

  if (
    Number.isNaN(ruleStart.getTime()) ||
    Number.isNaN(ruleEnd.getTime()) ||
    startAt.getTime() < ruleStart.getTime() ||
    endAt.getTime() > ruleEnd.getTime()
  ) {
    return errorResult(redirectPath, "Der Termin muss komplett im Verfuegbarkeitsfenster liegen.");
  }

  // Booking mode enforcement — all permission logic flows through canCreateBooking.
  const { data: horseModeData } = await input.supabase
    .from("horses")
    .select("id, booking_mode")
    .eq("id", horseId)
    .maybeSingle();

  const horseMode = horseModeData as { id: string; booking_mode: string } | null;

  if (
    !horseMode ||
    !canCreateBooking({
      endAt,
      horse: { booking_mode: (horseMode.booking_mode ?? "slots") as HorseBookingMode },
      rule: { end_at: rule.end_at, start_at: rule.start_at },
      startAt
    })
  ) {
    const mode = horseMode?.booking_mode ?? "slots";
    const modeMessage =
      mode === "slots"
        ? "Nur exakte Slots sind buchbar. Bitte waehle einen freigegebenen Slot ohne Zeitanpassung."
        : "Diese Buchung entspricht nicht dem Buchungsmodus dieses Pferdes.";

    return errorResult(redirectPath, modeMessage);
  }

  let bookingWindows: BookingWindow[];

  try {
    bookingWindows = buildBookingWindows({
      availability_rule_id: rule.id,
      created_at: new Date().toISOString(),
      horse_id: horseId,
      id: "pending",
      recurrence_rrule: recurrenceRrule,
      requested_end_at: requestedEndIso,
      requested_start_at: requestedStartIso,
      rider_id: input.userId,
      slot_id: rule.slot_id,
      status: "requested"
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "INVALID_RRULE" || error.message === "UNSUPPORTED_RRULE" || error.message === "RECURRENCE_LIMIT")) {
      return errorResult(redirectPath, getRecurrenceErrorMessage(error));
    }

    return errorResult(redirectPath, "Die Terminanfrage enthaelt einen ungueltigen Zeitraum.");
  }

  const { existingBlocks, existingBookings } = await loadBookingPlanningData(input.supabase, horseId);

  if (hasWindowConflict(bookingWindows, existingBookings) || hasWindowConflict(bookingWindows, existingBlocks)) {
    return errorResult(redirectPath, getBookingConflictMessage(recurrenceRrule));
  }

  if (shouldDirectBookOperationalSlot(recurrenceRrule)) {
    const { data: bookingRequestId, error } = await input.supabase.rpc("direct_book_operational_slot", {
      p_end_at: requestedEndIso,
      p_horse_id: horseId,
      p_rule_id: ruleId,
      p_start_at: requestedStartIso
    });

    if (error) {
      input.logSupabaseError("Direct operational booking failed", error);
      return errorResult(redirectPath, getDirectBookingErrorMessage(error));
    }

    await emitDomainEvent(input.supabase, {
      event_type: "booking_created",
      horse_id: horseId,
      payload: { booking_request_id: (bookingRequestId as string | null) ?? null, end_at: requestedEndIso, start_at: requestedStartIso },
      rider_id: input.userId
    });

    const { data: horseOwner } = await input.supabase
      .from("horses")
      .select("owner_id")
      .eq("id", horseId)
      .maybeSingle();
    const ownerId = (horseOwner as { owner_id: string } | null)?.owner_id ?? null;
    if (ownerId) {
      await createNotification(input.supabase, {
        eventType: "booking_created",
        horseId,
        payload: {
          booking_request_id: (bookingRequestId as string | null) ?? null,
          end_at: requestedEndIso,
          rider_id: input.userId,
          start_at: requestedStartIso
        },
        userId: ownerId
      });
    }

    return successResult(redirectPath, "Der Slot wurde direkt gebucht.", getDirectBookingPaths(horseId));
  }

  const { error } = await input.supabase.from("booking_requests").insert({
    availability_rule_id: rule.id,
    horse_id: horseId,
    recurrence_rrule: recurrenceRrule,
    requested_end_at: requestedEndIso,
    requested_start_at: requestedStartIso,
    rider_id: input.userId,
    slot_id: rule.slot_id,
    status: "requested"
  });

  if (error) {
    input.logSupabaseError("Booking request insert failed", error);
    return errorResult(redirectPath, "Die Terminanfrage konnte nicht gespeichert werden.");
  }

  return successResult(redirectPath, "Die Terminanfrage wurde gesendet.", getRiderBookingPaths(horseId));
}

export async function acceptBookingRequestForOwner(input: {
  logSupabaseError: LogSupabaseError;
  ownerId: string;
  requestId: string;
  supabase: SupabaseClient;
}): Promise<BookingMutationResult> {
  const redirectPath = "/owner/reitbeteiligungen";
  const request = await getManagedBookingRequest(input.supabase, input.requestId, input.ownerId);

  if (!request) {
    return errorResult(redirectPath, "Die Buchungsanfrage konnte nicht gefunden werden.");
  }

  if (request.status !== "requested") {
    return errorResult(redirectPath, "Diese Buchungsanfrage wurde bereits bearbeitet.");
  }

  if (request.recurrence_rrule) {
    return errorResult(redirectPath, OPERATIONAL_RECURRENCE_NOT_ENABLED_MESSAGE);
  }

  if (!request.requested_start_at || !isFutureOperationalStartAt({ startAt: request.requested_start_at })) {
    return errorResult(redirectPath, "Nur zukuenftige Termine koennen angenommen werden.");
  }

  if (!request.availability_rule_id) {
    return errorResult(redirectPath, "Dieses Verfuegbarkeitsfenster ist nicht mehr aktiv.");
  }

  const { error } = await input.supabase.rpc("accept_booking_request", {
    p_request_id: input.requestId
  });

  if (error) {
    input.logSupabaseError("Accept booking request RPC failed", error);
    return errorResult(redirectPath, getAcceptBookingErrorMessage(error));
  }

  await emitDomainEvent(input.supabase, {
    event_type: "booking_created",
    horse_id: request.horse_id,
    payload: { booking_request_id: input.requestId, end_at: request.requested_end_at ?? null, start_at: request.requested_start_at ?? null },
    rider_id: request.rider_id
  });
  // No notification — owner is the actor

  return successResult(
    redirectPath,
    request.recurrence_rrule ? "Die Buchungsanfrage wurde inklusive Wiederholung angenommen." : "Die Buchungsanfrage wurde angenommen.",
    getOwnerBookingPaths(request.horse_id)
  );
}

export async function declineBookingRequestForOwner(input: {
  ownerId: string;
  requestId: string;
  supabase: SupabaseClient;
}): Promise<BookingMutationResult> {
  const redirectPath = "/owner/reitbeteiligungen";
  const request = await getManagedBookingRequest(input.supabase, input.requestId, input.ownerId);

  if (!request) {
    return errorResult(redirectPath, "Die Buchungsanfrage konnte nicht gefunden werden.");
  }

  const { data: updatedRequest, error } = await input.supabase
    .from("booking_requests")
    .update({ status: "declined" })
    .eq("id", input.requestId)
    .eq("status", "requested")
    .select("id")
    .maybeSingle();

  if (error || !updatedRequest) {
    return errorResult(redirectPath, "Diese Buchungsanfrage wurde bereits bearbeitet.");
  }

  return successResult(redirectPath, "Die Buchungsanfrage wurde abgelehnt.", [
    "/owner/reitbeteiligungen",
    "/anfragen",
    `/pferde/${request.horse_id}/kalender`
  ]);
}

export async function cancelOperationalBookingForRider(input: {
  bookingId: string;
  logSupabaseError: LogSupabaseError;
  riderId: string;
  supabase: SupabaseClient;
}): Promise<BookingMutationResult> {
  const fallbackRedirectPath = "/anfragen";
  const booking = await getOperationalBooking(input.supabase, input.bookingId);

  if (!booking) {
    return errorResult(fallbackRedirectPath, "Der Termin konnte nicht gefunden werden.");
  }

  const redirectPath = `/pferde/${booking.horse_id}/kalender`;

  if (booking.rider_id !== input.riderId) {
    return errorResult(redirectPath, "Du darfst diesen Termin nicht stornieren.");
  }

  if (booking.request_status !== BOOKING_REQUEST_STATUS.accepted) {
    return errorResult(redirectPath, getCancelBookingErrorMessage({ message: "INVALID_STATUS" }));
  }

  if (booking.recurrence_rrule) {
    return errorResult(redirectPath, getCancelBookingErrorMessage({ message: "UNSUPPORTED_RECURRENCE" }));
  }

  if (!canCancelOperationalBooking({ startAt: booking.start_at, status: booking.request_status })) {
    return errorResult(redirectPath, "Nur noch nicht begonnene Termine koennen storniert werden.");
  }

  const { error } = await input.supabase.rpc("cancel_operational_booking", {
    p_booking_id: booking.id
  });

  if (error) {
    input.logSupabaseError("Cancel operational booking failed", error);
    return errorResult(redirectPath, getCancelBookingErrorMessage(error));
  }

  await emitDomainEvent(input.supabase, {
    event_type: "booking_cancelled",
    horse_id: booking.horse_id,
    payload: { end_at: booking.end_at, reason: "manual", start_at: booking.start_at },
    rider_id: booking.rider_id
  });

  await createNotification(input.supabase, {
    eventType: "booking_cancelled",
    horseId: booking.horse_id,
    payload: { end_at: booking.end_at, reason: "manual", start_at: booking.start_at },
    userId: booking.rider_id
  });

  return successResult(redirectPath, "Der Termin wurde storniert.", getDirectBookingPaths(booking.horse_id));
}

export async function cancelOperationalBookingForOwner(input: {
  bookingId: string;
  logSupabaseError: LogSupabaseError;
  ownerId: string;
  supabase: SupabaseClient;
}): Promise<BookingMutationResult> {
  const fallbackRedirectPath = "/owner/reitbeteiligungen";
  const booking = await getOperationalBooking(input.supabase, input.bookingId);

  if (!booking) {
    return errorResult(fallbackRedirectPath, "Der Termin konnte nicht gefunden werden.");
  }

  const redirectPath = `/pferde/${booking.horse_id}/kalender`;
  const horse = await getOwnedHorse(input.supabase, booking.horse_id, input.ownerId);

  if (!horse) {
    return errorResult(redirectPath, "Du darfst diesen Termin nicht stornieren.");
  }

  if (booking.request_status !== BOOKING_REQUEST_STATUS.accepted) {
    return errorResult(redirectPath, getCancelBookingErrorMessage({ message: "INVALID_STATUS" }));
  }

  if (booking.recurrence_rrule) {
    return errorResult(redirectPath, getCancelBookingErrorMessage({ message: "UNSUPPORTED_RECURRENCE" }));
  }

  if (!canCancelOperationalBooking({ startAt: booking.start_at, status: booking.request_status })) {
    return errorResult(redirectPath, "Nur noch nicht begonnene Termine koennen storniert werden.");
  }

  const { error } = await input.supabase.rpc("cancel_operational_booking", {
    p_booking_id: booking.id
  });

  if (error) {
    input.logSupabaseError("Cancel operational booking failed", error);
    return errorResult(redirectPath, getCancelBookingErrorMessage(error));
  }

  await emitDomainEvent(input.supabase, {
    event_type: "booking_cancelled",
    horse_id: booking.horse_id,
    payload: { end_at: booking.end_at, reason: "manual", start_at: booking.start_at },
    rider_id: booking.rider_id
  });

  await createNotification(input.supabase, {
    eventType: "booking_cancelled",
    horseId: booking.horse_id,
    payload: { end_at: booking.end_at, reason: "manual", start_at: booking.start_at },
    userId: booking.rider_id
  });

  return successResult(redirectPath, "Der Termin wurde storniert.", getDirectBookingPaths(booking.horse_id));
}

async function rescheduleOperationalBooking(input: {
  actorId: string;
  bookingId: string;
  endAtInput: string;
  logSupabaseError: LogSupabaseError;
  role: "owner" | "rider";
  ruleId: string;
  startAtInput: string;
  supabase: SupabaseClient;
}): Promise<BookingMutationResult> {
  const fallbackRedirectPath = input.role === "owner" ? "/owner/reitbeteiligungen" : "/anfragen";
  const booking = await getOperationalBooking(input.supabase, input.bookingId);

  if (!booking) {
    return errorResult(fallbackRedirectPath, "Der Termin konnte nicht gefunden werden.");
  }

  const redirectPath = `/pferde/${booking.horse_id}/kalender`;
  const rescheduleRedirectPath = `${redirectPath}?rescheduleBooking=${booking.id}#umbuchen`;
  const startAt = new Date(input.startAtInput);
  const endAt = new Date(input.endAtInput);

  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) {
    return errorResult(
      rescheduleRedirectPath,
      getRescheduleBookingErrorMessageForReason("invalid_target_slot"),
      "invalid_target_slot"
    );
  }

  if (!isFutureOperationalStartAt({ startAt: input.startAtInput })) {
    return errorResult(
      rescheduleRedirectPath,
      getRescheduleBookingErrorMessageForReason("booking_past"),
      "booking_past"
    );
  }

  if (input.role === "rider") {
    if (booking.rider_id !== input.actorId) {
      return errorResult(
        rescheduleRedirectPath,
        getRescheduleBookingErrorMessageForReason("unauthorized"),
        "unauthorized"
      );
    }
  } else {
    const horse = await getOwnedHorse(input.supabase, booking.horse_id, input.actorId);

    if (!horse) {
      return errorResult(
        rescheduleRedirectPath,
        getRescheduleBookingErrorMessageForReason("unauthorized"),
        "unauthorized"
      );
    }
  }

  const approvalStatus = await getApprovalStatus(booking.horse_id, booking.rider_id, input.supabase);
  const relationshipFailureReason = getRelationshipFailureReason(approvalStatus);

  if (relationshipFailureReason) {
    return errorResult(
      rescheduleRedirectPath,
      getRescheduleBookingErrorMessageForReason(relationshipFailureReason),
      relationshipFailureReason
    );
  }

  if (booking.request_status !== BOOKING_REQUEST_STATUS.accepted) {
    return errorResult(
      rescheduleRedirectPath,
      getRescheduleBookingErrorMessageForReason("invalid_status"),
      "invalid_status"
    );
  }

  if (booking.recurrence_rrule) {
    return errorResult(
      rescheduleRedirectPath,
      OPERATIONAL_RECURRENCE_NOT_ENABLED_MESSAGE
    );
  }

  if (!canRescheduleOperationalBooking({ startAt: booking.start_at, status: booking.request_status })) {
    return errorResult(
      rescheduleRedirectPath,
      getRescheduleBookingErrorMessageForReason("booking_started"),
      "booking_started"
    );
  }

  if (isSameBookingWindow(booking.start_at, booking.end_at, startAt.toISOString(), endAt.toISOString())) {
    return errorResult(
      rescheduleRedirectPath,
      getRescheduleBookingErrorMessageForReason("invalid_target_slot"),
      "invalid_target_slot"
    );
  }

  const rule = await loadOperationalAvailabilityRule(input.supabase, booking.horse_id, input.ruleId);

  if (!rule || !rule.active || rule.is_trial_slot) {
    return errorResult(
      rescheduleRedirectPath,
      getRescheduleBookingErrorMessageForReason("invalid_target_slot"),
      "invalid_target_slot"
    );
  }

  const ruleStart = new Date(rule.start_at);
  const ruleEnd = new Date(rule.end_at);

  if (
    Number.isNaN(ruleStart.getTime()) ||
    Number.isNaN(ruleEnd.getTime()) ||
    startAt.getTime() < ruleStart.getTime() ||
    endAt.getTime() > ruleEnd.getTime()
  ) {
    return errorResult(
      rescheduleRedirectPath,
      getRescheduleBookingErrorMessageForReason("invalid_target_slot"),
      "invalid_target_slot"
    );
  }

  const bookingWindow: BookingWindow[] = [
    {
      endAt: endAt.toISOString(),
      startAt: startAt.toISOString()
    }
  ];
  const { existingBlocks, existingBookings } = await loadBookingPlanningData(input.supabase, booking.horse_id, booking.id);

  if (hasWindowConflict(bookingWindow, existingBookings)) {
    return errorResult(
      rescheduleRedirectPath,
      getRescheduleBookingErrorMessageForReason("slot_not_free"),
      "slot_not_free"
    );
  }

  if (hasWindowConflict(bookingWindow, existingBlocks)) {
    return errorResult(
      rescheduleRedirectPath,
      getRescheduleBookingErrorMessageForReason("conflict"),
      "conflict"
    );
  }

  const { error } = await input.supabase.rpc("reschedule_operational_booking", {
    p_booking_id: booking.id,
    p_end_at: endAt.toISOString(),
    p_rule_id: input.ruleId,
    p_start_at: startAt.toISOString()
  });

  if (error) {
    input.logSupabaseError("Reschedule operational booking failed", error);
    const reason = getRescheduleBookingErrorReason(error);
    return errorResult(rescheduleRedirectPath, getRescheduleBookingErrorMessage(error), reason);
  }

  await emitDomainEvent(input.supabase, {
    event_type: "booking_rescheduled",
    horse_id: booking.horse_id,
    payload: {
      new_end_at: endAt.toISOString(),
      new_start_at: startAt.toISOString(),
      old_end_at: booking.end_at,
      old_start_at: booking.start_at
    },
    rider_id: booking.rider_id
  });

  await createNotification(input.supabase, {
    eventType: "booking_rescheduled",
    horseId: booking.horse_id,
    payload: {
      new_end_at: endAt.toISOString(),
      new_start_at: startAt.toISOString(),
      old_end_at: booking.end_at,
      old_start_at: booking.start_at
    },
    userId: booking.rider_id
  });

  return successResult(redirectPath, "Der Termin wurde umgebucht.", getDirectBookingPaths(booking.horse_id));
}

export async function rescheduleOperationalBookingForRider(input: {
  bookingId: string;
  endAtInput: string;
  logSupabaseError: LogSupabaseError;
  riderId: string;
  ruleId: string;
  startAtInput: string;
  supabase: SupabaseClient;
}): Promise<BookingMutationResult> {
  return rescheduleOperationalBooking({
    actorId: input.riderId,
    bookingId: input.bookingId,
    endAtInput: input.endAtInput,
    logSupabaseError: input.logSupabaseError,
    role: "rider",
    ruleId: input.ruleId,
    startAtInput: input.startAtInput,
    supabase: input.supabase
  });
}

export async function rescheduleOperationalBookingForOwner(input: {
  bookingId: string;
  endAtInput: string;
  logSupabaseError: LogSupabaseError;
  ownerId: string;
  ruleId: string;
  startAtInput: string;
  supabase: SupabaseClient;
}): Promise<BookingMutationResult> {
  return rescheduleOperationalBooking({
    actorId: input.ownerId,
    bookingId: input.bookingId,
    endAtInput: input.endAtInput,
    logSupabaseError: input.logSupabaseError,
    role: "owner",
    ruleId: input.ruleId,
    startAtInput: input.startAtInput,
    supabase: input.supabase
  });
}
