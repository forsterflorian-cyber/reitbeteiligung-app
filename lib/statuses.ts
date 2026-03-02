import type { ApprovalStatus, BookingRequestStatus, TrialRequestStatus } from "@/types/database";

export const TRIAL_REQUEST_STATUS = {
  requested: "requested",
  accepted: "accepted",
  declined: "declined",
  completed: "completed"
} as const satisfies Record<TrialRequestStatus, TrialRequestStatus>;

export const APPROVAL_STATUS = {
  approved: "approved",
  revoked: "revoked"
} as const satisfies Record<ApprovalStatus, ApprovalStatus>;

export const BOOKING_REQUEST_STATUS = {
  requested: "requested",
  accepted: "accepted",
  declined: "declined",
  canceled: "canceled"
} as const satisfies Record<BookingRequestStatus, BookingRequestStatus>;

export type MutableTrialRequestStatus = Exclude<TrialRequestStatus, typeof TRIAL_REQUEST_STATUS.requested>;

const mutableTrialRequestStatuses = [
  TRIAL_REQUEST_STATUS.accepted,
  TRIAL_REQUEST_STATUS.declined,
  TRIAL_REQUEST_STATUS.completed
] as const satisfies readonly MutableTrialRequestStatus[];

const approvalStatuses = [APPROVAL_STATUS.approved, APPROVAL_STATUS.revoked] as const satisfies readonly ApprovalStatus[];

const bookingRequestStatuses = [
  BOOKING_REQUEST_STATUS.requested,
  BOOKING_REQUEST_STATUS.accepted,
  BOOKING_REQUEST_STATUS.declined,
  BOOKING_REQUEST_STATUS.canceled
] as const satisfies readonly BookingRequestStatus[];

export function isMutableTrialRequestStatus(value: string): value is MutableTrialRequestStatus {
  return mutableTrialRequestStatuses.includes(value as MutableTrialRequestStatus);
}

export function isApprovalStatus(value: string): value is ApprovalStatus {
  return approvalStatuses.includes(value as ApprovalStatus);
}

export function isBookingRequestStatus(value: string): value is BookingRequestStatus {
  return bookingRequestStatuses.includes(value as BookingRequestStatus);
}
