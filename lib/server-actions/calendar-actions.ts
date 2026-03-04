import { asOptionalString, asString } from "../forms";
import { R1_CORE_MODE } from "../release-stage";
import type { createClient } from "../supabase/server";
import { getOwnedHorse } from "./horse";
import {
  getAvailabilityAccessError,
  getAvailabilityConflictError,
  getAvailabilityInvalidWindowError,
  getAvailabilityLoadError,
  getAvailabilityPlannerDayError,
  getAvailabilityRevalidationPaths,
  getAvailabilitySaveError,
  getAvailabilitySavedMessage,
  getAvailabilityTimeError,
  getCalendarBlockAccessError,
  getCalendarBlockInvalidWindowError,
  getCalendarBlockPlannerDayError,
  getCalendarBlockQuarterHourError,
  getCalendarBlockRevalidationPaths,
  getCalendarBlockSavedMessage,
  getCalendarBlockSaveError,
  getCalendarBlockTimeError,
  getCalendarRedirectPath,
  getOwnedAvailabilityRule,
  getOwnedCalendarBlock
} from "./calendar";

type SupabaseClient = ReturnType<typeof createClient>;
type SupabaseErrorLike = {
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  message: string;
};
type LogSupabaseError = (context: string, error: SupabaseErrorLike) => void;

type ParsedClockTime = {
  hours: number;
  minutes: number;
};

type BookingWindow = {
  endAt: string;
  startAt: string;
};

type TimeRangeRecord = {
  end_at: string;
  start_at: string;
};

type AvailabilityRangeRecord = {
  end_at: string;
  start_at: string;
};

type CalendarActionResult =
  | {
      message: string;
      ok: false;
      redirectPath: string;
    }
  | {
      ok: true;
      paths: readonly string[];
      redirectPath: string;
      successMessage: string;
    };

const CALENDAR_STEP_MINUTES = 15;

type CalendarDeleteActionResult =
  | {
      message: string;
      ok: false;
    }
  | {
      horseId: string;
      ok: true;
      paths: readonly string[];
      successMessage: string;
    };

function errorResult(redirectPath: string, message: string): CalendarActionResult {
  return {
    message,
    ok: false,
    redirectPath
  };
}

function successResult(redirectPath: string, successMessage: string, paths: readonly string[]): CalendarActionResult {
  return {
    ok: true,
    paths,
    redirectPath,
    successMessage
  };
}

function parseClockTime(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return null;
  }

  const [hoursValue, minutesValue] = value.split(":");
  const hours = Number.parseInt(hoursValue, 10);
  const minutes = Number.parseInt(minutesValue, 10);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    minutes % CALENDAR_STEP_MINUTES !== 0
  ) {
    return null;
  }

  return {
    hours,
    minutes
  } satisfies ParsedClockTime;
}

function buildSingleAvailabilityWindow(dayValue: string, startTime: ParsedClockTime, endTime: ParsedClockTime) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayValue)) {
    return null;
  }

  const [yearValue, monthValue, dayNumberValue] = dayValue.split("-");
  const year = Number.parseInt(yearValue, 10);
  const month = Number.parseInt(monthValue, 10);
  const dayNumber = Number.parseInt(dayNumberValue, 10);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(dayNumber)) {
    return null;
  }

  const startAt = new Date(year, month - 1, dayNumber, startTime.hours, startTime.minutes, 0, 0);
  const endAt = new Date(year, month - 1, dayNumber, endTime.hours, endTime.minutes, 0, 0);

  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt || endAt <= new Date()) {
    return null;
  }

  return {
    endAt: endAt.toISOString(),
    startAt: startAt.toISOString()
  } satisfies BookingWindow;
}

function isQuarterHourAligned(value: Date) {
  return value.getMinutes() % CALENDAR_STEP_MINUTES === 0 && value.getSeconds() === 0 && value.getMilliseconds() === 0;
}

function isResizeDirection(value: string): value is "start-earlier" | "start-later" | "end-earlier" | "end-later" {
  return value === "start-earlier" || value === "start-later" || value === "end-earlier" || value === "end-later";
}

function isMoveDirection(value: string): value is "earlier" | "later" {
  return value === "earlier" || value === "later";
}

