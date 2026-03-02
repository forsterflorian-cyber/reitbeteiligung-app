"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOnboardingUser, requireProfile } from "@/lib/auth";
import {
  HORSE_GESCHLECHTER,
  HORSE_IMAGE_BUCKET,
  HORSE_IMAGE_SELECT_FIELDS,
  MAX_HORSE_IMAGES,
  createHorseImageStoragePath,
  isHorseGeschlecht,
  sortHorseImages
} from "@/lib/horses";
import { asInteger, asOptionalString, asString, isRole } from "@/lib/forms";
import {
  APPROVAL_STATUS,
  TRIAL_REQUEST_STATUS,
  isApprovalStatus,
  isMutableTrialRequestStatus
} from "@/lib/statuses";
import { createClient } from "@/lib/supabase/server";
import type { Approval, AvailabilityRule, Booking, BookingRequest, CalendarBlock, Horse, HorseImage, TrialRequest } from "@/types/database";

const PASSWORD_RESET_REDIRECT_URL = "https://reitbeteiligung.app/passwort-zuruecksetzen";
const RECURRENCE_HORIZON_WEEKS = 12;
const MAX_RECURRENCE_OCCURRENCES = 100;
const AVAILABILITY_GENERATION_WEEKS = 8;
const AVAILABILITY_PRESET_DAYS = {
  custom: [] as number[],
  daily: [0, 1, 2, 3, 4, 5, 6],
  weekdays: [1, 2, 3, 4, 5],
  weekends: [0, 6]
} as const;
const RRULE_WEEKDAYS: Record<string, number> = {
  FR: 5,
  MO: 1,
  SA: 6,
  SU: 0,
  TH: 4,
  TU: 2,
  WE: 3
};

type OwnerRequestRecord = Pick<TrialRequest, "id" | "horse_id" | "rider_id" | "status">;
type HorseOwnerRecord = Pick<Horse, "id" | "owner_id">;
type HorseImageRecord = Pick<HorseImage, "id" | "horse_id" | "path" | "storage_path" | "position" | "created_at">;
type CalendarBlockRecord = Pick<CalendarBlock, "id" | "horse_id" | "start_at" | "end_at" | "created_at">;
type AvailabilityRuleRecord = Pick<AvailabilityRule, "id" | "horse_id" | "slot_id" | "start_at" | "end_at" | "active" | "created_at">;
type BookingRequestRecord = Pick<BookingRequest, "id" | "slot_id" | "availability_rule_id" | "horse_id" | "rider_id" | "status" | "requested_start_at" | "requested_end_at" | "recurrence_rrule" | "created_at">;
type ApprovalRecord = Pick<Approval, "horse_id" | "rider_id" | "status">;
type BookingRecord = Pick<Booking, "id" | "start_at" | "end_at">;
type TimeRangeRecord = Pick<CalendarBlock, "start_at" | "end_at">;
type ParsedRecurrenceRule = {
  byDays: number[] | null;
  count: number | null;
  freq: "DAILY" | "WEEKLY";
  interval: number;
  until: Date | null;
};
type BookingWindow = {
  endAt: string;
  startAt: string;
};
type AvailabilityPreset = keyof typeof AVAILABILITY_PRESET_DAYS;
type ParsedClockTime = {
  hours: number;
  minutes: number;
};
type SupabaseErrorLike = {
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  message: string;
};

function redirectWithMessage(path: string, key: "error" | "message", message: string): never {
  redirect(`${path}?${key}=${encodeURIComponent(message)}`);
}

function logSupabaseError(context: string, error: SupabaseErrorLike) {
  console.error(`[${context}] ${error.message}`, {
    code: error.code ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null
  });
}

function getOwnerRedirectPath(formData: FormData, fallback = '/owner/horses') {
  const redirectTo = asString(formData.get('redirectTo'));

  if (!redirectTo.startsWith('/owner/')) {
    return fallback;
  }

  return redirectTo;
}

function addDaysUtc(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isAvailabilityPreset(value: string): value is AvailabilityPreset {
  return value === "daily" || value === "weekdays" || value === "weekends" || value === "custom";
}

function parseClockTime(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return null;
  }

  const [hoursValue, minutesValue] = value.split(":");
  const hours = Number.parseInt(hoursValue, 10);
  const minutes = Number.parseInt(minutesValue, 10);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return {
    hours,
    minutes
  } satisfies ParsedClockTime;
}

function resolveAvailabilityDays(preset: AvailabilityPreset, selectedValues: string[]) {
  if (preset !== "custom") {
    return [...AVAILABILITY_PRESET_DAYS[preset]];
  }

  return [...new Set(selectedValues)]
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
    .sort((left, right) => left - right);
}

