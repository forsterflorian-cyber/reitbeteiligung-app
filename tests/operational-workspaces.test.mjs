import assert from "node:assert/strict";
import test from "node:test";

import { buildOwnerOperationalWorkspaceItems } from "../lib/owner-workspace.ts";
import { buildRiderOperationalWorkspaceItems } from "../lib/rider-workspace.ts";

test("Rider-Workspace zeigt direkte Buchung, Umbuchung und Storno nur fuer aktive Beziehungen", () => {
  const activeRelationships = [
    {
      approval: {
        created_at: "2026-03-19T08:00:00.000Z",
        horse_id: "horse-1",
        rider_id: "rider-1",
        status: "approved"
      },
      conversation: null,
      horse: {
        id: "horse-1",
        plz: "10115",
        title: "Asterix"
      },
      latestTrial: null
    }
  ];
  const rules = [
    {
      active: true,
      created_at: "2026-03-19T08:00:00.000Z",
      end_at: "2026-03-20T11:00:00.000Z",
      horse_id: "horse-1",
      id: "rule-1",
      is_trial_slot: false,
      slot_id: "slot-1",
      start_at: "2026-03-20T10:00:00.000Z"
    },
    {
      active: true,
      created_at: "2026-03-19T08:10:00.000Z",
      end_at: "2026-03-20T13:00:00.000Z",
      horse_id: "horse-1",
      id: "rule-2",
      is_trial_slot: false,
      slot_id: "slot-2",
      start_at: "2026-03-20T12:00:00.000Z"
    }
  ];
  const upcomingBookings = [
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
  ];
  const occupancyByHorseId = new Map([
    [
      "horse-1",
      [
        {
          end_at: "2026-03-20T11:00:00.000Z",
          start_at: "2026-03-20T10:00:00.000Z"
        }
      ]
    ]
  ]);

  const directOverview = buildRiderOperationalWorkspaceItems({
    activeRelationships,
    now: new Date("2026-03-20T08:00:00.000Z"),
    occupancyByHorseId,
    rules,
    upcomingBookings
  });

  assert.equal(directOverview.length, 1);
  assert.equal(directOverview[0].upcomingBookings[0].canCancel, true);
  assert.equal(directOverview[0].upcomingBookings[0].canReschedule, true);
  assert.deepEqual(
    directOverview[0].openSlots.map((slot) => slot.availabilityRuleId),
    ["rule-2"]
  );

  const rescheduleOverview = buildRiderOperationalWorkspaceItems({
    activeRelationships,
    now: new Date("2026-03-20T08:00:00.000Z"),
    occupancyByHorseId,
    rules: [
      ...rules,
      {
        active: true,
        created_at: "2026-03-19T08:15:00.000Z",
        end_at: "2026-03-20T11:30:00.000Z",
        horse_id: "horse-1",
        id: "rule-3",
        is_trial_slot: false,
        slot_id: "slot-3",
        start_at: "2026-03-20T10:30:00.000Z"
      }
    ],
    selectedBookingId: "booking-1",
    upcomingBookings
  });

  assert.equal(rescheduleOverview[0].selectedBooking?.id, "booking-1");
  assert.deepEqual(
    rescheduleOverview[0].openSlots.map((slot) => slot.availabilityRuleId),
    ["rule-3", "rule-2"]
  );

  const revokedOverview = buildRiderOperationalWorkspaceItems({
    activeRelationships: [],
    now: new Date("2026-03-20T08:00:00.000Z"),
    occupancyByHorseId,
    rules,
    upcomingBookings
  });

  assert.deepEqual(revokedOverview, []);
});

test("Owner-Workspace zeigt freie und belegte Slots pro Pferd und blendet leere Faelle aus", () => {
  const horses = [
    {
      active: true,
      created_at: "2026-03-10T08:00:00.000Z",
      description: null,
      id: "horse-1",
      plz: "10115",
      title: "Asterix"
    },
    {
      active: true,
      created_at: "2026-03-10T08:10:00.000Z",
      description: null,
      id: "horse-2",
      plz: "10117",
      title: "Boreas"
    }
  ];
  const activeRelationships = [
    {
      approval: {
        created_at: "2026-03-19T08:00:00.000Z",
        horse_id: "horse-1",
        rider_id: "rider-1",
        status: "approved"
      },
      conversation: null,
      horse: horses[0],
      latestTrial: null
    }
  ];
  const rules = [
    {
      active: true,
      created_at: "2026-03-19T08:00:00.000Z",
      end_at: "2026-03-20T11:00:00.000Z",
      horse_id: "horse-1",
      id: "rule-1",
      is_trial_slot: false,
      slot_id: "slot-1",
      start_at: "2026-03-20T10:00:00.000Z"
    },
    {
      active: true,
      created_at: "2026-03-19T08:10:00.000Z",
      end_at: "2026-03-20T13:00:00.000Z",
      horse_id: "horse-1",
      id: "rule-2",
      is_trial_slot: false,
      slot_id: "slot-2",
      start_at: "2026-03-20T12:00:00.000Z"
    }
  ];
  const upcomingBookings = [
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
  ];

  const overview = buildOwnerOperationalWorkspaceItems({
    activeRelationships,
    blocks: [],
    horses,
    now: new Date("2026-03-20T08:00:00.000Z"),
    riderProfiles: [{ display_name: "Anna", id: "rider-1" }],
    rules,
    upcomingBookings
  });

  assert.equal(overview.length, 1);
  assert.equal(overview[0].horseId, "horse-1");
  assert.equal(overview[0].activeRiderCount, 1);
  assert.equal(overview[0].upcomingBookings[0].riderName, "Anna");
  assert.deepEqual(
    overview[0].openSlots.map((slot) => slot.availabilityRuleId),
    ["rule-2"]
  );
});
