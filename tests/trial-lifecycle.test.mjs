import assert from "node:assert/strict";
import test from "node:test";

import {
  canAcceptTrialRequest,
  canApproveTrialRequest,
  canCancelTrialRequest,
  canRetryTrialRequest,
  canCompleteTrialRequest,
  doesTrialRequestBlockNewRequest,
  doesTrialRequestReserveTrialSlot,
  getRiderTrialRequestStatusMessage,
  isActiveRelationship
} from "../lib/trial-lifecycle.ts";

test("trial lifecycle helper deckt die Owner- und Rider-Schritte sauber ab", () => {
  assert.equal(canCancelTrialRequest("requested"), true);
  assert.equal(canCancelTrialRequest("accepted"), true);
  assert.equal(canCancelTrialRequest("declined"), false);
  assert.equal(canCancelTrialRequest("withdrawn"), false);
  assert.equal(canAcceptTrialRequest("requested"), true);
  assert.equal(canAcceptTrialRequest("accepted"), false);
  assert.equal(canCompleteTrialRequest("accepted"), true);
  assert.equal(canCompleteTrialRequest("completed"), false);
  assert.equal(canApproveTrialRequest("completed"), true);
  assert.equal(canApproveTrialRequest("requested"), false);
  assert.equal(canRetryTrialRequest("declined"), true);
  assert.equal(canRetryTrialRequest("withdrawn"), true);
  assert.equal(canRetryTrialRequest("completed"), false);
  assert.equal(doesTrialRequestBlockNewRequest("requested"), true);
  assert.equal(doesTrialRequestBlockNewRequest("completed"), true);
  assert.equal(doesTrialRequestBlockNewRequest("withdrawn"), false);
  assert.equal(doesTrialRequestReserveTrialSlot("accepted"), true);
  assert.equal(doesTrialRequestReserveTrialSlot("withdrawn"), false);
});

test("isActiveRelationship erkennt nur freigeschaltete Beziehungen", () => {
  assert.equal(isActiveRelationship("approved"), true);
  assert.equal(isActiveRelationship("rejected"), false);
  assert.equal(isActiveRelationship("revoked"), false);
  assert.equal(isActiveRelationship(null), false);
});

test("Rider-Statuscopy bleibt fuer alle Trial-Enden eindeutig, inklusive withdrawn", () => {
  assert.equal(
    getRiderTrialRequestStatusMessage("requested"),
    "Deine Anfrage ist eingegangen. Der Pferdehalter entscheidet als Naechstes."
  );
  assert.equal(
    getRiderTrialRequestStatusMessage("completed"),
    "Der Probetermin wurde als durchgefuehrt markiert. Warte jetzt auf die Freischaltung."
  );
  assert.equal(
    getRiderTrialRequestStatusMessage("completed", "rejected"),
    "Der Probetermin wurde durchgefuehrt. Fuer dieses Pferd wurdest du danach nicht aufgenommen."
  );
  assert.equal(
    getRiderTrialRequestStatusMessage("completed", "revoked"),
    "Die Freischaltung fuer dieses Pferd wurde spaeter wieder entzogen."
  );
  assert.equal(
    getRiderTrialRequestStatusMessage("withdrawn"),
    "Du hast diese Anfrage zurueckgezogen. Wenn wieder passende Probetermine frei sind, kannst du erneut anfragen."
  );
});
