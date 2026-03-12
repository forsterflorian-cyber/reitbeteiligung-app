import assert from "node:assert/strict";
import test from "node:test";

import { getOwnerPlan, getOwnerPlanUsageSummary } from "../lib/plans.ts";
import { getUpcomingTrialSlots, isTrialRuleBlocked, trialRangesOverlap } from "../lib/trial-slots.ts";

test("trialRangesOverlap erkennt echte Ueberschneidungen", () => {
  assert.equal(trialRangesOverlap("2026-03-10T10:00:00.000Z", "2026-03-10T11:00:00.000Z", "2026-03-10T10:30:00.000Z", "2026-03-10T11:30:00.000Z"), true);
  assert.equal(trialRangesOverlap("2026-03-10T10:00:00.000Z", "2026-03-10T11:00:00.000Z", "2026-03-10T11:00:00.000Z", "2026-03-10T12:00:00.000Z"), false);
});

test("isTrialRuleBlocked blockiert Belegung und bestehende Anfragen", () => {
  const rule = {
    id: "rule-1",
    active: true,
    is_trial_slot: true,
    start_at: "2026-03-12T09:00:00.000Z",
    end_at: "2026-03-12T10:00:00.000Z"
  };

  assert.equal(
    isTrialRuleBlocked(rule, [{ start_at: "2026-03-12T09:15:00.000Z", end_at: "2026-03-12T09:45:00.000Z" }], []),
    true
  );

  assert.equal(
    isTrialRuleBlocked(rule, [], [{ availability_rule_id: "rule-1", requested_start_at: null, requested_end_at: null, status: "requested" }]),
    true
  );

  assert.equal(
    isTrialRuleBlocked(rule, [], [{ availability_rule_id: null, requested_start_at: "2026-03-12T09:15:00.000Z", requested_end_at: "2026-03-12T09:45:00.000Z", status: "accepted" }]),
    true
  );

  assert.equal(
    isTrialRuleBlocked(rule, [], [{ availability_rule_id: null, requested_start_at: "2026-03-12T09:15:00.000Z", requested_end_at: "2026-03-12T09:45:00.000Z", status: "declined" }]),
    false
  );

  assert.equal(
    isTrialRuleBlocked(rule, [], [{ availability_rule_id: "rule-1", requested_start_at: null, requested_end_at: null, status: "withdrawn" }]),
    false
  );
});

test("getUpcomingTrialSlots liefert nur aktive kommende freie Slots", () => {
  const slots = getUpcomingTrialSlots({
    now: new Date("2026-03-10T08:00:00.000Z"),
    occupiedRanges: [{ start_at: "2026-03-10T10:00:00.000Z", end_at: "2026-03-10T11:00:00.000Z" }],
    reservedRequests: [],
    rules: [
      { id: "past", active: true, is_trial_slot: true, start_at: "2026-03-09T09:00:00.000Z", end_at: "2026-03-09T10:00:00.000Z" },
      { id: "blocked", active: true, is_trial_slot: true, start_at: "2026-03-10T10:00:00.000Z", end_at: "2026-03-10T11:00:00.000Z" },
      { id: "inactive", active: false, is_trial_slot: true, start_at: "2026-03-10T12:00:00.000Z", end_at: "2026-03-10T13:00:00.000Z" },
      { id: "notrial", active: true, is_trial_slot: false, start_at: "2026-03-10T14:00:00.000Z", end_at: "2026-03-10T15:00:00.000Z" },
      { id: "free-2", active: true, is_trial_slot: true, start_at: "2026-03-10T16:00:00.000Z", end_at: "2026-03-10T17:00:00.000Z" },
      { id: "free-1", active: true, is_trial_slot: true, start_at: "2026-03-10T09:00:00.000Z", end_at: "2026-03-10T10:00:00.000Z" }
    ]
  });

  assert.deepEqual(
    slots.map((slot) => slot.availabilityRuleId),
    ["free-1", "free-2"]
  );
});

test("getOwnerPlan schaltet im R1 alle Kernfunktionen frei", () => {
  const plan = getOwnerPlan(
    {
      role: "owner",
      is_premium: false,
      created_at: "2026-03-01T00:00:00.000Z",
      trial_started_at: null
    },
    {
      horseCount: 4,
      approvedRiderCount: 9
    }
  );

  assert.equal(plan.key, "paid");
  assert.equal(plan.label, "Freigeschaltet");
  assert.equal(plan.maxHorses, null);
  assert.equal(plan.maxApprovedRiders, null);
  assert.equal(
    getOwnerPlanUsageSummary(plan, { horseCount: 4, approvedRiderCount: 9 }),
    "Aktuell 4 Pferdeprofile und 9 aktive Reitbeteiligungen aktiv."
  );
});
