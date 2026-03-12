import type { SupabaseClient } from "@supabase/supabase-js";

import { filterActiveOperationalBookings, getAcceptedOperationalBookingRequestIdSet } from "./active-operational-bookings.ts";
import { canCancelOperationalBooking, canRescheduleOperationalBooking } from "./booking-guards.ts";
import { loadConversationSummaryMaps, type ConversationContactInfo } from "./message-summaries.ts";
import { getUpcomingOperationalSlots } from "./operational-slots.ts";
import {
  buildApprovalStatusMap,
  getRelationshipKey,
  hasVisibleRelationshipConversation,
  isActiveRelationship,
  shouldShowTrialRequestInLifecycle
} from "./relationship-state.ts";
import type { Approval, AvailabilityRule, Booking, CalendarBlock, Conversation, Message, Profile, TrialRequest } from "../types/database.ts";

type OwnerWorkspaceHorse = {
  active: boolean;
  created_at: string;
  description: string | null;
  id: string;
  plz: string;
  title: string;
};

export type OwnerRequestItem = TrialRequest & {
  horse?: OwnerWorkspaceHorse | null;
};

export type ActiveRelationshipItem = {
  approval: Approval;
  conversation: Conversation | null;
  horse: OwnerWorkspaceHorse | null;
  latestTrial: OwnerRequestItem | null;
};

export type OwnerWorkspaceData = {
  activeRelationships: ActiveRelationshipItem[];
  approvalMap: Map<string, Approval>;
  conversationInfo: Map<string, ConversationContactInfo | null>;
  conversationMap: Map<string, Conversation>;
  conversations: Conversation[];
  horseMap: Map<string, OwnerWorkspaceHorse>;
  horses: OwnerWorkspaceHorse[];
  latestMessages: Map<string, Message>;
  trialPipelineItems: OwnerRequestItem[];
};

type OwnerOperationalRuleRecord = Pick<AvailabilityRule, "id" | "horse_id" | "slot_id" | "start_at" | "end_at" | "active" | "is_trial_slot" | "created_at">;
type OwnerOperationalBookingRecord = Pick<
  Booking,
  "id" | "booking_request_id" | "availability_rule_id" | "slot_id" | "horse_id" | "rider_id" | "start_at" | "end_at" | "created_at"
>;
type OwnerOperationalBlockRecord = Pick<CalendarBlock, "horse_id" | "start_at" | "end_at">;
type OwnerOperationalBookingRequestStatusRecord = {
  id: string;
  status: string;
};
type OwnerOperationalRiderProfileRecord = Pick<Profile, "id" | "display_name">;

export type OwnerOperationalSlotItem = {
  availabilityRuleId: string;
  endAt: string;
  startAt: string;
};

export type OwnerOperationalBookingItem = {
  canCancel: boolean;
  canReschedule: boolean;
  endAt: string;
  horseId: string;
  id: string;
  riderId: string;
  riderName: string | null;
  startAt: string;
};

export type OwnerOperationalWorkspaceItem = {
  activeRiderCount: number;
  horseId: string;
  horseTitle: string;
  openSlots: OwnerOperationalSlotItem[];
  selectedBooking: OwnerOperationalBookingItem | null;
  upcomingBookings: OwnerOperationalBookingItem[];
};

export function hasUnreadOwnerMessage(conversation: Conversation | null, latestMessage: Message | null, currentUserId: string) {
  if (!conversation || !latestMessage || latestMessage.sender_id === currentUserId) {
    return false;
  }

  const lastReadAt = conversation.owner_last_read_at ?? conversation.created_at;
  return Date.parse(latestMessage.created_at) > Date.parse(lastReadAt);
}

