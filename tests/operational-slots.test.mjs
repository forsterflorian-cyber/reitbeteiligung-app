import assert from "node:assert/strict";
import test from "node:test";

import {
  excludeOperationalRange,
  getUpcomingOperationalSlots,
  isOperationalRuleBlocked,
  mergeOccupiedRanges,
  operationalRangesOverlap,
  splitAvailabilityRulesByPhase,
  subtractOccupiedFromSlot
} from "../lib/operational-slots.ts";

test("Operative Slots blocken Doppelbelegung und Konflikte sauber", () => {
  assert.equal(
    operationalRangesOverlap("2026-03-20T10:00:00.000Z", "2026-03-20T11:00:00.000Z", "2026-03-20T10:30:00.000Z", "2026-03-20T11:30:00.000Z"),
    true
  );
  assert.equal(
    operationalRangesOverlap("2026-03-20T10:00:00.000Z", "2026-03-20T11:00:00.000Z", "2026-03-20T11:00:00.000Z", "2026-03-20T12:00:00.000Z"),
    false
  );

  const rule = {
    active: true,
    end_at: "2026-03-20T11:00:00.000Z",
    id: "rule-1",
    is_trial_slot: false,
    start_at: "2026-03-20T10:00:00.000Z"
  };

  assert.equal(
    isOperationalRuleBlocked(rule, [{ start_at: "2026-03-20T10:15:00.000Z", end_at: "2026-03-20T10:45:00.000Z" }]),
    true
  );
  assert.equal(isOperationalRuleBlocked(rule, []), false);
});

test("Nur freie nicht-Trial-Slots werden aktiven Reitbeteiligungen gezeigt", () => {
  const rules = [
    { active: true, end_at: "2026-03-19T09:00:00.000Z", id: "past", is_trial_slot: false, start_at: "2026-03-19T08:00:00.000Z" },
    { active: true, end_at: "2026-03-20T08:30:00.000Z", id: "already-started", is_trial_slot: false, start_at: "2026-03-20T07:30:00.000Z" },
    { active: true, end_at: "2026-03-20T11:00:00.000Z", id: "free-1", is_trial_slot: false, start_at: "2026-03-20T10:00:00.000Z" },
    { active: true, end_at: "2026-03-20T13:00:00.000Z", id: "blocked", is_trial_slot: false, start_at: "2026-03-20T12:00:00.000Z" },
    { active: true, end_at: "2026-03-20T15:00:00.000Z", id: "trial", is_trial_slot: true, start_at: "2026-03-20T14:00:00.000Z" },
    { active: false, end_at: "2026-03-20T17:00:00.000Z", id: "inactive", is_trial_slot: false, start_at: "2026-03-20T16:00:00.000Z" },
    { active: true, end_at: "2026-03-20T19:00:00.000Z", id: "free-2", is_trial_slot: false, start_at: "2026-03-20T18:00:00.000Z" }
  ];
  const { operationalRules, trialRules } = splitAvailabilityRulesByPhase(rules);
  const slots = getUpcomingOperationalSlots({
    now: new Date("2026-03-20T08:00:00.000Z"),
    occupiedRanges: [{ start_at: "2026-03-20T12:00:00.000Z", end_at: "2026-03-20T13:00:00.000Z" }],
    rules: operationalRules
  });

  assert.deepEqual(
    slots.map((slot) => slot.availabilityRuleId),
    ["free-1", "free-2"]
  );
  assert.deepEqual(
    trialRules.map((rule) => rule.id),
    ["trial"]
  );
});

