import assert from "node:assert/strict";
import test from "node:test";

import { createCalendarBlockForOwner, deleteCalendarBlockForOwner } from "../lib/server-actions/calendar.ts";
import { createSupabaseMock } from "./helpers/mock-supabase.mjs";

// ---------------------------------------------------------------------------
// Mock RPC handlers
// ---------------------------------------------------------------------------

// Simulates create_calendar_block_for_horse DB function:
//   - Inserts block into calendar_blocks
//   - Cancels stornierbare bookings (overlap + start_at >= now + accepted + no recurrence)
//   - Writes calendar_block_created domain event (same transaction)
//   - Returns [{ block_id, cancelled_booking_ids }]
function createCalendarBlockHandler() {
  return ({ args, state }) => {
    const now = new Date().toISOString();

    if (!state.tables.calendar_blocks) state.tables.calendar_blocks = [];
    if (!state.tables.domain_events) state.tables.domain_events = [];

    const blockId = `block-${state.tables.calendar_blocks.length + 1}`;

    state.tables.calendar_blocks.push({
      created_at: now,
      end_at: args.p_end_at,
      horse_id: args.p_horse_id,
      id: blockId,
      start_at: args.p_start_at,
      title: args.p_title ?? null
    });

    const cancelledIds = [];

    for (const booking of state.tables.bookings ?? []) {
      if (booking.horse_id !== args.p_horse_id) continue;
      // Overlap: booking.start_at < block.end_at AND booking.end_at > block.start_at
      if (!(booking.start_at < args.p_end_at && booking.end_at > args.p_start_at)) continue;
      // Stornierbar: not yet started
      if (booking.start_at < now) continue;

      const request = (state.tables.booking_requests ?? []).find((r) => r.id === booking.booking_request_id);
      if (!request || request.status !== "accepted" || request.recurrence_rrule) continue;

      // Cancel via same logic as _cancel_booking_data
      request.status = "canceled";
      cancelledIds.push(booking.id);
    }

    // Remove cancelled bookings from table
    if (cancelledIds.length > 0) {
      state.tables.bookings = (state.tables.bookings ?? []).filter((b) => !cancelledIds.includes(b.id));
    }

    // Write domain event (simulates DB-side write in same transaction)
    state.tables.domain_events.push({
      event_type: "calendar_block_created",
      horse_id: args.p_horse_id,
      payload: {
        block_id: blockId,
        cancelled_booking_ids: cancelledIds,
        end_at: args.p_end_at,
        start_at: args.p_start_at,
        title: args.p_title ?? null
      },
      rider_id: null
    });

    return { data: [{ block_id: blockId, cancelled_booking_ids: cancelledIds }], error: null };
  };
}

// Simulates delete_calendar_block_for_horse DB function:
//   - Deletes block from calendar_blocks
//   - Writes calendar_block_deleted domain event (same transaction)
function createDeleteCalendarBlockHandler() {
  return ({ args, state }) => {
    if (!state.tables.domain_events) state.tables.domain_events = [];

    const block = (state.tables.calendar_blocks ?? []).find((b) => b.id === args.p_block_id);

    if (!block) {
      return { data: null, error: { message: "NOT_FOUND" } };
    }

    state.tables.calendar_blocks = state.tables.calendar_blocks.filter((b) => b.id !== args.p_block_id);

    state.tables.domain_events.push({
      event_type: "calendar_block_deleted",
      horse_id: block.horse_id,
      payload: {
        block_id: args.p_block_id,
        end_at: block.end_at,
        start_at: block.start_at,
        title: block.title ?? null
      },
      rider_id: null
    });

    return { data: null, error: null };
  };
}

// ---------------------------------------------------------------------------
// Shared seed fragments
// ---------------------------------------------------------------------------

function makeFutureBooking(overrides = {}) {
  return {
    availability_rule_id: "rule-1",
    booking_request_id: "request-1",
    end_at: "2026-03-20T12:00:00.000Z",
    horse_id: "horse-1",
    id: "booking-1",
    rider_id: "rider-1",
    slot_id: "slot-1",
    start_at: "2026-03-20T10:00:00.000Z",
    ...overrides
  };
}

