import assert from "node:assert/strict";
import test from "node:test";

import { getUpcomingOperationalSlots } from "../lib/operational-slots.ts";
import {
  acceptBookingRequestForOwner,
  cancelOperationalBookingForOwner,
  cancelOperationalBookingForRider,
  rescheduleOperationalBookingForOwner,
  rescheduleOperationalBookingForRider,
  requestBookingForRider
} from "../lib/server-actions/bookings.ts";
import { createSupabaseMock } from "./helpers/mock-supabase.mjs";

function createOperationalBookingForm(overrides = {}) {
  const values = {
    endAt: "2026-03-20T11:00:00.000Z",
    horseId: "horse-1",
    ruleId: "rule-1",
    startAt: "2026-03-20T10:00:00.000Z",
    ...overrides
  };
  const formData = new FormData();
  formData.set("horseId", values.horseId);
  formData.set("ruleId", values.ruleId);
  formData.set("startAt", values.startAt);
  formData.set("endAt", values.endAt);
  return formData;
}

function getBookingMinutes(startAt, endAt) {
  return Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000);
}

function getWeekKey(value) {
  const date = new Date(value);
  const weekday = date.getUTCDay() || 7;
  const weekStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - weekday + 1, 0, 0, 0, 0));
  return weekStart.toISOString();
}

function getWeeklyLimitMinutes(state, horseId, riderId) {
  const limit = state.tables.rider_booking_limits?.find((item) => item.horse_id === horseId && item.rider_id === riderId) ?? null;
  return typeof limit?.weekly_hours_limit === "number" ? limit.weekly_hours_limit * 60 : null;
}

function getAcceptedOperationalRequestIds(state, horseId = null) {
  return new Set(
    (state.tables.booking_requests ?? [])
      .filter((request) => request.status === "accepted" && (!horseId || request.horse_id === horseId))
      .map((request) => request.id)
  );
}

function cleanupInactiveOperationalBookings(state, horseId = null) {
  const acceptedRequestIds = getAcceptedOperationalRequestIds(state, horseId);
  state.tables.bookings = (state.tables.bookings ?? []).filter(
    (booking) => (horseId && booking.horse_id !== horseId) || acceptedRequestIds.has(booking.booking_request_id)
  );
}

function operationalRangesOverlap(leftStartAt, leftEndAt, rightStartAt, rightEndAt) {
  return leftStartAt < rightEndAt && leftEndAt > rightStartAt;
}

function hasOperationalBookingConflict(state, { endAt, excludeBookingId = null, horseId, startAt }) {
  cleanupInactiveOperationalBookings(state, horseId);
  const acceptedRequestIds = getAcceptedOperationalRequestIds(state, horseId);

  return (state.tables.bookings ?? []).some((booking) => {
    if (booking.horse_id !== horseId || booking.id === excludeBookingId) {
      return false;
    }

    if (!acceptedRequestIds.has(booking.booking_request_id)) {
      return false;
    }

    return operationalRangesOverlap(booking.start_at, booking.end_at, startAt, endAt);
  });
}

function hasOperationalBlockConflict(state, { endAt, horseId, startAt }) {
  return (state.tables.calendar_blocks ?? []).some(
    (block) =>
      block.horse_id === horseId &&
      operationalRangesOverlap(block.start_at, block.end_at, startAt, endAt)
  );
}

function getActiveWeeklyBookedMinutes(state, { excludeBookingId = null, horseId, referenceAt, riderId }) {
  const weekKey = getWeekKey(referenceAt);

  return (state.tables.bookings ?? []).reduce((sum, booking) => {
    if (booking.horse_id !== horseId || booking.rider_id !== riderId) {
      return sum;
    }

    if (excludeBookingId && booking.id === excludeBookingId) {
      return sum;
    }

    if (getWeekKey(booking.start_at) !== weekKey) {
      return sum;
    }

    const request = state.tables.booking_requests?.find((item) => item.id === booking.booking_request_id) ?? null;
    const rule = state.tables.availability_rules?.find((item) => item.id === booking.availability_rule_id) ?? null;

    if (!request || request.status !== "accepted" || request.recurrence_rrule || rule?.is_trial_slot) {
      return sum;
    }

    return sum + getBookingMinutes(booking.start_at, booking.end_at);
  }, 0);
}

function createQuotaAwareDirectBookingHandler() {
  return ({ args, state }) => {
    cleanupInactiveOperationalBookings(state, args.p_horse_id);

    if (hasOperationalBookingConflict(state, {
      endAt: args.p_end_at,
      horseId: args.p_horse_id,
      startAt: args.p_start_at
    }) || hasOperationalBlockConflict(state, {
      endAt: args.p_end_at,
      horseId: args.p_horse_id,
      startAt: args.p_start_at
    })) {
      return { data: null, error: { message: "TIME_UNAVAILABLE" } };
    }

    const limitMinutes = getWeeklyLimitMinutes(state, args.p_horse_id, "rider-1");
    const bookedMinutes = getActiveWeeklyBookedMinutes(state, {
      horseId: args.p_horse_id,
      referenceAt: args.p_start_at,
      riderId: "rider-1"
    });
    const requestedMinutes = getBookingMinutes(args.p_start_at, args.p_end_at);

    if (limitMinutes !== null && bookedMinutes + requestedMinutes > limitMinutes) {
      return { data: null, error: { message: "WEEKLY_LIMIT_EXCEEDED" } };
    }

    const rule = state.tables.availability_rules.find((item) => item.id === args.p_rule_id);
    const requestId = `request-${state.tables.booking_requests.length + 1}`;
    const bookingId = `booking-${state.tables.bookings.length + 1}`;

    state.tables.booking_requests.push({
      availability_rule_id: args.p_rule_id,
      created_at: "2026-03-19T08:15:00.000Z",
      horse_id: args.p_horse_id,
      id: requestId,
      recurrence_rrule: null,
      requested_end_at: args.p_end_at,
      requested_start_at: args.p_start_at,
      rider_id: "rider-1",
      slot_id: rule?.slot_id ?? "slot-generated",
      status: "accepted"
    });
    state.tables.bookings.push({
      availability_rule_id: args.p_rule_id,
      booking_request_id: requestId,
      created_at: "2026-03-19T08:16:00.000Z",
      end_at: args.p_end_at,
      horse_id: args.p_horse_id,
      id: bookingId,
      rider_id: "rider-1",
      slot_id: rule?.slot_id ?? "slot-generated",
      start_at: args.p_start_at
    });

    return { data: requestId, error: null };
  };
}

function createQuotaAwareCancelBookingHandler() {
  return ({ args, state }) => {
    const booking = state.tables.bookings.find((item) => item.id === args.p_booking_id);

    if (!booking) {
      return { data: null, error: { message: "NOT_FOUND" } };
    }

    const request = state.tables.booking_requests.find((item) => item.id === booking.booking_request_id);

    if (!request || request.status !== "accepted") {
      return { data: null, error: { message: "INVALID_STATUS" } };
    }

    request.status = "canceled";
    state.tables.bookings = state.tables.bookings.filter((item) => item.id !== booking.id);
    return { data: null, error: null };
  };
}