function shiftRangeBoundary(
  startAtValue: string,
  endAtValue: string,
  direction: "start-earlier" | "start-later" | "end-earlier" | "end-later"
) {
  const startAt = new Date(startAtValue);
  const endAt = new Date(endAtValue);

  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    return null;
  }

  if (direction === "start-earlier") {
    startAt.setMinutes(startAt.getMinutes() - CALENDAR_STEP_MINUTES, 0, 0);
  }

  if (direction === "start-later") {
    startAt.setMinutes(startAt.getMinutes() + CALENDAR_STEP_MINUTES, 0, 0);
  }

  if (direction === "end-earlier") {
    endAt.setMinutes(endAt.getMinutes() - CALENDAR_STEP_MINUTES, 0, 0);
  }

  if (direction === "end-later") {
    endAt.setMinutes(endAt.getMinutes() + CALENDAR_STEP_MINUTES, 0, 0);
  }

  if (endAt <= startAt) {
    return null;
  }

  return {
    endAt: endAt.toISOString(),
    startAt: startAt.toISOString()
  } satisfies BookingWindow;
}

function shiftWholeRange(startAtValue: string, endAtValue: string, direction: "earlier" | "later") {
  const startAt = new Date(startAtValue);
  const endAt = new Date(endAtValue);

  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    return null;
  }

  startAt.setMinutes(startAt.getMinutes() + (direction === "earlier" ? -CALENDAR_STEP_MINUTES : CALENDAR_STEP_MINUTES), 0, 0);
  endAt.setMinutes(endAt.getMinutes() + (direction === "earlier" ? -CALENDAR_STEP_MINUTES : CALENDAR_STEP_MINUTES), 0, 0);

  if (endAt <= startAt) {
    return null;
  }

  return {
    endAt: endAt.toISOString(),
    startAt: startAt.toISOString()
  } satisfies BookingWindow;
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

async function getActiveAvailabilityRanges(
  supabase: SupabaseClient,
  horseId: string,
  excludeRuleId?: string
) {
  let query = supabase.from("availability_rules").select("id, start_at, end_at").eq("horse_id", horseId).eq("active", true);

  if (excludeRuleId) {
    query = query.neq("id", excludeRuleId);
  }

  const { data, error } = await query;

  return {
    error,
    ranges: ((data as AvailabilityRangeRecord[] | null) ?? []).map((range) => ({
      end_at: range.end_at,
      start_at: range.start_at
    }))
  };
}

export async function createAvailabilityDayForOwner(input: {
  formData: FormData;
  logSupabaseError: LogSupabaseError;
  ownerId: string;
  supabase: SupabaseClient;
}): Promise<CalendarActionResult> {
  const horseId = asString(input.formData.get("horseId"));

  if (!horseId) {
    return errorResult("/owner/horses", getCalendarBlockAccessError("missing_horse"));
  }

  const horse = await getOwnedHorse(input.supabase, horseId, input.ownerId);

  if (!horse) {
    return errorResult("/owner/horses", getAvailabilityAccessError("forbidden_manage"));
  }

  const selectedDate = asString(input.formData.get("selectedDate"));
  const redirectPath = getCalendarRedirectPath(input.formData, horseId, selectedDate, { anchor: "tagesfenster" });
  const successRedirectPath = getCalendarRedirectPath(input.formData, horseId, selectedDate, { anchor: "kalender-feedback" });
  const startTime = parseClockTime(asString(input.formData.get("startTime")));
  const endTime = parseClockTime(asString(input.formData.get("endTime")));
  const isTrialSlot = input.formData.get("isTrialSlot") === "on";

  if (!startTime || !endTime) {
    return errorResult(redirectPath, getAvailabilityTimeError());
  }

  const window = buildSingleAvailabilityWindow(selectedDate, startTime, endTime);

  if (!window) {
    return errorResult(redirectPath, getAvailabilityInvalidWindowError("create"));
  }

  const { ranges: existingRanges, error: existingRuleError } = await getActiveAvailabilityRanges(input.supabase, horseId);

  if (existingRuleError) {
    input.logSupabaseError("Availability day lookup failed", existingRuleError);
    return errorResult(redirectPath, getAvailabilityLoadError());
  }

  if (hasWindowConflict([window], existingRanges)) {
    return errorResult(redirectPath, getAvailabilityConflictError("create"));
  }

  const { data: slotData, error: slotError } = await input.supabase
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
      input.logSupabaseError("Availability day slot insert failed", slotError);
    }

    return errorResult(redirectPath, getAvailabilitySaveError("create"));
  }

  const { error } = await input.supabase.from("availability_rules").insert({
    active: true,
    end_at: window.endAt,
    horse_id: horseId,
    is_trial_slot: isTrialSlot,
    slot_id: slotData.id,
    start_at: window.startAt
  });

  if (error) {
    input.logSupabaseError("Availability day insert failed", error);

    const { error: cleanupError } = await input.supabase.from("availability_slots").delete().eq("id", slotData.id).eq("horse_id", horseId);

    if (cleanupError) {
      input.logSupabaseError("Availability day cleanup failed", cleanupError);
    }

    return errorResult(redirectPath, getAvailabilitySaveError("create"));
  }

  return successResult(successRedirectPath, getAvailabilitySavedMessage("create"), getAvailabilityRevalidationPaths(horseId));
}