export function buildOwnerOperationalWorkspaceItems(args: {
  activeRelationships: readonly ActiveRelationshipItem[];
  blocks: readonly OwnerOperationalBlockRecord[];
  horses: readonly OwnerWorkspaceHorse[];
  riderProfiles: readonly OwnerOperationalRiderProfileRecord[];
  rules: readonly OwnerOperationalRuleRecord[];
  selectedBookingId?: string | null;
  slotLimit?: number;
  upcomingBookings: readonly OwnerOperationalBookingRecord[];
  now?: Date;
}) {
  const now = args.now ?? new Date();
  const slotLimit = args.slotLimit ?? 4;
  const activeRelationshipCountByHorseId = new Map<string, number>();
  const rulesByHorseId = new Map<string, OwnerOperationalRuleRecord[]>();
  const bookingsByHorseId = new Map<string, OwnerOperationalBookingRecord[]>();
  const occupancyByHorseId = new Map<string, OwnerOperationalBlockRecord[]>();
  const riderNameById = new Map(args.riderProfiles.map((profile) => [profile.id, profile.display_name?.trim() || null]));

  for (const item of args.activeRelationships) {
    activeRelationshipCountByHorseId.set(
      item.approval.horse_id,
      (activeRelationshipCountByHorseId.get(item.approval.horse_id) ?? 0) + 1
    );
  }

  for (const rule of args.rules) {
    const rules = rulesByHorseId.get(rule.horse_id) ?? [];
    rules.push(rule);
    rulesByHorseId.set(rule.horse_id, rules);
  }

  for (const booking of args.upcomingBookings) {
    const bookings = bookingsByHorseId.get(booking.horse_id) ?? [];
    bookings.push(booking);
    bookingsByHorseId.set(booking.horse_id, bookings);

    const occupancy = occupancyByHorseId.get(booking.horse_id) ?? [];
    occupancy.push({
      end_at: booking.end_at,
      horse_id: booking.horse_id,
      start_at: booking.start_at
    });
    occupancyByHorseId.set(booking.horse_id, occupancy);
  }

  for (const block of args.blocks) {
    const occupancy = occupancyByHorseId.get(block.horse_id) ?? [];
    occupancy.push(block);
    occupancyByHorseId.set(block.horse_id, occupancy);
  }

  return args.horses
    .map((horse) => {
      const activeRiderCount = activeRelationshipCountByHorseId.get(horse.id) ?? 0;
      const upcomingBookings = (bookingsByHorseId.get(horse.id) ?? [])
        .slice()
        .sort((left, right) => Date.parse(left.start_at) - Date.parse(right.start_at))
        .map((booking) => ({
          canCancel: canCancelOperationalBooking({ startAt: booking.start_at, status: "accepted" }),
          canReschedule: canRescheduleOperationalBooking({ startAt: booking.start_at, status: "accepted" }),
          endAt: booking.end_at,
          horseId: booking.horse_id,
          id: booking.id,
          riderId: booking.rider_id,
          riderName: riderNameById.get(booking.rider_id) ?? null,
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
        occupiedRanges: (occupancyByHorseId.get(horse.id) ?? []).slice(),
        rules: rulesByHorseId.get(horse.id) ?? []
      }).map((slot) => ({
        availabilityRuleId: slot.availabilityRuleId,
        endAt: slot.endAt,
        startAt: slot.startAt
      }));

      return {
        activeRiderCount,
        horseId: horse.id,
        horseTitle: horse.title,
        openSlots,
        selectedBooking,
        upcomingBookings
      } satisfies OwnerOperationalWorkspaceItem;
    })
    .filter((item) => item.activeRiderCount > 0 || item.upcomingBookings.length > 0 || item.openSlots.length > 0);
}

export async function loadOwnerOperationalWorkspaceData(
  supabase: SupabaseClient,
  horses: readonly OwnerWorkspaceHorse[],
  activeRelationships: readonly ActiveRelationshipItem[],
  options?: {
    now?: Date;
    selectedBookingId?: string | null;
    slotLimit?: number;
  }
): Promise<OwnerOperationalWorkspaceItem[]> {
  const horseIds = horses.map((horse) => horse.id);

  if (horseIds.length === 0) {
    return [];
  }

  const now = options?.now ?? new Date();
  const nowIso = now.toISOString();
  const [rulesResult, bookingsResult, bookingRequestsResult, blocksResult] = await Promise.all([
    supabase
      .from("availability_rules")
      .select("id, horse_id, slot_id, start_at, end_at, active, is_trial_slot, created_at")
      .in("horse_id", horseIds)
      .eq("active", true)
      .order("start_at", { ascending: true }),
    supabase
      .from("bookings")
      .select("id, booking_request_id, availability_rule_id, slot_id, horse_id, rider_id, start_at, end_at, created_at")
      .in("horse_id", horseIds)
      .gte("end_at", nowIso)
      .order("start_at", { ascending: true }),
    supabase
      .from("booking_requests")
      .select("id, status")
      .in("horse_id", horseIds),
    supabase
      .from("calendar_blocks")
      .select("horse_id, start_at, end_at")
      .in("horse_id", horseIds)
  ]);
  const acceptedRequestIds = getAcceptedOperationalBookingRequestIdSet(
    (bookingRequestsResult.data as OwnerOperationalBookingRequestStatusRecord[] | null) ?? []
  );
  const upcomingBookings = filterActiveOperationalBookings(
    (bookingsResult.data as OwnerOperationalBookingRecord[] | null) ?? [],
    acceptedRequestIds
  );
  const riderIds = [...new Set(upcomingBookings.map((booking) => booking.rider_id))];
  const riderProfilesResult = riderIds.length > 0
    ? await supabase.from("profiles").select("id, display_name").in("id", riderIds)
    : { data: [] as OwnerOperationalRiderProfileRecord[] };

  return buildOwnerOperationalWorkspaceItems({
    activeRelationships,
    blocks: (blocksResult.data as OwnerOperationalBlockRecord[] | null) ?? [],
    horses,
    now,
    riderProfiles: (riderProfilesResult.data as OwnerOperationalRiderProfileRecord[] | null) ?? [],
    rules: (rulesResult.data as OwnerOperationalRuleRecord[] | null) ?? [],
    selectedBookingId: options?.selectedBookingId ?? null,
    slotLimit: options?.slotLimit,
    upcomingBookings
  });
}

export async function loadOwnerWorkspaceData(supabase: SupabaseClient, ownerId: string): Promise<OwnerWorkspaceData> {
  const { data: horsesData } = await supabase
    .from("horses")
    .select("id, title, plz, description, active, created_at")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  const horses = (horsesData as OwnerWorkspaceHorse[] | null) ?? [];
  const horseMap = new Map(horses.map((horse) => [horse.id, horse]));
  const horseIds = horses.map((horse) => horse.id);

  if (horseIds.length === 0) {
    return {
      activeRelationships: [],
      approvalMap: new Map(),
      conversationInfo: new Map(),
      conversationMap: new Map(),
      conversations: [],
      horseMap,
      horses,
      latestMessages: new Map(),
      trialPipelineItems: []
    };
  }

  const [{ data: requestsData }, { data: approvalsData }, { data: conversationsData }] =
    await Promise.all([
      supabase
        .from("trial_requests")
        .select("id, horse_id, rider_id, status, message, availability_rule_id, requested_start_at, requested_end_at, created_at")
        .in("horse_id", horseIds)
        .order("created_at", { ascending: false })
        .limit(40),
      supabase.from("approvals").select("horse_id, rider_id, status, created_at").in("horse_id", horseIds),
      supabase
        .from("conversations")
        .select("id, horse_id, rider_id, owner_id, owner_last_read_at, rider_last_read_at, created_at")
        .eq("owner_id", ownerId)
        .in("horse_id", horseIds)
    ]);

  const requests = (requestsData as TrialRequest[] | null) ?? [];
  const approvals = (approvalsData as Approval[] | null) ?? [];
  const conversations = (conversationsData as Conversation[] | null) ?? [];

  const approvalStatusMap = buildApprovalStatusMap(approvals);
  const approvalMap = new Map(approvals.map((approval) => [getRelationshipKey(approval.horse_id, approval.rider_id), approval]));

  const items: OwnerRequestItem[] = requests.map((request) => ({
    ...request,
    horse: horseMap.get(request.horse_id) ?? null
  }));

  const latestTrialByPair = new Map<string, OwnerRequestItem>();
  items.forEach((item) => {
    const key = getRelationshipKey(item.horse_id, item.rider_id);

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

  const activeRelationships: ActiveRelationshipItem[] = approvals
    .filter((approval) => isActiveRelationship(approval.status))
    .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
    .map((approval) => {
      const key = getRelationshipKey(approval.horse_id, approval.rider_id);

      return {
        approval,
        conversation: conversationMap.get(key) ?? null,
        horse: horseMap.get(approval.horse_id) ?? null,
        latestTrial: latestTrialByPair.get(key) ?? null
      };
    });

  const trialPipelineItems = items.filter((item) =>
    shouldShowTrialRequestInLifecycle(item.status, approvalStatusMap.get(getRelationshipKey(item.horse_id, item.rider_id)))
  );

  return {
    activeRelationships,
    approvalMap,
    conversationInfo,
    conversationMap,
    conversations: visibleConversations,
    horseMap,
    horses,
    latestMessages,
    trialPipelineItems
  };
}