test("operationalRangesOverlap erkennt Ueberlappung unabhaengig vom ISO-Timestamp-Format", () => {
  // Z-Suffix vs +00:00 – dieselbe UTC-Zeit, unterschiedliche String-Darstellung
  assert.equal(
    operationalRangesOverlap(
      "2026-03-13T17:00:00.000Z",
      "2026-03-13T18:00:00.000Z",
      "2026-03-13T17:00:00+00:00",
      "2026-03-13T18:00:00+00:00"
    ),
    true,
    "Z vs +00:00 – muss als Ueberlappung erkannt werden"
  );
  // mit Mikrosekunden vs ohne
  assert.equal(
    operationalRangesOverlap(
      "2026-03-13T17:00:00+00:00",
      "2026-03-13T18:00:00+00:00",
      "2026-03-13T17:00:00.000000+00:00",
      "2026-03-13T18:00:00.000000+00:00"
    ),
    true,
    "Mit und ohne Mikrosekunden – muss als Ueberlappung erkannt werden"
  );
  // adjazente Bereiche duerfennicht als ueberlappend gelten (gemischtes Format)
  assert.equal(
    operationalRangesOverlap(
      "2026-03-13T18:00:00.000Z",
      "2026-03-13T19:00:00.000Z",
      "2026-03-13T17:00:00+00:00",
      "2026-03-13T18:00:00+00:00"
    ),
    false,
    "Adjazente Bereiche mit gemischten Formaten duerfen nicht als ueberlappend gelten"
  );
});

test("Nach Umbuchung erscheint der Ziel-Slot nicht gleichzeitig als frei und gebucht", () => {
  // Szenario: Buchung von 14.03 auf 13.03 umgebucht.
  // Beide Availability-Rules existieren weiterhin (active=true).
  // Occupancy enthaelt nach der Umbuchung nur den 13.03-Eintrag.
  const rules = [
    {
      active: true,
      end_at: "2026-03-13T18:00:00+00:00",
      id: "rule-13",
      is_trial_slot: false,
      start_at: "2026-03-13T17:00:00+00:00"
    },
    {
      active: true,
      end_at: "2026-03-14T18:00:00+00:00",
      id: "rule-14",
      is_trial_slot: false,
      start_at: "2026-03-14T17:00:00+00:00"
    }
  ];
  // Occupancy wie von Supabase-RPC (+00:00-Format): 13.03 ist gebucht
  const occupancy = [{ end_at: "2026-03-13T18:00:00+00:00", start_at: "2026-03-13T17:00:00+00:00" }];

  const openSlots = getUpcomingOperationalSlots({
    now: new Date("2026-03-12T00:00:00.000Z"),
    occupiedRanges: occupancy,
    rules
  });

  assert.ok(
    !openSlots.some((slot) => slot.availabilityRuleId === "rule-13"),
    "Ziel-Slot (13.03) darf nach Umbuchung nicht als freier Slot erscheinen"
  );
  assert.ok(
    openSlots.some((slot) => slot.availabilityRuleId === "rule-14"),
    "Quell-Slot (14.03) muss nach Umbuchung als freier Slot erscheinen"
  );
  assert.equal(openSlots.length, 1);
});

test("Ziel-Slot bleibt blockiert auch wenn Occupancy im Z-Format vorliegt (gemischte Formate)", () => {
  // Wie vorheriger Test, aber Occupancy-Timestamps im Z-Format (JS toISOString).
  // Simuliert den Fall, dass RPC und direkte DB-Queries unterschiedliche Formate liefern.
  const rules = [
    {
      active: true,
      end_at: "2026-03-13T18:00:00+00:00",
      id: "rule-13",
      is_trial_slot: false,
      start_at: "2026-03-13T17:00:00+00:00"
    }
  ];
  const occupancyZFormat = [{ end_at: "2026-03-13T18:00:00.000Z", start_at: "2026-03-13T17:00:00.000Z" }];

  const openSlots = getUpcomingOperationalSlots({
    now: new Date("2026-03-12T00:00:00.000Z"),
    occupiedRanges: occupancyZFormat,
    rules
  });

  assert.equal(
    openSlots.length,
    0,
    "Ziel-Slot muss auch bei Z-formatierter Occupancy als blockiert gelten"
  );
});

test("Umbuchung blendet die eigene Altbelegung aus der freien Slot-Pruefung aus", () => {
  const rules = [
    { active: true, end_at: "2026-03-20T11:00:00.000Z", id: "current", is_trial_slot: false, start_at: "2026-03-20T10:00:00.000Z" },
    { active: true, end_at: "2026-03-20T11:30:00.000Z", id: "overlap", is_trial_slot: false, start_at: "2026-03-20T10:30:00.000Z" }
  ];
  const occupiedRanges = [{ start_at: "2026-03-20T10:00:00.000Z", end_at: "2026-03-20T11:00:00.000Z" }];

  assert.deepEqual(excludeOperationalRange(occupiedRanges, occupiedRanges[0]), []);
  assert.deepEqual(
    getUpcomingOperationalSlots({
      disallowedRange: occupiedRanges[0],
      excludedRange: occupiedRanges[0],
      now: new Date("2026-03-20T08:00:00.000Z"),
      occupiedRanges,
      rules
    }).map((slot) => slot.availabilityRuleId),
    ["overlap"]
  );
});