export async function updateAvailabilityDayForOwner(input: {
  formData: FormData;
  logSupabaseError: LogSupabaseError;
  ownerId: string;
  supabase: SupabaseClient;
}): Promise<CalendarActionResult> {
  const ruleId = asString(input.formData.get("ruleId"));

  if (!ruleId) {
    return errorResult("/owner/horses", getAvailabilityAccessError("missing_rule"));
  }

  const rule = await getOwnedAvailabilityRule(input.supabase, ruleId, input.ownerId);

  if (!rule) {
    return errorResult("/owner/horses", getAvailabilityAccessError("forbidden_edit"));
  }

  const selectedDate = asString(input.formData.get("selectedDate")) || rule.start_at.slice(0, 10);
  const redirectPath = getCalendarRedirectPath(input.formData, rule.horse_id, selectedDate, { anchor: "tagesfenster", focusRuleId: rule.id });
  const successRedirectPath = getCalendarRedirectPath(input.formData, rule.horse_id, selectedDate, { anchor: "kalender-feedback" });
  const startTime = parseClockTime(asString(input.formData.get("startTime")));
  const endTime = parseClockTime(asString(input.formData.get("endTime")));
  const isTrialSlotValue = input.formData.get("isTrialSlot");
  const isTrialSlot = isTrialSlotValue === null ? Boolean(rule.is_trial_slot) : isTrialSlotValue === "on";

  if (!startTime || !endTime) {
    return errorResult(redirectPath, getAvailabilityTimeError());
  }

  const window = buildSingleAvailabilityWindow(selectedDate, startTime, endTime);

  if (!window) {
    return errorResult(redirectPath, getAvailabilityInvalidWindowError("update"));
  }

  const { ranges: existingRanges, error: duplicateRuleError } = await getActiveAvailabilityRanges(input.supabase, rule.horse_id, rule.id);

  if (duplicateRuleError) {
    input.logSupabaseError("Availability day duplicate lookup failed", duplicateRuleError);
    return errorResult(redirectPath, getAvailabilityLoadError());
  }

  if (hasWindowConflict([window], existingRanges)) {
    return errorResult(redirectPath, getAvailabilityConflictError("update"));
  }

  const { error: slotError } = await input.supabase
    .from("availability_slots")
    .update({
      end_at: window.endAt,
      start_at: window.startAt
    })
    .eq("id", rule.slot_id)
    .eq("horse_id", rule.horse_id);

  if (slotError) {
    input.logSupabaseError("Availability slot update failed", slotError);
    return errorResult(redirectPath, getAvailabilitySaveError("update"));
  }

  const { error: ruleError } = await input.supabase
    .from("availability_rules")
    .update({
      end_at: window.endAt,
      is_trial_slot: isTrialSlot,
      start_at: window.startAt
    })
    .eq("id", rule.id);

  if (ruleError) {
    input.logSupabaseError("Availability rule update failed", ruleError);

    const { error: rollbackError } = await input.supabase
      .from("availability_slots")
      .update({
        end_at: rule.end_at,
        start_at: rule.start_at
      })
      .eq("id", rule.slot_id)
      .eq("horse_id", rule.horse_id);

    if (rollbackError) {
      input.logSupabaseError("Availability slot rollback failed", rollbackError);
    }

    return errorResult(redirectPath, getAvailabilitySaveError("update"));
  }

  return successResult(successRedirectPath, getAvailabilitySavedMessage("update"), getAvailabilityRevalidationPaths(rule.horse_id));
}

