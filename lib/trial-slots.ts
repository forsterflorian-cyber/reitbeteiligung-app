import type { AvailabilityRule, TrialRequest } from "@/types/database";
import { doesTrialRequestReserveTrialSlot } from "./trial-lifecycle.ts";

type TrialSlotRule = Pick<AvailabilityRule, "id" | "active" | "start_at" | "end_at" | "is_trial_slot">;
type TrialReservation = Pick<TrialRequest, "availability_rule_id" | "requested_start_at" | "requested_end_at" | "status">;
type TimeRange = {
  start_at: string;
  end_at: string;
};

export type TrialSlot = {
  availabilityRuleId: string;
  endAt: string;
  startAt: string;
};

export function trialRangesOverlap(
  leftStartAt: string,
  leftEndAt: string,
  rightStartAt: string,
  rightEndAt: string
) {
  return leftStartAt < rightEndAt && leftEndAt > rightStartAt;
}

export function isTrialRuleBlocked(
  rule: TrialSlotRule,
  occupiedRanges: TimeRange[],
  reservedRequests: TrialReservation[]
) {
  const hasOccupiedOverlap = occupiedRanges.some((range) =>
    trialRangesOverlap(rule.start_at, rule.end_at, range.start_at, range.end_at)
  );

  if (hasOccupiedOverlap) {
    return true;
  }

  const matchingReservation = reservedRequests.some((request) => {
    if (!doesTrialRequestReserveTrialSlot(request.status)) {
      return false;
    }

    if (request.availability_rule_id && request.availability_rule_id === rule.id) {
      return true;
    }

    if (!request.requested_start_at || !request.requested_end_at) {
      return false;
    }

    return trialRangesOverlap(rule.start_at, rule.end_at, request.requested_start_at, request.requested_end_at);
  });

  return matchingReservation;
}

export function getUpcomingTrialSlots({
  limit = 10,
  now = new Date(),
  occupiedRanges,
  reservedRequests,
  rules
}: {
  limit?: number;
  now?: Date;
  occupiedRanges: TimeRange[];
  reservedRequests: TrialReservation[];
  rules: TrialSlotRule[];
}) {
  return rules
    .filter((rule) => rule.active && rule.is_trial_slot === true)
    .filter((rule) => new Date(rule.end_at).getTime() > now.getTime())
    .sort((left, right) => new Date(left.start_at).getTime() - new Date(right.start_at).getTime())
    .filter((rule) => !isTrialRuleBlocked(rule, occupiedRanges, reservedRequests))
    .slice(0, limit)
    .map(
      (rule) =>
        ({
          availabilityRuleId: rule.id,
          endAt: rule.end_at,
          startAt: rule.start_at
        }) satisfies TrialSlot
    );
}
