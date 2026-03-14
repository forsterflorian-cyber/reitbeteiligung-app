import { getUpcomingOperationalSlots, splitAvailabilityRulesByPhase } from "./operational-slots.ts";
import type { AvailabilityRule } from "@/types/database";

type OperationalWeekOccupancyRow = {
  end_at: string;
  source: "booking" | "block" | string;
  start_at: string;
};

export type OperationalWeekEntryKind = "available" | "block" | "booking";

export type OperationalWeekEntry = {
  endAt: string;
  key: string;
  kind: OperationalWeekEntryKind;
  startAt: string;
};

export type OperationalWeekDay = {
  dayKey: string;
  entries: OperationalWeekEntry[];
  isToday: boolean;
};

function dayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function dayEnd(date: Date) {
  const start = dayStart(date);
  return addOperationalWeekDays(start, 1);
}

function overlapsDay(startAt: string, endAt: string, dayDate: Date) {
  const rangeStart = new Date(startAt).getTime();
  const rangeEnd = new Date(endAt).getTime();
  const dayRangeStart = dayStart(dayDate).getTime();
  const dayRangeEnd = dayEnd(dayDate).getTime();

  return rangeStart < dayRangeEnd && rangeEnd > dayRangeStart;
}

function isWithinWeek(startAt: string, endAt: string, weekStart: Date, weekEnd: Date) {
  const rangeStart = new Date(startAt).getTime();
  const rangeEnd = new Date(endAt).getTime();
  return rangeStart < weekEnd.getTime() && rangeEnd > weekStart.getTime();
}

function sortOperationalWeekEntries(left: OperationalWeekEntry, right: OperationalWeekEntry) {
  const leftStart = new Date(left.startAt).getTime();
  const rightStart = new Date(right.startAt).getTime();

  if (leftStart !== rightStart) {
    return leftStart - rightStart;
  }

  const order: Record<OperationalWeekEntryKind, number> = {
    booking: 0,
    block: 1,
    available: 2
  };

  return order[left.kind] - order[right.kind];
}

export function toOperationalWeekDayKey(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function startOfOperationalWeek(date: Date) {
  const start = dayStart(date);
  const weekday = start.getDay();
  const delta = weekday === 0 ? -6 : 1 - weekday;
  return addOperationalWeekDays(start, delta);
}

export function addOperationalWeekDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 0, 0, 0, 0);
}

export function parseOperationalWeekOffset(value: string | null) {
  if (!value || !/^-?\d{1,3}$/.test(value)) {
    return 0;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : 0;
}

export function buildOperationalWeekDays({
  now = new Date(),
  occupancy,
  rules,
  weekOffset = 0
}: {
  now?: Date;
  occupancy: OperationalWeekOccupancyRow[];
  rules: AvailabilityRule[];
  weekOffset?: number;
}) {
  const { operationalRules } = splitAvailabilityRulesByPhase(rules);
  const currentWeekStart = startOfOperationalWeek(now);
  const weekStart = addOperationalWeekDays(currentWeekStart, weekOffset * 7);
  const weekEnd = addOperationalWeekDays(weekStart, 7);
  const availableEntries = getUpcomingOperationalSlots({
    limit: operationalRules.length,
    now: weekOffset === 0 ? now : weekStart,
    occupiedRanges: occupancy,
    rules: operationalRules
  })
    .filter((slot) => isWithinWeek(slot.startAt, slot.endAt, weekStart, weekEnd))
    .map(
      (slot) =>
        ({
          endAt: slot.endAt,
          key: `available:${slot.availabilityRuleId}:${slot.startAt}`,
          kind: "available",
          startAt: slot.startAt
        }) satisfies OperationalWeekEntry
    );
  const occupancyEntries = occupancy
    .filter((entry) => isWithinWeek(entry.start_at, entry.end_at, weekStart, weekEnd))
    .map(
      (entry, index) =>
        ({
          endAt: entry.end_at,
          key: `${entry.source}:${entry.start_at}:${entry.end_at}:${index}`,
          kind: entry.source === "block" ? "block" : "booking",
          startAt: entry.start_at
        }) satisfies OperationalWeekEntry
    );
  const todayKey = toOperationalWeekDayKey(now);

  return Array.from({ length: 7 }, (_, index) => {
    const dayDate = addOperationalWeekDays(weekStart, index);
    const dayKey = toOperationalWeekDayKey(dayDate);
    const entries = [...availableEntries, ...occupancyEntries]
      .filter((entry) => overlapsDay(entry.startAt, entry.endAt, dayDate))
      .sort(sortOperationalWeekEntries);

    return {
      dayKey,
      entries,
      isToday: dayKey === todayKey
    } satisfies OperationalWeekDay;
  });
}
