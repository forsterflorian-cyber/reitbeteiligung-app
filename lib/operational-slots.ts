import type { AvailabilityRule } from "@/types/database";

type OperationalSlotRule = Pick<AvailabilityRule, "id" | "active" | "start_at" | "end_at" | "is_trial_slot">;
type TimeRange = {
  end_at: string;
  start_at: string;
};

export type OperationalSlot = {
  availabilityRuleId: string;
  endAt: string;
  startAt: string;
};

export function isTrialAvailabilityRule<T extends Pick<AvailabilityRule, "is_trial_slot">>(rule: T) {
  return rule.is_trial_slot === true;
}

export function isOperationalAvailabilityRule<T extends Pick<AvailabilityRule, "is_trial_slot">>(rule: T) {
  return !isTrialAvailabilityRule(rule);
}

export function splitAvailabilityRulesByPhase<T extends Pick<AvailabilityRule, "is_trial_slot">>(rules: readonly T[]) {
  return {
    operationalRules: rules.filter((rule) => isOperationalAvailabilityRule(rule)),
    trialRules: rules.filter((rule) => isTrialAvailabilityRule(rule))
  };
}

export function operationalRangesOverlap(
  leftStartAt: string,
  leftEndAt: string,
  rightStartAt: string,
  rightEndAt: string
) {
  return new Date(leftStartAt).getTime() < new Date(rightEndAt).getTime() && new Date(leftEndAt).getTime() > new Date(rightStartAt).getTime();
}

export function isOperationalRuleBlocked(rule: OperationalSlotRule, occupiedRanges: TimeRange[]) {
  return occupiedRanges.some((range) => operationalRangesOverlap(rule.start_at, rule.end_at, range.start_at, range.end_at));
}

export function excludeOperationalRange<T extends TimeRange>(occupiedRanges: readonly T[], excludedRange: TimeRange | null | undefined) {
  if (!excludedRange) {
    return [...occupiedRanges];
  }

  return occupiedRanges.filter(
    (range) => !(range.start_at === excludedRange.start_at && range.end_at === excludedRange.end_at)
  );
}

export function getUpcomingOperationalSlots({
  disallowedRange = null,
  excludedRange = null,
  limit = 12,
  now = new Date(),
  occupiedRanges,
  rules
}: {
  disallowedRange?: TimeRange | null;
  excludedRange?: TimeRange | null;
  limit?: number;
  now?: Date;
  occupiedRanges: TimeRange[];
  rules: OperationalSlotRule[];
}) {
  const effectiveOccupiedRanges = excludeOperationalRange(occupiedRanges, excludedRange);

  return rules
    .filter((rule) => rule.active && isOperationalAvailabilityRule(rule))
    .filter((rule) => new Date(rule.start_at).getTime() > now.getTime())
    .filter((rule) => !disallowedRange || rule.start_at !== disallowedRange.start_at || rule.end_at !== disallowedRange.end_at)
    .sort((left, right) => new Date(left.start_at).getTime() - new Date(right.start_at).getTime())
    .filter((rule) => !isOperationalRuleBlocked(rule, effectiveOccupiedRanges))
    .slice(0, limit)
    .map(
      (rule) =>
        ({
          availabilityRuleId: rule.id,
          endAt: rule.end_at,
          startAt: rule.start_at
        }) satisfies OperationalSlot
    );
}
