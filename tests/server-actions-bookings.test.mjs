import assert from "node:assert/strict";
import test from "node:test";

import { acceptBookingRequestForOwner, requestBookingForRider } from "../lib/server-actions/bookings.ts";
import { createSupabaseMock } from "./helpers/mock-supabase.mjs";

function createOperationalBookingForm() {
  const formData = new FormData();
  formData.set("horseId", "horse-1");
  formData.set("ruleId", "rule-1");
  formData.set("startAt", "2026-03-20T10:00:00.000Z");
  formData.set("endAt", "2026-03-20T11:00:00.000Z");
  return formData;
}

test("Aktive Beziehung darf operative Direktbuchung ausloesen, Konflikte scheitern serverseitig sauber", async () => {
  const successSupabase = createSupabaseMock(
    {
      approvals: [{ horse_id: "horse-1", rider_id: "rider-1", status: "approved" }],
      availability_rules: [
        {
          active: true,
          created_at: "2026-03-19T08:00:00.000Z",
          end_at: "2026-03-20T12:00:00.000Z",
          horse_id: "horse-1",
          id: "rule-1",
          is_trial_slot: false,
          slot_id: "slot-1",
          start_at: "2026-03-20T09:00:00.000Z"
        }
      ],
      bookings: [],
      calendar_blocks: []
    },
    {
      rpcHandlers: {
        direct_book_operational_slot: () => ({ data: "booking-request-1", error: null })
      }
    }
  );

  const successResult = await requestBookingForRider({
    formData: createOperationalBookingForm(),
    logSupabaseError: () => {},
    supabase: successSupabase,
    userId: "rider-1"
  });

  assert.equal(successResult.ok, true);
  assert.equal(successResult.message, "Der Slot wurde direkt gebucht.");
  assert.deepEqual(successSupabase.state.rpcCalls.map((call) => call.name), ["direct_book_operational_slot"]);

  const conflictSupabase = createSupabaseMock(
    {
      approvals: [{ horse_id: "horse-1", rider_id: "rider-1", status: "approved" }],
      availability_rules: [
        {
          active: true,
          created_at: "2026-03-19T08:00:00.000Z",
          end_at: "2026-03-20T12:00:00.000Z",
          horse_id: "horse-1",
          id: "rule-1",
          is_trial_slot: false,
          slot_id: "slot-1",
          start_at: "2026-03-20T09:00:00.000Z"
        }
      ],
      bookings: [],
      calendar_blocks: []
    },
    {
      rpcHandlers: {
        direct_book_operational_slot: () => ({ data: null, error: { message: "TIME_UNAVAILABLE" } })
      }
    }
  );

  const conflictResult = await requestBookingForRider({
    formData: createOperationalBookingForm(),
    logSupabaseError: () => {},
    supabase: conflictSupabase,
    userId: "rider-1"
  });

  assert.equal(conflictResult.ok, false);
  assert.equal(conflictResult.message, "Der angefragte Termin ist nicht mehr verfuegbar.");
});

test("Revoked sperrt operative Rider-Buchung sofort und Owner-Accept meldet Konflikte ueber die RPC-Grenze", async () => {
  const revokedSupabase = createSupabaseMock({
    approvals: [{ horse_id: "horse-1", rider_id: "rider-1", status: "revoked" }],
    availability_rules: [
      {
        active: true,
        created_at: "2026-03-19T08:00:00.000Z",
        end_at: "2026-03-20T12:00:00.000Z",
        horse_id: "horse-1",
        id: "rule-1",
        is_trial_slot: false,
        slot_id: "slot-1",
        start_at: "2026-03-20T09:00:00.000Z"
      }
    ],
    bookings: [],
    calendar_blocks: []
  });

  const revokedResult = await requestBookingForRider({
    formData: createOperationalBookingForm(),
    logSupabaseError: () => {},
    supabase: revokedSupabase,
    userId: "rider-1"
  });

  assert.equal(revokedResult.ok, false);
  assert.equal(revokedResult.message, "Nur freigeschaltete Reiter koennen einen Termin anfragen.");
  assert.equal(revokedSupabase.state.rpcCalls.length, 0);

  const ownerSupabase = createSupabaseMock(
    {
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
          status: "requested"
        }
      ],
      horses: [{ id: "horse-1", owner_id: "owner-1" }]
    },
    {
      rpcHandlers: {
        accept_booking_request: () => ({ data: null, error: { message: "TIME_UNAVAILABLE" } })
      }
    }
  );

  const acceptResult = await acceptBookingRequestForOwner({
    logSupabaseError: () => {},
    ownerId: "owner-1",
    requestId: "request-1",
    supabase: ownerSupabase
  });

  assert.equal(acceptResult.ok, false);
  assert.equal(acceptResult.message, "Der angefragte Termin ist nicht mehr verfuegbar.");
  assert.deepEqual(ownerSupabase.state.rpcCalls.map((call) => call.name), ["accept_booking_request"]);
});
