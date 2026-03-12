import { canApproveRider, getOwnerPlan, getOwnerPlanUsage } from "../plans.ts";
import { isActiveRelationship } from "../relationship-state.ts";
import { APPROVAL_STATUS, BOOKING_REQUEST_STATUS, type OwnerTrialDecisionStatus } from "../statuses.ts";
import type { createClient } from "../supabase/server.ts";
import type { Approval, Booking, BookingRequest, Profile, TrialRequest } from "../../types/database";
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
type RelationshipBookingRecord = Pick<Booking, "id" | "booking_request_id" | "end_at">;
type RelationshipBookingRequestRecord = Pick<BookingRequest, "id" | "status" | "requested_end_at">;

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

export function getApprovalTransitionError(requestStatus: "requested" | "accepted" | "declined" | "completed" | "withdrawn") {
  if (requestStatus !== "completed") {
    return "Nur durchgefuehrte Probetermine koennen entschieden werden.";
  }

  return null;
}

export function getApprovalSavedMessage(nextStatus: Approval["status"]) {
  switch (nextStatus) {
    case "approved":
      return "Die Reitbeteiligung wurde freigeschaltet.";
    case "rejected":
      return "Die Reitbeteiligung wurde nicht aufgenommen.";
    case "revoked":
      return "Die Freischaltung wurde entzogen.";
  }
}

export function getDeleteRelationshipError(approvalStatus: Approval["status"] | null | undefined) {
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
    "/nachrichten",
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

function isFutureRelationshipBooking(endAt: string | null | undefined, now: Date) {
  if (!endAt) {
    return false;
  }

  const parsedEndAt = new Date(endAt);

  if (Number.isNaN(parsedEndAt.getTime())) {
    return false;
  }

  return parsedEndAt.getTime() > now.getTime();
}

function getRelationshipCleanupBookingRequestStatus(
  request: RelationshipBookingRequestRecord,
  futureBookingRequestIds: ReadonlySet<string>,
  now: Date
) {
  if (request.status === BOOKING_REQUEST_STATUS.requested) {
    return BOOKING_REQUEST_STATUS.declined;
  }

  if (
    request.status === BOOKING_REQUEST_STATUS.accepted &&
    (futureBookingRequestIds.has(request.id) || isFutureRelationshipBooking(request.requested_end_at ?? null, now))
  ) {
    return BOOKING_REQUEST_STATUS.canceled;
  }

  return null;
}

export async function cleanupRelationshipOperationalData(input: {
  horseId: string;
  logSupabaseError: LogSupabaseError;
  riderId: string;
  supabase: SupabaseClient;
}) {
  const now = new Date();
  const [{ data: bookingData }, { data: bookingRequestData }] = await Promise.all([
    input.supabase.from("bookings").select("id, booking_request_id, end_at").eq("horse_id", input.horseId).eq("rider_id", input.riderId),
    input.supabase
      .from("booking_requests")
      .select("id, status, requested_end_at")
      .eq("horse_id", input.horseId)
      .eq("rider_id", input.riderId)
  ]);
  const bookings = (bookingData as RelationshipBookingRecord[] | null) ?? [];
  const bookingRequests = (bookingRequestData as RelationshipBookingRequestRecord[] | null) ?? [];
  const futureBookings = bookings.filter((booking) => isFutureRelationshipBooking(booking.end_at, now));
  const futureBookingRequestIds = new Set(futureBookings.map((booking) => booking.booking_request_id));

  for (const booking of futureBookings) {
    const { error: bookingDeleteError } = await input.supabase.from("bookings").delete().eq("id", booking.id);

    if (bookingDeleteError) {
      input.logSupabaseError("Relationship booking cleanup failed", bookingDeleteError);
      return "Die operative Kalenderzuordnung konnte nicht bereinigt werden.";
    }
  }

  for (const request of bookingRequests) {
    const nextStatus = getRelationshipCleanupBookingRequestStatus(request, futureBookingRequestIds, now);

    if (!nextStatus || nextStatus === request.status) {
      continue;
    }

    const { error: bookingRequestUpdateError } = await input.supabase
      .from("booking_requests")
      .update({ status: nextStatus })
      .eq("id", request.id);

    if (bookingRequestUpdateError) {
      input.logSupabaseError("Relationship booking request cleanup failed", bookingRequestUpdateError);
      return "Die operative Kalenderzuordnung konnte nicht bereinigt werden.";
    }
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
  logSupabaseError: LogSupabaseError;
  nextStatus: OwnerTrialDecisionStatus;
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

  return successResult(
    input.redirectPath,
    getApprovalSavedMessage(input.nextStatus),
    getRelationshipRevalidationPaths(request.horse_id, request.rider_id)
  );
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
