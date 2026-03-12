import type { SupabaseClient } from "@supabase/supabase-js";

import { canCancelOperationalBooking, canRescheduleOperationalBooking } from "./booking-guards.ts";
import { loadConversationSummaryMaps, type ConversationContactInfo } from "./message-summaries.ts";
import { getUpcomingOperationalSlots } from "./operational-slots.ts";
import { buildApprovalStatusMap, getRelationshipKey, hasVisibleRelationshipConversation, isActiveRelationship } from "./relationship-state.ts";
import type { Approval, AvailabilityRule, Booking, Conversation, Message, TrialRequest } from "../types/database.ts";

type RiderWorkspaceHorse = {
  id: string;
  plz: string;
  title: string;
};

export type RiderRequestItem = TrialRequest & {
  horse?: RiderWorkspaceHorse | null;
};

export type RiderActiveRelationshipItem = {
  approval: Approval;
  conversation: Conversation | null;
  horse: RiderWorkspaceHorse | null;
  latestTrial: RiderRequestItem | null;
};

export type RiderWorkspaceData = {
  activeRelationships: RiderActiveRelationshipItem[];
  approvalStatusMap: Map<string, Approval["status"]>;
  conversationInfo: Map<string, ConversationContactInfo | null>;
  conversationMap: Map<string, Conversation>;
  conversations: Conversation[];
  horseMap: Map<string, RiderWorkspaceHorse>;
  latestMessages: Map<string, Message>;
  requests: RiderRequestItem[];
};

type RiderOperationalRuleRecord = Pick<AvailabilityRule, "id" | "horse_id" | "slot_id" | "start_at" | "end_at" | "active" | "is_trial_slot" | "created_at">;
type RiderOperationalBookingRecord = Pick<
  Booking,
  "id" | "booking_request_id" | "availability_rule_id" | "slot_id" | "horse_id" | "rider_id" | "start_at" | "end_at" | "created_at"
>;
type RiderOperationalOccupancyRecord = {
  end_at: string;
  start_at: string;
};

export type RiderOperationalBookingItem = {
  canCancel: boolean;
  canReschedule: boolean;
  endAt: string;
  horseId: string;
  id: string;
  startAt: string;
};

export type RiderOperationalSlotItem = {
  availabilityRuleId: string;
  endAt: string;
  startAt: string;
};

export type RiderOperationalWorkspaceItem = {
  horseId: string;
  horseTitle: string;
  openSlots: RiderOperationalSlotItem[];
  selectedBooking: RiderOperationalBookingItem | null;
  upcomingBookings: RiderOperationalBookingItem[];
};

export function hasUnreadRiderMessage(conversation: Conversation | null, latestMessage: Message | null, currentUserId: string) {
  if (!conversation || !latestMessage || latestMessage.sender_id === currentUserId) {
    return false;
  }

  const lastReadAt = conversation.rider_last_read_at ?? conversation.created_at;
  return Date.parse(latestMessage.created_at) > Date.parse(lastReadAt);
}