// Weekly availability is persisted as explicit windows in the current schema.
// The selected weekday pattern is therefore expanded into concrete entries ahead of time.
function buildAvailabilityWindows(days: number[], startTime: ParsedClockTime, endTime: ParsedClockTime) {
  const windows: BookingWindow[] = [];
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  for (let dayOffset = 0; dayOffset < AVAILABILITY_GENERATION_WEEKS * 7; dayOffset += 1) {
    const dayDate = new Date(
      startOfToday.getFullYear(),
      startOfToday.getMonth(),
      startOfToday.getDate() + dayOffset,
      0,
      0,
      0,
      0
    );

    if (!days.includes(dayDate.getDay())) {
      continue;
    }

    const startAt = new Date(
      dayDate.getFullYear(),
      dayDate.getMonth(),
      dayDate.getDate(),
      startTime.hours,
      startTime.minutes,
      0,
      0
    );
    const endAt = new Date(
      dayDate.getFullYear(),
      dayDate.getMonth(),
      dayDate.getDate(),
      endTime.hours,
      endTime.minutes,
      0,
      0
    );

    if (endAt <= startAt || endAt <= now) {
      continue;
    }

    windows.push({
      endAt: endAt.toISOString(),
      startAt: startAt.toISOString()
    });
  }

  return windows;
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

function parseRecurrenceRule(value: string, baseStart: Date): ParsedRecurrenceRule {
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

function buildBookingWindows(request: BookingRequestRecord): BookingWindow[] {
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

function windowsOverlap(left: BookingWindow, right: BookingWindow) {
  return left.startAt < right.endAt && left.endAt > right.startAt;
}

function hasWindowConflict(windows: BookingWindow[], existingRanges: TimeRangeRecord[]) {
  return windows.some((window) =>
    existingRanges.some((existingRange) =>
      windowsOverlap(window, {
        endAt: existingRange.end_at,
        startAt: existingRange.start_at
      })
    )
  );
}

function getRecurrenceErrorMessage(error: Error) {
  switch (error.message) {
    case "UNSUPPORTED_RRULE":
      return "Aktuell werden nur einfache RRULEs mit FREQ=DAILY oder FREQ=WEEKLY unterstuetzt.";
    case "RECURRENCE_LIMIT":
      return "Die Wiederholung ueberschreitet den maximalen Horizont von 12 Wochen.";
    default:
      return "Die Wiederholung ist ungueltig. Nutze zum Beispiel FREQ=WEEKLY;INTERVAL=1;COUNT=6.";
  }
}

async function getOwnedHorse(supabase: ReturnType<typeof createClient>, horseId: string, ownerId: string) {
  const { data } = await supabase.from("horses").select("id, owner_id").eq("id", horseId).eq("owner_id", ownerId).maybeSingle();

  return (data as HorseOwnerRecord | null) ?? null;
}

async function getOwnedCalendarBlock(supabase: ReturnType<typeof createClient>, blockId: string, ownerId: string) {
  const { data } = await supabase
    .from("calendar_blocks")
    .select("id, horse_id, start_at, end_at, created_at")
    .eq("id", blockId)
    .maybeSingle();

  const block = (data as CalendarBlockRecord | null) ?? null;

  if (!block) {
    return null;
  }

  const horse = await getOwnedHorse(supabase, block.horse_id, ownerId);

  if (!horse) {
    return null;
  }

  return block;
}
async function getOwnedAvailabilityRule(supabase: ReturnType<typeof createClient>, ruleId: string, ownerId: string) {
  const { data } = await supabase
    .from("availability_rules")
    .select("id, horse_id, slot_id, start_at, end_at, active, created_at")
    .eq("id", ruleId)
    .maybeSingle();

  const rule = (data as AvailabilityRuleRecord | null) ?? null;

  if (!rule) {
    return null;
  }

  const horse = await getOwnedHorse(supabase, rule.horse_id, ownerId);

  if (!horse) {
    return null;
  }

  return rule;
}

async function getManagedBookingRequest(supabase: ReturnType<typeof createClient>, requestId: string, ownerId: string) {
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

function getAcceptBookingErrorMessage(error: SupabaseErrorLike) {
  switch (error.message) {
    case "TIME_UNAVAILABLE":
      return "Der angefragte Termin ist nicht mehr verfuegbar.";
    case "NOT_APPROVED":
      return "Nur freigeschaltete Reiter koennen gebucht werden.";
    case "OUTSIDE_RULE":
      return "Der Termin liegt nicht innerhalb des Verfuegbarkeitsfensters.";
    case "RULE_INACTIVE":
      return "Dieses Verfuegbarkeitsfenster ist nicht mehr aktiv.";
    case "INVALID_STATUS":
      return "Diese Buchungsanfrage wurde bereits bearbeitet.";
    default:
      return "Die Buchungsanfrage konnte nicht angenommen werden.";
  }
}

async function getOwnedTrialRequest(requestId: string, ownerId: string) {
  const supabase = createClient();
  const { data: request } = await supabase
    .from("trial_requests")
    .select("id, horse_id, rider_id, status")
    .eq("id", requestId)
    .maybeSingle();

  const typedRequest = (request as OwnerRequestRecord | null) ?? null;

  if (!typedRequest) {
    return null;
  }

  const horse = await getOwnedHorse(supabase, typedRequest.horse_id, ownerId);

  if (!horse) {
    return null;
  }

  return { request: typedRequest, supabase };
}

export async function signupAction(formData: FormData) {
  const email = asString(formData.get("email")).toLowerCase();
  const password = asString(formData.get("password"));

  if (!email.includes("@") || password.length < 8) {
    redirectWithMessage("/signup", "error", "Bitte gib eine gueltige E-Mail-Adresse und ein Passwort mit mindestens 8 Zeichen ein.");
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });

  if (error) {
    redirectWithMessage("/signup", "error", "Die Registrierung konnte nicht abgeschlossen werden. Bitte pruefe deine Angaben.");
  }

  if (data.user && data.session) {
    redirect("/onboarding");
  }

  redirectWithMessage("/login", "message", "Konto erstellt. Bitte pruefe dein Postfach, falls eine Bestaetigung aktiv ist.");
}

export async function loginAction(formData: FormData) {
  const email = asString(formData.get("email")).toLowerCase();
  const password = asString(formData.get("password"));

  if (!email.includes("@") || password.length < 8) {
    redirectWithMessage("/login", "error", "Bitte gib E-Mail-Adresse und Passwort ein.");
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error || !data.user) {
    redirectWithMessage("/login", "error", "Die Anmeldung ist fehlgeschlagen. Bitte pruefe E-Mail-Adresse und Passwort.");
  }

  const { data: profile } = await supabase.from("profiles").select("id").eq("id", data.user.id).maybeSingle();

  redirect(profile ? "/dashboard" : "/onboarding");
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = asString(formData.get("email")).toLowerCase();

  if (!email.includes("@")) {
    redirectWithMessage("/passwort-vergessen", "error", "Bitte gib eine gueltige E-Mail-Adresse ein.");
  }

  const supabase = createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: PASSWORD_RESET_REDIRECT_URL
  });

  if (error) {
    redirectWithMessage(
      "/passwort-vergessen",
      "error",
      "Der Link zum Zuruecksetzen konnte nicht versendet werden. Bitte versuche es erneut."
    );
  }

  redirectWithMessage(
    "/passwort-vergessen",
    "message",
    "Wenn ein Konto zu dieser E-Mail-Adresse existiert, wurde ein Link zum Zuruecksetzen versendet."
  );
}

export async function requestTrialAction(formData: FormData) {
  const { supabase, user } = await requireProfile("rider");
  const horseId = asString(formData.get("horseId"));
  const message = asOptionalString(formData.get("message"));

  if (!horseId) {
    redirectWithMessage("/suchen", "error", "Das Pferd konnte nicht gefunden werden.");
  }

  const { data: horseData } = await supabase
    .from("horses")
    .select("id, owner_id")
    .eq("id", horseId)
    .eq("active", true)
    .maybeSingle();

  const horse = (horseData as HorseOwnerRecord | null) ?? null;

  if (!horse) {
    redirectWithMessage("/suchen", "error", "Dieses Pferd ist aktuell nicht verfuegbar.");
  }

  const riderId = user.id;

  const { error } = await supabase.from("trial_requests").insert({
    horse_id: horseId,
    message,
    rider_id: riderId,
    status: TRIAL_REQUEST_STATUS.requested
  });

  if (error) {
    console.error("Trial request insert failed", error);
    redirectWithMessage(`/pferde/${horseId}`, "error", "Probeanfrage konnte nicht gespeichert werden.");
  }

  const { error: conversationError } = await supabase.from("conversations").upsert(
    {
      horse_id: horseId,
      owner_id: horse.owner_id,
      rider_id: riderId
    },
    {
      ignoreDuplicates: true,
      onConflict: "horse_id,rider_id,owner_id"
    }
  );

  if (conversationError) {
    console.error("Conversation insert failed after trial request", conversationError);
    revalidatePath(`/pferde/${horseId}`);
    revalidatePath("/anfragen");
    revalidatePath("/owner/anfragen");
    redirect(
      `/pferde/${horseId}?message=${encodeURIComponent(
        "Deine Anfrage fuer den Probetermin wurde gesendet."
      )}&error=${encodeURIComponent("Chat konnte nicht erstellt werden.")}`
    );
  }

  revalidatePath(`/pferde/${horseId}`);
  revalidatePath("/anfragen");
  revalidatePath("/owner/anfragen");
  redirectWithMessage(`/pferde/${horseId}`, "message", "Deine Anfrage fuer den Probetermin wurde gesendet.");
}

export async function updateTrialRequestStatusAction(formData: FormData) {
  const { user } = await requireProfile("owner");
  const requestId = asString(formData.get("requestId"));
  const nextStatus = asString(formData.get("status"));

  if (!requestId || !isMutableTrialRequestStatus(nextStatus)) {
    redirectWithMessage("/owner/anfragen", "error", "Die Aktion ist ungueltig.");
  }

  const record = await getOwnedTrialRequest(requestId, user.id);

  if (!record) {
    redirectWithMessage("/owner/anfragen", "error", "Die Anfrage konnte nicht gefunden werden.");
  }

  if (nextStatus === TRIAL_REQUEST_STATUS.completed && record.request.status !== TRIAL_REQUEST_STATUS.accepted) {
    redirectWithMessage("/owner/anfragen", "error", "Nur angenommene Probetermine koennen als durchgefuehrt markiert werden.");
  }

  if (
    (nextStatus === TRIAL_REQUEST_STATUS.accepted || nextStatus === TRIAL_REQUEST_STATUS.declined) &&
    record.request.status !== TRIAL_REQUEST_STATUS.requested
  ) {
    redirectWithMessage("/owner/anfragen", "error", "Diese Anfrage kann nicht mehr geaendert werden.");
  }

  const { error } = await record.supabase.from("trial_requests").update({ status: nextStatus }).eq("id", requestId);

  if (error) {
    logSupabaseError("Trial request status update failed", error);
    redirectWithMessage("/owner/anfragen", "error", "Der Status konnte nicht aktualisiert werden.");
  }

  revalidatePath("/owner/anfragen");
  revalidatePath("/anfragen");
  redirectWithMessage("/owner/anfragen", "message", "Der Status wurde aktualisiert.");
}

export async function updateApprovalAction(formData: FormData) {
  const { user } = await requireProfile("owner");
  const requestId = asString(formData.get("requestId"));
  const nextStatus = asString(formData.get("status"));

  if (!requestId || !isApprovalStatus(nextStatus)) {
    redirectWithMessage("/owner/anfragen", "error", "Die Freischaltung ist ungueltig.");
  }

  const record = await getOwnedTrialRequest(requestId, user.id);

  if (!record) {
    redirectWithMessage("/owner/anfragen", "error", "Die Anfrage konnte nicht gefunden werden.");
  }

  if (record.request.status !== TRIAL_REQUEST_STATUS.completed) {
    redirectWithMessage("/owner/anfragen", "error", "Nur durchgefuehrte Probetermine koennen freigeschaltet werden.");
  }

  const { error } = await record.supabase.from("approvals").upsert(
    {
      horse_id: record.request.horse_id,
      rider_id: record.request.rider_id,
      status: nextStatus
    },
    {
      onConflict: "horse_id,rider_id"
    }
  );

  if (error) {
    logSupabaseError("Approval upsert failed", error);
    redirectWithMessage("/owner/anfragen", "error", "Die Freischaltung konnte nicht gespeichert werden.");
  }

  revalidatePath("/owner/anfragen");
  revalidatePath(`/pferde/${record.request.horse_id}`);
  const successMessage = nextStatus === APPROVAL_STATUS.approved ? "Die Reitbeteiligung wurde freigeschaltet." : "Die Freischaltung wurde entzogen.";
  redirectWithMessage("/owner/anfragen", "message", successMessage);
}

export async function logoutAction() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirectWithMessage("/login", "message", "Du bist jetzt abgemeldet.");
}

