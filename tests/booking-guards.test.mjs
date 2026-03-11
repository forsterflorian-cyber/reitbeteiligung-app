import assert from "node:assert/strict";
import test from "node:test";

import {
  getAcceptBookingErrorMessage,
  getDirectBookingErrorMessage,
  isBookingWriteConflictError,
  OPERATIONAL_RECURRENCE_NOT_ENABLED_MESSAGE,
  shouldDirectBookOperationalSlot
} from "../lib/booking-guards.ts";

test("Booking-Guardrails erkennen Schreibkonflikte und atomare RPC-Fehler", () => {
  assert.equal(isBookingWriteConflictError({ code: "23P01", message: "exclusion" }), true);
  assert.equal(isBookingWriteConflictError({ code: "23505", message: "duplicate" }), true);
  assert.equal(isBookingWriteConflictError({ message: "TIME_UNAVAILABLE" }), true);
  assert.equal(isBookingWriteConflictError({ code: "42501", message: "forbidden" }), false);

  assert.equal(
    getDirectBookingErrorMessage({ message: "TIME_UNAVAILABLE" }),
    "Der angefragte Termin ist nicht mehr verfuegbar."
  );
  assert.equal(
    getAcceptBookingErrorMessage({ message: "INVALID_STATUS" }),
    "Diese Buchungsanfrage wurde bereits bearbeitet."
  );
});

test("Operative V1 bleibt bewusst bei Einzelbuchungen", () => {
  assert.equal(shouldDirectBookOperationalSlot(null), true);
  assert.equal(shouldDirectBookOperationalSlot("FREQ=WEEKLY;COUNT=2"), false);
  assert.equal(
    OPERATIONAL_RECURRENCE_NOT_ENABLED_MESSAGE,
    "Wiederholende operative Buchungen sind in dieser Version noch nicht freigeschaltet."
  );
});
