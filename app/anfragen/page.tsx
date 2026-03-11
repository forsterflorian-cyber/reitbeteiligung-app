import { RiderRequestsWorkspace, type RiderRelationshipCard, type RiderTrialCard } from "@/components/rider/rider-requests-workspace";
import { AppPageShell } from "@/components/ui/app-page-shell";
import { requireProfile } from "@/lib/auth";
import { buildApprovalStatusMap, getApprovalStatusForPair, getRelationshipKey, isActiveRelationship, shouldShowTrialRequestInLifecycle } from "@/lib/relationship-state";
import { readSearchParam } from "@/lib/search-params";
import type { Approval, Conversation, Horse, Message, TrialRequest } from "@/types/database";

type TrialRequestListItem = TrialRequest & {
  horse?: Horse | null;
};

type ActiveRelationshipItem = {
  approval: Approval;
  conversation: Conversation | null;
  horse: Horse | null;
  latestTrial: TrialRequestListItem | null;
};

type ContactInfoRecord = {
  partner_name: string | null;
};

function hasUnreadMessage(conversation: Conversation | null, latestMessage: Message | null, currentUserId: string) {
  if (!conversation || !latestMessage || latestMessage.sender_id === currentUserId) {
    return false;
  }

  const lastReadAt = conversation.rider_last_read_at ?? conversation.created_at;
  return Date.parse(latestMessage.created_at) > Date.parse(lastReadAt);
}

export default async function AnfragenPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { supabase, user } = await requireProfile("rider");
  const error = readSearchParam(searchParams, "error");
  const message = readSearchParam(searchParams, "message");

  const [{ data: trialData }, { data: approvalsData }] = await Promise.all([
    supabase
      .from("trial_requests")
      .select("id, horse_id, rider_id, status, message, availability_rule_id, requested_start_at, requested_end_at, created_at")
      .eq("rider_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("approvals").select("horse_id, rider_id, status, created_at").eq("rider_id", user.id)
  ]);

  const requests = (trialData as TrialRequest[] | null) ?? [];
  const approvalsArray = (approvalsData as Approval[] | null) ?? [];
  const activeApprovals = approvalsArray.filter((approval) => isActiveRelationship(approval.status));
  const approvalStatusMap = buildApprovalStatusMap(approvalsArray);
  const horseIds = [...new Set([...requests.map((request) => request.horse_id), ...activeApprovals.map((approval) => approval.horse_id)])];

  const [{ data: horseData }, { data: conversationsData }] = await Promise.all([
    horseIds.length > 0
      ? supabase.from("horses").select("id, owner_id, title, plz, description, active, created_at").in("id", horseIds)
      : Promise.resolve({ data: [] as Horse[] | null }),
    horseIds.length > 0
      ? supabase
          .from("conversations")
          .select("id, horse_id, rider_id, owner_id, owner_last_read_at, rider_last_read_at, created_at")
          .eq("rider_id", user.id)
          .in("horse_id", horseIds)
      : Promise.resolve({ data: [] as Conversation[] | null })
  ]);

  const horses = new Map((((horseData as Horse[] | null) ?? [])).map((horse) => [horse.id, horse]));
  const conversationsArray = (conversationsData as Conversation[] | null) ?? [];
  const conversationIds = conversationsArray.map((conversation) => conversation.id);

  const [{ data: latestMessagesData }, contactInfoEntries] = await Promise.all([
    conversationIds.length > 0
      ? supabase
          .from("messages")
          .select("id, conversation_id, sender_id, content, created_at")
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Message[] | null }),
    Promise.all(
      conversationsArray.map(async (conversation) => {
        const { data } = await supabase.rpc("get_conversation_contact_info", {
          p_conversation_id: conversation.id
        });
        const rows = Array.isArray(data) ? data : data ? [data] : [];
        return [conversation.id, ((rows[0] as ContactInfoRecord | undefined) ?? null)] as const;
      })
    )
  ]);

  const conversations = new Map(conversationsArray.map((conversation) => [getRelationshipKey(conversation.horse_id, conversation.rider_id), conversation]));
  const conversationInfo = new Map(contactInfoEntries);
  const latestMessages = new Map<string, Message>();

  (((latestMessagesData as Message[] | null) ?? [])).forEach((latestMessage) => {
    if (!latestMessages.has(latestMessage.conversation_id)) {
      latestMessages.set(latestMessage.conversation_id, latestMessage);
    }
  });

  const items: TrialRequestListItem[] = requests.map((request) => ({
    ...request,
    horse: horses.get(request.horse_id) ?? null
  }));
  const latestTrialByHorseId = new Map<string, TrialRequestListItem>();

  items.forEach((item) => {
    if (!latestTrialByHorseId.has(item.horse_id)) {
      latestTrialByHorseId.set(item.horse_id, item);
    }
  });

  const activeRelationships: ActiveRelationshipItem[] = activeApprovals
    .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
    .map((approval) => {
      const key = getRelationshipKey(approval.horse_id, approval.rider_id);

      return {
        approval,
        conversation: conversations.get(key) ?? null,
        horse: horses.get(approval.horse_id) ?? null,
        latestTrial: latestTrialByHorseId.get(approval.horse_id) ?? null
      };
    });

  const openTrialItems = items.filter((item) =>
    shouldShowTrialRequestInLifecycle(item.status, getApprovalStatusForPair(approvalStatusMap, item.horse_id, item.rider_id))
  );

  const activeRelationshipCards: RiderRelationshipCard[] = activeRelationships.map((item) => {
    const contact = item.conversation ? conversationInfo.get(item.conversation.id) ?? null : null;
    const latestMessage = item.conversation ? latestMessages.get(item.conversation.id) ?? null : null;

    return {
      horseId: item.approval.horse_id,
      horseTitle: item.horse?.title ?? "Pferdeprofil nicht gefunden",
      ownerName: contact?.partner_name?.trim() || "Pferdehalter",
      approvedAt: item.approval.created_at,
      lastTrialStartAt: item.latestTrial?.requested_start_at ?? null,
      lastTrialEndAt: item.latestTrial?.requested_end_at ?? null,
      hasUnread: hasUnreadMessage(item.conversation, latestMessage, user.id),
      conversationId: item.conversation?.id ?? null
    };
  });

  const openTrialCards: RiderTrialCard[] = openTrialItems.map((item) => {
    const conversation = conversations.get(getRelationshipKey(item.horse_id, item.rider_id)) ?? null;
    const contact = conversation ? conversationInfo.get(conversation.id) ?? null : null;
    const latestMessage = conversation ? latestMessages.get(conversation.id) ?? null : null;

    return {
      id: item.id,
      horseId: item.horse_id,
      horseTitle: item.horse?.title ?? "Pferdeprofil nicht gefunden",
      ownerName: contact?.partner_name?.trim() || "Pferdehalter",
      requestedStartAt: item.requested_start_at ?? null,
      requestedEndAt: item.requested_end_at ?? null,
      messageText: item.message?.trim() || "Keine Nachricht hinterlegt.",
      status: item.status,
      hasUnread: hasUnreadMessage(conversation, latestMessage, user.id),
      conversationId: conversation?.id ?? null
    };
  });

  return (
    <AppPageShell>
      <RiderRequestsWorkspace
        activeRelationships={activeRelationshipCards}
        conversationCount={conversationsArray.length}
        error={error}
        message={message}
        openTrials={openTrialCards}
      />
    </AppPageShell>
  );
}
