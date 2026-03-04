import { getAvailabilityRevalidationPaths, getCalendarBlockSavedMessage, getOwnedAvailabilityRule, getOwnedCalendarBlock } from "./calendar";
import type { createClient } from "../supabase/server";

type SupabaseClient = ReturnType<typeof createClient>;
type SupabaseErrorLike = {
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  message: string;
};
type LogSupabaseError = (context: string, error: SupabaseErrorLike) => void;

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
      `/pferde/${block.horse_id}/kalender`,
      `/pferde/${block.horse_id}`
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