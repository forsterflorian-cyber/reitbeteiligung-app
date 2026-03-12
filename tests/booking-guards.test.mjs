import assert from "node:assert/strict";
import test from "node:test";

import {
  canCancelOperationalBooking,
  canRescheduleOperationalBooking,
  getAcceptBookingErrorMessage,
  getCancelBookingErrorMessage,
  getDirectBookingErrorMessage,
  getRescheduleBookingErrorMessage,
  getRescheduleBookingErrorReason,
  isFutureOperationalStartAt,
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
    getDirectBookingErrorMessage({ message: "BOOKING_STARTED" }),
    "Nur zukuenftige Termine koennen direkt gebucht werden."
  );
  assert.equal(
    getDirectBookingErrorMessage({ message: "WEEKLY_LIMIT_EXCEEDED" }),
    "Dein Wochenkontingent fuer dieses Pferd ist in dieser Woche bereits ausgeschoepft."
  );
  assert.equal(
    getAcceptBookingErrorMessage({ message: "INVALID_STATUS" }),
    "Diese Buchungsanfrage wurde bereits bearbeitet."
  );
  assert.equal(
    getAcceptBookingErrorMessage({ message: "BOOKING_STARTED" }),
    "Nur zukuenftige Termine koennen angenommen werden."
  );
  assert.equal(
    getAcceptBookingErrorMessage({ message: "WEEKLY_LIMIT_EXCEEDED" }),
    "Das Wochenkontingent dieses Reiters ist in dieser Woche bereits ausgeschoepft."
  );
  assert.equal(
    getCancelBookingErrorMessage({ message: "BOOKING_STARTED" }),
    "Nur noch nicht begonnene Termine koennen storniert werden."
  );
  assert.equal(
    getCancelBookingErrorMessage({ message: "NOT_APPROVED" }),
    "Nur aktive Reitbeteiligungen koennen eigene Termine stornieren."
  );
  assert.equal(
    getRescheduleBookingErrorMessage({ message: "TIME_UNAVAILABLE" }),
    "Der gewaehlte Slot ist nicht mehr verfuegbar."
  );
  assert.equal(
    getRescheduleBookingErrorMessage({ message: "TARGET_IN_PAST" }),
    "Der neue Termin muss in der Zukunft liegen."
  );
  assert.equal(
    getRescheduleBookingErrorMessage({ message: "WEEKLY_LIMIT_EXCEEDED" }),
    "In der Zielwoche ist dein Wochenkontingent fuer dieses Pferd bereits ausgeschoepft."
  );
  assert.equal(
    getRescheduleBookingErrorMessage({ message: "SAME_SLOT" }),
    "Bitte waehle einen anderen gueltigen freien Slot fuer die Umbuchung."
  );
  assert.equal(
    getRescheduleBookingErrorReason({ message: "NOT_ALLOWED" }),
    "unauthorized"
  );
  assert.equal(
    getRescheduleBookingErrorReason({ message: "NOT_APPROVED" }),
    "inactive_relationship"
  );
  assert.equal(
    getRescheduleBookingErrorReason({ message: "RULE_INACTIVE" }),
    "invalid_target_slot"
  );
});

test("Operative V1 bleibt bewusst bei Einzelbuchungen", () => {
  assert.equal(shouldDirectBookOperationalSlot(null), true);
  assert.equal(shouldDirectBookOperationalSlot("FREQ=WEEKLY;COUNT=2"), false);
  assert.equal(
    OPERATIONAL_RECURRENCE_NOT_ENABLED_MESSAGE,
    "Wiederholende operative Buchungen sind in dieser Version noch nicht freigeschaltet."
  );
  assert.equal(
    isFutureOperationalStartAt({
      now: new Date("2026-03-20T08:00:00.000Z"),
      startAt: "2026-03-20T10:00:00.000Z"
    }),
    true
  );
  assert.equal(
    isFutureOperationalStartAt({
      now: new Date("2026-03-20T10:00:00.000Z"),
      startAt: "2026-03-20T10:00:00.000Z"
    }),
    false
  );
  assert.equal(
    canCancelOperationalBooking({
      now: new Date("2026-03-20T08:00:00.000Z"),
      startAt: "2026-03-20T10:00:00.000Z",
      status: "accepted"
    }),
    true
  );
  assert.equal(
    canCancelOperationalBooking({
      now: new Date("2026-03-20T10:00:00.000Z"),
      startAt: "2026-03-20T10:00:00.000Z",
      status: "accepted"
    }),
    false
  );
  assert.equal(
    canCancelOperationalBooking({
      now: new Date("2026-03-20T08:00:00.000Z"),
      startAt: "2026-03-20T10:00:00.000Z",
      status: "canceled"
    }),
    false
  );
  assert.equal(
    canRescheduleOperationalBooking({
      now: new Date("2026-03-20T08:00:00.000Z"),
      startAt: "2026-03-20T10:00:00.000Z",
      status: "accepted"
    }),
    true
  );
  assert.equal(
    canRescheduleOperationalBooking({
      now: new Date("2026-03-20T08:00:00.000Z"),
      startAt: "2026-03-20T10:00:00.000Z",
      status: "rescheduled"
    }),
    false
  );
});