// ─── Slot-Segmentierung: subtractOccupiedFromSlot ───────────────────────────

const SLOT = {
  active: true,
  end_at: "2026-03-17T18:00:00.000Z",
  id: "slot-1",
  is_trial_slot: false,
  start_at: "2026-03-17T08:00:00.000Z"
};

test("Slot-Segmentierung: keine Buchung → gesamter Slot wird zurückgegeben", () => {
  const result = subtractOccupiedFromSlot(SLOT, []);
  assert.equal(result.length, 1);
  assert.equal(result[0].startAt, "2026-03-17T08:00:00.000Z");
  assert.equal(result[0].endAt, "2026-03-17T18:00:00.000Z");
  assert.equal(result[0].availabilityRuleId, "slot-1");
});

test("Slot-Segmentierung: Buchung am Anfang → nur Ende-Segment zurückgegeben", () => {
  const result = subtractOccupiedFromSlot(SLOT, [
    { start_at: "2026-03-17T08:00:00.000Z", end_at: "2026-03-17T09:00:00.000Z" }
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].startAt, "2026-03-17T09:00:00.000Z");
  assert.equal(result[0].endAt, "2026-03-17T18:00:00.000Z");
});

test("Slot-Segmentierung: Buchung in der Mitte → zwei freie Segmente", () => {
  const result = subtractOccupiedFromSlot(SLOT, [
    { start_at: "2026-03-17T11:00:00.000Z", end_at: "2026-03-17T13:00:00.000Z" }
  ]);
  assert.equal(result.length, 2);
  assert.equal(result[0].startAt, "2026-03-17T08:00:00.000Z");
  assert.equal(result[0].endAt, "2026-03-17T11:00:00.000Z");
  assert.equal(result[1].startAt, "2026-03-17T13:00:00.000Z");
  assert.equal(result[1].endAt, "2026-03-17T18:00:00.000Z");
});

test("Slot-Segmentierung: Buchung am Ende → nur Anfangs-Segment zurückgegeben", () => {
  const result = subtractOccupiedFromSlot(SLOT, [
    { start_at: "2026-03-17T17:00:00.000Z", end_at: "2026-03-17T18:00:00.000Z" }
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].startAt, "2026-03-17T08:00:00.000Z");
  assert.equal(result[0].endAt, "2026-03-17T17:00:00.000Z");
});

test("Slot-Segmentierung: mehrere Buchungen → mehrere freie Segmente", () => {
  const result = subtractOccupiedFromSlot(SLOT, [
    { start_at: "2026-03-17T08:00:00.000Z", end_at: "2026-03-17T09:00:00.000Z" },
    { start_at: "2026-03-17T11:00:00.000Z", end_at: "2026-03-17T12:00:00.000Z" },
    { start_at: "2026-03-17T15:00:00.000Z", end_at: "2026-03-17T16:00:00.000Z" }
  ]);
  assert.equal(result.length, 3);
  assert.equal(result[0].startAt, "2026-03-17T09:00:00.000Z");
  assert.equal(result[0].endAt, "2026-03-17T11:00:00.000Z");
  assert.equal(result[1].startAt, "2026-03-17T12:00:00.000Z");
  assert.equal(result[1].endAt, "2026-03-17T15:00:00.000Z");
  assert.equal(result[2].startAt, "2026-03-17T16:00:00.000Z");
  assert.equal(result[2].endAt, "2026-03-17T18:00:00.000Z");
});

test("Slot-Segmentierung: überlappende Buchungen werden normalisiert", () => {
  // Two bookings that overlap each other should be treated as one contiguous block
  const result = subtractOccupiedFromSlot(SLOT, mergeOccupiedRanges([
    { start_at: "2026-03-17T10:00:00.000Z", end_at: "2026-03-17T12:00:00.000Z" },
    { start_at: "2026-03-17T11:00:00.000Z", end_at: "2026-03-17T13:00:00.000Z" }
  ]));
  assert.equal(result.length, 2);
  assert.equal(result[0].startAt, "2026-03-17T08:00:00.000Z");
  assert.equal(result[0].endAt, "2026-03-17T10:00:00.000Z");
  assert.equal(result[1].startAt, "2026-03-17T13:00:00.000Z");
  assert.equal(result[1].endAt, "2026-03-17T18:00:00.000Z");
});