export async function completeOnboardingAction(formData: FormData) {
  const { supabase, user } = await requireOnboardingUser();
  const role = asString(formData.get("role"));
  const displayName = asString(formData.get("displayName"));
  const phone = asOptionalString(formData.get("phone"));

  if (!isRole(role)) {
    redirectWithMessage("/onboarding", "error", "Bitte waehle Pferdehalter oder Reiter aus.");
  }

  if (displayName.length < 2) {
    redirectWithMessage("/onboarding", "error", "Bitte gib deinen Namen an.");
  }

  if (phone && phone.length < 6) {
    redirectWithMessage("/onboarding", "error", "Bitte gib eine gueltige Telefonnummer an oder lasse das Feld leer.");
  }

  const { error } = await supabase.from("profiles").insert({
    display_name: displayName,
    id: user.id,
    phone,
    role
  });

  if (error) {
    logSupabaseError("Profile insert failed", error);
    redirectWithMessage("/onboarding", "error", "Das Profil konnte nicht angelegt werden.");
  }

  revalidatePath("/", "layout");
  revalidatePath("/dashboard");
  redirectWithMessage("/dashboard", "message", "Dein Profil wurde angelegt.");
}

export async function saveProfileDetailsAction(formData: FormData) {
  const { supabase, user } = await requireProfile();
  const displayName = asString(formData.get("displayName"));
  const phone = asOptionalString(formData.get("phone"));

  if (displayName.length < 2) {
    redirectWithMessage("/profil", "error", "Bitte gib deinen Namen an.");
  }

  if (phone && phone.length < 6) {
    redirectWithMessage("/profil", "error", "Bitte gib eine gueltige Telefonnummer an oder lasse das Feld leer.");
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      phone
    })
    .eq("id", user.id);

  if (error) {
    logSupabaseError("Profile update failed", error);
    redirectWithMessage("/profil", "error", "Das Profil konnte nicht gespeichert werden.");
  }

  revalidatePath("/", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/profil");
  revalidatePath("/anfragen");
  revalidatePath("/owner/anfragen");
  redirectWithMessage("/profil", "message", "Dein Profil wurde gespeichert.");
}

