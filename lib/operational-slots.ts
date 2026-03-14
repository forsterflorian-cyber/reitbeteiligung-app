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

const FIFTEEN_MIN_MS = 15 * 60 * 1000;

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

/**
 * Merges overlapping or adjacent occupied ranges into a sorted, non-overlapping list.
 * Input ranges may be in any order and may overlap.
 */
export function mergeOccupiedRanges(ranges: readonly TimeRange[]): TimeRange[] {
  if (ranges.length === 0) return [];

  const sorted = [...ranges].sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
  );

  const merged: TimeRange[] = [{ ...sorted[0]! }];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]!;
    const last = merged[merged.length - 1]!;
    const currentStart = new Date(current.start_at).getTime();
    const lastEnd = new Date(last.end_at).getTime();

    if (currentStart <= lastEnd) {
      const currentEnd = new Date(current.end_at).getTime();
      if (currentEnd > lastEnd) {
        last.end_at = current.end_at;
      }
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

/**
 * Subtracts occupied ranges from a single operational slot and returns the remaining
 * free segments, snapped to 15-minute boundaries and filtered to >= 15 minutes.
 *
 * @param rule - The operational slot rule defining the slot's full [start, end) range.
 * @param mergedOccupied - Pre-merged, sorted occupied ranges (from mergeOccupiedRanges).
 */
export function subtractOccupiedFromSlot(
  rule: OperationalSlotRule,
  mergedOccupied: readonly TimeRange[]
): OperationalSlot[] {
  const slotStart = new Date(rule.start_at).getTime();
  const slotEnd = new Date(rule.end_at).getTime();

  const freeSegments: Array<{ start: number; end: number }> = [];
  let cursor = slotStart;

  for (const occupied of mergedOccupied) {
    const occStart = Math.max(new Date(occupied.start_at).getTime(), slotStart);
    const occEnd = Math.min(new Date(occupied.end_at).getTime(), slotEnd);

    if (occStart >= occEnd) continue; // no actual overlap with this slot

    if (cursor < occStart) {
      freeSegments.push({ start: cursor, end: occStart });
    }
    cursor = Math.max(cursor, occEnd);
  }

  if (cursor < slotEnd) {
    freeSegments.push({ start: cursor, end: slotEnd });
  }

  return freeSegments
    .map((seg) => ({
      start: Math.ceil(seg.start / FIFTEEN_MIN_MS) * FIFTEEN_MIN_MS,
      end: Math.floor(seg.end / FIFTEEN_MIN_MS) * FIFTEEN_MIN_MS
    }))
    .filter((seg) => seg.end - seg.start >= FIFTEEN_MIN_MS)
    .map((seg) => ({
      availabilityRuleId: rule.id,
      endAt: new Date(seg.end).toISOString(),
      startAt: new Date(seg.start).toISOString()
    } satisfies OperationalSlot));
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
  const mergedOccupied = mergeOccupiedRanges(effectiveOccupiedRanges);

  return rules
    .filter((rule) => rule.active && isOperationalAvailabilityRule(rule))
    .filter((rule) => new Date(rule.start_at).getTime() > now.getTime())
    .filter((rule) => !disallowedRange || rule.start_at !== disallowedRange.start_at || rule.end_at !== disallowedRange.end_at)
    .sort((left, right) => new Date(left.start_at).getTime() - new Date(right.start_at).getTime())
    .flatMap((rule) => subtractOccupiedFromSlot(rule, mergedOccupied))
    .slice(0, limit);
}
