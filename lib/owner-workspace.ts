import type { SupabaseClient } from "@supabase/supabase-js";

import { loadConversationSummaryMaps, type ConversationContactInfo } from "@/lib/message-summaries";
import {
  buildApprovalStatusMap,
  getRelationshipKey,
  hasVisibleRelationshipConversation,
  isActiveRelationship,
  shouldShowTrialRequestInLifecycle
} from "@/lib/relationship-state";
import type { Approval, Conversation, Message, TrialRequest } from "@/types/database";

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
