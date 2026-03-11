import { asOptionalString, asString } from "../forms";
import { R1_CORE_MODE } from "../release-stage";
import type { createClient } from "../supabase/server";
import { getOwnedHorse } from "./horse";
import {
  buildAvailabilityWindows,
  buildSingleAvailabilityWindow,
  getActiveAvailabilityRanges,
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
  getOwnedCalendarBlock,
  hasWindowConflict,
  isAvailabilityPreset,
  isMoveDirection,
  isQuarterHourAligned,
  isResizeDirection,
  parseClockTime,
  resolveAvailabilityDays,
  shiftRangeBoundary,
  shiftWholeRange,
  type CalendarBookingWindow
} from "./calendar";

type SupabaseClient = ReturnType<typeof createClient>;
type SupabaseErrorLike = {
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  message: string;
};
type LogSupabaseError = (context: string, error: SupabaseErrorLike) => void;

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

export async function createAvailabilityRuleForOwner(input: {
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
    return errorResult("/owner/horses", getAvailabilityAccessError("forbidden_manage"));
  }

  const presetValue = asString(input.formData.get("availabilityPreset"));

  if (!isAvailabilityPreset(presetValue)) {
    return errorResult(redirectPath, "Bitte w\u00e4hle ein g\u00fcltiges Wochenmuster aus.");
  }

  const selectedWeekdays = input.formData
    .getAll("weekday")
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
  const isTrialSlot = input.formData.get("isTrialSlot") === "on";
  const days = resolveAvailabilityDays(presetValue, selectedWeekdays);

  if (days.length === 0) {
    return errorResult(redirectPath, "Bitte w\u00e4hle mindestens einen Wochentag aus.");
  }

  const startTime = parseClockTime(asString(input.formData.get("startTime")));
  const endTime = parseClockTime(asString(input.formData.get("endTime")));

  if (!startTime || !endTime) {
    return errorResult(redirectPath, getAvailabilityTimeError());
  }

  if (endTime.hours < startTime.hours || (endTime.hours === startTime.hours && endTime.minutes <= startTime.minutes)) {
    return errorResult(redirectPath, "Das Ende muss nach dem Beginn liegen.");
  }

  const candidateWindows = buildAvailabilityWindows(days, startTime, endTime);

  if (candidateWindows.length === 0) {
    return errorResult(redirectPath, "Mit dieser Auswahl entstehen in den n\u00e4chsten 8 Wochen keine zuk\u00fcnftigen Zeitfenster.");
  }

  const { ranges: existingRanges, error: existingRulesError } = await getActiveAvailabilityRanges(input.supabase, horseId);

  if (existingRulesError) {
    input.logSupabaseError("Availability rule lookup failed", existingRulesError);
    return errorResult(redirectPath, getAvailabilityLoadError());
  }

  const existingRuleKeys = new Set(existingRanges.map((rule) => rule.start_at + "|" + rule.end_at));
  const windowsToCreate: CalendarBookingWindow[] = [];
  let skippedCount = 0;
  let overlapSkippedCount = 0;

  for (const window of candidateWindows) {
    if (existingRuleKeys.has(window.startAt + "|" + window.endAt)) {
      skippedCount += 1;
      continue;
    }

    if (hasWindowConflict([window], existingRanges)) {
      overlapSkippedCount += 1;
      continue;
    }

    windowsToCreate.push(window);
    existingRanges.push({
      end_at: window.endAt,
      start_at: window.startAt
    });
  }

  if (windowsToCreate.length === 0) {
    if (overlapSkippedCount > 0) {
      return errorResult(redirectPath, "Die neuen Standardzeiten \u00fcberschneiden sich mit bestehenden Verf\u00fcgbarkeiten.");
    }

    return errorResult(redirectPath, "Diese Standardzeiten sind bereits hinterlegt.");
  }

  let createdCount = 0;
  let failedCount = 0;

  for (const window of windowsToCreate) {
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
        input.logSupabaseError("Availability slot insert failed", slotError);
      }

      failedCount += 1;
      continue;
    }

    const slotId = slotData.id;
    const { error } = await input.supabase.from("availability_rules").insert({
      active: true,
      end_at: window.endAt,
      horse_id: horseId,
      is_trial_slot: isTrialSlot,
      slot_id: slotId,
      start_at: window.startAt
    });

    if (error) {
      input.logSupabaseError("Availability rule insert failed", error);
      failedCount += 1;

      const { error: cleanupError } = await input.supabase.from("availability_slots").delete().eq("id", slotId).eq("horse_id", horseId);

      if (cleanupError) {
        input.logSupabaseError("Availability slot cleanup failed", cleanupError);
      }

      continue;
    }

    createdCount += 1;
  }

  if (createdCount === 0) {
    return errorResult(redirectPath, "Die Standardzeiten konnten nicht gespeichert werden.");
  }

  const messageParts = [
    createdCount === 1
      ? "1 Verf\u00fcgbarkeitsfenster wurde gespeichert."
      : createdCount + " Verf\u00fcgbarkeitsfenster wurden gespeichert."
  ];

  if (skippedCount > 0) {
    messageParts.push(
      skippedCount === 1
        ? "1 bereits vorhandenes Fenster wurde \u00fcbersprungen."
        : skippedCount + " bereits vorhandene Fenster wurden \u00fcbersprungen."
    );
  }

  if (overlapSkippedCount > 0) {
    messageParts.push(
      overlapSkippedCount === 1
        ? "1 \u00fcberlappendes Fenster wurde \u00fcbersprungen."
        : overlapSkippedCount + " \u00fcberlappende Fenster wurden \u00fcbersprungen."
    );
  }

  if (failedCount > 0) {
    messageParts.push(
      failedCount === 1
        ? "1 Fenster konnte nicht angelegt werden."
        : failedCount + " Fenster konnten nicht angelegt werden."
    );
  }

  return successResult(
    redirectPath,
    messageParts.join(" "),
    [...getCalendarBlockRevalidationPaths(horseId), "/owner/anfragen", "/anfragen"]
  );
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