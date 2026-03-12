import type { ApprovalStatus, BookingRequestStatus, TrialRequestStatus } from "@/types/database";

export type DisplayableStatus = TrialRequestStatus | ApprovalStatus | BookingRequestStatus;
export type StatusTone = "pending" | "approved" | "rejected" | "info" | "neutral";

// All user-facing workflow states are mapped in one place so badges and labels
// stay consistent across landing, dashboards and detail views.
const statusDisplayMap: Record<DisplayableStatus, { label: string; tone: StatusTone }> = {
  requested: {
    label: "Ausstehend",
    tone: "pending"
  },
  accepted: {
    label: "Angenommen",
    tone: "approved"
  },
  declined: {
    label: "Abgelehnt",
    tone: "rejected"
  },
  completed: {
    label: "Durchgefuehrt",
    tone: "info"
  },
  withdrawn: {
    label: "Zurueckgezogen",
    tone: "neutral"
  },
  approved: {
    label: "Freigeschaltet",
    tone: "approved"
  },
  rejected: {
    label: "Nicht aufgenommen",
    tone: "rejected"
  },
  revoked: {
    label: "Freischaltung entzogen",
    tone: "rejected"
  },
  canceled: {
    label: "Storniert",
    tone: "neutral"
  },
  rescheduled: {
    label: "Umgebucht",
    tone: "info"
  }
};

export function getStatusDisplay(status: DisplayableStatus) {
  return statusDisplayMap[status];
}
