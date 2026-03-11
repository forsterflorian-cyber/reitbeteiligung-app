import assert from "node:assert/strict";
import test from "node:test";

import {
  buildApprovalStatusMap,
  canAccessOperationalCalendar,
  getApprovalStatusForPair,
  getRelationshipConversationStage,
  getRelationshipKey,
  hasVisibleRelationshipConversation,
  hasRelationshipDecision,
  isActiveRelationship,
  isRejectedTrialAfterCompletion,
  shouldShowTrialRequestInLifecycle
} from "../lib/relationship-state.ts";

test("Probe geht bis zur Aufnahme nur ohne Relationship-Entscheidung durch den Lifecycle", () => {
  const approvalStatusMap = buildApprovalStatusMap([
    { horse_id: "horse-1", rider_id: "rider-2", status: "revoked" },
    { horse_id: "horse-2", rider_id: "rider-3", status: "approved" }
  ]);

  assert.equal(getRelationshipKey("horse-1", "rider-1"), "horse-1:rider-1");
  assert.equal(getApprovalStatusForPair(approvalStatusMap, "horse-1", "rider-1"), null);
  assert.equal(shouldShowTrialRequestInLifecycle("completed", null), true);
  assert.equal(shouldShowTrialRequestInLifecycle("completed", "revoked"), false);
  assert.equal(shouldShowTrialRequestInLifecycle("requested", "approved"), false);
  assert.equal(hasRelationshipDecision("revoked"), true);
  assert.equal(hasRelationshipDecision(null), false);
});

test("Aktive Reitbeteiligung wird nur ueber approval=approved sichtbar", () => {
  assert.equal(isActiveRelationship("approved"), true);
  assert.equal(isActiveRelationship("revoked"), false);
  assert.equal(isActiveRelationship(null), false);
});

test("Operativer Kalender haengt nur an Owner oder aktiver Reitbeteiligung", () => {
  assert.equal(
    canAccessOperationalCalendar({
      approvalStatus: null,
      isHorseOwner: true,
      viewerRole: "owner"
    }),
    true
  );
  assert.equal(
    canAccessOperationalCalendar({
      approvalStatus: "approved",
      isHorseOwner: false,
      viewerRole: "rider"
    }),
    true
  );
  assert.equal(
    canAccessOperationalCalendar({
      approvalStatus: "revoked",
      isHorseOwner: false,
      viewerRole: "rider"
    }),
    false
  );
  assert.equal(
    canAccessOperationalCalendar({
      approvalStatus: null,
      isHorseOwner: false,
      viewerRole: "rider"
    }),
    false
  );
});

test("Revoked faellt weder in Trial-Chat noch in aktive Beziehung zurueck", () => {
  assert.equal(getRelationshipConversationStage("completed", "approved"), "active");
  assert.equal(getRelationshipConversationStage("completed", null), "trial");
  assert.equal(getRelationshipConversationStage("completed", "revoked"), "inactive");
  assert.equal(hasVisibleRelationshipConversation("completed", "revoked"), false);
  assert.equal(isRejectedTrialAfterCompletion("completed", "revoked"), true);
});