export async function resizeAvailabilityRuleForOwner(input: {
  formData: FormData;
  logSupabaseError: LogSupabaseError;
  ownerId: string;
  supabase: SupabaseClient;
}): Promise<CalendarActionResult> {
  const ruleId = asString(input.formData.get("ruleId"));
  const directionValue = asString(input.formData.get("direction"));

  if (!ruleId || !isResizeDirection(directionValue)) {
    return errorResult("/owner/horses", getAvailabilitySaveError("planner_adjust"));
  }

  const rule = await getOwnedAvailabilityRule(input.supabase, ruleId, input.ownerId);

  if (!rule) {
    return errorResult("/owner/horses", getAvailabilityAccessError("forbidden_adjust"));
  }

  const selectedDate = rule.start_at.slice(0, 10);
  const redirectPath = "/pferde/" + rule.horse_id + "/kalender?day=" + selectedDate + "&focusRule=" + rule.id;
  const resizedWindow = shiftRangeBoundary(rule.start_at, rule.end_at, directionValue);

  if (!resizedWindow || resizedWindow.startAt.slice(0, 10) !== selectedDate || resizedWindow.endAt.slice(0, 10) !== selectedDate) {
    return errorResult(redirectPath, getAvailabilityPlannerDayError("adjust"));
  }

  const { ranges: existingRanges, error: duplicateRuleError } = await getActiveAvailabilityRanges(input.supabase, rule.horse_id, rule.id);

  if (duplicateRuleError) {
    input.logSupabaseError("Availability planner resize lookup failed", duplicateRuleError);
    return errorResult(redirectPath, getAvailabilityLoadError());
  }

  if (hasWindowConflict([resizedWindow], existingRanges)) {
    return errorResult(redirectPath, getAvailabilityConflictError("update"));
  }

  const { error: slotError } = await input.supabase
    .from("availability_slots")
    .update({
      end_at: resizedWindow.endAt,
      start_at: resizedWindow.startAt
    })
    .eq("id", rule.slot_id)
    .eq("horse_id", rule.horse_id);

  if (slotError) {
    input.logSupabaseError("Availability slot planner resize failed", slotError);
    return errorResult(redirectPath, getAvailabilitySaveError("planner_adjust"));
  }

  const { error: ruleError } = await input.supabase
    .from("availability_rules")
    .update({
      end_at: resizedWindow.endAt,
      start_at: resizedWindow.startAt
    })
    .eq("id", rule.id);

  if (ruleError) {
    input.logSupabaseError("Availability rule planner resize failed", ruleError);

    const { error: rollbackError } = await input.supabase
      .from("availability_slots")
      .update({
        end_at: rule.end_at,
        start_at: rule.start_at
      })
      .eq("id", rule.slot_id)
      .eq("horse_id", rule.horse_id);

    if (rollbackError) {
      input.logSupabaseError("Availability slot planner resize rollback failed", rollbackError);
    }

    return errorResult(redirectPath, getAvailabilitySaveError("planner_adjust"));
  }

  return successResult(redirectPath, getAvailabilitySavedMessage("planner_adjust"), getAvailabilityRevalidationPaths(rule.horse_id));
}

