import type { Approval, TrialRequest, UserRole } from "@/types/database";
import { isTrialRequestLifecycleStatus } from "./statuses.ts";

export type RelationshipApprovalStatus = Approval["status"] | null | undefined;
export type RelationshipConversationStage = "active" | "ended" | "inactive" | "trial";
export type RiderRelationshipSection = "active" | "archive" | "in_clarification";

export function getRelationshipKey(horseId: string, riderId: string) {
  return `${horseId}:${riderId}`;
}

export function buildApprovalStatusMap<T extends Pick<Approval, "horse_id" | "rider_id" | "status">>(approvals: readonly T[]) {
  return new Map(approvals.map((approval) => [getRelationshipKey(approval.horse_id, approval.rider_id), approval.status]));
}

export function getApprovalStatusForPair(
  approvalStatusMap: ReadonlyMap<string, Approval["status"]>,
  horseId: string,
  riderId: string
) {
  return approvalStatusMap.get(getRelationshipKey(horseId, riderId)) ?? null;
}

export function isActiveRelationship(approvalStatus: RelationshipApprovalStatus) {
  return approvalStatus === "approved";
}

export function isRevokedRelationship(approvalStatus: RelationshipApprovalStatus) {
  return approvalStatus === "revoked";
}

export function isEndedRelationship(approvalStatus: RelationshipApprovalStatus) {
  return approvalStatus === "ended";
}

export function isRejectedRelationship(approvalStatus: RelationshipApprovalStatus) {
  return approvalStatus === "rejected";
}

export function hasRelationshipDecision(approvalStatus: RelationshipApprovalStatus) {
  return (
    isActiveRelationship(approvalStatus) ||
    isRejectedRelationship(approvalStatus) ||
    isRevokedRelationship(approvalStatus) ||
    isEndedRelationship(approvalStatus)
  );
}

export function shouldShowTrialRequestInLifecycle(
  requestStatus: TrialRequest["status"],
  approvalStatus: RelationshipApprovalStatus
) {
  if (hasRelationshipDecision(approvalStatus)) {
    return false;
  }

  return isTrialRequestLifecycleStatus(requestStatus);
}

export function isCompletedTrialAwaitingDecision(
  requestStatus: TrialRequest["status"] | null | undefined,
  approvalStatus: RelationshipApprovalStatus
) {
  return requestStatus === "completed" && !hasRelationshipDecision(approvalStatus);
}

export function getRiderRelationshipSection(
  requestStatus: TrialRequest["status"] | null | undefined,
  approvalStatus: RelationshipApprovalStatus
): RiderRelationshipSection {
  if (isActiveRelationship(approvalStatus)) {
    return "active";
  }

  if (requestStatus && shouldShowTrialRequestInLifecycle(requestStatus, approvalStatus)) {
    return "in_clarification";
  }

  return "archive";
}

export function canAccessOperationalCalendar(args: {
  approvalStatus: RelationshipApprovalStatus;
  isHorseOwner: boolean;
  viewerRole: UserRole | null | undefined;
}) {
  if (args.isHorseOwner) {
    return true;
  }

  return args.viewerRole === "rider" && isActiveRelationship(args.approvalStatus);
}

export function getRelationshipConversationStage(
  trialRequestStatus: TrialRequest["status"] | null | undefined,
  approvalStatus: RelationshipApprovalStatus
): RelationshipConversationStage {
  if (isActiveRelationship(approvalStatus)) {
    return "active";
  }

  if (isEndedRelationship(approvalStatus)) {
    return "ended";
  }

  if (trialRequestStatus && shouldShowTrialRequestInLifecycle(trialRequestStatus, approvalStatus)) {
    return "trial";
  }

  return "inactive";
}

export function hasVisibleRelationshipConversation(
  trialRequestStatus: TrialRequest["status"] | null | undefined,
  approvalStatus: RelationshipApprovalStatus
) {
  const stage = getRelationshipConversationStage(trialRequestStatus, approvalStatus);

  return stage !== "inactive";
}

export function isRejectedTrialAfterCompletion(
  trialRequestStatus: TrialRequest["status"] | null | undefined,
  approvalStatus: RelationshipApprovalStatus
) {
  return trialRequestStatus === "completed" && isRejectedRelationship(approvalStatus);
}