export async function saveHorseAction(formData: FormData) {
  const { supabase, user } = await requireProfile("owner");
  const redirectPath = getOwnerRedirectPath(formData);
  const horseId = asString(formData.get("horseId"));
  const title = asString(formData.get("title"));
  const plz = asString(formData.get("plz"));
  const description = asOptionalString(formData.get("description"));
  const heightCm = asInteger(formData.get("heightCm"));
  const breed = asOptionalString(formData.get("breed"));
  const color = asOptionalString(formData.get("color"));
  const sexValue = asOptionalString(formData.get("sex"));
  const birthYear = asInteger(formData.get("birthYear"));
  const active = formData.get("active") === "on";
  const currentYear = new Date().getFullYear();

  if (title.length < 2 || plz.length < 3) {
    redirectWithMessage(redirectPath, "error", "Titel und PLZ sind erforderlich.");
  }

  if (heightCm !== null && (heightCm < 50 || heightCm > 220)) {
    redirectWithMessage(redirectPath, "error", "Das Stockmass muss zwischen 50 und 220 cm liegen.");
  }

  if (birthYear !== null && (birthYear < 1980 || birthYear > currentYear)) {
    redirectWithMessage(redirectPath, "error", `Das Geburtsjahr muss zwischen 1980 und ${currentYear} liegen.`);
  }

  if (sexValue && !isHorseGeschlecht(sexValue)) {
    redirectWithMessage(redirectPath, "error", `Bitte waehle ${HORSE_GESCHLECHTER.join(", ")} fuer das Geschlecht.`);
  }

  const horseValues = {
    active,
    birth_year: birthYear,
    breed,
    color,
    description,
    height_cm: heightCm,
    plz,
    sex: sexValue,
    title
  };

  if (horseId) {
    const { error } = await supabase.from("horses").update(horseValues).eq("id", horseId).eq("owner_id", user.id);

    if (error) {
      redirectWithMessage(redirectPath, "error", "Das Pferdeprofil konnte nicht gespeichert werden.");
    }
  } else {
    const { error } = await supabase.from("horses").insert({
      ...horseValues,
      owner_id: user.id
    });

    if (error) {
      redirectWithMessage(redirectPath, "error", "Das Pferdeprofil konnte nicht gespeichert werden.");
    }
  }

  revalidatePath("/owner/horses");
  revalidatePath("/owner/pferde-verwalten");
  revalidatePath("/dashboard");
  revalidatePath("/suchen");
  redirectWithMessage(redirectPath, "message", "Das Pferdeprofil wurde gespeichert.");
}

export async function uploadHorseImagesAction(formData: FormData) {
  const { supabase, user } = await requireProfile("owner");
  const redirectPath = getOwnerRedirectPath(formData, "/owner/pferde-verwalten");
  const horseId = asString(formData.get("horseId"));

  if (!horseId) {
    redirectWithMessage(redirectPath, "error", "Das Pferdeprofil konnte nicht gefunden werden.");
  }

  const horse = await getOwnedHorse(supabase, horseId, user.id);

  if (!horse) {
    redirectWithMessage(redirectPath, "error", "Du kannst nur Bilder fuer eigene Pferdeprofile hochladen.");
  }

  const rawFiles = formData.getAll("images");
  const files = rawFiles.filter((entry): entry is File => typeof File !== "undefined" && entry instanceof File && entry.size > 0);

  if (files.length === 0) {
    redirectWithMessage(redirectPath, "error", "Bitte waehle mindestens ein Bild aus.");
  }

  if (files.some((file) => !file.type.startsWith("image/"))) {
    redirectWithMessage(redirectPath, "error", "Es koennen nur Bilddateien hochgeladen werden.");
  }

  const { data: existingImagesData } = await supabase
    .from("horse_images")
    .select(HORSE_IMAGE_SELECT_FIELDS)
    .eq("horse_id", horseId)
    .order("created_at", { ascending: true });

  const existingImages = sortHorseImages(
    (Array.isArray(existingImagesData) ? (existingImagesData as HorseImageRecord[]) : []).filter((image) => image.id)
  );

  if (existingImages.length + files.length > MAX_HORSE_IMAGES) {
    redirectWithMessage(redirectPath, "error", `Es koennen maximal ${MAX_HORSE_IMAGES} Bilder gespeichert werden.`);
  }

  const nextPosition = existingImages.reduce((maxPosition, image) => {
    const position = typeof image.position === "number" ? image.position : 0;
    return Math.max(maxPosition, position + 1);
  }, 0);

  const uploads = files.map((file, index) => {
    const imageId = crypto.randomUUID();
    const path = createHorseImageStoragePath(horseId, imageId, file.name);

    return {
      file,
      id: imageId,
      path,
      position: nextPosition + index
    };
  });

  const preparedImageIds: string[] = [];
  const uploadedPaths: string[] = [];

  const rollbackBatch = async () => {
    if (uploadedPaths.length > 0) {
      const { error: storageCleanupError } = await supabase.storage.from(HORSE_IMAGE_BUCKET).remove(uploadedPaths);

      if (storageCleanupError) {
        logSupabaseError("Horse image batch storage cleanup failed", storageCleanupError);
      }
    }

    if (preparedImageIds.length > 0) {
      const { error: rowCleanupError } = await supabase.from("horse_images").delete().in("id", preparedImageIds);

      if (rowCleanupError) {
        logSupabaseError("Horse image batch row cleanup failed", rowCleanupError);
      }
    }
  };

  for (const upload of uploads) {
    const { error: insertError } = await supabase.rpc("prepare_owner_horse_image", {
      p_horse_id: horseId,
      p_image_id: upload.id,
      p_path: upload.path,
      p_position: upload.position
    });

    if (insertError) {
      logSupabaseError("Horse image row prepare failed", insertError);
      await rollbackBatch();
      redirectWithMessage(redirectPath, "error", "Die Bilder konnten nicht gespeichert werden.");
    }

    preparedImageIds.push(upload.id);

    const { error: uploadError } = await supabase.storage.from(HORSE_IMAGE_BUCKET).upload(upload.path, upload.file, {
      cacheControl: "3600",
      contentType: upload.file.type || undefined,
      upsert: false
    });

    if (uploadError) {
      logSupabaseError("Horse image upload failed", uploadError);
      await rollbackBatch();
      redirectWithMessage(redirectPath, "error", "Die Bilder konnten nicht hochgeladen werden.");
    }

    uploadedPaths.push(upload.path);
  }

  revalidatePath("/owner/horses");
  revalidatePath("/owner/pferde-verwalten");
  revalidatePath("/suchen");
  revalidatePath(`/pferde/${horseId}`);
  redirectWithMessage(redirectPath, "message", "Die Bilder wurden gespeichert.");
}