export async function moveAvailabilityRuleForOwner(input: {
  formData: FormData;
  logSupabaseError: LogSupabaseError;
  ownerId: string;
  supabase: SupabaseClient;
}): Promise<CalendarActionResult> {
  const ruleId = asString(input.formData.get("ruleId"));
  const directionValue = asString(input.formData.get("direction"));

  if (!ruleId || !isMoveDirection(directionValue)) {
    return errorResult("/owner/horses", getAvailabilitySaveError("planner_move"));
  }

  const rule = await getOwnedAvailabilityRule(input.supabase, ruleId, input.ownerId);

  if (!rule) {
    return errorResult("/owner/horses", getAvailabilityAccessError("forbidden_move"));
  }

  const selectedDate = rule.start_at.slice(0, 10);
  const redirectPath = "/pferde/" + rule.horse_id + "/kalender?day=" + selectedDate + "&focusRule=" + rule.id;
  const shiftedWindow = shiftWholeRange(rule.start_at, rule.end_at, directionValue);

  if (!shiftedWindow || shiftedWindow.startAt.slice(0, 10) !== selectedDate || shiftedWindow.endAt.slice(0, 10) !== selectedDate) {
    return errorResult(redirectPath, getAvailabilityPlannerDayError("move"));
  }

  const { ranges: existingRanges, error: duplicateRuleError } = await getActiveAvailabilityRanges(input.supabase, rule.horse_id, rule.id);

  if (duplicateRuleError) {
    input.logSupabaseError("Availability planner move lookup failed", duplicateRuleError);
    return errorResult(redirectPath, getAvailabilityLoadError());
  }

  if (hasWindowConflict([shiftedWindow], existingRanges)) {
    return errorResult(redirectPath, getAvailabilityConflictError("update"));
  }

  const { error: slotError } = await input.supabase
    .from("availability_slots")
    .update({
      end_at: shiftedWindow.endAt,
      start_at: shiftedWindow.startAt
    })
    .eq("id", rule.slot_id)
    .eq("horse_id", rule.horse_id);

  if (slotError) {
    input.logSupabaseError("Availability slot planner move failed", slotError);
    return errorResult(redirectPath, getAvailabilitySaveError("planner_move"));
  }

  const { error: ruleError } = await input.supabase
    .from("availability_rules")
    .update({
      end_at: shiftedWindow.endAt,
      start_at: shiftedWindow.startAt
    })
    .eq("id", rule.id);

  if (ruleError) {
    input.logSupabaseError("Availability rule planner move failed", ruleError);

    const { error: rollbackError } = await input.supabase
      .from("availability_slots")
      .update({
        end_at: rule.end_at,
        start_at: rule.start_at
      })
      .eq("id", rule.slot_id)
      .eq("horse_id", rule.horse_id);

    if (rollbackError) {
      input.logSupabaseError("Availability slot planner move rollback failed", rollbackError);
    }

    return errorResult(redirectPath, getAvailabilitySaveError("planner_move"));
  }

  return successResult(redirectPath, getAvailabilitySavedMessage("planner_move"), getAvailabilityRevalidationPaths(rule.horse_id));
}

export async function createCalendarBlockForOwner(input: {
  formData: FormData;
  logSupabaseError: LogSupabaseError;
  ownerId: string;
  supabase: SupabaseClient;
}): Promise<CalendarActionResult> {
  const horseId = asString(input.formData.get("horseId"));

  if (!horseId) {
    return errorResult("/owner/horses", getAvailabilityAccessError("missing_horse"));
  }

  const horse = await getOwnedHorse(input.supabase, horseId, input.ownerId);
  const selectedDate = asString(input.formData.get("selectedDate")) || new Date().toISOString().slice(0, 10);
  const redirectPath = getCalendarRedirectPath(input.formData, horseId, selectedDate, {
    anchor: R1_CORE_MODE ? "kalender-liste" : "kalender-bearbeiten"
  });

  if (!horse) {
    return errorResult("/owner/horses", getCalendarBlockAccessError("forbidden_manage"));
  }

  const startAtValue = asString(input.formData.get("startAt"));
  const endAtValue = asString(input.formData.get("endAt"));
  const blockTitle = asOptionalString(input.formData.get("blockTitle"));
  const startAt = new Date(startAtValue);
  const endAt = new Date(endAtValue);

  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    return errorResult(redirectPath, getCalendarBlockTimeError());
  }

  if (endAt <= startAt) {
    return errorResult(redirectPath, "Das Ende muss nach dem Beginn liegen.");
  }

  if (!isQuarterHourAligned(startAt) || !isQuarterHourAligned(endAt)) {
    return errorResult(redirectPath, getCalendarBlockQuarterHourError());
  }

  const { error } = await input.supabase.from("calendar_blocks").insert({
    end_at: endAt.toISOString(),
    horse_id: horseId,
    start_at: startAt.toISOString(),
    title: blockTitle
  });

  if (error) {
    input.logSupabaseError("Calendar block insert failed", error);
    return errorResult(redirectPath, getCalendarBlockSaveError("create"));
  }

  return successResult(redirectPath, getCalendarBlockSavedMessage("create"), getCalendarBlockRevalidationPaths(horseId));
}

