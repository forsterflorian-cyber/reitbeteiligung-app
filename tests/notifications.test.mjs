import assert from "node:assert/strict";
import test from "node:test";

import { createNotification } from "../lib/notifications.ts";
import { getUserNotifications, getUnreadNotificationCount, markNotificationRead } from "../lib/server-actions/notifications.ts";
import { cancelOperationalBookingForRider } from "../lib/server-actions/bookings.ts";
import { updateTrialRequestStatusForOwner } from "../lib/server-actions/trial-actions.ts";
import { createSupabaseMock } from "./helpers/mock-supabase.mjs";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function makeNotificationRpcHandler() {
  return ({ args, state }) => {
    if (!state.tables.notifications) state.tables.notifications = [];
    const id = `notif-${state.tables.notifications.length + 1}`;
    state.tables.notifications.push({ id, ...args });
    return { data: id, error: null };
  };
}

// ---------------------------------------------------------------------------
// createNotification unit tests
// ---------------------------------------------------------------------------

test("createNotification normalfall: insert_notification RPC aufgerufen, kein throw", async () => {
  const supabase = createSupabaseMock(
    { notifications: [] },
    { rpcHandlers: { insert_notification: makeNotificationRpcHandler() } }
  );

  await createNotification(supabase, {
    eventType: "trial_accepted",
    horseId: "horse-1",
    payload: { request_id: "req-1" },
    userId: "rider-1"
  });

  assert.equal(supabase.state.rpcCalls.some((c) => c.name === "insert_notification"), true);
  assert.equal(supabase.state.tables.notifications.length, 1);
  assert.equal(supabase.state.tables.notifications[0].p_user_id, "rider-1");
  assert.equal(supabase.state.tables.notifications[0].p_event_type, "trial_accepted");
});

test("createNotification RPC-Fehler: Fehler wird geschluckt, kein throw", async () => {
  const supabase = createSupabaseMock(
    {},
    { rpcHandlers: { insert_notification: () => ({ data: null, error: { message: "DB_ERROR" } }) } }
  );

  // Must not throw
  await assert.doesNotReject(() =>
    createNotification(supabase, {
      eventType: "booking_cancelled",
      horseId: "horse-1",
      payload: { reason: "manual" },
      userId: "rider-1"
    })
  );
});

// ---------------------------------------------------------------------------
// getUserNotifications tests
// ---------------------------------------------------------------------------

test("getUserNotifications gibt Notifications des Users zurueck", async () => {
  const supabase = createSupabaseMock({
    notifications: [
      { id: "n-1", user_id: "user-1", event_type: "booking_created", horse_id: "h-1", payload: {}, read_at: null, created_at: "2026-03-13T10:00:00Z" },
      { id: "n-2", user_id: "user-1", event_type: "trial_accepted", horse_id: "h-1", payload: {}, read_at: "2026-03-12T09:00:00Z", created_at: "2026-03-12T08:00:00Z" }
    ]
  });

  const result = await getUserNotifications(supabase);

  assert.equal(result.length, 2);
  assert.equal(result[0].id, "n-1");
  assert.equal(result[1].id, "n-2");
});

test("getUserNotifications gibt leeres Array zurueck wenn keine Notifications vorhanden", async () => {
  const supabase = createSupabaseMock({ notifications: [] });
  const result = await getUserNotifications(supabase);
  assert.deepEqual(result, []);
});

// ---------------------------------------------------------------------------
// getUnreadNotificationCount tests
// ---------------------------------------------------------------------------

test("getUnreadNotificationCount zaehlt nur ungelesene Notifications", async () => {
  const supabase = createSupabaseMock({
    notifications: [
      { id: "n-1", user_id: "user-1", event_type: "booking_created", read_at: null, created_at: "2026-03-13T10:00:00Z" },
      { id: "n-2", user_id: "user-1", event_type: "trial_accepted", read_at: null, created_at: "2026-03-12T08:00:00Z" },
      { id: "n-3", user_id: "user-1", event_type: "booking_cancelled", read_at: "2026-03-11T08:00:00Z", created_at: "2026-03-11T07:00:00Z" }
    ]
  });

  const count = await getUnreadNotificationCount(supabase);
  assert.equal(count, 2);
});