test("Slot-Segmentierung: vollständig belegte Buchung → kein Segment", () => {
  const result = subtractOccupiedFromSlot(SLOT, [
    { start_at: "2026-03-17T08:00:00.000Z", end_at: "2026-03-17T18:00:00.000Z" }
  ]);
  assert.equal(result.length, 0);
});

test("Slot-Segmentierung: stornierte Buchung belegt keinen Slot (leere Occupancy)", () => {
  // Cancelled bookings must not appear in occupiedRanges at all (filtered upstream).
  // This test confirms that with empty occupancy the full slot is returned.
  const result = subtractOccupiedFromSlot(SLOT, []);
  assert.equal(result.length, 1, "Nach Stornierung muss der gesamte Slot wieder verfügbar sein");
  assert.equal(result[0].startAt, "2026-03-17T08:00:00.000Z");
  assert.equal(result[0].endAt, "2026-03-17T18:00:00.000Z");
});

test("Slot-Segmentierung: verschobene Altbuchung blockiert nicht (via getUpcomingOperationalSlots excludedRange)", () => {
  const rules = [{ active: true, end_at: "2026-03-17T18:00:00.000Z", id: "rule-17", is_trial_slot: false, start_at: "2026-03-17T08:00:00.000Z" }];
  const occupiedRanges = [{ start_at: "2026-03-17T08:00:00.000Z", end_at: "2026-03-17T09:00:00.000Z" }];

  // Without exclusion: only tail segment visible
  const withOccupancy = getUpcomingOperationalSlots({
    now: new Date("2026-03-16T00:00:00.000Z"),
    occupiedRanges,
    rules
  });
  assert.equal(withOccupancy.length, 1);
  assert.equal(withOccupancy[0].startAt, "2026-03-17T09:00:00.000Z");

  // Excluding the old booking range (rescheduling): full slot appears
  const withExclusion = getUpcomingOperationalSlots({
    excludedRange: occupiedRanges[0],
    now: new Date("2026-03-16T00:00:00.000Z"),
    occupiedRanges,
    rules
  });
  assert.equal(withExclusion.length, 1);
  assert.equal(withExclusion[0].startAt, "2026-03-17T08:00:00.000Z");
  assert.equal(withExclusion[0].endAt, "2026-03-17T18:00:00.000Z");
});

test("Slot-Segmentierung: Restfenster < 15 Minuten wird nicht zurückgegeben", () => {
  // Booking ends at 08:50 → remaining 08:50–09:00 = 10 min → snaps to 09:00–09:00 → filtered
  const result = subtractOccupiedFromSlot(SLOT, [
    { start_at: "2026-03-17T08:00:00.000Z", end_at: "2026-03-17T08:50:00.000Z" }
  ]);
  // The remaining tail 08:50–18:00 snaps to 09:00–18:00 (>= 15 min, returned)
  // The prefix 08:00–08:00 = 0 min → not returned
  assert.equal(result.length, 1);
  assert.equal(result[0].startAt, "2026-03-17T09:00:00.000Z");
  assert.equal(result[0].endAt, "2026-03-17T18:00:00.000Z");
});

test("Slot-Segmentierung: Restfenster genau 15 Minuten wird zurückgegeben", () => {
  // Booking 08:00–08:45 → remaining 08:45–09:00 = exactly 15 min on-grid → returned
  const shortSlot = {
    active: true,
    end_at: "2026-03-17T09:00:00.000Z",
    id: "short",
    is_trial_slot: false,
    start_at: "2026-03-17T08:00:00.000Z"
  };
  const result = subtractOccupiedFromSlot(shortSlot, [
    { start_at: "2026-03-17T08:00:00.000Z", end_at: "2026-03-17T08:45:00.000Z" }
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].startAt, "2026-03-17T08:45:00.000Z");
  assert.equal(result[0].endAt, "2026-03-17T09:00:00.000Z");
});
