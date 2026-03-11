import { canApproveRider, getOwnerPlan, getOwnerPlanUsage } from "../plans.ts";
import { isActiveRelationship } from "../relationship-state.ts";
import { APPROVAL_STATUS } from "../statuses.ts";
import type { createClient } from "../supabase/server.ts";
import type { Approval, Profile, TrialRequest } from "../../types/database";
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

type RelationshipMutationResult =
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

function errorResult(redirectPath: string, message: string): RelationshipMutationResult {
  return {
    message,
    ok: false,
    redirectPath
  };
}

function successResult(redirectPath: string, message: string, paths: readonly string[]): RelationshipMutationResult {
  return {
    message,
    ok: true,
    paths,
    redirectPath
  };
}

export function getApprovalTransitionError(requestStatus: "requested" | "accepted" | "declined" | "completed") {
  if (requestStatus !== "completed") {
    return "Nur durchgefuehrte Probetermine koennen freigeschaltet werden.";
  }

  return null;
}

export function getApprovalSavedMessage(nextStatus: "approved" | "revoked") {
  return nextStatus === "approved" ? "Die Reitbeteiligung wurde freigeschaltet." : "Die Freischaltung wurde entzogen.";
}

export function getDeleteRelationshipError(approvalStatus: "approved" | "revoked" | null | undefined) {
  if (isActiveRelationship(approvalStatus)) {
    return null;
  }

  return "Fuer diese Reitbeteiligung gibt es nichts mehr zu loeschen.";
}

export function getRelationshipRevalidationPaths(horseId: string, riderId: string) {
  return [
    "/owner/anfragen",
    "/owner/reitbeteiligungen",
    "/owner/nachrichten",
    "/anfragen",
    "/dashboard",
    "/owner/pferde-verwalten",
    `/pferde/${horseId}`,
    `/pferde/${horseId}/kalender`,
    `/pferde/${horseId}/gruppenchat`,
    `/owner/reiter/${riderId}`
  ] as const;
}

async function getOwnedTrialRequest(supabase: SupabaseClient, requestId: string, ownerId: string) {
  const { data: requestData } = await supabase
    .from("trial_requests")
    .select("id, horse_id, rider_id, status")
    .eq("id", requestId)
    .maybeSingle();

  const request = (requestData as OwnerRequestRecord | null) ?? null;

  if (!request) {
    return null;
  }

  const horse = await getOwnedHorse(supabase, request.horse_id, ownerId);

  if (!horse) {
    return null;
  }

  return request;
}

export async function cleanupRelationshipOperationalData(input: {
  horseId: string;
  logSupabaseError: LogSupabaseError;
  riderId: string;
  supabase: SupabaseClient;
}) {
  const { error: bookingRequestDeleteError } = await input.supabase
    .from("booking_requests")
    .delete()
    .eq("horse_id", input.horseId)
    .eq("rider_id", input.riderId);

  if (bookingRequestDeleteError) {
    input.logSupabaseError("Relationship booking request cleanup failed", bookingRequestDeleteError);
    return "Die operative Kalenderzuordnung konnte nicht bereinigt werden.";
  }

  const { error: riderLimitDeleteError } = await input.supabase
    .from("rider_booking_limits")
    .delete()
    .eq("horse_id", input.horseId)
    .eq("rider_id", input.riderId);

  if (riderLimitDeleteError) {
    input.logSupabaseError("Relationship booking limit cleanup failed", riderLimitDeleteError);
    return "Die operative Kalenderzuordnung konnte nicht bereinigt werden.";
  }

  return null;
}

