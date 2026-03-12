import type { ApprovalStatus, BookingRequestStatus, TrialRequestStatus } from "@/types/database";

export const TRIAL_REQUEST_STATUS = {
  requested: "requested",
  accepted: "accepted",
  declined: "declined",
  completed: "completed",
  withdrawn: "withdrawn"
} as const satisfies Record<TrialRequestStatus, TrialRequestStatus>;

export const APPROVAL_STATUS = {
  approved: "approved",
  rejected: "rejected",
  revoked: "revoked"
} as const satisfies Record<ApprovalStatus, ApprovalStatus>;

export const BOOKING_REQUEST_STATUS = {
  requested: "requested",
  accepted: "accepted",
  declined: "declined",
  canceled: "canceled",
  rescheduled: "rescheduled"
} as const satisfies Record<BookingRequestStatus, BookingRequestStatus>;

export type MutableTrialRequestStatus =
  | typeof TRIAL_REQUEST_STATUS.accepted
  | typeof TRIAL_REQUEST_STATUS.declined
  | typeof TRIAL_REQUEST_STATUS.completed;

const mutableTrialRequestStatuses = [
  TRIAL_REQUEST_STATUS.accepted,
  TRIAL_REQUEST_STATUS.declined,
  TRIAL_REQUEST_STATUS.completed
] as const satisfies readonly MutableTrialRequestStatus[];

const trialRequestLifecycleStatuses = [
  TRIAL_REQUEST_STATUS.requested,
  TRIAL_REQUEST_STATUS.accepted,
  TRIAL_REQUEST_STATUS.completed
] as const satisfies readonly TrialRequestStatus[];

const retryableTrialRequestStatuses = [
  TRIAL_REQUEST_STATUS.declined,
  TRIAL_REQUEST_STATUS.withdrawn
] as const satisfies readonly TrialRequestStatus[];

export type OwnerTrialDecisionStatus = typeof APPROVAL_STATUS.approved | typeof APPROVAL_STATUS.rejected;

const approvalStatuses = [
  APPROVAL_STATUS.approved,
  APPROVAL_STATUS.rejected,
  APPROVAL_STATUS.revoked
] as const satisfies readonly ApprovalStatus[];
const ownerTrialDecisionStatuses = [
  APPROVAL_STATUS.approved,
  APPROVAL_STATUS.rejected
] as const satisfies readonly OwnerTrialDecisionStatus[];

const bookingRequestStatuses = [
  BOOKING_REQUEST_STATUS.requested,
  BOOKING_REQUEST_STATUS.accepted,
  BOOKING_REQUEST_STATUS.declined,
  BOOKING_REQUEST_STATUS.canceled,
  BOOKING_REQUEST_STATUS.rescheduled
] as const satisfies readonly BookingRequestStatus[];

export function isMutableTrialRequestStatus(value: string): value is MutableTrialRequestStatus {
  return mutableTrialRequestStatuses.includes(value as MutableTrialRequestStatus);
}

export function isTrialRequestLifecycleStatus(value: TrialRequestStatus | null | undefined): value is TrialRequestStatus {
  return value ? (trialRequestLifecycleStatuses as readonly TrialRequestStatus[]).includes(value) : false;
}

export function isRetryableTrialRequestStatus(value: TrialRequestStatus | null | undefined): value is TrialRequestStatus {
  return value ? (retryableTrialRequestStatuses as readonly TrialRequestStatus[]).includes(value) : false;
}

export function isWithdrawnTrialRequestStatus(value: TrialRequestStatus | null | undefined): value is TrialRequestStatus {
  return value === TRIAL_REQUEST_STATUS.withdrawn;
}

export function isApprovalStatus(value: string): value is ApprovalStatus {
  return approvalStatuses.includes(value as ApprovalStatus);
}

export function isOwnerTrialDecisionStatus(value: string): value is OwnerTrialDecisionStatus {
  return ownerTrialDecisionStatuses.includes(value as OwnerTrialDecisionStatus);
}

export function isBookingRequestStatus(value: string): value is BookingRequestStatus {
  return bookingRequestStatuses.includes(value as BookingRequestStatus);
}
