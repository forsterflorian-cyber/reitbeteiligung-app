import type { createClient } from "../supabase/server";
import type { AvailabilityRule, CalendarBlock } from "../../types/database";

type CalendarBlockRecord = Pick<CalendarBlock, "id" | "horse_id" | "title" | "start_at" | "end_at" | "created_at">;
type AvailabilityRuleRecord = Pick<AvailabilityRule, "id" | "horse_id" | "slot_id" | "start_at" | "end_at" | "active" | "is_trial_slot" | "created_at">;
type HorseOwnerRecord = { id: string; owner_id: string };

function readString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export function getAvailabilityAccessError(
  reason: "forbidden_adjust" | "forbidden_edit" | "forbidden_manage" | "forbidden_move" | "missing_horse" | "missing_rule"
) {
  switch (reason) {
    case "missing_horse":
      return "Das Pferdeprofil konnte nicht gefunden werden.";
    case "missing_rule":
      return "Das Zeitfenster konnte nicht gefunden werden.";
    case "forbidden_edit":
      return "Du kannst nur eigene Verf\u00fcgbarkeiten bearbeiten.";
    case "forbidden_adjust":
      return "Du kannst nur eigene Verf\u00fcgbarkeiten anpassen.";
    case "forbidden_move":
      return "Du kannst nur eigene Verf\u00fcgbarkeiten verschieben.";
    default:
      return "Du kannst nur eigene Verf\u00fcgbarkeiten verwalten.";
  }
}

export function getAvailabilityTimeError() {
  return "Bitte gib eine g\u00fcltige Uhrzeit an.";
}

export function getAvailabilityInvalidWindowError(kind: "create" | "update") {
  return kind === "create"
    ? "F\u00fcr diesen Tag konnte kein g\u00fcltiges Zeitfenster erstellt werden."
    : "F\u00fcr dieses Zeitfenster konnte kein g\u00fcltiger Zeitraum erstellt werden.";
}

export function getAvailabilityLoadError() {
  return "Die vorhandenen Verf\u00fcgbarkeiten konnten nicht geladen werden.";
}

export function getAvailabilityConflictError(kind: "create" | "update") {
  return kind === "create"
    ? "Dieses Zeitfenster \u00fcberschneidet sich mit einer bestehenden Verf\u00fcgbarkeit."
    : "Ein anderes Zeitfenster \u00fcberschneidet sich bereits mit diesem Zeitraum.";
}

export function getAvailabilityPlannerDayError(action: "adjust" | "move") {
  return action === "adjust"
    ? "Im Planer l\u00e4sst sich das Zeitfenster nur innerhalb dieses Tages anpassen."
    : "Im Planer l\u00e4sst sich das Zeitfenster nur innerhalb dieses Tages verschieben.";
}

export function getAvailabilitySaveError(kind: "create" | "planner_adjust" | "planner_move" | "update") {
  switch (kind) {
    case "create":
      return "Das Tagesfenster konnte nicht gespeichert werden.";
    case "planner_adjust":
      return "Das Zeitfenster konnte nicht im Planer angepasst werden.";
    case "planner_move":
      return "Das Zeitfenster konnte nicht im Planer verschoben werden.";
    default:
      return "Das Zeitfenster konnte nicht aktualisiert werden.";
  }
}

export function getAvailabilitySavedMessage(kind: "create" | "planner_adjust" | "planner_move" | "update") {
  switch (kind) {
    case "create":
      return "Das Tagesfenster wurde gespeichert.";
    case "planner_adjust":
      return "Das Zeitfenster wurde direkt im Planer angepasst.";
    case "planner_move":
      return "Das Zeitfenster wurde direkt im Planer verschoben.";
    default:
      return "Das Zeitfenster wurde aktualisiert.";
  }
}

export function getCalendarBlockAccessError(
  reason:
    | "forbidden_adjust"
    | "forbidden_delete"
    | "forbidden_edit"
    | "forbidden_manage"
    | "forbidden_move"
    | "missing_block"
    | "missing_horse"
) {
  switch (reason) {
    case "missing_horse":
      return "Das Pferdeprofil konnte nicht gefunden werden.";
    case "missing_block":
      return "Die Kalender-Sperre konnte nicht gefunden werden.";
    case "forbidden_edit":
      return "Du kannst nur eigene Kalender-Sperren bearbeiten.";
    case "forbidden_adjust":
      return "Du kannst nur eigene Kalender-Sperren anpassen.";
    case "forbidden_move":
      return "Du kannst nur eigene Kalender-Sperren verschieben.";
    case "forbidden_delete":
      return "Du kannst nur eigene Kalender-Sperren l\u00f6schen.";
    default:
      return "Du kannst nur eigene Kalender-Sperren verwalten.";
  }
}

export function getCalendarBlockTimeError() {
  return "Bitte gib einen g\u00fcltigen Zeitraum an.";
}

export function getCalendarBlockQuarterHourError() {
  return "Bitte nutze f\u00fcr Sperren ein 15-Minuten-Raster.";
}