export async function deleteHorseImageAction(formData: FormData) {
  const { supabase, user } = await requireProfile("owner");
  const redirectPath = getOwnerRedirectPath(formData, "/owner/pferde-verwalten");
  const imageId = asString(formData.get("imageId"));

  if (!imageId) {
    redirectWithMessage(redirectPath, "error", "Das Bild konnte nicht gefunden werden.");
  }

  const { data: imageData } = await supabase.from("horse_images").select(HORSE_IMAGE_SELECT_FIELDS).eq("id", imageId).maybeSingle();
  const image = (imageData as HorseImageRecord | null) ?? null;

  if (!image) {
    redirectWithMessage(redirectPath, "error", "Das Bild konnte nicht gefunden werden.");
  }

  const horse = await getOwnedHorse(supabase, image.horse_id, user.id);

  if (!horse) {
    redirectWithMessage(redirectPath, "error", "Du kannst nur Bilder fuer eigene Pferdeprofile loeschen.");
  }

  const imagePath = image.path ?? image.storage_path ?? null;

  if (!imagePath) {
    redirectWithMessage(redirectPath, "error", "Das Bild konnte nicht geloescht werden.");
  }

  const { error: storageError } = await supabase.storage.from(HORSE_IMAGE_BUCKET).remove([imagePath]);

  if (storageError) {
    logSupabaseError("Horse image storage delete failed", storageError);
    redirectWithMessage(redirectPath, "error", "Das Bild konnte nicht geloescht werden.");
  }

  const { error } = await supabase.from("horse_images").delete().eq("id", imageId);

  if (error) {
    logSupabaseError("Horse image row delete failed", error);
    redirectWithMessage(redirectPath, "error", "Das Bild konnte nicht geloescht werden.");
  }

  revalidatePath("/owner/horses");
  revalidatePath("/owner/pferde-verwalten");
  revalidatePath("/suchen");
  revalidatePath(`/pferde/${image.horse_id}`);
  redirectWithMessage(redirectPath, "message", "Das Bild wurde entfernt.");
}
export async function createCalendarBlockAction(formData: FormData) {
  const { supabase, user } = await requireProfile("owner");
  const horseId = asString(formData.get("horseId"));

  if (!horseId) {
    redirectWithMessage("/owner/horses", "error", "Das Pferdeprofil konnte nicht gefunden werden.");
  }

  const horse = await getOwnedHorse(supabase, horseId, user.id);
  const redirectPath = `/pferde/${horseId}/kalender`;

  if (!horse) {
    redirectWithMessage("/owner/horses", "error", "Du kannst nur eigene Kalender-Sperren verwalten.");
  }

  const startAtValue = asString(formData.get("startAt"));
  const endAtValue = asString(formData.get("endAt"));
  const startAt = new Date(startAtValue);
  const endAt = new Date(endAtValue);

  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    redirectWithMessage(redirectPath, "error", "Bitte gib einen gueltigen Zeitraum an.");
  }

  if (endAt <= startAt) {
    redirectWithMessage(redirectPath, "error", "Das Ende muss nach dem Beginn liegen.");
  }

  const { error } = await supabase.from("calendar_blocks").insert({
    horse_id: horseId,
    start_at: startAt.toISOString(),
    end_at: endAt.toISOString()
  });

  if (error) {
    logSupabaseError("Calendar block insert failed", error);
    redirectWithMessage(redirectPath, "error", "Der Zeitraum konnte nicht als belegt gespeichert werden.");
  }

  revalidatePath(redirectPath);
  revalidatePath(`/pferde/${horseId}`);
  redirectWithMessage(redirectPath, "message", "Der Zeitraum wurde als belegt gespeichert.");
}

