import assert from "node:assert/strict";
import test from "node:test";

import {
  getTrialConversationFailureMessage,
  getTrialRequestDuplicateError,
  getTrialRequestSuccessMessage,
  getTrialSlotSelectionError,
  getTrialStatusTransitionError
} from "../lib/server-actions/trial.ts";
import {
  getApprovalSavedMessage,
  getApprovalTransitionError,
  getDeleteRelationshipError
} from "../lib/server-actions/relationships.ts";

test("Probetermin anfragen prueft Duplikate, Slot-Auswahl und Erfolgsmeldungen direkt", () => {
  assert.equal(
    getTrialRequestDuplicateError("requested"),
    "Du hast f\u00fcr dieses Pferd bereits eine offene Probeanfrage. Ziehe sie unter Meine Reitbeteiligungen zur\u00fcck, bevor du erneut anfragst."
  );
  assert.equal(
    getTrialRequestDuplicateError("completed"),
    "Du hast f\u00fcr dieses Pferd bereits einen laufenden oder abgeschlossenen Probetermin."
  );
  assert.equal(getTrialSlotSelectionError(true, false), "Bitte w\u00e4hle einen verf\u00fcgbaren Probetermin aus.");
  assert.equal(getTrialSlotSelectionError(false, false), null);
  assert.equal(getTrialRequestSuccessMessage(true), "Deine Anfrage f\u00fcr den Probetermin wurde gesendet.");
  assert.equal(
    getTrialConversationFailureMessage(false),
    "Deine allgemeine Probeanfrage wurde gesendet. Der Chat konnte nicht erstellt werden."
  );
});

test("Annehmen oder ablehnen folgt den Statusregeln direkt", () => {
  assert.equal(getTrialStatusTransitionError("requested", "accepted"), null);
  assert.equal(getTrialStatusTransitionError("requested", "declined"), null);
  assert.equal(
    getTrialStatusTransitionError("accepted", "declined"),
    "Diese Anfrage kann nicht mehr ge\u00e4ndert werden."
  );
  assert.equal(
    getTrialStatusTransitionError("requested", "completed"),
    "Nur angenommene Probetermine k\u00f6nnen als durchgef\u00fchrt markiert werden."
  );
});

test("Aufnehmen als Reitbeteiligung haengt direkt am durchgefuehrten Probetermin", () => {
  assert.equal(getApprovalTransitionError("completed"), null);
  assert.equal(
    getApprovalTransitionError("accepted"),
    "Nur durchgefuehrte Probetermine koennen entschieden werden."
  );
  assert.equal(
    getApprovalTransitionError("withdrawn"),
    "Nur durchgefuehrte Probetermine koennen entschieden werden."
  );
  assert.equal(getApprovalSavedMessage("approved"), "Die Reitbeteiligung wurde freigeschaltet.");
  assert.equal(getApprovalSavedMessage("rejected"), "Die Reitbeteiligung wurde nicht aufgenommen.");
  assert.equal(getApprovalSavedMessage("revoked"), "Die Freischaltung wurde entzogen.");
});

test("Entfernen einer Reitbeteiligung prueft den aktiven Datensatz direkt", () => {
  assert.equal(getDeleteRelationshipError("approved"), null);
  assert.equal(
    getDeleteRelationshipError("rejected"),
    "Fuer diese Reitbeteiligung gibt es nichts mehr zu loeschen."
  );
  assert.equal(
    getDeleteRelationshipError("revoked"),
    "Fuer diese Reitbeteiligung gibt es nichts mehr zu loeschen."
  );
  assert.equal(
    getDeleteRelationshipError(null),
    "Fuer diese Reitbeteiligung gibt es nichts mehr zu loeschen."
  );
});