export async function updateCalendarBlockForOwner(input: {
  formData: FormData;
  logSupabaseError: LogSupabaseError;
  ownerId: string;
  supabase: SupabaseClient;
}): Promise<CalendarActionResult> {
  const blockId = asString(input.formData.get("blockId"));

  if (!blockId) {
    return errorResult("/owner/horses", getCalendarBlockAccessError("missing_block"));
  }

  const block = await getOwnedCalendarBlock(input.supabase, blockId, input.ownerId);

  if (!block) {
    return errorResult("/owner/horses", getCalendarBlockAccessError("forbidden_edit"));
  }

  const selectedDate = asString(input.formData.get("selectedDate")) || block.start_at.slice(0, 10);
  const redirectPath = getCalendarRedirectPath(input.formData, block.horse_id, selectedDate, { anchor: "tagesfenster", focusBlockId: block.id });
  const successRedirectPath = getCalendarRedirectPath(input.formData, block.horse_id, selectedDate, { anchor: "kalender-feedback" });
  const startTime = parseClockTime(asString(input.formData.get("startTime")));
  const endTime = parseClockTime(asString(input.formData.get("endTime")));
  const blockTitleValue = input.formData.get("blockTitle");
  const blockTitle = blockTitleValue === null ? block.title ?? null : asOptionalString(blockTitleValue);

  if (!startTime || !endTime) {
    return errorResult(redirectPath, getAvailabilityTimeError());
  }

  const window = buildSingleAvailabilityWindow(selectedDate, startTime, endTime);

  if (!window) {
    return errorResult(redirectPath, getCalendarBlockInvalidWindowError());
  }

  const { error } = await input.supabase
    .from("calendar_blocks")
    .update({
      end_at: window.endAt,
      start_at: window.startAt,
      title: blockTitle
    })
    .eq("id", block.id);

  if (error) {
    input.logSupabaseError("Calendar block update failed", error);
    return errorResult(redirectPath, getCalendarBlockSaveError("update"));
  }

  return successResult(successRedirectPath, getCalendarBlockSavedMessage("update"), getCalendarBlockRevalidationPaths(block.horse_id));
}

export async function resizeCalendarBlockForOwner(input: {
  formData: FormData;
  logSupabaseError: LogSupabaseError;
  ownerId: string;
  supabase: SupabaseClient;
}): Promise<CalendarActionResult> {
  const blockId = asString(input.formData.get("blockId"));
  const directionValue = asString(input.formData.get("direction"));

  if (!blockId || !isResizeDirection(directionValue)) {
    return errorResult("/owner/horses", getCalendarBlockSaveError("planner_adjust"));
  }

  const block = await getOwnedCalendarBlock(input.supabase, blockId, input.ownerId);

  if (!block) {
    return errorResult("/owner/horses", getCalendarBlockAccessError("forbidden_adjust"));
  }

  const selectedDate = block.start_at.slice(0, 10);
  const redirectPath = "/pferde/" + block.horse_id + "/kalender?day=" + selectedDate + "&focusBlock=" + block.id;
  const resizedWindow = shiftRangeBoundary(block.start_at, block.end_at, directionValue);

  if (!resizedWindow || resizedWindow.startAt.slice(0, 10) !== selectedDate || resizedWindow.endAt.slice(0, 10) !== selectedDate) {
    return errorResult(redirectPath, getCalendarBlockPlannerDayError("adjust"));
  }

  const { error } = await input.supabase
    .from("calendar_blocks")
    .update({
      end_at: resizedWindow.endAt,
      start_at: resizedWindow.startAt
    })
    .eq("id", block.id);

  if (error) {
    input.logSupabaseError("Calendar block planner resize failed", error);
    return errorResult(redirectPath, getCalendarBlockSaveError("planner_adjust"));
  }

  return successResult(redirectPath, getCalendarBlockSavedMessage("planner_adjust"), getCalendarBlockRevalidationPaths(block.horse_id));
}

