import type { SupabaseClient } from "@supabase/supabase-js";

import { loadConversationSummaryMaps, type ConversationContactInfo } from "@/lib/message-summaries";
import { buildApprovalStatusMap, getRelationshipKey, hasVisibleRelationshipConversation, isActiveRelationship } from "@/lib/relationship-state";
import type { Approval, Conversation, Message, TrialRequest } from "@/types/database";

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

export function hasUnreadRiderMessage(conversation: Conversation | null, latestMessage: Message | null, currentUserId: string) {
  if (!conversation || !latestMessage || latestMessage.sender_id === currentUserId) {
    return false;
  }

  const lastReadAt = conversation.rider_last_read_at ?? conversation.created_at;
  return Date.parse(latestMessage.created_at) > Date.parse(lastReadAt);
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