export async function deleteCalendarBlockAction(formData: FormData) {
  const { supabase, user } = await requireProfile("owner");
  const blockId = asString(formData.get("blockId"));

  if (!blockId) {
    redirectWithMessage("/owner/horses", "error", "Die Kalender-Sperre konnte nicht gefunden werden.");
  }

  const block = await getOwnedCalendarBlock(supabase, blockId, user.id);

  if (!block) {
    redirectWithMessage("/owner/horses", "error", "Du kannst nur eigene Kalender-Sperren loeschen.");
  }

  const redirectPath = `/pferde/${block.horse_id}/kalender`;
  const { error } = await supabase.from("calendar_blocks").delete().eq("id", blockId);

  if (error) {
    logSupabaseError("Calendar block delete failed", error);
    redirectWithMessage(redirectPath, "error", "Die Kalender-Sperre konnte nicht geloescht werden.");
  }

  revalidatePath(redirectPath);
  revalidatePath(`/pferde/${block.horse_id}`);
  redirectWithMessage(redirectPath, "message", "Die Kalender-Sperre wurde entfernt.");
}
export async function createAvailabilityRuleAction(formData: FormData) {
  const { supabase, user } = await requireProfile("owner");
  const horseId = asString(formData.get("horseId"));

  if (!horseId) {
    redirectWithMessage("/owner/horses", "error", "Das Pferdeprofil konnte nicht gefunden werden.");
  }

  const horse = await getOwnedHorse(supabase, horseId, user.id);
  const redirectPath = `/pferde/${horseId}/kalender`;

  if (!horse) {
    redirectWithMessage("/owner/horses", "error", "Du kannst nur eigene Verfuegbarkeiten verwalten.");
  }

  const presetValue = asString(formData.get("availabilityPreset"));

  if (!isAvailabilityPreset(presetValue)) {
    redirectWithMessage(redirectPath, "error", "Bitte waehle ein gueltiges Wochenmuster aus.");
  }

  const selectedWeekdays = formData
    .getAll("weekday")
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
  const days = resolveAvailabilityDays(presetValue, selectedWeekdays);

  if (days.length === 0) {
    redirectWithMessage(redirectPath, "error", "Bitte waehle mindestens einen Wochentag aus.");
  }

  const startTime = parseClockTime(asString(formData.get("startTime")));
  const endTime = parseClockTime(asString(formData.get("endTime")));

  if (!startTime || !endTime) {
    redirectWithMessage(redirectPath, "error", "Bitte gib eine gueltige Uhrzeit an.");
  }

  if (endTime.hours < startTime.hours || (endTime.hours === startTime.hours && endTime.minutes <= startTime.minutes)) {
    redirectWithMessage(redirectPath, "error", "Das Ende muss nach dem Beginn liegen.");
  }

  const candidateWindows = buildAvailabilityWindows(days, startTime, endTime);

  if (candidateWindows.length === 0) {
    redirectWithMessage(
      redirectPath,
      "error",
      "Mit dieser Auswahl entstehen in den naechsten 8 Wochen keine zukuenftigen Zeitfenster."
    );
  }

  const { data: existingRulesData, error: existingRulesError } = await supabase
    .from("availability_rules")
    .select("start_at, end_at")
    .eq("horse_id", horseId)
    .eq("active", true)
    .gte("end_at", new Date().toISOString());

  if (existingRulesError) {
    logSupabaseError("Availability rule lookup failed", existingRulesError);
    redirectWithMessage(redirectPath, "error", "Die vorhandenen Verfuegbarkeiten konnten nicht geladen werden.");
  }

  const existingRuleKeys = new Set(
    (((existingRulesData as Array<{ end_at: string; start_at: string }> | null) ?? [])).map(
      (rule) => `${rule.start_at}|${rule.end_at}`
    )
  );
  const windowsToCreate = candidateWindows.filter((window) => !existingRuleKeys.has(`${window.startAt}|${window.endAt}`));
  const skippedCount = candidateWindows.length - windowsToCreate.length;

  if (windowsToCreate.length === 0) {
    redirectWithMessage(redirectPath, "message", "Diese Standardzeiten sind bereits hinterlegt.");
  }

  let createdCount = 0;
  let failedCount = 0;

  for (const window of windowsToCreate) {
    const { data: slotData, error: slotError } = await supabase
      .from("availability_slots")
      .insert({
        active: true,
        end_at: window.endAt,
        horse_id: horseId,
        start_at: window.startAt
      })
      .select("id")
      .maybeSingle();

    if (slotError || !slotData?.id) {
      if (slotError) {
        logSupabaseError("Availability slot insert failed", slotError);
      }

      failedCount += 1;
      continue;
    }

    const slotId = slotData.id;
    const { error } = await supabase.from("availability_rules").insert({
      active: true,
      end_at: window.endAt,
      horse_id: horseId,
      slot_id: slotId,
      start_at: window.startAt
    });

    if (error) {
      logSupabaseError("Availability rule insert failed", error);
      failedCount += 1;

      const { error: cleanupError } = await supabase.from("availability_slots").delete().eq("id", slotId).eq("horse_id", horseId);

      if (cleanupError) {
        logSupabaseError("Availability slot cleanup failed", cleanupError);
      }

      continue;
    }

    createdCount += 1;
  }

  if (createdCount === 0) {
    redirectWithMessage(redirectPath, "error", "Die Standardzeiten konnten nicht gespeichert werden.");
  }

  revalidatePath(redirectPath);
  revalidatePath(`/pferde/${horseId}`);
  revalidatePath("/owner/anfragen");
  revalidatePath("/anfragen");

  const messageParts = [
    createdCount === 1
      ? "1 Verfuegbarkeitsfenster wurde gespeichert."
      : `${createdCount} Verfuegbarkeitsfenster wurden gespeichert.`
  ];

  if (skippedCount > 0) {
    messageParts.push(
      skippedCount === 1
        ? "1 bereits vorhandenes Fenster wurde uebersprungen."
        : `${skippedCount} bereits vorhandene Fenster wurden uebersprungen.`
    );
  }

  if (failedCount > 0) {
    messageParts.push(
      failedCount === 1
        ? "1 Fenster konnte nicht angelegt werden."
        : `${failedCount} Fenster konnten nicht angelegt werden.`
    );
  }

  redirectWithMessage(redirectPath, "message", messageParts.join(" "));
}

export async function deleteAvailabilityRuleAction(formData: FormData) {
  const { supabase, user } = await requireProfile("owner");
  const ruleId = asString(formData.get("ruleId"));

  if (!ruleId) {
    redirectWithMessage("/owner/horses", "error", "Das Verfuegbarkeitsfenster konnte nicht gefunden werden.");
  }

  const rule = await getOwnedAvailabilityRule(supabase, ruleId, user.id);

  if (!rule) {
    redirectWithMessage("/owner/horses", "error", "Du kannst nur eigene Verfuegbarkeitsfenster loeschen.");
  }

  const redirectPath = `/pferde/${rule.horse_id}/kalender`;
  const { error } = await supabase.from("availability_slots").delete().eq("id", rule.slot_id).eq("horse_id", rule.horse_id);

  if (error) {
    logSupabaseError("Availability rule delete failed", error);
    redirectWithMessage(redirectPath, "error", "Das Verfuegbarkeitsfenster konnte nicht geloescht werden.");
  }

  revalidatePath(redirectPath);
  revalidatePath("/owner/anfragen");
  revalidatePath("/anfragen");
  redirectWithMessage(redirectPath, "message", "Das Verfuegbarkeitsfenster wurde entfernt.");
}