function createQuotaAwareRescheduleHandler() {
  return ({ args, state }) => {
    const booking = state.tables.bookings.find((item) => item.id === args.p_booking_id);

    if (!booking) {
      return { data: null, error: { message: "NOT_FOUND" } };
    }

    const oldRequest = state.tables.booking_requests.find((item) => item.id === booking.booking_request_id);

    if (!oldRequest || oldRequest.status !== "accepted") {
      return { data: null, error: { message: "INVALID_STATUS" } };
    }

    cleanupInactiveOperationalBookings(state, booking.horse_id);

    if (hasOperationalBookingConflict(state, {
      endAt: args.p_end_at,
      excludeBookingId: booking.id,
      horseId: booking.horse_id,
      startAt: args.p_start_at
    }) || hasOperationalBlockConflict(state, {
      endAt: args.p_end_at,
      horseId: booking.horse_id,
      startAt: args.p_start_at
    })) {
      return { data: null, error: { message: "TIME_UNAVAILABLE" } };
    }

    const limitMinutes = getWeeklyLimitMinutes(state, booking.horse_id, booking.rider_id);
    const bookedMinutes = getActiveWeeklyBookedMinutes(state, {
      excludeBookingId: booking.id,
      horseId: booking.horse_id,
      referenceAt: args.p_start_at,
      riderId: booking.rider_id
    });
    const requestedMinutes = getBookingMinutes(args.p_start_at, args.p_end_at);

    if (limitMinutes !== null && bookedMinutes + requestedMinutes > limitMinutes) {
      return { data: null, error: { message: "WEEKLY_LIMIT_EXCEEDED" } };
    }

    const rule = state.tables.availability_rules.find((item) => item.id === args.p_rule_id);
    const newRequestId = `request-${state.tables.booking_requests.length + 1}`;
    const newBookingId = `booking-${state.tables.bookings.length + 1}`;

    oldRequest.status = "rescheduled";
    state.tables.bookings = state.tables.bookings.filter((item) => item.id !== booking.id);
    state.tables.booking_requests.push({
      availability_rule_id: args.p_rule_id,
      created_at: "2026-03-19T08:15:00.000Z",
      horse_id: booking.horse_id,
      id: newRequestId,
      recurrence_rrule: null,
      requested_end_at: args.p_end_at,
      requested_start_at: args.p_start_at,
      rider_id: booking.rider_id,
      slot_id: rule?.slot_id ?? "slot-rescheduled",
      status: "accepted",
      rescheduled_from_booking_request_id: oldRequest.id
    });
    state.tables.bookings.push({
      availability_rule_id: args.p_rule_id,
      booking_request_id: newRequestId,
      created_at: "2026-03-19T08:16:00.000Z",
      end_at: args.p_end_at,
      horse_id: booking.horse_id,
      id: newBookingId,
      rider_id: booking.rider_id,
      slot_id: rule?.slot_id ?? "slot-rescheduled",
      start_at: args.p_start_at
    });

    return { data: newRequestId, error: null };
  };
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
  const revokedSupabase = createSupabaseMock(
    {
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
    },
    {
      rpcHandlers: {
        direct_book_operational_slot: () => ({ data: null, error: { message: "NOT_APPROVED" } })
      }
    }
  );

  const revokedResult = await requestBookingForRider({
    formData: createOperationalBookingForm(),
    logSupabaseError: () => {},
    supabase: revokedSupabase,
    userId: "rider-1"
  });

  assert.equal(revokedResult.ok, false);
  assert.equal(revokedResult.message, "Nur freigeschaltete Reiter koennen einen Termin anfragen.");
  assert.deepEqual(revokedSupabase.state.rpcCalls.map((call) => call.name), []);

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

test("Vergangene operative Termine werden weder direkt gebucht noch nachtraeglich angenommen", async () => {
  const directSupabase = createSupabaseMock({
    approvals: [{ horse_id: "horse-1", rider_id: "rider-1", status: "approved" }],
    availability_rules: [
      {
        active: true,
        created_at: "2026-03-01T08:00:00.000Z",
        end_at: "2026-03-05T11:00:00.000Z",
        horse_id: "horse-1",
        id: "rule-1",
        is_trial_slot: false,
        slot_id: "slot-1",
        start_at: "2026-03-05T10:00:00.000Z"
      }
    ],
    bookings: [],
    calendar_blocks: []
  });

  const directResult = await requestBookingForRider({
    formData: createOperationalBookingForm({
      endAt: "2026-03-05T11:00:00.000Z",
      startAt: "2026-03-05T10:00:00.000Z"
    }),
    logSupabaseError: () => {},
    supabase: directSupabase,
    userId: "rider-1"
  });

  assert.equal(directResult.ok, false);
  assert.equal(directResult.message, "Nur zukuenftige Termine koennen direkt gebucht werden.");
  assert.equal(directSupabase.state.rpcCalls.length, 0);

  const acceptSupabase = createSupabaseMock({
    booking_requests: [
      {
        availability_rule_id: "rule-1",
        created_at: "2026-03-01T08:00:00.000Z",
        horse_id: "horse-1",
        id: "request-1",
        recurrence_rrule: null,
        requested_end_at: "2026-03-05T11:00:00.000Z",
        requested_start_at: "2026-03-05T10:00:00.000Z",
        rider_id: "rider-1",
        slot_id: "slot-1",
        status: "requested"
      }
    ],
    horses: [{ id: "horse-1", owner_id: "owner-1" }]
  });

  const acceptResult = await acceptBookingRequestForOwner({
    logSupabaseError: () => {},
    ownerId: "owner-1",
    requestId: "request-1",
    supabase: acceptSupabase
  });

  assert.equal(acceptResult.ok, false);
  assert.equal(acceptResult.message, "Nur zukuenftige Termine koennen angenommen werden.");
  assert.equal(acceptSupabase.state.rpcCalls.length, 0);
});

test("Berechtigter Storno historisiert operative Buchungen und gibt den Slot wieder frei", async () => {
  const rule = {
    active: true,
    created_at: "2026-03-19T08:00:00.000Z",
    end_at: "2026-03-20T11:00:00.000Z",
    horse_id: "horse-1",
    id: "rule-1",
    is_trial_slot: false,
    slot_id: "slot-1",
    start_at: "2026-03-20T10:00:00.000Z"
  };
  const supabase = createSupabaseMock(
    {
      approvals: [{ horse_id: "horse-1", rider_id: "rider-1", status: "approved" }],
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
      availability_rules: [rule],
      horses: [{ id: "horse-1", owner_id: "owner-1" }]
    },
    {
      rpcHandlers: {
        cancel_operational_booking: ({ args, state }) => {
          const booking = state.tables.bookings.find((item) => item.id === args.p_booking_id);

          if (!booking) {
            return { data: null, error: { message: "NOT_FOUND" } };
          }

          const request = state.tables.booking_requests.find((item) => item.id === booking.booking_request_id);

          if (!request || request.status !== "accepted") {
            return { data: null, error: { message: "INVALID_STATUS" } };
          }

          request.status = "canceled";
          state.tables.bookings = state.tables.bookings.filter((item) => item.id !== booking.id);
          return { data: null, error: null };
        }
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
  assert.equal(result.message, "Der Termin wurde storniert.");
  assert.equal(supabase.state.tables.bookings.length, 0);
  assert.equal(supabase.state.tables.booking_requests[0].status, "canceled");
  assert.deepEqual(
    getUpcomingOperationalSlots({
      now: new Date("2026-03-20T08:00:00.000Z"),
      occupiedRanges: supabase.state.tables.bookings.map((booking) => ({ end_at: booking.end_at, start_at: booking.start_at })),
      rules: [rule]
    }).map((slot) => slot.availabilityRuleId),
    ["rule-1"]
  );
});

test("Unberechtigte oder revoked Reiter duerfen operative Termine nicht stornieren", async () => {
  const baseState = {
    approvals: [{ horse_id: "horse-1", rider_id: "rider-1", status: "approved" }],
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
  };

  const unauthorizedSupabase = createSupabaseMock(baseState);
  const unauthorizedResult = await cancelOperationalBookingForRider({
    bookingId: "booking-1",
    logSupabaseError: () => {},
    riderId: "rider-2",
    supabase: unauthorizedSupabase
  });

  assert.equal(unauthorizedResult.ok, false);
  assert.equal(unauthorizedResult.message, "Du darfst diesen Termin nicht stornieren.");
  assert.equal(unauthorizedSupabase.state.tables.bookings.length, 1);
  assert.equal(unauthorizedSupabase.state.rpcCalls.length, 0);

  const revokedSupabase = createSupabaseMock(
    {
      ...baseState,
      approvals: [{ horse_id: "horse-1", rider_id: "rider-1", status: "revoked" }]
    },
    {
      rpcHandlers: {
        cancel_operational_booking: () => ({ data: null, error: { message: "NOT_APPROVED" } })
      }
    }
  );

  const revokedResult = await cancelOperationalBookingForRider({
    bookingId: "booking-1",
    logSupabaseError: () => {},
    riderId: "rider-1",
    supabase: revokedSupabase
  });

  assert.equal(revokedResult.ok, false);
  assert.equal(revokedResult.message, "Nur aktive Reitbeteiligungen koennen eigene Termine stornieren.");
  assert.equal(revokedSupabase.state.tables.bookings.length, 1);
  assert.equal(revokedSupabase.state.tables.booking_requests[0].status, "accepted");
});

test("Owner darf operative Buchungen fuer das eigene Pferd stornieren", async () => {
  const supabase = createSupabaseMock(
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
    },
    {
      rpcHandlers: {
        cancel_operational_booking: ({ state }) => {
          state.tables.booking_requests[0].status = "canceled";
          state.tables.bookings = [];
          return { data: null, error: null };
        }
      }
    }
  );

  const result = await cancelOperationalBookingForOwner({
    bookingId: "booking-1",
    logSupabaseError: () => {},
    ownerId: "owner-1",
    supabase
  });

  assert.equal(result.ok, true);
  assert.equal(supabase.state.tables.bookings.length, 0);
  assert.equal(supabase.state.tables.booking_requests[0].status, "canceled");
});

test("Berechtigte Umbuchung ersetzt die aktive Belegung atomar und historisiert den alten Termin", async () => {
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
  const supabase = createSupabaseMock(
    {
      approvals: [{ horse_id: "horse-1", rider_id: "rider-1", status: "approved" }],
      availability_rules: rules,
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
    },
    {
      rpcHandlers: {
        reschedule_operational_booking: ({ args, state }) => {
          const booking = state.tables.bookings.find((item) => item.id === args.p_booking_id);

          if (!booking) {
            return { data: null, error: { message: "NOT_FOUND" } };
          }

          const oldRequest = state.tables.booking_requests.find((item) => item.id === booking.booking_request_id);

          if (!oldRequest || oldRequest.status !== "accepted") {
            return { data: null, error: { message: "INVALID_STATUS" } };
          }

          oldRequest.status = "rescheduled";
          state.tables.bookings = state.tables.bookings.filter((item) => item.id !== booking.id);
          state.tables.booking_requests.push({
            availability_rule_id: args.p_rule_id,
            created_at: "2026-03-19T08:15:00.000Z",
            horse_id: booking.horse_id,
            id: "request-2",
            recurrence_rrule: null,
            requested_end_at: args.p_end_at,
            requested_start_at: args.p_start_at,
            rider_id: booking.rider_id,
            slot_id: "slot-2",
            status: "accepted",
            rescheduled_from_booking_request_id: oldRequest.id
          });
          state.tables.bookings.push({
            availability_rule_id: args.p_rule_id,
            booking_request_id: "request-2",
            created_at: "2026-03-19T08:16:00.000Z",
            end_at: args.p_end_at,
            horse_id: booking.horse_id,
            id: "booking-2",
            rider_id: booking.rider_id,
            slot_id: "slot-2",
            start_at: args.p_start_at
          });

          return { data: "request-2", error: null };
        }
      }
    }
  );

  const result = await rescheduleOperationalBookingForRider({
    bookingId: "booking-1",
    endAtInput: "2026-03-20T13:00:00.000Z",
    logSupabaseError: () => {},
    riderId: "rider-1",
    ruleId: "rule-2",
    startAtInput: "2026-03-20T12:00:00.000Z",
    supabase
  });

  assert.equal(result.ok, true);
  assert.equal(result.message, "Der Termin wurde umgebucht.");
  assert.equal(supabase.state.tables.bookings.length, 1);
  assert.equal(supabase.state.tables.bookings[0].id, "booking-2");
  assert.equal(supabase.state.tables.booking_requests[0].status, "rescheduled");
  assert.equal(supabase.state.tables.booking_requests[1].status, "accepted");
  assert.equal(supabase.state.tables.booking_requests[1].rescheduled_from_booking_request_id, "request-1");
  assert.deepEqual(
    getUpcomingOperationalSlots({
      now: new Date("2026-03-20T08:00:00.000Z"),
      occupiedRanges: supabase.state.tables.bookings.map((booking) => ({ end_at: booking.end_at, start_at: booking.start_at })),
      rules
    }).map((slot) => slot.availabilityRuleId),
    ["rule-1"]
  );
});

test("Bestehende Buchung am 14.03 laesst sich auf einen freien Slot am 13.03 umbuchen", async () => {
  const supabase = createSupabaseMock(
    {
      approvals: [{ horse_id: "horse-1", rider_id: "rider-1", status: "approved" }],
      availability_rules: [
        {
          active: true,
          created_at: "2026-03-10T08:00:00.000Z",
          end_at: "2026-03-14T11:00:00.000Z",
          horse_id: "horse-1",
          id: "rule-14",
          is_trial_slot: false,
          slot_id: "slot-14",
          start_at: "2026-03-14T10:00:00.000Z"
        },
        {
          active: true,
          created_at: "2026-03-10T08:10:00.000Z",
          end_at: "2026-03-13T11:00:00.000Z",
          horse_id: "horse-1",
          id: "rule-13",
          is_trial_slot: false,
          slot_id: "slot-13",
          start_at: "2026-03-13T10:00:00.000Z"
        }
      ],
      booking_requests: [
        {
          availability_rule_id: "rule-14",
          created_at: "2026-03-10T08:00:00.000Z",
          horse_id: "horse-1",
          id: "request-14",
          recurrence_rrule: null,
          requested_end_at: "2026-03-14T11:00:00.000Z",
          requested_start_at: "2026-03-14T10:00:00.000Z",
          rider_id: "rider-1",
          slot_id: "slot-14",
          status: "accepted"
        }
      ],
      bookings: [
        {
          availability_rule_id: "rule-14",
          booking_request_id: "request-14",
          created_at: "2026-03-10T08:05:00.000Z",
          end_at: "2026-03-14T11:00:00.000Z",
          horse_id: "horse-1",
          id: "booking-14",
          rider_id: "rider-1",
          slot_id: "slot-14",
          start_at: "2026-03-14T10:00:00.000Z"
        }
      ],
      horses: [{ id: "horse-1", owner_id: "owner-1" }]
    },
    {
      rpcHandlers: {
        reschedule_operational_booking: createQuotaAwareRescheduleHandler()
      }
    }
  );

  const result = await rescheduleOperationalBookingForRider({
    bookingId: "booking-14",
    endAtInput: "2026-03-13T11:00:00.000Z",
    logSupabaseError: () => {},
    riderId: "rider-1",
    ruleId: "rule-13",
    startAtInput: "2026-03-13T10:00:00.000Z",
    supabase
  });

  assert.equal(result.ok, true);
  assert.deepEqual(
    supabase.state.tables.booking_requests.map((request) => request.status),
    ["rescheduled", "accepted"]
  );
  assert.equal(supabase.state.tables.bookings.length, 1);
  assert.equal(supabase.state.tables.bookings[0].start_at, "2026-03-13T10:00:00.000Z");
});

test("14.03 stornieren, 13.03 buchen und danach zurueck auf den freien 14.03-Slot umbuchen funktioniert", async () => {
  const supabase = createSupabaseMock(
    {
      approvals: [{ horse_id: "horse-1", rider_id: "rider-1", status: "approved" }],
      availability_rules: [
        {
          active: true,
          created_at: "2026-03-10T08:00:00.000Z",
          end_at: "2026-03-14T11:00:00.000Z",
          horse_id: "horse-1",
          id: "rule-14",
          is_trial_slot: false,
          slot_id: "slot-14",
          start_at: "2026-03-14T10:00:00.000Z"
        },
        {
          active: true,
          created_at: "2026-03-10T08:10:00.000Z",
          end_at: "2026-03-13T11:00:00.000Z",
          horse_id: "horse-1",
          id: "rule-13",
          is_trial_slot: false,
          slot_id: "slot-13",
          start_at: "2026-03-13T10:00:00.000Z"
        }
      ],
      booking_requests: [
        {
          availability_rule_id: "rule-14",
          created_at: "2026-03-10T08:00:00.000Z",
          horse_id: "horse-1",
          id: "request-14",
          recurrence_rrule: null,
          requested_end_at: "2026-03-14T11:00:00.000Z",
          requested_start_at: "2026-03-14T10:00:00.000Z",
          rider_id: "rider-1",
          slot_id: "slot-14",
          status: "accepted"
        }
      ],
      bookings: [
        {
          availability_rule_id: "rule-14",
          booking_request_id: "request-14",
          created_at: "2026-03-10T08:05:00.000Z",
          end_at: "2026-03-14T11:00:00.000Z",
          horse_id: "horse-1",
          id: "booking-14",
          rider_id: "rider-1",
          slot_id: "slot-14",
          start_at: "2026-03-14T10:00:00.000Z"
        }
      ],
      calendar_blocks: [],
      horses: [{ id: "horse-1", owner_id: "owner-1" }]
    },
    {
      rpcHandlers: {
        cancel_operational_booking: createQuotaAwareCancelBookingHandler(),
        direct_book_operational_slot: createQuotaAwareDirectBookingHandler(),
        reschedule_operational_booking: createQuotaAwareRescheduleHandler()
      }
    }
  );

  const cancelResult = await cancelOperationalBookingForRider({
    bookingId: "booking-14",
    logSupabaseError: () => {},
    riderId: "rider-1",
    supabase
  });
  const directBookResult = await requestBookingForRider({
    formData: createOperationalBookingForm({
      endAt: "2026-03-13T11:00:00.000Z",
      ruleId: "rule-13",
      startAt: "2026-03-13T10:00:00.000Z"
    }),
    logSupabaseError: () => {},
    supabase,
    userId: "rider-1"
  });
  const returnRescheduleResult = await rescheduleOperationalBookingForRider({
    bookingId: "booking-1",
    endAtInput: "2026-03-14T11:00:00.000Z",
    logSupabaseError: () => {},
    riderId: "rider-1",
    ruleId: "rule-14",
    startAtInput: "2026-03-14T10:00:00.000Z",
    supabase
  });

  assert.equal(cancelResult.ok, true);
  assert.equal(directBookResult.ok, true);
  assert.equal(returnRescheduleResult.ok, true);
  assert.equal(supabase.state.tables.bookings.length, 1);
  assert.equal(supabase.state.tables.bookings[0].start_at, "2026-03-14T10:00:00.000Z");
  assert.deepEqual(
    supabase.state.tables.booking_requests.map((request) => request.status),
    ["canceled", "rescheduled", "accepted"]
  );
});

test("Ein gecancelter Alttermin blockiert denselben operativen Slot nicht mehr", async () => {
  const supabase = createSupabaseMock(
    {
      approvals: [{ horse_id: "horse-1", rider_id: "rider-1", status: "approved" }],
      availability_rules: [
        {
          active: true,
          created_at: "2026-03-10T08:00:00.000Z",
          end_at: "2026-03-14T11:00:00.000Z",
          horse_id: "horse-1",
          id: "rule-14",
          is_trial_slot: false,
          slot_id: "slot-14",
          start_at: "2026-03-14T10:00:00.000Z"
        }
      ],
      booking_requests: [
        {
          availability_rule_id: "rule-14",
          created_at: "2026-03-10T08:00:00.000Z",
          horse_id: "horse-1",
          id: "request-old",
          recurrence_rrule: null,
          requested_end_at: "2026-03-14T11:00:00.000Z",
          requested_start_at: "2026-03-14T10:00:00.000Z",
          rider_id: "rider-1",
          slot_id: "slot-14",
          status: "canceled"
        }
      ],
      bookings: [
        {
          availability_rule_id: "rule-14",
          booking_request_id: "request-old",
          created_at: "2026-03-10T08:05:00.000Z",
          end_at: "2026-03-14T11:00:00.000Z",
          horse_id: "horse-1",
          id: "booking-stale",
          rider_id: "rider-1",
          slot_id: "slot-14",
          start_at: "2026-03-14T10:00:00.000Z"
        }
      ],
      calendar_blocks: []
    },
    {
      rpcHandlers: {
        direct_book_operational_slot: createQuotaAwareDirectBookingHandler()
      }
    }
  );

  const result = await requestBookingForRider({
    formData: createOperationalBookingForm({
      endAt: "2026-03-14T11:00:00.000Z",
      ruleId: "rule-14",
      startAt: "2026-03-14T10:00:00.000Z"
    }),
    logSupabaseError: () => {},
    supabase,
    userId: "rider-1"
  });

  assert.equal(result.ok, true);
  assert.equal(supabase.state.tables.bookings.length, 1);
  assert.equal(supabase.state.tables.bookings[0].booking_request_id, "request-2");
  assert.equal(supabase.state.tables.booking_requests.find((request) => request.id === "request-old")?.status, "canceled");
});

test("Ein als rescheduled historisierter Alttermin blockiert den Rueckweg auf seinen Slot nicht", async () => {
  const supabase = createSupabaseMock(
    {
      approvals: [{ horse_id: "horse-1", rider_id: "rider-1", status: "approved" }],
      availability_rules: [
        {
          active: true,
          created_at: "2026-03-10T08:00:00.000Z",
          end_at: "2026-03-13T11:00:00.000Z",
          horse_id: "horse-1",
          id: "rule-13",
          is_trial_slot: false,
          slot_id: "slot-13",
          start_at: "2026-03-13T10:00:00.000Z"
        },
        {
          active: true,
          created_at: "2026-03-10T08:10:00.000Z",
          end_at: "2026-03-14T11:00:00.000Z",
          horse_id: "horse-1",
          id: "rule-14",
          is_trial_slot: false,
          slot_id: "slot-14",
          start_at: "2026-03-14T10:00:00.000Z"
        }
      ],
      booking_requests: [
        {
          availability_rule_id: "rule-14",
          created_at: "2026-03-10T08:00:00.000Z",
          horse_id: "horse-1",
          id: "request-old",
          recurrence_rrule: null,
          requested_end_at: "2026-03-14T11:00:00.000Z",
          requested_start_at: "2026-03-14T10:00:00.000Z",
          rider_id: "rider-1",
          slot_id: "slot-14",
          status: "rescheduled"
        },
        {
          availability_rule_id: "rule-13",
          created_at: "2026-03-10T08:20:00.000Z",
          horse_id: "horse-1",
          id: "request-active",
          recurrence_rrule: null,
          requested_end_at: "2026-03-13T11:00:00.000Z",
          requested_start_at: "2026-03-13T10:00:00.000Z",
          rider_id: "rider-1",
          slot_id: "slot-13",
          status: "accepted"
        }
      ],
      bookings: [
        {
          availability_rule_id: "rule-14",
          booking_request_id: "request-old",
          created_at: "2026-03-10T08:05:00.000Z",
          end_at: "2026-03-14T11:00:00.000Z",
          horse_id: "horse-1",
          id: "booking-stale",
          rider_id: "rider-1",
          slot_id: "slot-14",
          start_at: "2026-03-14T10:00:00.000Z"
        },
        {
          availability_rule_id: "rule-13",
          booking_request_id: "request-active",
          created_at: "2026-03-10T08:25:00.000Z",
          end_at: "2026-03-13T11:00:00.000Z",
          horse_id: "horse-1",
          id: "booking-active",
          rider_id: "rider-1",
          slot_id: "slot-13",
          start_at: "2026-03-13T10:00:00.000Z"
        }
      ],
      horses: [{ id: "horse-1", owner_id: "owner-1" }]
    },
    {
      rpcHandlers: {
        reschedule_operational_booking: createQuotaAwareRescheduleHandler()
      }
    }
  );

  const result = await rescheduleOperationalBookingForRider({
    bookingId: "booking-active",
    endAtInput: "2026-03-14T11:00:00.000Z",
    logSupabaseError: () => {},
    riderId: "rider-1",
    ruleId: "rule-14",
    startAtInput: "2026-03-14T10:00:00.000Z",
    supabase
  });

  assert.equal(result.ok, true);
  assert.equal(supabase.state.tables.bookings.length, 1);
  assert.equal(supabase.state.tables.bookings[0].start_at, "2026-03-14T10:00:00.000Z");
  assert.equal(
    supabase.state.tables.booking_requests.find((request) => request.id === "request-old")?.status,
    "rescheduled"
  );
});

test("Direktbuchung und Umbuchung benutzen dieselbe aktive Freiheitslogik fuer operative Slots", async () => {
  const directSupabase = createSupabaseMock(
    {
      approvals: [{ horse_id: "horse-1", rider_id: "rider-1", status: "approved" }],
      availability_rules: [
        {
          active: true,
          created_at: "2026-03-10T08:00:00.000Z",
          end_at: "2026-03-14T11:00:00.000Z",
          horse_id: "horse-1",
          id: "rule-14",
          is_trial_slot: false,
          slot_id: "slot-14",
          start_at: "2026-03-14T10:00:00.000Z"
        }
      ],
      booking_requests: [
        {
          availability_rule_id: "rule-14",
          created_at: "2026-03-10T08:00:00.000Z",
          horse_id: "horse-1",
          id: "request-stale",
          recurrence_rrule: null,
          requested_end_at: "2026-03-14T11:00:00.000Z",
          requested_start_at: "2026-03-14T10:00:00.000Z",
          rider_id: "rider-1",
          slot_id: "slot-14",
          status: "canceled"
        }
      ],
      bookings: [
        {
          availability_rule_id: "rule-14",
          booking_request_id: "request-stale",
          created_at: "2026-03-10T08:05:00.000Z",
          end_at: "2026-03-14T11:00:00.000Z",
          horse_id: "horse-1",
          id: "booking-stale",
          rider_id: "rider-1",
          slot_id: "slot-14",
          start_at: "2026-03-14T10:00:00.000Z"
        }
      ],
      calendar_blocks: []
    },
    {
      rpcHandlers: {
        direct_book_operational_slot: createQuotaAwareDirectBookingHandler()
      }
    }
  );
  const rescheduleSupabase = createSupabaseMock(
    {
      approvals: [{ horse_id: "horse-1", rider_id: "rider-1", status: "approved" }],
      availability_rules: [
        {
          active: true,
          created_at: "2026-03-10T08:00:00.000Z",
          end_at: "2026-03-13T11:00:00.000Z",
          horse_id: "horse-1",
          id: "rule-13",
          is_trial_slot: false,
          slot_id: "slot-13",
          start_at: "2026-03-13T10:00:00.000Z"
        },
        {
          active: true,
          created_at: "2026-03-10T08:10:00.000Z",
          end_at: "2026-03-14T11:00:00.000Z",
          horse_id: "horse-1",
          id: "rule-14",
          is_trial_slot: false,
          slot_id: "slot-14",
          start_at: "2026-03-14T10:00:00.000Z"
        }
      ],
      booking_requests: [
        {
          availability_rule_id: "rule-14",
          created_at: "2026-03-10T08:00:00.000Z",
          horse_id: "horse-1",
          id: "request-stale",
          recurrence_rrule: null,
          requested_end_at: "2026-03-14T11:00:00.000Z",
          requested_start_at: "2026-03-14T10:00:00.000Z",
          rider_id: "rider-1",
          slot_id: "slot-14",
          status: "canceled"
        },
        {
          availability_rule_id: "rule-13",
          created_at: "2026-03-10T08:20:00.000Z",
          horse_id: "horse-1",
          id: "request-active",
          recurrence_rrule: null,
          requested_end_at: "2026-03-13T11:00:00.000Z",
          requested_start_at: "2026-03-13T10:00:00.000Z",
          rider_id: "rider-1",
          slot_id: "slot-13",
          status: "accepted"
        }
      ],
      bookings: [
        {
          availability_rule_id: "rule-14",
          booking_request_id: "request-stale",
          created_at: "2026-03-10T08:05:00.000Z",
          end_at: "2026-03-14T11:00:00.000Z",
          horse_id: "horse-1",
          id: "booking-stale",
          rider_id: "rider-1",
          slot_id: "slot-14",
          start_at: "2026-03-14T10:00:00.000Z"
        },
        {
          availability_rule_id: "rule-13",
          booking_request_id: "request-active",
          created_at: "2026-03-10T08:25:00.000Z",
          end_at: "2026-03-13T11:00:00.000Z",
          horse_id: "horse-1",
          id: "booking-active",
          rider_id: "rider-1",
          slot_id: "slot-13",
          start_at: "2026-03-13T10:00:00.000Z"
        }
      ],
      calendar_blocks: [],
      horses: [{ id: "horse-1", owner_id: "owner-1" }]
    },
    {
      rpcHandlers: {
        reschedule_operational_booking: createQuotaAwareRescheduleHandler()
      }
    }
  );

  const directResult = await requestBookingForRider({
    formData: createOperationalBookingForm({
      endAt: "2026-03-14T11:00:00.000Z",
      ruleId: "rule-14",
      startAt: "2026-03-14T10:00:00.000Z"
    }),
    logSupabaseError: () => {},
    supabase: directSupabase,
    userId: "rider-1"
  });
  const rescheduleResult = await rescheduleOperationalBookingForRider({
    bookingId: "booking-active",
    endAtInput: "2026-03-14T11:00:00.000Z",
    logSupabaseError: () => {},
    riderId: "rider-1",
    ruleId: "rule-14",
    startAtInput: "2026-03-14T10:00:00.000Z",
    supabase: rescheduleSupabase
  });

  assert.equal(directResult.ok, true);
  assert.equal(rescheduleResult.ok, true);
});

test("Unberechtigte, revoked oder konflikthafte Umbuchungen werden sauber blockiert", async () => {
  const baseState = {
    approvals: [{ horse_id: "horse-1", rider_id: "rider-1", status: "approved" }],
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
  };

  const unauthorizedSupabase = createSupabaseMock(baseState);
  const unauthorizedResult = await rescheduleOperationalBookingForRider({
    bookingId: "booking-1",
    endAtInput: "2026-03-20T13:00:00.000Z",
    logSupabaseError: () => {},
    riderId: "rider-2",
    ruleId: "rule-2",
    startAtInput: "2026-03-20T12:00:00.000Z",
    supabase: unauthorizedSupabase
  });

  assert.equal(unauthorizedResult.ok, false);
  assert.equal(unauthorizedResult.message, "Du darfst diesen Termin nicht umbuchen.");
  assert.equal(unauthorizedResult.reason, "unauthorized");
  assert.equal(unauthorizedSupabase.state.rpcCalls.length, 0);

  const revokedSupabase = createSupabaseMock(
    {
      ...baseState,
      approvals: [{ horse_id: "horse-1", rider_id: "rider-1", status: "revoked" }]
    },
    {
      rpcHandlers: {
        reschedule_operational_booking: () => ({ data: null, error: { message: "NOT_APPROVED" } })
      }
    }
  );

  const revokedResult = await rescheduleOperationalBookingForRider({
    bookingId: "booking-1",
    endAtInput: "2026-03-20T13:00:00.000Z",
    logSupabaseError: () => {},
    riderId: "rider-1",
    ruleId: "rule-2",
    startAtInput: "2026-03-20T12:00:00.000Z",
    supabase: revokedSupabase
  });

  assert.equal(revokedResult.ok, false);
  assert.equal(revokedResult.message, "Deine Freischaltung fuer diese Reitbeteiligung wurde entzogen.");
  assert.equal(revokedResult.reason, "revoked");
  assert.equal(revokedSupabase.state.tables.bookings[0].id, "booking-1");
  assert.equal(revokedSupabase.state.rpcCalls.length, 0);

  const conflictSupabase = createSupabaseMock(baseState, {
    rpcHandlers: {
      reschedule_operational_booking: () => ({ data: null, error: { message: "TIME_UNAVAILABLE" } })
    }
  });

  const conflictResult = await rescheduleOperationalBookingForOwner({
    bookingId: "booking-1",
    endAtInput: "2026-03-20T13:00:00.000Z",
    logSupabaseError: () => {},
    ownerId: "owner-1",
    ruleId: "rule-2",
    startAtInput: "2026-03-20T12:00:00.000Z",
    supabase: conflictSupabase
  });

  assert.equal(conflictResult.ok, false);
  assert.equal(conflictResult.message, "Der gewaehlte Slot ist nicht mehr verfuegbar.");
  assert.equal(conflictResult.reason, "slot_not_free");
  assert.equal(conflictSupabase.state.tables.bookings.length, 1);
  assert.equal(conflictSupabase.state.tables.booking_requests[0].status, "accepted");
});

test("Umbuchung auf ungueltige Zielslots oder kurz vor Terminbeginn wird schon serverseitig vor der RPC blockiert", async () => {
  const baseState = {
    approvals: [{ horse_id: "horse-1", rider_id: "rider-1", status: "approved" }],
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
  };

  const sameSlotSupabase = createSupabaseMock(baseState);
  const sameSlotResult = await rescheduleOperationalBookingForRider({
    bookingId: "booking-1",
    endAtInput: "2026-03-20T11:00:00.000Z",
    logSupabaseError: () => {},
    riderId: "rider-1",
    ruleId: "rule-2",
    startAtInput: "2026-03-20T10:00:00.000Z",
    supabase: sameSlotSupabase
  });

  assert.equal(sameSlotResult.ok, false);
  assert.equal(sameSlotResult.message, "Bitte waehle einen anderen gueltigen freien Slot fuer die Umbuchung.");
  assert.equal(sameSlotResult.reason, "invalid_target_slot");
  assert.equal(sameSlotSupabase.state.rpcCalls.length, 0);

  const invalidTargetSupabase = createSupabaseMock(baseState);
  const invalidTargetResult = await rescheduleOperationalBookingForRider({
    bookingId: "booking-1",
    endAtInput: "2026-03-20T13:15:00.000Z",
    logSupabaseError: () => {},
    riderId: "rider-1",
    ruleId: "rule-2",
    startAtInput: "2026-03-20T12:15:00.000Z",
    supabase: invalidTargetSupabase
  });

  assert.equal(invalidTargetResult.ok, false);
  assert.equal(invalidTargetResult.message, "Bitte waehle einen anderen gueltigen freien Slot fuer die Umbuchung.");
  assert.equal(invalidTargetResult.reason, "invalid_target_slot");
  assert.equal(invalidTargetSupabase.state.rpcCalls.length, 0);

  const nearStartSupabase = createSupabaseMock({
    ...baseState,
    booking_requests: [
      {
        ...baseState.booking_requests[0],
        requested_end_at: "2026-03-01T11:00:00.000Z",
        requested_start_at: "2026-03-01T10:00:00.000Z"
      }
    ],
    bookings: [
      {
        ...baseState.bookings[0],
        end_at: "2026-03-01T11:00:00.000Z",
        start_at: "2026-03-01T10:00:00.000Z"
      }
    ]
  });
  const nearStartResult = await rescheduleOperationalBookingForRider({
    bookingId: "booking-1",
    endAtInput: "2026-03-20T13:00:00.000Z",
    logSupabaseError: () => {},
    riderId: "rider-1",
    ruleId: "rule-2",
    startAtInput: "2026-03-20T12:00:00.000Z",
    supabase: nearStartSupabase
  });

  assert.equal(nearStartResult.ok, false);
  assert.equal(nearStartResult.message, "Nur noch nicht begonnene Termine koennen umgebucht werden.");
  assert.equal(nearStartResult.reason, "booking_started");
  assert.equal(nearStartSupabase.state.rpcCalls.length, 0);
});

test("Wochenkontingent blockiert Direktbuchungen ueber dem Limit und Storno gibt Kapazitaet wieder frei", async () => {
  const rule = {
    active: true,
    created_at: "2026-03-19T08:00:00.000Z",
    end_at: "2026-03-20T11:00:00.000Z",
    horse_id: "horse-1",
    id: "rule-1",
    is_trial_slot: false,
    slot_id: "slot-1",
    start_at: "2026-03-20T10:00:00.000Z"
  };
  const secondRule = {
    active: true,
    created_at: "2026-03-19T08:10:00.000Z",
    end_at: "2026-03-20T13:00:00.000Z",
    horse_id: "horse-1",
    id: "rule-2",
    is_trial_slot: false,
    slot_id: "slot-2",
    start_at: "2026-03-20T12:00:00.000Z"
  };
  const supabase = createSupabaseMock(
    {
      approvals: [{ horse_id: "horse-1", rider_id: "rider-1", status: "approved" }],
      availability_rules: [rule, secondRule],
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
      horses: [{ id: "horse-1", owner_id: "owner-1" }],
      rider_booking_limits: [
        {
          created_at: "2026-03-19T07:00:00.000Z",
          horse_id: "horse-1",
          rider_id: "rider-1",
          updated_at: "2026-03-19T07:00:00.000Z",
          weekly_hours_limit: 1
        }
      ]
    },
    {
      rpcHandlers: {
        cancel_operational_booking: createQuotaAwareCancelBookingHandler(),
        direct_book_operational_slot: createQuotaAwareDirectBookingHandler()
      }
    }
  );

  const overLimitResult = await requestBookingForRider({
    formData: createOperationalBookingForm({
      endAt: "2026-03-20T13:00:00.000Z",
      ruleId: "rule-2",
      startAt: "2026-03-20T12:00:00.000Z"
    }),
    logSupabaseError: () => {},
    supabase,
    userId: "rider-1"
  });

  assert.equal(overLimitResult.ok, false);
  assert.equal(overLimitResult.message, "Dein Wochenkontingent fuer dieses Pferd ist in dieser Woche bereits ausgeschoepft.");
  assert.equal(supabase.state.tables.bookings.length, 1);

  const cancelResult = await cancelOperationalBookingForRider({
    bookingId: "booking-1",
    logSupabaseError: () => {},
    riderId: "rider-1",
    supabase
  });

  assert.equal(cancelResult.ok, true);
  assert.equal(supabase.state.tables.bookings.length, 0);
  assert.equal(supabase.state.tables.booking_requests[0].status, "canceled");

  const rebookResult = await requestBookingForRider({
    formData: createOperationalBookingForm({
      endAt: "2026-03-20T13:00:00.000Z",
      ruleId: "rule-2",
      startAt: "2026-03-20T12:00:00.000Z"
    }),
    logSupabaseError: () => {},
    supabase,
    userId: "rider-1"
  });

  assert.equal(rebookResult.ok, true);
  assert.equal(supabase.state.tables.bookings.length, 1);
  assert.equal(supabase.state.tables.booking_requests[1].status, "accepted");
});

test("Umbuchung prueft die Zielwoche gegen das Wochenkontingent", async () => {
  const supabase = createSupabaseMock(
    {
      approvals: [{ horse_id: "horse-1", rider_id: "rider-1", status: "approved" }],
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
        },
        {
          active: true,
          created_at: "2026-03-19T08:10:00.000Z",
          end_at: "2026-03-27T11:00:00.000Z",
          horse_id: "horse-1",
          id: "rule-2",
          is_trial_slot: false,
          slot_id: "slot-2",
          start_at: "2026-03-27T10:00:00.000Z"
        },
        {
          active: true,
          created_at: "2026-03-19T08:15:00.000Z",
          end_at: "2026-03-27T13:00:00.000Z",
          horse_id: "horse-1",
          id: "rule-3",
          is_trial_slot: false,
          slot_id: "slot-3",
          start_at: "2026-03-27T12:00:00.000Z"
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
        },
        {
          availability_rule_id: "rule-2",
          created_at: "2026-03-19T08:20:00.000Z",
          horse_id: "horse-1",
          id: "request-2",
          recurrence_rrule: null,
          requested_end_at: "2026-03-27T11:00:00.000Z",
          requested_start_at: "2026-03-27T10:00:00.000Z",
          rider_id: "rider-1",
          slot_id: "slot-2",
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
        },
        {
          availability_rule_id: "rule-2",
          booking_request_id: "request-2",
          created_at: "2026-03-19T08:25:00.000Z",
          end_at: "2026-03-27T11:00:00.000Z",
          horse_id: "horse-1",
          id: "booking-2",
          rider_id: "rider-1",
          slot_id: "slot-2",
          start_at: "2026-03-27T10:00:00.000Z"
        }
      ],
      horses: [{ id: "horse-1", owner_id: "owner-1" }],
      rider_booking_limits: [
        {
          created_at: "2026-03-19T07:00:00.000Z",
          horse_id: "horse-1",
          rider_id: "rider-1",
          updated_at: "2026-03-19T07:00:00.000Z",
          weekly_hours_limit: 1
        }
      ]
    },
    {
      rpcHandlers: {
        reschedule_operational_booking: createQuotaAwareRescheduleHandler()
      }
    }
  );

  const result = await rescheduleOperationalBookingForRider({
    bookingId: "booking-1",
    endAtInput: "2026-03-27T13:00:00.000Z",
    logSupabaseError: () => {},
    riderId: "rider-1",
    ruleId: "rule-3",
    startAtInput: "2026-03-27T12:00:00.000Z",
    supabase
  });

  assert.equal(result.ok, false);
  assert.equal(result.message, "In der Zielwoche ist dein Wochenkontingent fuer dieses Pferd bereits ausgeschoepft.");
  assert.equal(supabase.state.tables.bookings.length, 2);
  assert.equal(supabase.state.tables.booking_requests[0].status, "accepted");
});

test("Umbuchung zaehlt den ersetzten Alttermin nicht doppelt und haelt die Historie sauber", async () => {
  const supabase = createSupabaseMock(
    {
      approvals: [{ horse_id: "horse-1", rider_id: "rider-1", status: "approved" }],
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
      horses: [{ id: "horse-1", owner_id: "owner-1" }],
      rider_booking_limits: [
        {
          created_at: "2026-03-19T07:00:00.000Z",
          horse_id: "horse-1",
          rider_id: "rider-1",
          updated_at: "2026-03-19T07:00:00.000Z",
          weekly_hours_limit: 1
        }
      ]
    },
    {
      rpcHandlers: {
        reschedule_operational_booking: createQuotaAwareRescheduleHandler()
      }
    }
  );

  const result = await rescheduleOperationalBookingForRider({
    bookingId: "booking-1",
    endAtInput: "2026-03-20T13:00:00.000Z",
    logSupabaseError: () => {},
    riderId: "rider-1",
    ruleId: "rule-2",
    startAtInput: "2026-03-20T12:00:00.000Z",
    supabase
  });

  assert.equal(result.ok, true);
  assert.equal(supabase.state.tables.bookings.length, 1);
  assert.equal(supabase.state.tables.bookings[0].start_at, "2026-03-20T12:00:00.000Z");
  assert.equal(supabase.state.tables.booking_requests[0].status, "rescheduled");
  assert.equal(supabase.state.tables.booking_requests[1].status, "accepted");
  assert.equal(supabase.state.tables.booking_requests[1].rescheduled_from_booking_request_id, "request-1");
});

test("Mehrere Umbuchungen hintereinander hinterlassen genau eine aktive Belegung und saubere Historie", async () => {
  const supabase = createSupabaseMock(
    {
      approvals: [{ horse_id: "horse-1", rider_id: "rider-1", status: "approved" }],
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
        },
        {
          active: true,
          created_at: "2026-03-19T08:20:00.000Z",
          end_at: "2026-03-20T15:00:00.000Z",
          horse_id: "horse-1",
          id: "rule-3",
          is_trial_slot: false,
          slot_id: "slot-3",
          start_at: "2026-03-20T14:00:00.000Z"
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
    },
    {
      rpcHandlers: {
        reschedule_operational_booking: createQuotaAwareRescheduleHandler()
      }
    }
  );

  const firstReschedule = await rescheduleOperationalBookingForRider({
    bookingId: "booking-1",
    endAtInput: "2026-03-20T13:00:00.000Z",
    logSupabaseError: () => {},
    riderId: "rider-1",
    ruleId: "rule-2",
    startAtInput: "2026-03-20T12:00:00.000Z",
    supabase
  });
  const secondReschedule = await rescheduleOperationalBookingForRider({
    bookingId: "booking-2",
    endAtInput: "2026-03-20T15:00:00.000Z",
    logSupabaseError: () => {},
    riderId: "rider-1",
    ruleId: "rule-3",
    startAtInput: "2026-03-20T14:00:00.000Z",
    supabase
  });

  assert.equal(firstReschedule.ok, true);
  assert.equal(secondReschedule.ok, true);
  assert.equal(supabase.state.tables.bookings.length, 1);
  assert.equal(supabase.state.tables.bookings[0].start_at, "2026-03-20T14:00:00.000Z");
  assert.deepEqual(
    supabase.state.tables.booking_requests.map((item) => item.status),
    ["rescheduled", "rescheduled", "accepted"]
  );
});

test("Parallele operative Direktbuchungen koennen das Wochenkontingent nicht ueberschreiten", async () => {
  const supabase = createSupabaseMock(
    {
      approvals: [{ horse_id: "horse-1", rider_id: "rider-1", status: "approved" }],
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
      ],
      booking_requests: [],
      bookings: [],
      calendar_blocks: [],
      rider_booking_limits: [
        {
          created_at: "2026-03-19T07:00:00.000Z",
          horse_id: "horse-1",
          rider_id: "rider-1",
          updated_at: "2026-03-19T07:00:00.000Z",
          weekly_hours_limit: 1
        }
      ]
    },
    {
      rpcHandlers: {
        direct_book_operational_slot: createQuotaAwareDirectBookingHandler()
      }
    }
  );

  const [firstResult, secondResult] = await Promise.all([
    requestBookingForRider({
      formData: createOperationalBookingForm({
        endAt: "2026-03-20T11:00:00.000Z",
        ruleId: "rule-1",
        startAt: "2026-03-20T10:00:00.000Z"
      }),
      logSupabaseError: () => {},
      supabase,
      userId: "rider-1"
    }),
    requestBookingForRider({
      formData: createOperationalBookingForm({
        endAt: "2026-03-20T13:00:00.000Z",
        ruleId: "rule-2",
        startAt: "2026-03-20T12:00:00.000Z"
      }),
      logSupabaseError: () => {},
      supabase,
      userId: "rider-1"
    })
  ]);

  assert.equal([firstResult.ok, secondResult.ok].filter(Boolean).length, 1);
  assert.equal([firstResult.message, secondResult.message].includes("Dein Wochenkontingent fuer dieses Pferd ist in dieser Woche bereits ausgeschoepft."), true);
  assert.equal(supabase.state.tables.bookings.length, 1);
});
