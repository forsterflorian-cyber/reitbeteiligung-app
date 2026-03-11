import { MAX_WEEKLY_HOURS_LIMIT, MIN_WEEKLY_HOURS_LIMIT } from "../booking-limits.ts";
import { getApprovalStatus } from "../approvals.ts";
import { isActiveRelationship } from "../relationship-state.ts";
import type { createClient } from "../supabase/server.ts";
import { getOwnedHorse } from "./horse.ts";

type SupabaseClient = ReturnType<typeof createClient>;
type SupabaseErrorLike = {
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  message: string;
};
type LogSupabaseError = (context: string, error: SupabaseErrorLike) => void;

type BookingLimitMutationResult =
  | {
      message: string;
      ok: false;
      redirectPath: string;
    }
  | {
      message: string;
      ok: true;
      paths: readonly string[];
      redirectPath: string;
    };

function errorResult(redirectPath: string, message: string): BookingLimitMutationResult {
  return {
    message,
    ok: false,
    redirectPath
  };
}

function successResult(redirectPath: string, message: string, paths: readonly string[]): BookingLimitMutationResult {
  return {
    message,
    ok: true,
    paths,
    redirectPath
  };
}

function getBookingLimitPaths(horseId: string) {
  return ["/owner/anfragen", "/anfragen", `/pferde/${horseId}`, `/pferde/${horseId}/kalender`] as const;
}

export async function saveRiderBookingLimitForOwner(input: {
  horseId: string;
  logSupabaseError: LogSupabaseError;
  ownerId: string;
  riderId: string;
  supabase: SupabaseClient;
  weeklyHoursLimit: number | null;
  weeklyHoursLimitInput: string;
}): Promise<BookingLimitMutationResult> {
  const redirectPath = "/owner/anfragen";

  if (!input.horseId || !input.riderId) {
    return errorResult(redirectPath, "Das Kontingent konnte nicht zugeordnet werden.");
  }

  const horse = await getOwnedHorse(input.supabase, input.horseId, input.ownerId);

  if (!horse) {
    return errorResult(redirectPath, "Du kannst nur eigene Reitbeteiligungen verwalten.");
  }

  const approvalStatus = await getApprovalStatus(input.horseId, input.riderId, input.supabase);

  if (!isActiveRelationship(approvalStatus)) {
    return errorResult(redirectPath, "Ein Kontingent kannst du erst nach der Freischaltung hinterlegen.");
  }

  if (!input.weeklyHoursLimitInput) {
    const { error } = await input.supabase
      .from("rider_booking_limits")
      .delete()
      .eq("horse_id", input.horseId)
      .eq("rider_id", input.riderId);

    if (error) {
      input.logSupabaseError("Rider booking limit delete failed", error);
      return errorResult(redirectPath, "Das Kontingent konnte nicht entfernt werden.");
    }

    return successResult(redirectPath, "Das Wochenkontingent wurde entfernt.", getBookingLimitPaths(input.horseId));
  }

  if (
    input.weeklyHoursLimit === null ||
    input.weeklyHoursLimit < MIN_WEEKLY_HOURS_LIMIT ||
    input.weeklyHoursLimit > MAX_WEEKLY_HOURS_LIMIT
  ) {
    return errorResult(
      redirectPath,
      `Bitte gib ein Wochenkontingent zwischen ${MIN_WEEKLY_HOURS_LIMIT} und ${MAX_WEEKLY_HOURS_LIMIT} Stunden an.`
    );
  }

  const { error } = await input.supabase.from("rider_booking_limits").upsert(
    {
      horse_id: input.horseId,
      rider_id: input.riderId,
      updated_at: new Date().toISOString(),
      weekly_hours_limit: input.weeklyHoursLimit
    },
    {
      onConflict: "horse_id,rider_id"
    }
  );

  if (error) {
    input.logSupabaseError("Rider booking limit upsert failed", error);
    return errorResult(redirectPath, "Das Wochenkontingent konnte nicht gespeichert werden.");
  }

  return successResult(redirectPath, "Das Wochenkontingent wurde gespeichert.", getBookingLimitPaths(input.horseId));
}
