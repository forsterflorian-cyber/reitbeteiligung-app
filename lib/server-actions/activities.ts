"use server";

import { emitDomainEvent } from "@/lib/domain-events";
import { asOptionalString, asString } from "@/lib/forms";
import { redirectWithFlash } from "@/lib/server-flash";
import { createClient } from "@/lib/supabase/server";
import type { HorseDailyActivity, HorseDailyActivityType } from "@/types/database";

const ALLOWED_ACTIVITY_TYPES: HorseDailyActivityType[] = [
  "ride",
  "groundwork",
  "hack",
  "lunge",
  "free_movement",
  "care",
  "other"
];

function isActivityType(value: string): value is HorseDailyActivityType {
  return (ALLOWED_ACTIVITY_TYPES as string[]).includes(value);
}

export async function logHorseActivityAction(formData: FormData): Promise<void> {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const horseId = asString(formData.get("horse_id"));
  const activityTypeRaw = asString(formData.get("activity_type"));
  const activityDate = asString(formData.get("activity_date"));
  const activityTime = asOptionalString(formData.get("activity_time"));
  const commentRaw = asOptionalString(formData.get("comment"));
  const comment = commentRaw?.trim() ? commentRaw.trim() : null;

  const returnPath = horseId ? `/pferde/${horseId}` : "/dashboard";

  if (!user) {
    redirectWithFlash(returnPath, "error", "Nicht angemeldet.");
  }

  if (!horseId) {
    redirectWithFlash(returnPath, "error", "Pferd fehlt.");
  }

  if (!isActivityType(activityTypeRaw)) {
    redirectWithFlash(returnPath, "error", "Ungültiger Aktivitätstyp.");
  }

  if (!activityDate || !/^\d{4}-\d{2}-\d{2}$/.test(activityDate)) {
    redirectWithFlash(returnPath, "error", "Datum fehlt oder ist ungültig.");
  }

  const { data: insertData, error: insertError } = await supabase
    .from("horse_daily_activities")
    .insert({
      horse_id: horseId,
      user_id: user!.id,
      activity_type: activityTypeRaw,
      activity_date: activityDate,
      activity_time: activityTime ?? null,
      comment,
      status: "active"
    })
    .select("id, horse_id, user_id, activity_type, activity_date")
    .single();

  if (insertError || !insertData) {
    redirectWithFlash(returnPath, "error", "Aktivität konnte nicht gespeichert werden.");
  }

  const inserted = insertData as Pick<
    HorseDailyActivity,
    "id" | "horse_id" | "user_id" | "activity_type" | "activity_date"
  >;

  // Domain event — non-blocking side effect.
  await emitDomainEvent(supabase, {
    event_type: "horse_activity_logged",
    horse_id: inserted.horse_id,
    rider_id: user!.id,
    payload: {
      activity_id: inserted.id,
      activity_type: inserted.activity_type,
      activity_date: inserted.activity_date,
      user_id: inserted.user_id
    }
  });

  redirectWithFlash(returnPath, "success", "Aktivität wurde eingetragen.");
}

export async function correctHorseActivityAction(formData: FormData): Promise<void> {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const activityId = asString(formData.get("activity_id"));

  if (!user) {
    redirectWithFlash("/dashboard", "error", "Nicht angemeldet.");
  }

  if (!activityId) {
    redirectWithFlash("/dashboard", "error", "Aktivität fehlt.");
  }

  // Load the row to validate ownership and current status before updating.
  const { data: existingData, error: loadError } = await supabase
    .from("horse_daily_activities")
    .select("id, horse_id, user_id, status")
    .eq("id", activityId)
    .maybeSingle();

  if (loadError || !existingData) {
    redirectWithFlash("/dashboard", "error", "Aktivität nicht gefunden.");
  }

  const existing = existingData as Pick<
    HorseDailyActivity,
    "id" | "horse_id" | "user_id" | "status"
  >;

  const returnPath = `/pferde/${existing.horse_id}`;

  if (existing.user_id !== user!.id) {
    redirectWithFlash(returnPath, "error", "Du kannst nur eigene Aktivitäten korrigieren.");
  }

  if (existing.status !== "active") {
    redirectWithFlash(returnPath, "error", "Diese Aktivität wurde bereits korrigiert.");
  }

  const { error: updateError } = await supabase
    .from("horse_daily_activities")
    .update({
      status: "corrected",
      updated_at: new Date().toISOString()
    })
    .eq("id", activityId)
    .eq("user_id", user!.id)
    .eq("status", "active");

  if (updateError) {
    redirectWithFlash(returnPath, "error", "Aktivität konnte nicht korrigiert werden.");
  }

  redirectWithFlash(returnPath, "success", "Aktivität als korrigiert markiert.");
}
