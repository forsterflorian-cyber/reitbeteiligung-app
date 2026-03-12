import assert from "node:assert/strict";
import test from "node:test";

import { getStatusDisplay } from "../lib/status-display.ts";
import {
  buildApprovalStatusMap,
  canAccessOperationalCalendar,
  getApprovalStatusForPair,
  getRiderRelationshipSection,
  getRelationshipConversationStage,
  getRelationshipKey,
  hasVisibleRelationshipConversation,
  hasRelationshipDecision,
  isActiveRelationship,
  isCompletedTrialAwaitingDecision,
  isRejectedTrialAfterCompletion,
  shouldShowTrialRequestInLifecycle
} from "../lib/relationship-state.ts";

test("Probe geht bis zur Aufnahme nur ohne Relationship-Entscheidung durch den Lifecycle", () => {
  const approvalStatusMap = buildApprovalStatusMap([
    { horse_id: "horse-1", rider_id: "rider-2", status: "rejected" },
    { horse_id: "horse-2", rider_id: "rider-3", status: "approved" }
  ]);

  assert.equal(getRelationshipKey("horse-1", "rider-1"), "horse-1:rider-1");
  assert.equal(getApprovalStatusForPair(approvalStatusMap, "horse-1", "rider-1"), null);
  assert.equal(shouldShowTrialRequestInLifecycle("completed", null), true);
  assert.equal(shouldShowTrialRequestInLifecycle("completed", "rejected"), false);
  assert.equal(shouldShowTrialRequestInLifecycle("requested", "approved"), false);
  assert.equal(hasRelationshipDecision("rejected"), true);
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
  assert.equal(getRelationshipConversationStage("completed", "rejected"), "inactive");
  assert.equal(hasVisibleRelationshipConversation("completed", "rejected"), false);
  assert.equal(isRejectedTrialAfterCompletion("completed", "rejected"), true);
  assert.equal(getRelationshipConversationStage("completed", "revoked"), "inactive");
  assert.equal(hasVisibleRelationshipConversation("completed", "revoked"), false);
  assert.equal(isRejectedTrialAfterCompletion("completed", "revoked"), false);
});

test("Rider-Bereiche trennen aktiv, klaerung und archiv ohne neue UI-Sonderlogik", () => {
  assert.equal(getRiderRelationshipSection("requested", null), "in_clarification");
  assert.equal(getRiderRelationshipSection("completed", null), "in_clarification");
  assert.equal(getRiderRelationshipSection("completed", "approved"), "active");
  assert.equal(getRiderRelationshipSection("declined", null), "archive");
  assert.equal(getRiderRelationshipSection("withdrawn", null), "archive");
  assert.equal(getRiderRelationshipSection("completed", "rejected"), "archive");
  assert.equal(getRiderRelationshipSection("completed", "revoked"), "archive");
  assert.equal(isCompletedTrialAwaitingDecision("completed", null), true);
  assert.equal(isCompletedTrialAwaitingDecision("completed", "rejected"), false);
  assert.equal(isCompletedTrialAwaitingDecision("completed", "revoked"), false);
  assert.equal(isCompletedTrialAwaitingDecision("withdrawn", null), false);
});

test("Statusanzeige und Archivlabels bleiben fuer Historienstatus eindeutig", () => {
  assert.deepEqual(getStatusDisplay("withdrawn"), {
    label: "Zurueckgezogen",
    tone: "neutral"
  });
  assert.deepEqual(getStatusDisplay("declined"), {
    label: "Abgelehnt",
    tone: "rejected"
  });
  assert.deepEqual(getStatusDisplay("rejected"), {
    label: "Nicht aufgenommen",
    tone: "rejected"
  });
  assert.deepEqual(getStatusDisplay("revoked"), {
    label: "Freischaltung entzogen",
    tone: "rejected"
  });
  assert.deepEqual(getStatusDisplay("rescheduled"), {
    label: "Umgebucht",
    tone: "info"
  });
  assert.deepEqual(getStatusDisplay("canceled"), {
    label: "Storniert",
    tone: "neutral"
  });
});
