import assert from "node:assert/strict";
import test from "node:test";

import { deleteAvailabilityRuleForOwner } from "../lib/server-actions/calendar-actions.ts";
import {
  getHorseCreateLimitError,
  getHorseDeleteError,
  getHorseValidationError
} from "../lib/server-actions/horse.ts";
import {
  getAvailabilityConflictError,
  getAvailabilityPlannerDayError,
  getAvailabilitySaveError,
  getCalendarBlockQuarterHourError,
  getCalendarBlockSavedMessage
} from "../lib/server-actions/calendar.ts";
import { createSupabaseMock } from "./helpers/mock-supabase.mjs";

test("Pferde-Regeln pruefen Validierung, Tarifgrenzen und Loeschschutz direkt", () => {
  assert.equal(
    getHorseValidationError({
      allowedSexes: ["Stute", "Wallach"],
      birthYear: 1979,
      currentYear: 2026,
      heightCm: null,
      plz: "12345",
      sexValue: null,
      title: "Ab"
    }),
    "Das Geburtsjahr muss zwischen 1980 und 2026 liegen."
  );
  assert.equal(
    getHorseCreateLimitError("Kostenlos", 1),
    "Im Tarif Kostenlos sind 1 Pferd enthalten. Für weitere Pferde brauchst du später den bezahlten Tarif."
  );
  assert.equal(
    getHorseDeleteError("active_relationships"),
    "Pferdeprofile mit aktiven Reitbeteiligungen können nicht gelöscht werden."
  );
});

test("Kalender-Regeln pruefen Konflikte, Planergrenzen und Nachrichten direkt", () => {
  assert.equal(
    getAvailabilityConflictError("update"),
    "Ein anderes Zeitfenster überschneidet sich bereits mit diesem Zeitraum."
  );
  assert.equal(
    getAvailabilityPlannerDayError("move"),
    "Im Planer lässt sich das Zeitfenster nur innerhalb dieses Tages verschieben."
  );
  assert.equal(
    getAvailabilitySaveError("planner_adjust"),
    "Das Zeitfenster konnte nicht im Planer angepasst werden."
  );
  assert.equal(getCalendarBlockQuarterHourError(), "Bitte nutze für Sperren ein 15-Minuten-Raster.");
  assert.equal(getCalendarBlockSavedMessage("delete"), "Die Kalender-Sperre wurde entfernt.");
});

test("Verfuegbarkeitsfenster werden fachlich beendet und behalten Booking-Historie", async () => {
  const supabase = createSupabaseMock({
    availability_rules: [
      {
        active: true,
        created_at: "2026-03-19T08:00:00.000Z",
        end_at: "2026-03-20T11:00:00.000Z",
        horse_id: "horse-1",
        id: "rule-1",
        is_trial_slot: false,
        slot_id: "slot-1",
        start_at: "2026-03-20T10:00:00.000Z"
      }
    ],
    availability_slots: [
      {
        active: true,
        end_at: "2026-03-20T11:00:00.000Z",
        horse_id: "horse-1",
        id: "slot-1",
        start_at: "2026-03-20T10:00:00.000Z"
      }
    ],
    booking_requests: [
      {
        availability_rule_id: "rule-1",
        created_at: "2026-03-19T08:00:00.000Z",
        horse_id: "horse-1",
        id: "request-1",
        recurrence_rrule: null,
        requested_end_at: "2026-03-20T11:00:00.000Z",
        requested_start_at: "2026-03-20T10:00:00.000Z",
        rider_id: "rider-1",
        slot_id: "slot-1",
        status: "accepted"
      }
    ],
    bookings: [
      {
        availability_rule_id: "rule-1",
        booking_request_id: "request-1",
        created_at: "2026-03-19T08:05:00.000Z",
        end_at: "2026-03-20T11:00:00.000Z",
        horse_id: "horse-1",
        id: "booking-1",
        rider_id: "rider-1",
        slot_id: "slot-1",
        start_at: "2026-03-20T10:00:00.000Z"
      }
    ],
    horses: [{ id: "horse-1", owner_id: "owner-1" }]
  });

  const result = await deleteAvailabilityRuleForOwner({
    logSupabaseError: () => {},
    ownerId: "owner-1",
    ruleId: "rule-1",
    supabase
  });

  assert.equal(result.ok, true);
  assert.equal(supabase.state.tables.availability_rules[0].active, false);
  assert.equal(supabase.state.tables.availability_slots[0].active, false);
  assert.equal(supabase.state.tables.booking_requests.length, 1);
  assert.equal(supabase.state.tables.booking_requests[0].status, "accepted");
  assert.equal(supabase.state.tables.bookings.length, 1);
  assert.equal(supabase.state.tables.bookings[0].booking_request_id, "request-1");
});