export async function updateRelationshipApprovalForOwner(input: {
  approvalContext: string;
  logSupabaseError: LogSupabaseError;
  nextStatus: Approval["status"];
  ownerId: string;
  ownerProfile: Profile;
  redirectPath: string;
  requestId: string;
  supabase: SupabaseClient;
}): Promise<RelationshipMutationResult> {
  const request = await getOwnedTrialRequest(input.supabase, input.requestId, input.ownerId);

  if (!request) {
    return errorResult(input.redirectPath, "Die Anfrage konnte nicht gefunden werden.");
  }

  const approvalTransitionError = getApprovalTransitionError(request.status);

  if (approvalTransitionError) {
    return errorResult(input.redirectPath, approvalTransitionError);
  }

  if (input.nextStatus === APPROVAL_STATUS.approved) {
    const { data: currentApprovalData } = await input.supabase
      .from("approvals")
      .select("status")
      .eq("horse_id", request.horse_id)
      .eq("rider_id", request.rider_id)
      .maybeSingle();
    const currentApproval = (currentApprovalData as Pick<Approval, "status"> | null) ?? null;
    const ownerUsage = await getOwnerPlanUsage(input.supabase, input.ownerId);

    if (!canApproveRider(input.ownerProfile, ownerUsage, currentApproval?.status ?? null)) {
      const ownerPlan = getOwnerPlan(input.ownerProfile, ownerUsage);
      const riderLimit = ownerPlan.maxApprovedRiders ?? 0;
      const riderLabel = riderLimit === 1 ? "1 Reitbeteiligung" : `${riderLimit} Reitbeteiligungen`;

      return errorResult(
        input.redirectPath,
        `Im Tarif ${ownerPlan.label} sind ${riderLabel} enthalten. Fuer weitere Freischaltungen brauchst du spaeter den bezahlten Tarif.`
      );
    }
  }

  const { error } = await input.supabase.from("approvals").upsert(
    {
      horse_id: request.horse_id,
      rider_id: request.rider_id,
      status: input.nextStatus
    },
    {
      onConflict: "horse_id,rider_id"
    }
  );

  if (error) {
    input.logSupabaseError("Approval upsert failed", error);
    return errorResult(input.redirectPath, "Die Freischaltung konnte nicht gespeichert werden.");
  }

  if (input.nextStatus === APPROVAL_STATUS.revoked && input.approvalContext === "relationship") {
    const cleanupError = await cleanupRelationshipOperationalData({
      horseId: request.horse_id,
      logSupabaseError: input.logSupabaseError,
      riderId: request.rider_id,
      supabase: input.supabase
    });

    if (cleanupError) {
      return errorResult(input.redirectPath, cleanupError);
    }
  }

  const successMessage = input.nextStatus === APPROVAL_STATUS.revoked && input.approvalContext === "trial"
    ? "Die Reitbeteiligung wurde nicht aufgenommen."
    : getApprovalSavedMessage(input.nextStatus);

  return successResult(input.redirectPath, successMessage, getRelationshipRevalidationPaths(request.horse_id, request.rider_id));
}

export async function removeRelationshipForOwner(input: {
  horseId: string;
  logSupabaseError: LogSupabaseError;
  ownerId: string;
  redirectPath: string;
  riderId: string;
  supabase: SupabaseClient;
}): Promise<RelationshipMutationResult> {
  const horse = await getOwnedHorse(input.supabase, input.horseId, input.ownerId);

  if (!horse) {
    return errorResult(input.redirectPath, "Du kannst nur eigene Reitbeteiligungen loeschen.");
  }

  const { data: approvalData } = await input.supabase
    .from("approvals")
    .select("status")
    .eq("horse_id", input.horseId)
    .eq("rider_id", input.riderId)
    .maybeSingle();
  const approval = (approvalData as Pick<Approval, "status"> | null) ?? null;
  const deleteRelationshipError = getDeleteRelationshipError(approval?.status ?? null);

  if (deleteRelationshipError) {
    return errorResult(input.redirectPath, deleteRelationshipError);
  }

  const { error: approvalSaveError } = await input.supabase.from("approvals").upsert(
    {
      horse_id: input.horseId,
      rider_id: input.riderId,
      status: APPROVAL_STATUS.revoked
    },
    {
      onConflict: "horse_id,rider_id"
    }
  );

  if (approvalSaveError) {
    input.logSupabaseError("Relationship revoke failed", approvalSaveError);
    return errorResult(input.redirectPath, "Die Reitbeteiligung konnte nicht entfernt werden.");
  }

  const cleanupError = await cleanupRelationshipOperationalData({
    horseId: input.horseId,
    logSupabaseError: input.logSupabaseError,
    riderId: input.riderId,
    supabase: input.supabase
  });

  if (cleanupError) {
    return errorResult(input.redirectPath, "Die Reitbeteiligung konnte nicht vollstaendig bereinigt werden.");
  }

  return successResult(input.redirectPath, "Die Reitbeteiligung wurde entfernt.", getRelationshipRevalidationPaths(input.horseId, input.riderId));
}