test("getUnreadNotificationCount gibt 0 zurueck wenn alle gelesen", async () => {
  const supabase = createSupabaseMock({
    notifications: [
      { id: "n-1", user_id: "user-1", event_type: "booking_created", read_at: "2026-03-10T10:00:00Z", created_at: "2026-03-10T09:00:00Z" }
    ]
  });

  const count = await getUnreadNotificationCount(supabase);
  assert.equal(count, 0);
});

// ---------------------------------------------------------------------------
// markNotificationRead tests
// ---------------------------------------------------------------------------

test("markNotificationRead normalfall: read_at gesetzt", async () => {
  const supabase = createSupabaseMock({
    notifications: [
      { id: "n-1", user_id: "user-1", event_type: "booking_created", read_at: null, created_at: "2026-03-13T10:00:00Z" }
    ]
  });

  await markNotificationRead(supabase, "n-1");

  const notification = supabase.state.tables.notifications.find((n) => n.id === "n-1");
  assert.notEqual(notification.read_at, null, "read_at soll gesetzt sein");
});

test("markNotificationRead ist idempotent (bereits gelesen → kein throw, kein zweites Update)", async () => {
  const existingReadAt = "2026-03-12T08:00:00Z";
  const supabase = createSupabaseMock({
    notifications: [
      { id: "n-1", user_id: "user-1", event_type: "booking_created", read_at: existingReadAt, created_at: "2026-03-12T07:00:00Z" }
    ]
  });

  await assert.doesNotReject(() => markNotificationRead(supabase, "n-1"));

  // read_at should not change (is filter prevents update on already-read row)
  const notification = supabase.state.tables.notifications.find((n) => n.id === "n-1");
  assert.equal(notification.read_at, existingReadAt, "read_at unveraendert");
});

test("markNotificationRead mit fehlender Notification: kein throw", async () => {
  const supabase = createSupabaseMock({ notifications: [] });
  await assert.doesNotReject(() => markNotificationRead(supabase, "does-not-exist"));
});

// ---------------------------------------------------------------------------
// Event-wiring integration tests
// ---------------------------------------------------------------------------

test("booking_cancelled (manual, Rider storniert): Notification fuer Rider mit reason: manual", async () => {
  const futureStart = "2026-04-01T10:00:00.000Z";
  const futureEnd = "2026-04-01T12:00:00.000Z";

  const supabase = createSupabaseMock(
    {
      bookings: [
        {
          id: "booking-1",
          booking_request_id: "req-1",
          horse_id: "horse-1",
          rider_id: "rider-1",
          start_at: futureStart,
          end_at: futureEnd
        }
      ],
      booking_requests: [{ id: "req-1", status: "accepted", recurrence_rrule: null }],
      domain_events: [],
      notifications: []
    },
    {
      rpcHandlers: {
        cancel_operational_booking: () => ({ data: null, error: null }),
        insert_notification: makeNotificationRpcHandler()
      }
    }
  );

  const result = await cancelOperationalBookingForRider({
    bookingId: "booking-1",
    logSupabaseError: () => {},
    riderId: "rider-1",
    supabase
  });

  assert.equal(result.ok, true);
  assert.equal(supabase.state.tables.notifications.length, 1);

  const notif = supabase.state.tables.notifications[0];
  assert.equal(notif.p_user_id, "rider-1");
  assert.equal(notif.p_event_type, "booking_cancelled");
  assert.equal(notif.p_payload.reason, "manual");
  assert.equal(notif.p_payload.start_at, futureStart);
  assert.equal(notif.p_payload.end_at, futureEnd);
});