export function getCalendarBlockInvalidWindowError() {
  return "F\u00fcr diese Sperre konnte kein g\u00fcltiger Zeitraum erstellt werden.";
}

export function getCalendarBlockPlannerDayError(action: "adjust" | "move") {
  return action === "adjust"
    ? "Im Planer l\u00e4sst sich die Sperre nur innerhalb dieses Tages anpassen."
    : "Im Planer l\u00e4sst sich die Sperre nur innerhalb dieses Tages verschieben.";
}

export function getCalendarBlockSaveError(kind: "create" | "delete" | "planner_adjust" | "planner_move" | "update") {
  switch (kind) {
    case "create":
      return "Der Zeitraum konnte nicht als belegt gespeichert werden.";
    case "delete":
      return "Die Kalender-Sperre konnte nicht gel\u00f6scht werden.";
    case "planner_adjust":
      return "Die Kalender-Sperre konnte nicht im Planer angepasst werden.";
    case "planner_move":
      return "Die Kalender-Sperre konnte nicht im Planer verschoben werden.";
    default:
      return "Die Kalender-Sperre konnte nicht aktualisiert werden.";
  }
}

export function getCalendarBlockSavedMessage(kind: "create" | "delete" | "planner_adjust" | "planner_move" | "update") {
  switch (kind) {
    case "create":
      return "Der Zeitraum wurde als belegt gespeichert.";
    case "delete":
      return "Die Kalender-Sperre wurde entfernt.";
    case "planner_adjust":
      return "Die Kalender-Sperre wurde direkt im Planer angepasst.";
    case "planner_move":
      return "Die Kalender-Sperre wurde direkt im Planer verschoben.";
    default:
      return "Die Kalender-Sperre wurde aktualisiert.";
  }
}

export function getAvailabilityRevalidationPaths(horseId: string) {
  return [`/pferde/${horseId}/kalender`, `/pferde/${horseId}`, "/owner/anfragen", "/anfragen"] as const;
}

export function getCalendarBlockRevalidationPaths(horseId: string) {
  return [`/pferde/${horseId}/kalender`, `/pferde/${horseId}`] as const;
}

export function getCalendarRedirectPath(
  formData: FormData,
  horseId: string,
  selectedDate: string,
  options?: {
    anchor?: string;
    focusBlockId?: string;
    focusRuleId?: string;
  }
) {
  const params = new URLSearchParams();
  const weekOffset = readString(formData.get("weekOffset"));
  const monthOffset = readString(formData.get("monthOffset"));
  const mode = readString(formData.get("mode"));
  const range = readString(formData.get("range"));

  if (/^-?\d{1,3}$/.test(weekOffset)) {
    params.set("weekOffset", weekOffset);
  }

  if (/^-?\d{1,3}$/.test(monthOffset)) {
    params.set("monthOffset", monthOffset);
  }

  if (selectedDate) {
    params.set("day", selectedDate);
  }

  if (mode === "edit") {
    params.set("mode", mode);
  }

  if (/^(1|7|30)$/.test(range)) {
    params.set("range", range);
  }

  if (options?.focusRuleId) {
    params.set("focusRule", options.focusRuleId);
  }

  if (options?.focusBlockId) {
    params.set("focusBlock", options.focusBlockId);
  }

  const query = params.toString();
  const hash = options?.anchor ? `#${options.anchor}` : "";
  return `/pferde/${horseId}/kalender${query ? `?${query}` : ""}${hash}`;
}

async function getOwnedHorseRecord(
  supabase: ReturnType<typeof createClient>,
  horseId: string,
  ownerId: string
) {
  const { data } = await supabase
    .from("horses")
    .select("id, owner_id")
    .eq("id", horseId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  return (data as HorseOwnerRecord | null) ?? null;
}

export async function getOwnedCalendarBlock(
  supabase: ReturnType<typeof createClient>,
  blockId: string,
  ownerId: string
) {
  const { data } = await supabase
    .from("calendar_blocks")
    .select("id, horse_id, title, start_at, end_at, created_at")
    .eq("id", blockId)
    .maybeSingle();

  const block = (data as CalendarBlockRecord | null) ?? null;

  if (!block) {
    return null;
  }

  const horse = await getOwnedHorseRecord(supabase, block.horse_id, ownerId);

  if (!horse) {
    return null;
  }

  return block;
}

export async function getOwnedAvailabilityRule(
  supabase: ReturnType<typeof createClient>,
  ruleId: string,
  ownerId: string
) {
  const { data } = await supabase
    .from("availability_rules")
    .select("id, horse_id, slot_id, start_at, end_at, active, is_trial_slot, created_at")
    .eq("id", ruleId)
    .maybeSingle();

  const rule = (data as AvailabilityRuleRecord | null) ?? null;

  if (!rule) {
    return null;
  }

  const horse = await getOwnedHorseRecord(supabase, rule.horse_id, ownerId);

  if (!horse) {
    return null;
  }

  return rule;
}