function makeFutureRequest(overrides = {}) {
  return {
    availability_rule_id: "rule-1",
    horse_id: "horse-1",
    id: "request-1",
    recurrence_rrule: null,
    requested_end_at: "2026-03-20T12:00:00.000Z",
    requested_start_at: "2026-03-20T10:00:00.000Z",
    rider_id: "rider-1",
    slot_id: "slot-1",
    status: "accepted",
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// createCalendarBlockForOwner tests
// ---------------------------------------------------------------------------

test("Owner-Block anlegen ohne Ueberlappung: Block wird erstellt, keine Stornierungen", async () => {
  const supabase = createSupabaseMock(
    {
      booking_requests: [makeFutureRequest()],
      bookings: [makeFutureBooking({ end_at: "2026-03-21T12:00:00.000Z", start_at: "2026-03-21T10:00:00.000Z" })],
      calendar_blocks: [],
      domain_events: [],
      horses: [{ id: "horse-1", owner_id: "owner-1" }]
    },
    { rpcHandlers: { create_calendar_block_for_horse: createCalendarBlockHandler() } }
  );

  const result = await createCalendarBlockForOwner({
    endAt: "2026-03-20T12:00:00.000Z",
    horseId: "horse-1",
    logSupabaseError: () => {},
    startAt: "2026-03-20T10:00:00.000Z",
    supabase,
    title: "Turnier"
  });

  assert.equal(result.ok, true);
  assert.equal(result.cancelledBookingIds.length, 0);
  assert.equal(supabase.state.tables.calendar_blocks.length, 1);
  assert.equal(supabase.state.tables.calendar_blocks[0].title, "Turnier");
  assert.equal(supabase.state.tables.bookings.length, 1, "Nicht-ueberlappende Buchung bleibt");

  // DB-seitiges Event vorhanden, kein booking_cancelled (JS-Schicht)
  assert.equal(supabase.state.tables.domain_events.length, 1);
  assert.equal(supabase.state.tables.domain_events[0].event_type, "calendar_block_created");
  assert.equal(supabase.state.tables.domain_events[0].horse_id, "horse-1");
  assert.equal(supabase.state.tables.domain_events[0].payload.block_id, "block-1");
  assert.equal(supabase.state.tables.domain_events[0].payload.title, "Turnier");
  assert.deepEqual(supabase.state.tables.domain_events[0].payload.cancelled_booking_ids, []);
});

test("Owner-Block storniert ueberlappende zukuenftige accepted Buchung", async () => {
  // Block 10:00-12:00 overlaps with booking 10:00-12:00 on the same day
  const supabase = createSupabaseMock(
    {
      booking_requests: [makeFutureRequest()],
      bookings: [makeFutureBooking()],
      calendar_blocks: [],
      domain_events: [],
      horses: [{ id: "horse-1", owner_id: "owner-1" }]
    },
    { rpcHandlers: { create_calendar_block_for_horse: createCalendarBlockHandler() } }
  );

  const result = await createCalendarBlockForOwner({
    endAt: "2026-03-20T12:00:00.000Z",
    horseId: "horse-1",
    logSupabaseError: () => {},
    startAt: "2026-03-20T10:00:00.000Z",
    supabase
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.cancelledBookingIds, ["booking-1"]);
  assert.equal(supabase.state.tables.bookings.length, 0, "Stornierte Buchung aus bookings entfernt");
  assert.equal(supabase.state.tables.booking_requests[0].status, "canceled");

  // calendar_block_created (DB) + booking_cancelled (JS-Schicht)
  assert.equal(supabase.state.tables.domain_events.length, 2);
  assert.equal(supabase.state.tables.domain_events[0].event_type, "calendar_block_created");
  assert.deepEqual(supabase.state.tables.domain_events[0].payload.cancelled_booking_ids, ["booking-1"]);
  assert.equal(supabase.state.tables.domain_events[1].event_type, "booking_cancelled");
  assert.equal(supabase.state.tables.domain_events[1].payload.booking_id, "booking-1");
  assert.equal(supabase.state.tables.domain_events[1].payload.reason, "owner_block");
});

test("Owner-Block laesst bereits begonnene Buchung (start_at < now) unangetastet", async () => {
  // Booking started March 1 (clearly past), ends April 1 — overlaps with future block
  const supabase = createSupabaseMock(
    {
      booking_requests: [makeFutureRequest({ requested_end_at: "2026-04-01T10:00:00.000Z", requested_start_at: "2026-03-01T10:00:00.000Z" })],
      bookings: [makeFutureBooking({ end_at: "2026-04-01T10:00:00.000Z", start_at: "2026-03-01T10:00:00.000Z" })],
      calendar_blocks: [],
      domain_events: [],
      horses: [{ id: "horse-1", owner_id: "owner-1" }]
    },
    { rpcHandlers: { create_calendar_block_for_horse: createCalendarBlockHandler() } }
  );

  // Block March 20 — overlaps the ongoing booking, but booking.start_at < now
  const result = await createCalendarBlockForOwner({
    endAt: "2026-03-20T12:00:00.000Z",
    horseId: "horse-1",
    logSupabaseError: () => {},
    startAt: "2026-03-20T10:00:00.000Z",
    supabase
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.cancelledBookingIds, []);
  assert.equal(supabase.state.tables.bookings.length, 1, "Bereits begonnene Buchung bleibt");
  assert.equal(supabase.state.tables.booking_requests[0].status, "accepted", "Status unveraendert");

  // Only DB-side event, no JS-side booking_cancelled
  assert.equal(supabase.state.tables.domain_events.length, 1);
  assert.equal(supabase.state.tables.domain_events[0].event_type, "calendar_block_created");
});

test("Owner-Block laesst recurring accepted Buchung unangetastet (V1-Einschraenkung)", async () => {
  const supabase = createSupabaseMock(
    {
      booking_requests: [makeFutureRequest({ recurrence_rrule: "FREQ=WEEKLY;COUNT=4" })],
      bookings: [makeFutureBooking()],
      calendar_blocks: [],
      domain_events: [],
      horses: [{ id: "horse-1", owner_id: "owner-1" }]
    },
    { rpcHandlers: { create_calendar_block_for_horse: createCalendarBlockHandler() } }
  );

  const result = await createCalendarBlockForOwner({
    endAt: "2026-03-20T12:00:00.000Z",
    horseId: "horse-1",
    logSupabaseError: () => {},
    startAt: "2026-03-20T10:00:00.000Z",
    supabase
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.cancelledBookingIds, []);
  assert.equal(supabase.state.tables.bookings.length, 1, "Recurring Buchung bleibt");
  assert.equal(supabase.state.tables.booking_requests[0].status, "accepted");
  assert.equal(supabase.state.tables.domain_events.length, 1);
  assert.equal(supabase.state.tables.domain_events[0].event_type, "calendar_block_created");
});

test("Owner-Block laesst bereits stornierte Buchung (status != accepted) unangetastet", async () => {
  const supabase = createSupabaseMock(
    {
      booking_requests: [makeFutureRequest({ status: "canceled" })],
      bookings: [makeFutureBooking()],
      calendar_blocks: [],
      domain_events: [],
      horses: [{ id: "horse-1", owner_id: "owner-1" }]
    },
    { rpcHandlers: { create_calendar_block_for_horse: createCalendarBlockHandler() } }
  );

  const result = await createCalendarBlockForOwner({
    endAt: "2026-03-20T12:00:00.000Z",
    horseId: "horse-1",
    logSupabaseError: () => {},
    startAt: "2026-03-20T10:00:00.000Z",
    supabase
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.cancelledBookingIds, []);
  assert.equal(supabase.state.tables.bookings.length, 1, "Canceled Buchung bleibt");
  assert.equal(supabase.state.tables.domain_events.length, 1);
});

test("Owner-Block mit gemischten Buchungen storniert nur die stornierbaren", async () => {
  // booking-A: future, accepted, no recurrence -> stornierbar
  // booking-B: future, accepted, no recurrence -> stornierbar
  // booking-C: past start (already started) -> nicht stornierbar
  // booking-D: future, accepted, has recurrence -> nicht stornierbar (V1)
  const supabase = createSupabaseMock(
    {
      booking_requests: [
        makeFutureRequest({ id: "request-A", requested_end_at: "2026-03-20T11:00:00.000Z", requested_start_at: "2026-03-20T09:00:00.000Z" }),
        makeFutureRequest({ id: "request-B", requested_end_at: "2026-03-20T14:00:00.000Z", requested_start_at: "2026-03-20T11:00:00.000Z" }),
        makeFutureRequest({ id: "request-C", requested_end_at: "2026-04-01T10:00:00.000Z", requested_start_at: "2026-03-01T10:00:00.000Z" }),
        makeFutureRequest({ id: "request-D", recurrence_rrule: "FREQ=WEEKLY;COUNT=4" })
      ],
      bookings: [
        makeFutureBooking({ booking_request_id: "request-A", end_at: "2026-03-20T11:00:00.000Z", id: "booking-A", start_at: "2026-03-20T09:00:00.000Z" }),
        makeFutureBooking({ booking_request_id: "request-B", end_at: "2026-03-20T14:00:00.000Z", id: "booking-B", start_at: "2026-03-20T11:00:00.000Z" }),
        makeFutureBooking({ booking_request_id: "request-C", end_at: "2026-04-01T10:00:00.000Z", id: "booking-C", start_at: "2026-03-01T10:00:00.000Z" }),
        makeFutureBooking({ booking_request_id: "request-D", id: "booking-D" })
      ],
      calendar_blocks: [],
      domain_events: [],
      horses: [{ id: "horse-1", owner_id: "owner-1" }]
    },
    { rpcHandlers: { create_calendar_block_for_horse: createCalendarBlockHandler() } }
  );

  // Block covers 08:00-15:00 on 2026-03-20: overlaps A, B, C, D
  const result = await createCalendarBlockForOwner({
    endAt: "2026-03-20T15:00:00.000Z",
    horseId: "horse-1",
    logSupabaseError: () => {},
    startAt: "2026-03-20T08:00:00.000Z",
    supabase
  });

  assert.equal(result.ok, true);
  assert.equal(result.cancelledBookingIds.length, 2);
  assert.ok(result.cancelledBookingIds.includes("booking-A"));
  assert.ok(result.cancelledBookingIds.includes("booking-B"));

  // C (started) and D (recurring) remain
  assert.equal(supabase.state.tables.bookings.length, 2);
  const remainingIds = supabase.state.tables.bookings.map((b) => b.id);
  assert.ok(remainingIds.includes("booking-C"));
  assert.ok(remainingIds.includes("booking-D"));

  // 1 calendar_block_created (DB) + 2 booking_cancelled (JS-Schicht)
  assert.equal(supabase.state.tables.domain_events.length, 3);
  assert.equal(supabase.state.tables.domain_events[0].event_type, "calendar_block_created");
  assert.equal(supabase.state.tables.domain_events.filter((e) => e.event_type === "booking_cancelled").length, 2);
});

test("Owner-Block schlaegt fehl wenn Caller nicht Owner ist (RPC NOT_ALLOWED)", async () => {
  const supabase = createSupabaseMock(
    { calendar_blocks: [], domain_events: [], horses: [{ id: "horse-1", owner_id: "owner-1" }] },
    { rpcHandlers: { create_calendar_block_for_horse: () => ({ data: null, error: { message: "NOT_ALLOWED" } }) } }
  );

  const result = await createCalendarBlockForOwner({
    endAt: "2026-03-20T12:00:00.000Z",
    horseId: "horse-1",
    logSupabaseError: () => {},
    startAt: "2026-03-20T10:00:00.000Z",
    supabase
  });

  assert.equal(result.ok, false);
  assert.equal(supabase.state.tables.calendar_blocks.length, 0, "Kein Block angelegt");
  assert.equal(supabase.state.tables.domain_events.length, 0, "Kein Event geschrieben");
});

test("Owner-Block schlaegt fehl bei ungueltiger Zeitspanne (RPC INVALID_TIME_RANGE)", async () => {
  const supabase = createSupabaseMock(
    { calendar_blocks: [], domain_events: [], horses: [{ id: "horse-1", owner_id: "owner-1" }] },
    { rpcHandlers: { create_calendar_block_for_horse: () => ({ data: null, error: { message: "INVALID_TIME_RANGE" } }) } }
  );

  const result = await createCalendarBlockForOwner({
    endAt: "2026-03-20T10:00:00.000Z", // end <= start
    horseId: "horse-1",
    logSupabaseError: () => {},
    startAt: "2026-03-20T12:00:00.000Z",
    supabase
  });

  assert.equal(result.ok, false);
  assert.equal(supabase.state.tables.calendar_blocks.length, 0);
});

// ---------------------------------------------------------------------------
// deleteCalendarBlockForOwner tests
// ---------------------------------------------------------------------------

test("Owner-Block loeschen: Block entfernt, calendar_block_deleted Event geschrieben", async () => {
  const supabase = createSupabaseMock(
    {
      calendar_blocks: [
        {
          created_at: "2026-03-13T08:00:00.000Z",
          end_at: "2026-03-20T12:00:00.000Z",
          horse_id: "horse-1",
          id: "block-1",
          start_at: "2026-03-20T10:00:00.000Z",
          title: "Turnier"
        }
      ],
      domain_events: [],
      horses: [{ id: "horse-1", owner_id: "owner-1" }]
    },
    { rpcHandlers: { delete_calendar_block_for_horse: createDeleteCalendarBlockHandler() } }
  );

  const result = await deleteCalendarBlockForOwner({
    blockId: "block-1",
    horseId: "horse-1",
    logSupabaseError: () => {},
    supabase
  });

  assert.equal(result.ok, true);
  assert.equal(supabase.state.tables.calendar_blocks.length, 0, "Block geloescht");

  assert.equal(supabase.state.tables.domain_events.length, 1);
  const event = supabase.state.tables.domain_events[0];
  assert.equal(event.event_type, "calendar_block_deleted");
  assert.equal(event.horse_id, "horse-1");
  assert.equal(event.payload.block_id, "block-1");
  assert.equal(event.payload.start_at, "2026-03-20T10:00:00.000Z");
  assert.equal(event.payload.end_at, "2026-03-20T12:00:00.000Z");
  assert.equal(event.payload.title, "Turnier");
});

test("Owner-Block loeschen schlaegt fehl wenn Block nicht existiert (NOT_FOUND)", async () => {
  const supabase = createSupabaseMock(
    { calendar_blocks: [], domain_events: [], horses: [{ id: "horse-1", owner_id: "owner-1" }] },
    { rpcHandlers: { delete_calendar_block_for_horse: createDeleteCalendarBlockHandler() } }
  );

  const result = await deleteCalendarBlockForOwner({
    blockId: "block-does-not-exist",
    horseId: "horse-1",
    logSupabaseError: () => {},
    supabase
  });

  assert.equal(result.ok, false);
  assert.equal(supabase.state.tables.domain_events.length, 0, "Kein Event geschrieben");
});

test("Owner-Block loeschen schlaegt fehl wenn Caller nicht Owner ist (NOT_ALLOWED)", async () => {
  const supabase = createSupabaseMock(
    { calendar_blocks: [], domain_events: [], horses: [{ id: "horse-1", owner_id: "owner-1" }] },
    { rpcHandlers: { delete_calendar_block_for_horse: () => ({ data: null, error: { message: "NOT_ALLOWED" } }) } }
  );

  const result = await deleteCalendarBlockForOwner({
    blockId: "block-1",
    horseId: "horse-1",
    logSupabaseError: () => {},
    supabase
  });

  assert.equal(result.ok, false);
  assert.equal(supabase.state.tables.domain_events.length, 0, "Kein Event geschrieben");
});
