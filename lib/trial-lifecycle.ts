import type { Approval, TrialRequest } from "@/types/database";

import { isActiveRelationship as isActiveRelationshipStatus } from "./relationship-state.ts";
import { isRetryableTrialRequestStatus, isTrialRequestLifecycleStatus, isWithdrawnTrialRequestStatus } from "./statuses.ts";

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

export function canRetryTrialRequest(status: TrialRequest["status"] | null | undefined) {
  return isRetryableTrialRequestStatus(status);
}

export function doesTrialRequestBlockNewRequest(status: TrialRequest["status"] | null | undefined) {
  return isTrialRequestLifecycleStatus(status);
}

export function doesTrialRequestReserveTrialSlot(status: TrialRequest["status"] | null | undefined) {
  return isTrialRequestLifecycleStatus(status);
}

export function isWithdrawnTrialRequest(status: TrialRequest["status"] | null | undefined) {
  return isWithdrawnTrialRequestStatus(status);
}

export function isActiveRelationship(approvalStatus: Approval["status"] | null | undefined) {
  return isActiveRelationshipStatus(approvalStatus);
}

export function getRiderTrialRequestStatusMessage(status: TrialRequest["status"]) {
  switch (status) {
    case "requested":
      return "Deine Anfrage ist eingegangen. Der Pferdehalter entscheidet als Naechstes.";
    case "accepted":
      return "Der Probetermin wurde angenommen. Vereinbart jetzt die Durchfuehrung.";
    case "completed":
      return "Der Probetermin wurde als durchgefuehrt markiert. Warte jetzt auf die Freischaltung.";
    case "declined":
      return "Die letzte Anfrage wurde abgelehnt. Du kannst bei Bedarf erneut anfragen.";
    case "withdrawn":
      return "Du hast diese Anfrage zurueckgezogen. Wenn wieder passende Probetermine frei sind, kannst du erneut anfragen.";
  }
}
