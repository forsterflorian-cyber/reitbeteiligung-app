import type { Approval, TrialRequest, UserRole } from "@/types/database";

export type RelationshipApprovalStatus = Approval["status"] | null | undefined;
export type RelationshipConversationStage = "active" | "inactive" | "trial";

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

export function hasRelationshipDecision(approvalStatus: RelationshipApprovalStatus) {
  return isActiveRelationship(approvalStatus) || isRevokedRelationship(approvalStatus);
}

export function shouldShowTrialRequestInLifecycle(
  requestStatus: TrialRequest["status"],
  approvalStatus: RelationshipApprovalStatus
) {
  if (hasRelationshipDecision(approvalStatus)) {
    return false;
  }

  return requestStatus === "requested" || requestStatus === "accepted" || requestStatus === "completed";
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

  if (trialRequestStatus && shouldShowTrialRequestInLifecycle(trialRequestStatus, approvalStatus)) {
    return "trial";
  }

  return "inactive";
}

export function hasVisibleRelationshipConversation(
  trialRequestStatus: TrialRequest["status"] | null | undefined,
  approvalStatus: RelationshipApprovalStatus
) {
  return getRelationshipConversationStage(trialRequestStatus, approvalStatus) !== "inactive";
}

export function isRejectedTrialAfterCompletion(
  trialRequestStatus: TrialRequest["status"] | null | undefined,
  approvalStatus: RelationshipApprovalStatus
) {
  return trialRequestStatus === "completed" && isRevokedRelationship(approvalStatus);
}