export function buildRiderOperationalWorkspaceItems(args: {
  activeRelationships: readonly RiderActiveRelationshipItem[];
  occupancyByHorseId: ReadonlyMap<string, readonly RiderOperationalOccupancyRecord[]>;
  rules: readonly RiderOperationalRuleRecord[];
  selectedBookingId?: string | null;
  slotLimit?: number;
  upcomingBookings: readonly RiderOperationalBookingRecord[];
  now?: Date;
}) {
  const now = args.now ?? new Date();
  const slotLimit = args.slotLimit ?? 4;
  const rulesByHorseId = new Map<string, RiderOperationalRuleRecord[]>();
  const bookingsByHorseId = new Map<string, RiderOperationalBookingRecord[]>();

  for (const rule of args.rules) {
    const rules = rulesByHorseId.get(rule.horse_id) ?? [];
    rules.push(rule);
    rulesByHorseId.set(rule.horse_id, rules);
  }

  for (const booking of args.upcomingBookings) {
    const bookings = bookingsByHorseId.get(booking.horse_id) ?? [];
    bookings.push(booking);
    bookingsByHorseId.set(booking.horse_id, bookings);
  }

  return args.activeRelationships.map((item) => {
    const horseId = item.approval.horse_id;
    const horseRules = rulesByHorseId.get(horseId) ?? [];
    const occupancy = [...(args.occupancyByHorseId.get(horseId) ?? [])];
    const upcomingBookings = (bookingsByHorseId.get(horseId) ?? [])
      .slice()
      .sort((left, right) => Date.parse(left.start_at) - Date.parse(right.start_at))
      .map((booking) => ({
        canCancel: canCancelOperationalBooking({ startAt: booking.start_at, status: "accepted" }),
        canReschedule: canRescheduleOperationalBooking({ startAt: booking.start_at, status: "accepted" }),
        endAt: booking.end_at,
        horseId: booking.horse_id,
        id: booking.id,
        startAt: booking.start_at
      }));
    const selectedBooking = upcomingBookings.find((booking) => booking.id === args.selectedBookingId && booking.canReschedule) ?? null;
    const openSlots = getUpcomingOperationalSlots({
      disallowedRange: selectedBooking
        ? {
            end_at: selectedBooking.endAt,
            start_at: selectedBooking.startAt
          }
        : null,
      excludedRange: selectedBooking
        ? {
            end_at: selectedBooking.endAt,
            start_at: selectedBooking.startAt
          }
        : null,
      limit: slotLimit,
      now,
      occupiedRanges: occupancy,
      rules: horseRules
    }).map((slot) => ({
      availabilityRuleId: slot.availabilityRuleId,
      endAt: slot.endAt,
      startAt: slot.startAt
    }));

    return {
      horseId,
      horseTitle: item.horse?.title ?? "Pferdeprofil nicht gefunden",
      openSlots,
      selectedBooking,
      upcomingBookings
    } satisfies RiderOperationalWorkspaceItem;
  });
}

export async function loadRiderOperationalWorkspaceData(
  supabase: SupabaseClient,
  riderId: string,
  activeRelationships: readonly RiderActiveRelationshipItem[],
  options?: {
    now?: Date;
    selectedBookingId?: string | null;
    slotLimit?: number;
  }
): Promise<RiderOperationalWorkspaceItem[]> {
  const horseIds = [...new Set(activeRelationships.map((item) => item.approval.horse_id))];

  if (horseIds.length === 0) {
    return [];
  }

  const now = options?.now ?? new Date();
  const nowIso = now.toISOString();
  const [rulesResult, bookingsResult, occupancyEntries] = await Promise.all([
    supabase
      .from("availability_rules")
      .select("id, horse_id, slot_id, start_at, end_at, active, is_trial_slot, created_at")
      .in("horse_id", horseIds)
      .eq("active", true)
      .order("start_at", { ascending: true }),
    supabase
      .from("bookings")
      .select("id, booking_request_id, availability_rule_id, slot_id, horse_id, rider_id, start_at, end_at, created_at")
      .eq("rider_id", riderId)
      .in("horse_id", horseIds)
      .gte("end_at", nowIso)
      .order("start_at", { ascending: true }),
    Promise.all(
      horseIds.map(async (horseId) => {
        const result = await supabase.rpc("get_horse_calendar_occupancy", {
          p_horse_id: horseId
        });

        return {
          horseId,
          rows: ((result.data as RiderOperationalOccupancyRecord[] | null) ?? []).sort(
            (left, right) => Date.parse(left.start_at) - Date.parse(right.start_at)
          )
        };
      })
    )
  ]);
  const occupancyByHorseId = new Map(
    occupancyEntries.map((entry) => [entry.horseId, entry.rows] as const)
  );

  return buildRiderOperationalWorkspaceItems({
    activeRelationships,
    now,
    occupancyByHorseId,
    rules: (rulesResult.data as RiderOperationalRuleRecord[] | null) ?? [],
    selectedBookingId: options?.selectedBookingId ?? null,
    slotLimit: options?.slotLimit,
    upcomingBookings: (bookingsResult.data as RiderOperationalBookingRecord[] | null) ?? []
  });
}

