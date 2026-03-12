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
    ["booking"]
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

test("Aktuelle Woche: vergangene freie Slots erscheinen nicht mehr als available", () => {
  // now = Donnerstag 12.03 10:00 Uhr
  // Slot am Dienstag 10.03 (vergangen) darf nicht als available erscheinen
  const week = buildOperationalWeekDays({
    now: new Date("2026-03-12T10:00:00.000Z"),
    occupancy: [],
    rules: [
      {
        active: true,
        created_at: "2026-03-01T08:00:00.000Z",
        end_at: "2026-03-10T11:00:00.000Z",
        horse_id: "horse-1",
        id: "past-slot",
        is_trial_slot: false,
        slot_id: "slot-1",
        start_at: "2026-03-10T10:00:00.000Z"
      }
    ],
    weekOffset: 0
  });

  assert.deepEqual(
    week.find((day) => day.dayKey === "2026-03-10")?.entries,
    [],
    "Vergangener Slot am Dienstag darf nicht als available erscheinen"
  );
});

test("Aktuelle Woche: kuenftiger freier Slot erscheint weiterhin als available", () => {
  // now = Donnerstag 12.03 10:00 Uhr
  // Slot am Freitag 13.03 (noch in der Zukunft) muss weiterhin als available erscheinen
  const week = buildOperationalWeekDays({
    now: new Date("2026-03-12T10:00:00.000Z"),
    occupancy: [],
    rules: [
      {
        active: true,
        created_at: "2026-03-01T08:00:00.000Z",
        end_at: "2026-03-13T11:00:00.000Z",
        horse_id: "horse-1",
        id: "future-slot",
        is_trial_slot: false,
        slot_id: "slot-1",
        start_at: "2026-03-13T10:00:00.000Z"
      }
    ],
    weekOffset: 0
  });

  assert.deepEqual(
    week.find((day) => day.dayKey === "2026-03-13")?.entries.map((entry) => entry.kind),
    ["available"],
    "Kuenftiger Slot am Freitag muss als available erscheinen"
  );
});

test("Zukuenftige Woche: freie Slots bleiben sichtbar auch wenn Slot vor aktuellem now liegt", () => {
  // now = Donnerstag 12.03 10:00 Uhr, weekOffset=1
  // Slot am Dienstag der naechsten Woche (17.03) ist relativ zu weekStart zukuenftig
  // und muss als available erscheinen, weil weekStart (16.03) < slot (17.03)
  const week = buildOperationalWeekDays({
    now: new Date("2026-03-12T10:00:00.000Z"),
    occupancy: [],
    rules: [
      {
        active: true,
        created_at: "2026-03-01T08:00:00.000Z",
        end_at: "2026-03-17T11:00:00.000Z",
        horse_id: "horse-1",
        id: "next-week-slot",
        is_trial_slot: false,
        slot_id: "slot-1",
        start_at: "2026-03-17T10:00:00.000Z"
      }
    ],
    weekOffset: 1
  });

  assert.deepEqual(
    week.find((day) => day.dayKey === "2026-03-17")?.entries.map((entry) => entry.kind),
    ["available"],
    "Slot in naechster Woche muss als available erscheinen"
  );
});
