import assert from "node:assert/strict";
import test from "node:test";

import { canAccessOperationalCalendar, hasVisibleRelationshipConversation } from "../lib/relationship-state.ts";
import { removeRelationshipForOwner } from "../lib/server-actions/relationships.ts";
import { createSupabaseMock } from "./helpers/mock-supabase.mjs";

test("Entfernen revokt die Beziehung, bereinigt operative Daten und sperrt Chat-/Kalenderkontext sofort", async () => {
  const supabase = createSupabaseMock({
    approvals: [{ horse_id: "horse-1", rider_id: "rider-1", status: "approved" }],
    booking_requests: [{ horse_id: "horse-1", id: "request-1", rider_id: "rider-1", status: "accepted" }],
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
  assert.equal(supabase.state.tables.booking_requests.length, 0);
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