export async function loadRiderWorkspaceData(supabase: SupabaseClient, riderId: string): Promise<RiderWorkspaceData> {
  const [{ data: requestsData }, { data: approvalsData }, { data: conversationsData }] = await Promise.all([
    supabase
      .from("trial_requests")
      .select("id, horse_id, rider_id, status, message, availability_rule_id, requested_start_at, requested_end_at, created_at")
      .eq("rider_id", riderId)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase.from("approvals").select("horse_id, rider_id, status, created_at").eq("rider_id", riderId),
    supabase
      .from("conversations")
      .select("id, horse_id, rider_id, owner_id, owner_last_read_at, rider_last_read_at, created_at")
      .eq("rider_id", riderId)
  ]);

  const requests = (requestsData as TrialRequest[] | null) ?? [];
  const approvals = (approvalsData as Approval[] | null) ?? [];
  const conversations = (conversationsData as Conversation[] | null) ?? [];
  const horseIds = [
    ...new Set([
      ...requests.map((request) => request.horse_id),
      ...approvals.map((approval) => approval.horse_id),
      ...conversations.map((conversation) => conversation.horse_id)
    ])
  ];

  const { data: horseData } = horseIds.length > 0
    ? await supabase.from("horses").select("id, title, plz").in("id", horseIds)
    : { data: [] as RiderWorkspaceHorse[] };

  const horses = (horseData as RiderWorkspaceHorse[] | null) ?? [];
  const horseMap = new Map(horses.map((horse) => [horse.id, horse]));
  const approvalStatusMap = buildApprovalStatusMap(approvals);
  const requestItems: RiderRequestItem[] = requests.map((request) => ({
    ...request,
    horse: horseMap.get(request.horse_id) ?? null
  }));
  const latestTrialByHorseId = new Map<string, RiderRequestItem>();
  const latestTrialByPair = new Map<string, RiderRequestItem>();

  requestItems.forEach((item) => {
    const key = getRelationshipKey(item.horse_id, item.rider_id);

    if (!latestTrialByHorseId.has(item.horse_id)) {
      latestTrialByHorseId.set(item.horse_id, item);
    }

    if (!latestTrialByPair.has(key)) {
      latestTrialByPair.set(key, item);
    }
  });
  const visibleConversations = conversations.filter((conversation) => {
    const key = getRelationshipKey(conversation.horse_id, conversation.rider_id);

    return hasVisibleRelationshipConversation(latestTrialByPair.get(key)?.status ?? null, approvalStatusMap.get(key) ?? null);
  });
  const { conversationInfo, latestMessages } = await loadConversationSummaryMaps(
    supabase,
    visibleConversations.map((conversation) => conversation.id)
  );
  const conversationMap = new Map(visibleConversations.map((conversation) => [getRelationshipKey(conversation.horse_id, conversation.rider_id), conversation]));

  const activeRelationships: RiderActiveRelationshipItem[] = approvals
    .filter((approval) => isActiveRelationship(approval.status))
    .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
    .map((approval) => {
      const key = getRelationshipKey(approval.horse_id, approval.rider_id);

      return {
        approval,
        conversation: conversationMap.get(key) ?? null,
        horse: horseMap.get(approval.horse_id) ?? null,
        latestTrial: latestTrialByHorseId.get(approval.horse_id) ?? null
      };
    });

  return {
    activeRelationships,
    approvalStatusMap,
    conversationInfo,
    conversationMap,
    conversations: visibleConversations,
    horseMap,
    latestMessages,
    requests: requestItems
  };
}
