import type { SupabaseClient } from "@supabase/supabase-js";

import { buildApprovalStatusMap, getRelationshipKey, isActiveRelationship, shouldShowTrialRequestInLifecycle } from "@/lib/relationship-state";
import type { Approval, BookingRequest, Conversation, Horse, Message, RiderBookingLimit, TrialRequest } from "@/types/database";

export type OwnerRequestItem = TrialRequest & {
  horse?: Horse | null;
};

export type OwnerBookingRequestItem = BookingRequest & {
  horse?: Horse | null;
};

export type ActiveRelationshipItem = {
  approval: Approval;
  conversation: Conversation | null;
  horse: Horse | null;
  latestTrial: OwnerRequestItem | null;
  riderBookingLimit: RiderBookingLimit | null;
};

type ContactInfoRecord = {
  partner_name: string | null;
};

export type OwnerWorkspaceData = {
  activeRelationships: ActiveRelationshipItem[];
  approvalMap: Map<string, Approval>;
  bookingItems: OwnerBookingRequestItem[];
  conversationInfo: Map<string, ContactInfoRecord | null>;
  conversationMap: Map<string, Conversation>;
  conversations: Conversation[];
  horseMap: Map<string, Horse>;
  horses: Horse[];
  latestMessages: Map<string, Message>;
  riderBookingLimitMap: Map<string, RiderBookingLimit>;
  trialPipelineItems: OwnerRequestItem[];
};

export function hasUnreadOwnerMessage(conversation: Conversation | null, latestMessage: Message | null, currentUserId: string) {
  if (!conversation || !latestMessage || latestMessage.sender_id === currentUserId) {
    return false;
  }

  const lastReadAt = conversation.owner_last_read_at ?? conversation.created_at;
  return Date.parse(latestMessage.created_at) > Date.parse(lastReadAt);
}

export async function loadOwnerWorkspaceData(supabase: SupabaseClient, ownerId: string): Promise<OwnerWorkspaceData> {
  const { data: horsesData } = await supabase
    .from("horses")
    .select("id, owner_id, title, plz, description, active, created_at")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  const horses = (horsesData as Horse[] | null) ?? [];
  const horseMap = new Map(horses.map((horse) => [horse.id, horse]));
  const horseIds = horses.map((horse) => horse.id);

  if (horseIds.length === 0) {
    return {
      activeRelationships: [],
      approvalMap: new Map(),
      bookingItems: [],
      conversationInfo: new Map(),
      conversationMap: new Map(),
      conversations: [],
      horseMap,
      horses,
      latestMessages: new Map(),
      riderBookingLimitMap: new Map(),
      trialPipelineItems: []
    };
  }

  const [{ data: requestsData }, { data: approvalsData }, { data: conversationsData }, { data: bookingRequestsData }, { data: riderBookingLimitsData }] =
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
        .in("horse_id", horseIds),
      supabase
        .from("booking_requests")
        .select("id, slot_id, availability_rule_id, horse_id, rider_id, status, requested_start_at, requested_end_at, recurrence_rrule, created_at")
        .in("horse_id", horseIds)
        .order("created_at", { ascending: false })
        .limit(40),
      supabase
        .from("rider_booking_limits")
        .select("horse_id, rider_id, weekly_hours_limit, created_at, updated_at")
        .in("horse_id", horseIds)
    ]);

  const requests = (requestsData as TrialRequest[] | null) ?? [];
  const approvals = (approvalsData as Approval[] | null) ?? [];
  const conversations = (conversationsData as Conversation[] | null) ?? [];
  const bookingRequests = (bookingRequestsData as BookingRequest[] | null) ?? [];
  const riderBookingLimits = (riderBookingLimitsData as RiderBookingLimit[] | null) ?? [];

  const conversationIds = conversations.map((conversation) => conversation.id);
  const { data: latestMessagesData } = conversationIds.length > 0
    ? await supabase
        .from("messages")
        .select("id, conversation_id, sender_id, content, created_at")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false })
    : { data: [] as Message[] };

  const contactInfoEntries = await Promise.all(
    conversations.map(async (conversation) => {
      const { data } = await supabase.rpc("get_conversation_contact_info", {
        p_conversation_id: conversation.id
      });
      const rows = Array.isArray(data) ? data : data ? [data] : [];
      const record = (rows[0] as ContactInfoRecord | undefined) ?? null;
      return [conversation.id, record] as const;
    })
  );

  const latestMessages = new Map<string, Message>();
  (((latestMessagesData as Message[] | null) ?? [])).forEach((message) => {
    if (!latestMessages.has(message.conversation_id)) {
      latestMessages.set(message.conversation_id, message);
    }
  });

  const approvalStatusMap = buildApprovalStatusMap(approvals);
  const approvalMap = new Map(approvals.map((approval) => [getRelationshipKey(approval.horse_id, approval.rider_id), approval]));
  const conversationMap = new Map(conversations.map((conversation) => [getRelationshipKey(conversation.horse_id, conversation.rider_id), conversation]));
  const riderBookingLimitMap = new Map(riderBookingLimits.map((limit) => [getRelationshipKey(limit.horse_id, limit.rider_id), limit]));
  const conversationInfo = new Map(contactInfoEntries);

  const items: OwnerRequestItem[] = requests.map((request) => ({
    ...request,
    horse: horseMap.get(request.horse_id) ?? null
  }));
  const bookingItems: OwnerBookingRequestItem[] = bookingRequests.map((request) => ({
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

  const activeRelationships: ActiveRelationshipItem[] = approvals
    .filter((approval) => isActiveRelationship(approval.status))
    .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
    .map((approval) => {
      const key = getRelationshipKey(approval.horse_id, approval.rider_id);

      return {
        approval,
        conversation: conversationMap.get(key) ?? null,
        horse: horseMap.get(approval.horse_id) ?? null,
        latestTrial: latestTrialByPair.get(key) ?? null,
        riderBookingLimit: riderBookingLimitMap.get(key) ?? null
      };
    });

  const trialPipelineItems = items.filter((item) =>
    shouldShowTrialRequestInLifecycle(item.status, approvalStatusMap.get(getRelationshipKey(item.horse_id, item.rider_id)))
  );

  return {
    activeRelationships,
    approvalMap,
    bookingItems,
    conversationInfo,
    conversationMap,
    conversations,
    horseMap,
    horses,
    latestMessages,
    riderBookingLimitMap,
    trialPipelineItems
  };
}
