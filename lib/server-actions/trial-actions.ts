import { TRIAL_REQUEST_STATUS, type MutableTrialRequestStatus } from "../statuses.ts";
import { getTrialStatusTransitionError } from "./trial.ts";
import type { createClient } from "../supabase/server.ts";
import type { TrialRequest } from "../../types/database";
import { getOwnedHorse } from "./horse.ts";

type SupabaseClient = ReturnType<typeof createClient>;
type SupabaseErrorLike = {
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  message: string;
};
type LogSupabaseError = (context: string, error: SupabaseErrorLike) => void;
type OwnerRequestRecord = Pick<TrialRequest, "id" | "horse_id" | "rider_id" | "status">;

type TrialMutationResult =
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

function errorResult(redirectPath: string, message: string): TrialMutationResult {
  return {
    message,
    ok: false,
    redirectPath
  };
}

function successResult(redirectPath: string, message: string, paths: readonly string[]): TrialMutationResult {
  return {
    message,
    ok: true,
    paths,
    redirectPath
  };
}

function getTrialLifecyclePaths(horseId: string) {
  return [
    "/owner/anfragen",
    "/owner/reitbeteiligungen",
    "/anfragen",
    "/dashboard",
    `/pferde/${horseId}`,
    `/pferde/${horseId}/kalender`
  ] as const;
}

async function getOwnedTrialRequest(supabase: SupabaseClient, requestId: string, ownerId: string) {
  const { data } = await supabase
    .from("trial_requests")
    .select("id, horse_id, rider_id, status")
    .eq("id", requestId)
    .maybeSingle();

  const request = (data as OwnerRequestRecord | null) ?? null;

  if (!request) {
    return null;
  }

  const horse = await getOwnedHorse(supabase, request.horse_id, ownerId);

  if (!horse) {
    return null;
  }

  return request;
}

export async function cancelTrialRequestForRider(input: {
  logSupabaseError: LogSupabaseError;
  requestId: string;
  riderId: string;
  supabase: SupabaseClient;
}): Promise<TrialMutationResult> {
  const redirectPath = "/anfragen";
  const { data } = await input.supabase
    .from("trial_requests")
    .select("id, horse_id, rider_id, status")
    .eq("id", input.requestId)
    .eq("rider_id", input.riderId)
    .maybeSingle();

  const request = (data as OwnerRequestRecord | null) ?? null;

  if (!request) {
    return errorResult(redirectPath, "Die Probeanfrage konnte nicht gefunden werden.");
  }

  if (request.status !== TRIAL_REQUEST_STATUS.requested && request.status !== TRIAL_REQUEST_STATUS.accepted) {
    return errorResult(redirectPath, "Diese Probeanfrage kann nicht mehr zurueckgezogen werden.");
  }

  const { data: cancelSucceeded, error } = await input.supabase.rpc("cancel_rider_trial_request", {
    p_request_id: request.id
  });

  if (error || !cancelSucceeded) {
    if (error) {
      input.logSupabaseError("Trial request cancel failed", error);
    }

    return errorResult(redirectPath, "Die Probeanfrage konnte nicht zurueckgezogen werden.");
  }

  return successResult(redirectPath, "Die Probeanfrage wurde zurueckgezogen.", getTrialLifecyclePaths(request.horse_id));
}

export async function updateTrialRequestStatusForOwner(input: {
  logSupabaseError: LogSupabaseError;
  nextStatus: MutableTrialRequestStatus;
  ownerId: string;
  requestId: string;
  supabase: SupabaseClient;
}): Promise<TrialMutationResult> {
  const redirectPath = "/owner/anfragen";
  const request = await getOwnedTrialRequest(input.supabase, input.requestId, input.ownerId);

  if (!request) {
    return errorResult(redirectPath, "Die Anfrage konnte nicht gefunden werden.");
  }

  const trialStatusTransitionError = getTrialStatusTransitionError(request.status, input.nextStatus);

  if (trialStatusTransitionError) {
    return errorResult(redirectPath, trialStatusTransitionError);
  }

  const { error } = await input.supabase.from("trial_requests").update({ status: input.nextStatus }).eq("id", input.requestId);

  if (error) {
    input.logSupabaseError("Trial request status update failed", error);
    return errorResult(redirectPath, "Der Status konnte nicht aktualisiert werden.");
  }

  return successResult(redirectPath, "Der Status wurde aktualisiert.", getTrialLifecyclePaths(request.horse_id));
}
