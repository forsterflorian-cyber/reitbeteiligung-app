import assert from "node:assert/strict";
import test from "node:test";

import { canAccessOperationalCalendar, getRiderRelationshipSection, hasVisibleRelationshipConversation } from "../lib/relationship-state.ts";
import { cancelTrialRequestForRider } from "../lib/server-actions/trial-actions.ts";
import { removeRelationshipForOwner } from "../lib/server-actions/relationships.ts";
import { createSupabaseMock } from "./helpers/mock-supabase.mjs";

test("Entfernen revokt die Beziehung, bereinigt operative Daten und sperrt Chat-/Kalenderkontext sofort", async () => {
  const supabase = createSupabaseMock({
    approvals: [{ horse_id: "horse-1", rider_id: "rider-1", status: "approved" }],
    booking_requests: [
      {
        created_at: "2026-03-19T07:30:00.000Z",
        horse_id: "horse-1",
        id: "request-1",
        requested_end_at: "2026-03-20T11:00:00.000Z",
        rider_id: "rider-1",
        status: "accepted"
      },
      {
        created_at: "2026-03-10T07:30:00.000Z",
        horse_id: "horse-1",
        id: "request-2",
        requested_end_at: "2026-03-10T11:00:00.000Z",
        rider_id: "rider-1",
        status: "accepted"
      },
      {
        created_at: "2026-03-19T08:00:00.000Z",
        horse_id: "horse-1",
        id: "request-3",
        requested_end_at: "2026-03-21T11:00:00.000Z",
        rider_id: "rider-1",
        status: "requested"
      }
    ],
    bookings: [
      {
        booking_request_id: "request-1",
        end_at: "2026-03-20T11:00:00.000Z",
        horse_id: "horse-1",
        id: "booking-1",
        rider_id: "rider-1"
      },
      {
        booking_request_id: "request-2",
        end_at: "2026-03-10T11:00:00.000Z",
        horse_id: "horse-1",
        id: "booking-2",
        rider_id: "rider-1"
      }
    ],
    horses: [{ id: "horse-1", owner_id: "owner-1" }],
    rider_booking_limits: [{ horse_id: "horse-1", rider_id: "rider-1", updated_at: "2026-03-19T08:00:00.000Z", weekly_hours_limit: 3 }]
  });

  const result = await removeRelationshipForOwner({
    horseId: "horse-1",
    logSupabaseError: () => {},
    ownerId: "owner-1",
    redirectPath: "/owner/reitbeteiligungen",
    riderId: "rider-1",
    supabase
  });

  assert.equal(result.ok, true);
  assert.equal(supabase.state.tables.approvals[0].status, "revoked");
  assert.equal(supabase.state.tables.bookings.length, 1);
  assert.equal(supabase.state.tables.bookings[0].id, "booking-2");
  assert.equal(supabase.state.tables.booking_requests.find((item) => item.id === "request-1")?.status, "canceled");
  assert.equal(supabase.state.tables.booking_requests.find((item) => item.id === "request-2")?.status, "accepted");
  assert.equal(supabase.state.tables.booking_requests.find((item) => item.id === "request-3")?.status, "declined");
  assert.equal(supabase.state.tables.rider_booking_limits.length, 0);
  assert.equal(
    canAccessOperationalCalendar({
      approvalStatus: supabase.state.tables.approvals[0].status,
      isHorseOwner: false,
      viewerRole: "rider"
    }),
    false
  );
  assert.equal(hasVisibleRelationshipConversation("completed", supabase.state.tables.approvals[0].status), false);
});

test("Rider-Rueckzug historisiert den Fall und sortiert ihn sofort ins Archiv", async () => {
  const supabase = createSupabaseMock(
    {
      trial_requests: [
        {
          created_at: "2026-03-19T08:00:00.000Z",
          horse_id: "horse-1",
          id: "trial-1",
          rider_id: "rider-1",
          status: "accepted"
        }
      ]
    },
    {
      rpcHandlers: {
        cancel_rider_trial_request: ({ args, state }) => {
          const request = state.tables.trial_requests.find((item) => item.id === args.p_request_id && item.rider_id === "rider-1");

          if (!request || (request.status !== "requested" && request.status !== "accepted")) {
            return { data: false, error: null };
          }

          request.status = "withdrawn";
          return { data: true, error: null };
        }
      }
    }
  );

  const result = await cancelTrialRequestForRider({
    logSupabaseError: () => {},
    requestId: "trial-1",
    riderId: "rider-1",
    supabase
  });

  assert.equal(result.ok, true);
  assert.equal(supabase.state.tables.trial_requests[0].status, "withdrawn");
  assert.equal(getRiderRelationshipSection(supabase.state.tables.trial_requests[0].status, null), "archive");
  assert.equal(hasVisibleRelationshipConversation(supabase.state.tables.trial_requests[0].status, null), false);
});
