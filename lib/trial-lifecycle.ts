import type { Approval, TrialRequest } from "@/types/database";

import { isActiveRelationship as isActiveRelationshipStatus } from "./relationship-state.ts";

export function canCancelTrialRequest(status: TrialRequest["status"]) {
  return status === "requested" || status === "accepted";
}

export function canAcceptTrialRequest(status: TrialRequest["status"]) {
  return status === "requested";
}

export function canCompleteTrialRequest(status: TrialRequest["status"]) {
  return status === "accepted";
}

export function canApproveTrialRequest(status: TrialRequest["status"]) {
  return status === "completed";
}

export function isActiveRelationship(approvalStatus: Approval["status"] | null | undefined) {
  return isActiveRelationshipStatus(approvalStatus);
}