export async function requestBookingAction(formData: FormData) {
  const { supabase, user } = await requireProfile("rider");
  const horseId = asString(formData.get("horseId"));
  const ruleId = asString(formData.get("ruleId"));
  const recurrenceRrule = asOptionalString(formData.get("recurrenceRrule"));

  if (!horseId || !ruleId) {
    redirectWithMessage("/suchen", "error", "Das Verfuegbarkeitsfenster konnte nicht gefunden werden.");
  }

  const redirectPath = `/pferde/${horseId}/kalender`;
  const startAtValue = asString(formData.get("startAt"));
  const endAtValue = asString(formData.get("endAt"));
  const startAt = new Date(startAtValue);
  const endAt = new Date(endAtValue);

  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    redirectWithMessage(redirectPath, "error", "Bitte gib einen gueltigen Termin an.");
  }

  if (endAt <= startAt) {
    redirectWithMessage(redirectPath, "error", "Das Ende muss nach dem Beginn liegen.");
  }

  if (recurrenceRrule) {
    try {
      parseRecurrenceRule(recurrenceRrule, startAt);
    } catch (error) {
      redirectWithMessage(redirectPath, "error", getRecurrenceErrorMessage(error as Error));
    }
  }

  const { data: approvalData } = await supabase
    .from("approvals")
    .select("horse_id, rider_id, status")
    .eq("horse_id", horseId)
    .eq("rider_id", user.id)
    .maybeSingle();

  const approval = (approvalData as ApprovalRecord | null) ?? null;

  if (approval?.status !== APPROVAL_STATUS.approved) {
    redirectWithMessage(redirectPath, "error", "Nur freigeschaltete Reiter koennen einen Termin anfragen.");
  }

  const { data: ruleData } = await supabase
    .from("availability_rules")
    .select("id, horse_id, slot_id, start_at, end_at, active, created_at")
    .eq("id", ruleId)
    .eq("horse_id", horseId)
    .maybeSingle();

  const rule = (ruleData as AvailabilityRuleRecord | null) ?? null;

  if (!rule || !rule.active) {
    redirectWithMessage(redirectPath, "error", "Dieses Verfuegbarkeitsfenster ist nicht mehr verfuegbar.");
  }

  const requestedStartIso = startAt.toISOString();
  const requestedEndIso = endAt.toISOString();

  if (requestedStartIso < rule.start_at || requestedEndIso > rule.end_at) {
    redirectWithMessage(redirectPath, "error", "Der Termin muss komplett im Verfuegbarkeitsfenster liegen.");
  }

  const { error } = await supabase.from("booking_requests").insert({
    availability_rule_id: rule.id,
    horse_id: horseId,
    recurrence_rrule: recurrenceRrule,
    requested_end_at: requestedEndIso,
    requested_start_at: requestedStartIso,
    rider_id: user.id,
    slot_id: rule.slot_id,
    status: "requested"
  });

  if (error) {
    logSupabaseError("Booking request insert failed", error);
    redirectWithMessage(redirectPath, "error", "Die Terminanfrage konnte nicht gespeichert werden.");
  }

  revalidatePath(redirectPath);
  revalidatePath("/anfragen");
  revalidatePath("/owner/anfragen");
  redirectWithMessage(redirectPath, "message", "Die Terminanfrage wurde gesendet.");
}

export async function acceptBookingRequestAction(formData: FormData) {
  const { supabase, user } = await requireProfile("owner");
  const requestId = asString(formData.get("requestId"));

  if (!requestId) {
    redirectWithMessage("/owner/anfragen", "error", "Die Buchungsanfrage konnte nicht gefunden werden.");
  }

  const request = await getManagedBookingRequest(supabase, requestId, user.id);

  if (!request) {
    redirectWithMessage("/owner/anfragen", "error", "Die Buchungsanfrage konnte nicht gefunden werden.");
  }

  if (request.status !== "requested") {
    redirectWithMessage("/owner/anfragen", "error", "Diese Buchungsanfrage wurde bereits bearbeitet.");
  }

  const { data: ruleData } = await supabase
    .from("availability_rules")
    .select("id, horse_id, slot_id, start_at, end_at, active, created_at")
    .eq("id", request.availability_rule_id)
    .eq("horse_id", request.horse_id)
    .maybeSingle();

  const rule = (ruleData as AvailabilityRuleRecord | null) ?? null;

  if (!rule || !rule.active || rule.slot_id !== request.slot_id) {
    redirectWithMessage("/owner/anfragen", "error", "Dieses Verfuegbarkeitsfenster ist nicht mehr aktiv.");
  }

  const { data: approvalData } = await supabase
    .from("approvals")
    .select("horse_id, rider_id, status")
    .eq("horse_id", request.horse_id)
    .eq("rider_id", request.rider_id)
    .maybeSingle();

  const approval = (approvalData as ApprovalRecord | null) ?? null;

  if (approval?.status !== APPROVAL_STATUS.approved) {
    redirectWithMessage("/owner/anfragen", "error", "Nur freigeschaltete Reiter koennen gebucht werden.");
  }

  if (!request.requested_start_at || !request.requested_end_at || request.requested_start_at < rule.start_at || request.requested_end_at > rule.end_at) {
    redirectWithMessage("/owner/anfragen", "error", "Der erste Termin liegt nicht im Verfuegbarkeitsfenster.");
  }

  let bookingWindows: BookingWindow[];

  try {
    bookingWindows = buildBookingWindows(request);
  } catch (error) {
    if (error instanceof Error && (error.message === "INVALID_RRULE" || error.message === "UNSUPPORTED_RRULE" || error.message === "RECURRENCE_LIMIT")) {
      redirectWithMessage("/owner/anfragen", "error", getRecurrenceErrorMessage(error));
    }

    redirectWithMessage("/owner/anfragen", "error", "Die Buchungsanfrage enthaelt einen ungueltigen Zeitraum.");
  }

  const [{ data: existingBookingsData }, { data: blocksData }] = await Promise.all([
    supabase.from("bookings").select("id, start_at, end_at").eq("horse_id", request.horse_id),
    supabase.from("calendar_blocks").select("start_at, end_at").eq("horse_id", request.horse_id)
  ]);

  const existingBookings = (existingBookingsData as BookingRecord[] | null) ?? [];
  const existingBlocks = (blocksData as TimeRangeRecord[] | null) ?? [];

  if (hasWindowConflict(bookingWindows, existingBookings) || hasWindowConflict(bookingWindows, existingBlocks)) {
    redirectWithMessage(
      "/owner/anfragen",
      "error",
      request.recurrence_rrule
        ? "Mindestens ein Wiederholungstermin kollidiert mit einer bestehenden Buchung oder Sperre."
        : "Der angefragte Termin ist nicht mehr verfuegbar."
    );
  }

  const bookingRows = bookingWindows.map((window) => ({
    availability_rule_id: rule.id,
    booking_request_id: request.id,
    end_at: window.endAt,
    horse_id: request.horse_id,
    rider_id: request.rider_id,
    slot_id: request.slot_id,
    start_at: window.startAt
  }));

  const { error: insertError } = await supabase.from("bookings").insert(bookingRows);

  if (insertError) {
    logSupabaseError("Booking insert failed", insertError);
    redirectWithMessage("/owner/anfragen", "error", "Die Buchung konnte nicht gespeichert werden.");
  }

  const { error: updateError } = await supabase.from("booking_requests").update({ status: "accepted" }).eq("id", requestId);

  if (updateError) {
    logSupabaseError("Booking request accept status update failed", updateError);
    const { error: cleanupError } = await supabase.from("bookings").delete().eq("booking_request_id", requestId);

    if (cleanupError) {
      logSupabaseError("Booking accept cleanup failed", cleanupError);
    }

    redirectWithMessage("/owner/anfragen", "error", "Die Buchungsanfrage konnte nicht angenommen werden.");
  }

  revalidatePath("/owner/anfragen");
  revalidatePath("/anfragen");
  revalidatePath(`/pferde/${request.horse_id}`);
  revalidatePath(`/pferde/${request.horse_id}/kalender`);
  redirectWithMessage(
    "/owner/anfragen",
    "message",
    request.recurrence_rrule ? "Die Buchungsanfrage wurde inklusive Wiederholung angenommen." : "Die Buchungsanfrage wurde angenommen."
  );
}