test("booking_created (Owner nimmt Anfrage an): keine Notification", async () => {
  const supabase = createSupabaseMock(
    {
      booking_requests: [
        {
          id: "req-1",
          horse_id: "horse-1",
          rider_id: "rider-1",
          status: "requested",
          requested_start_at: "2026-04-01T10:00:00.000Z",
          requested_end_at: "2026-04-01T12:00:00.000Z",
          recurrence_rrule: null,
          availability_rule_id: "rule-1",
          slot_id: "slot-1",
          created_at: "2026-03-13T08:00:00Z"
        }
      ],
      horses: [{ id: "horse-1", owner_id: "owner-1" }],
      domain_events: [],
      notifications: []
    },
    {
      rpcHandlers: {
        accept_booking_request: () => ({ data: null, error: null }),
        insert_notification: makeNotificationRpcHandler()
      }
    }
  );

  const result = await (await import("../lib/server-actions/bookings.ts")).acceptBookingRequestForOwner({
    logSupabaseError: () => {},
    ownerId: "owner-1",
    requestId: "req-1",
    supabase
  });

  assert.equal(result.ok, true);
  assert.equal(supabase.state.tables.notifications.length, 0, "Keine Selbst-Notification fuer Owner");
});

test("trial_accepted: Notification fuer Rider", async () => {
  const supabase = createSupabaseMock(
    {
      trial_requests: [{ id: "req-1", horse_id: "horse-1", rider_id: "rider-1", status: "requested" }],
      horses: [{ id: "horse-1", owner_id: "owner-1" }],
      domain_events: [],
      notifications: []
    },
    { rpcHandlers: { insert_notification: makeNotificationRpcHandler() } }
  );

  const result = await updateTrialRequestStatusForOwner({
    logSupabaseError: () => {},
    nextStatus: "accepted",
    ownerId: "owner-1",
    requestId: "req-1",
    supabase
  });

  assert.equal(result.ok, true);
  assert.equal(supabase.state.tables.notifications.length, 1);

  const notif = supabase.state.tables.notifications[0];
  assert.equal(notif.p_user_id, "rider-1");
  assert.equal(notif.p_event_type, "trial_accepted");
  assert.equal(notif.p_payload.request_id, "req-1");
});

test("booking_cancelled (owner_block): Notification fuer Rider mit reason: owner_block", async () => {
  // Tests calendar.ts createCalendarBlockForOwner wiring
  const { createCalendarBlockForOwner } = await import("../lib/server-actions/calendar.ts");

  const futureStart = "2026-04-01T10:00:00.000Z";
  const futureEnd = "2026-04-01T12:00:00.000Z";

  const supabase = createSupabaseMock(
    {
      bookings: [
        {
          id: "booking-1",
          booking_request_id: "req-1",
          horse_id: "horse-1",
          rider_id: "rider-1",
          start_at: futureStart,
          end_at: futureEnd
        }
      ],
      booking_requests: [{ id: "req-1", status: "accepted", recurrence_rrule: null }],
      calendar_blocks: [],
      domain_events: [],
      notifications: []
    },
    {
      rpcHandlers: {
        create_calendar_block_for_horse: ({ args, state }) => {
          // Simulate extended RPC: returns cancelled booking with rider_id, start_at, end_at
          const blockId = "block-1";
          state.tables.calendar_blocks.push({ id: blockId, horse_id: args.p_horse_id, start_at: args.p_start_at, end_at: args.p_end_at, title: args.p_title });
          return {
            data: [
              {
                block_id: blockId,
                cancelled_booking_ids: ["booking-1"],
                cancelled_rider_ids: ["rider-1"],
                cancelled_start_ats: [futureStart],
                cancelled_end_ats: [futureEnd]
              }
            ],
            error: null
          };
        },
        insert_notification: makeNotificationRpcHandler()
      }
    }
  );

  const result = await createCalendarBlockForOwner({
    endAt: "2026-04-01T14:00:00.000Z",
    horseId: "horse-1",
    logSupabaseError: () => {},
    startAt: "2026-04-01T08:00:00.000Z",
    supabase
  });

  assert.equal(result.ok, true);
  assert.equal(result.cancelledBookingIds.length, 1);

  // One booking_cancelled domain event + one notification
  const notifs = supabase.state.tables.notifications.filter((n) => n.p_event_type === "booking_cancelled");
  assert.equal(notifs.length, 1);
  assert.equal(notifs[0].p_user_id, "rider-1");
  assert.equal(notifs[0].p_payload.reason, "owner_block");
  assert.equal(notifs[0].p_payload.start_at, futureStart);
  assert.equal(notifs[0].p_payload.end_at, futureEnd);
});
