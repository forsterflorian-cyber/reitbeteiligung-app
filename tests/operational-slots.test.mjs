import assert from "node:assert/strict";
import test from "node:test";

import {
  excludeOperationalRange,
  getUpcomingOperationalSlots,
  isOperationalRuleBlocked,
  operationalRangesOverlap,
  splitAvailabilityRulesByPhase
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