export async function declineBookingRequestAction(formData: FormData) {
  const { supabase, user } = await requireProfile("owner");
  const requestId = asString(formData.get("requestId"));

  if (!requestId) {
    redirectWithMessage("/owner/anfragen", "error", "Die Buchungsanfrage konnte nicht gefunden werden.");
  }

  const request = await getManagedBookingRequest(supabase, requestId, user.id);

  if (!request) {
    redirectWithMessage("/owner/anfragen", "error", "Die Buchungsanfrage konnte nicht gefunden werden.");
  }

  if (request.status !== "requested") {
    redirectWithMessage("/owner/anfragen", "error", "Diese Buchungsanfrage wurde bereits bearbeitet.");
  }

  const { error } = await supabase.from("booking_requests").update({ status: "declined" }).eq("id", requestId);

  if (error) {
    logSupabaseError("Booking request decline failed", error);
    redirectWithMessage("/owner/anfragen", "error", "Die Buchungsanfrage konnte nicht abgelehnt werden.");
  }

  revalidatePath("/owner/anfragen");
  revalidatePath("/anfragen");
  revalidatePath(`/pferde/${request.horse_id}/kalender`);
  redirectWithMessage("/owner/anfragen", "message", "Die Buchungsanfrage wurde abgelehnt.");
}

export async function deleteHorseAction(formData: FormData) {
  const { supabase, user } = await requireProfile("owner");
  const redirectPath = getOwnerRedirectPath(formData, "/owner/pferde-verwalten");
  const horseId = asString(formData.get("horseId"));

  if (!horseId) {
    redirectWithMessage(redirectPath, "error", "Das Pferdeprofil konnte nicht gefunden werden.");
  }

  const horse = await getOwnedHorse(supabase, horseId, user.id);

  if (!horse) {
    redirectWithMessage(redirectPath, "error", "Du kannst nur eigene Pferdeprofile loeschen.");
  }

  const { data: imagesData } = await supabase
    .from("horse_images")
    .select(HORSE_IMAGE_SELECT_FIELDS)
    .eq("horse_id", horseId)
    .order("created_at", { ascending: true });

  const images = sortHorseImages(
    (Array.isArray(imagesData) ? (imagesData as HorseImageRecord[]) : []).filter((image) => image.id)
  );
  const imagePaths = images.map((image) => image.path ?? image.storage_path ?? null).filter((path): path is string => Boolean(path));

  if (imagePaths.length > 0) {
    const { error: storageError } = await supabase.storage.from(HORSE_IMAGE_BUCKET).remove(imagePaths);

    if (storageError) {
      logSupabaseError("Horse image cleanup during horse delete failed", storageError);
    }
  }

  const { error } = await supabase.rpc("delete_owner_horse", {
    p_horse_id: horseId
  });

  if (error) {
    logSupabaseError("Horse delete failed", error);

    if (error.code === "23503") {
      redirectWithMessage(redirectPath, "error", "Das Pferd hat noch aktive Termine oder Anfragen und kann derzeit nicht geloescht werden.");
    }

    redirectWithMessage(redirectPath, "error", "Pferdeprofil konnte nicht geloescht werden.");
  }

  revalidatePath("/owner/horses");
  revalidatePath("/owner/pferde-verwalten");
  revalidatePath("/dashboard");
  revalidatePath("/suchen");
  revalidatePath("/owner/anfragen");
  revalidatePath("/anfragen");
  revalidatePath(`/pferde/${horseId}`);
  redirectWithMessage(redirectPath, "message", "Das Pferdeprofil wurde geloescht.");
}

export async function saveRiderProfileAction(formData: FormData) {
  const { supabase, user } = await requireProfile("rider");
  const experience = asOptionalString(formData.get("experience"));
  const weight = asInteger(formData.get("weight"));
  const notes = asOptionalString(formData.get("notes"));

  if (weight !== null && weight <= 0) {
    redirectWithMessage("/rider/profile", "error", "Das Gewicht muss groesser als 0 sein.");
  }

  const { error } = await supabase.from("rider_profiles").upsert(
    {
      experience,
      notes,
      user_id: user.id,
      weight
    },
    {
      onConflict: "user_id"
    }
  );

  if (error) {
    redirectWithMessage("/rider/profile", "error", "Das Reiterprofil konnte nicht gespeichert werden.");
  }

  revalidatePath("/rider/profile");
  revalidatePath("/dashboard");
  redirectWithMessage("/rider/profile", "message", "Das Reiterprofil wurde gespeichert.");
}


