import assert from "node:assert/strict";
import test from "node:test";

import { buildOperationalWeekDays, parseOperationalWeekOffset } from "../lib/operational-week.ts";

test("Wochenlogik startet montags und verschiebt die Ansicht sauber in Wochenschritten", () => {
  assert.equal(parseOperationalWeekOffset(null), 0);
  assert.equal(parseOperationalWeekOffset("2"), 2);
  assert.equal(parseOperationalWeekOffset("x"), 0);

  const currentWeek = buildOperationalWeekDays({
    now: new Date("2026-03-12T10:00:00.000Z"),
    occupancy: [],
    rules: [],
    weekOffset: 0
  });
  const nextWeek = buildOperationalWeekDays({
    now: new Date("2026-03-12T10:00:00.000Z"),
    occupancy: [],
    rules: [],
    weekOffset: 1
  });

  assert.deepEqual(
    currentWeek.map((day) => day.dayKey),
    ["2026-03-09", "2026-03-10", "2026-03-11", "2026-03-12", "2026-03-13", "2026-03-14", "2026-03-15"]
  );
  assert.deepEqual(
    nextWeek.map((day) => day.dayKey),
    ["2026-03-16", "2026-03-17", "2026-03-18", "2026-03-19", "2026-03-20", "2026-03-21", "2026-03-22"]
  );
});

test("Wochenansicht nutzt nur operative Wahrheit und blendet Trial-Regeln als Tagesbelegung aus", () => {
  const week = buildOperationalWeekDays({
    now: new Date("2026-03-12T10:00:00.000Z"),
    occupancy: [
      {
        end_at: "2026-03-11T10:00:00.000Z",
        source: "booking",
        start_at: "2026-03-11T09:00:00.000Z"
      },
      {
        end_at: "2026-03-12T11:30:00.000Z",
        source: "block",
        start_at: "2026-03-12T10:30:00.000Z"
      }
    ],
    rules: [
      {
        active: true,
        created_at: "2026-03-01T08:00:00.000Z",
        end_at: "2026-03-11T08:00:00.000Z",
        horse_id: "horse-1",
        id: "available-slot",
        is_trial_slot: false,
        slot_id: "slot-1",
        start_at: "2026-03-11T07:00:00.000Z"
      },
      {
        active: true,
        created_at: "2026-03-01T08:00:00.000Z",
        end_at: "2026-03-12T11:30:00.000Z",
        horse_id: "horse-1",
        id: "blocked-slot",
        is_trial_slot: false,
        slot_id: "slot-2",
        start_at: "2026-03-12T10:30:00.000Z"
      },
      {
        active: true,
        created_at: "2026-03-01T08:00:00.000Z",
        end_at: "2026-03-14T12:00:00.000Z",
        horse_id: "horse-1",
        id: "trial-slot",
        is_trial_slot: true,
        slot_id: "slot-3",
        start_at: "2026-03-14T11:00:00.000Z"
      }
    ],
    weekOffset: 0
  });

  assert.deepEqual(
    week.find((day) => day.dayKey === "2026-03-11")?.entries.map((entry) => entry.kind),
    ["available", "booking"]
  );
  assert.deepEqual(
    week.find((day) => day.dayKey === "2026-03-12")?.entries.map((entry) => entry.kind),
    ["block"]
  );
  assert.deepEqual(
    week.find((day) => day.dayKey === "2026-03-14")?.entries,
    []
  );
});