export async function moveCalendarBlockForOwner(input: {
  formData: FormData;
  logSupabaseError: LogSupabaseError;
  ownerId: string;
  supabase: SupabaseClient;
}): Promise<CalendarActionResult> {
  const blockId = asString(input.formData.get("blockId"));
  const directionValue = asString(input.formData.get("direction"));

  if (!blockId || !isMoveDirection(directionValue)) {
    return errorResult("/owner/horses", getCalendarBlockSaveError("planner_move"));
  }

  const block = await getOwnedCalendarBlock(input.supabase, blockId, input.ownerId);

  if (!block) {
    return errorResult("/owner/horses", getCalendarBlockAccessError("forbidden_move"));
  }

  const selectedDate = block.start_at.slice(0, 10);
  const redirectPath = "/pferde/" + block.horse_id + "/kalender?day=" + selectedDate + "&focusBlock=" + block.id;
  const shiftedWindow = shiftWholeRange(block.start_at, block.end_at, directionValue);

  if (!shiftedWindow || shiftedWindow.startAt.slice(0, 10) !== selectedDate || shiftedWindow.endAt.slice(0, 10) !== selectedDate) {
    return errorResult(redirectPath, getCalendarBlockPlannerDayError("move"));
  }

  const { error } = await input.supabase
    .from("calendar_blocks")
    .update({
      end_at: shiftedWindow.endAt,
      start_at: shiftedWindow.startAt
    })
    .eq("id", block.id);

  if (error) {
    input.logSupabaseError("Calendar block planner move failed", error);
    return errorResult(redirectPath, getCalendarBlockSaveError("planner_move"));
  }

  return successResult(redirectPath, getCalendarBlockSavedMessage("planner_move"), getCalendarBlockRevalidationPaths(block.horse_id));
}

export async function deleteCalendarBlockForOwner(input: {
  blockId: string;
  logSupabaseError: LogSupabaseError;
  ownerId: string;
  supabase: SupabaseClient;
}): Promise<CalendarDeleteActionResult> {
  const block = await getOwnedCalendarBlock(input.supabase, input.blockId, input.ownerId);

  if (!block) {
    return {
      message: "Du kannst nur eigene Kalender-Sperren l\u00f6schen.",
      ok: false
    };
  }

  const { error } = await input.supabase.from("calendar_blocks").delete().eq("id", input.blockId);

  if (error) {
    input.logSupabaseError("Calendar block delete failed", error);
    return {
      message: "Die Kalender-Sperre konnte nicht gel\u00f6scht werden.",
      ok: false
    };
  }

  return {
    horseId: block.horse_id,
    ok: true,
    paths: [
      "/pferde/" + block.horse_id + "/kalender",
      "/pferde/" + block.horse_id
    ],
    successMessage: getCalendarBlockSavedMessage("delete")
  };
}

export async function deleteAvailabilityRuleForOwner(input: {
  logSupabaseError: LogSupabaseError;
  ownerId: string;
  ruleId: string;
  supabase: SupabaseClient;
}): Promise<CalendarDeleteActionResult> {
  const rule = await getOwnedAvailabilityRule(input.supabase, input.ruleId, input.ownerId);

  if (!rule) {
    return {
      message: "Du kannst nur eigene Verf\u00fcgbarkeitsfenster l\u00f6schen.",
      ok: false
    };
  }

  const { error } = await input.supabase.from("availability_slots").delete().eq("id", rule.slot_id).eq("horse_id", rule.horse_id);

  if (error) {
    input.logSupabaseError("Availability rule delete failed", error);
    return {
      message: "Das Verf\u00fcgbarkeitsfenster konnte nicht gel\u00f6scht werden.",
      ok: false
    };
  }

  return {
    horseId: rule.horse_id,
    ok: true,
    paths: getAvailabilityRevalidationPaths(rule.horse_id),
    successMessage: "Das Verf\u00fcgbarkeitsfenster wurde entfernt."
  };
}