import { RiderMessagesWorkspace, type RiderDirectMessageCard, type RiderGroupChatCard } from "@/components/rider/rider-messages-workspace";
import { AppPageShell } from "@/components/ui/app-page-shell";
import { requireProfile } from "@/lib/auth";
import { loadLatestHorseGroupMessages } from "@/lib/message-summaries";
import { getRelationshipKey, isActiveRelationship, isCompletedTrialAwaitingDecision } from "@/lib/relationship-state";
import { hasUnreadRiderMessage, loadRiderWorkspaceData } from "@/lib/rider-workspace";

export default async function RiderMessagesPage() {
  const { supabase, user } = await requireProfile("rider");
  const { activeRelationships, approvalStatusMap, conversationInfo, conversations, horseMap, latestMessages, requests } =
    await loadRiderWorkspaceData(supabase, user.id);

  const latestRequestByPair = new Map<string, (typeof requests)[number]>();

  requests.forEach((request) => {
    const key = getRelationshipKey(request.horse_id, request.rider_id);

    if (!latestRequestByPair.has(key)) {
      latestRequestByPair.set(key, request);
    }
  });

  const directMessages: RiderDirectMessageCard[] = conversations
    .map((conversation) => {
      const key = getRelationshipKey(conversation.horse_id, conversation.rider_id);
      const latestRequest = latestRequestByPair.get(key) ?? null;
      const approvalStatus = approvalStatusMap.get(key) ?? null;
      const latestMessage = latestMessages.get(conversation.id) ?? null;
      const contact = conversationInfo.get(conversation.id) ?? null;
      const sortValue = latestMessage ? Date.parse(latestMessage.created_at) : Date.parse(conversation.created_at);

      return {
        conversationId: conversation.id,
        horseId: conversation.horse_id,
        horseTitle: horseMap.get(conversation.horse_id)?.title ?? "Pferdeprofil nicht gefunden",
        ownerName: contact?.partner_name?.trim() || "Pferdehalter",
        hasUnread: hasUnreadRiderMessage(conversation, latestMessage, user.id),
        isActiveRelationship: isActiveRelationship(approvalStatus),
        isDecisionPendingAfterCompletion: isCompletedTrialAwaitingDecision(latestRequest?.status ?? null, approvalStatus),
        latestMessageAt: latestMessage?.created_at ?? conversation.created_at,
        latestMessageText: latestMessage?.content?.trim() || "Noch keine Nachricht hinterlegt.",
        sortValue
      };
    })
    .sort((left, right) => right.sortValue - left.sortValue)
    .map(({ sortValue: _sortValue, ...item }) => item);

  const unreadCount = directMessages.filter((item) => item.hasUnread).length;
  const groupHorseIds = activeRelationships.map((item) => item.approval.horse_id);
  const latestGroupMessageByHorse = await loadLatestHorseGroupMessages(supabase, groupHorseIds);

  const groupChats: RiderGroupChatCard[] = activeRelationships.map((item) => {
    const latestGroupMessage = latestGroupMessageByHorse.get(item.approval.horse_id) ?? null;

    return {
      horseId: item.approval.horse_id,
      horseTitle: item.horse?.title ?? "Pferdeprofil nicht gefunden",
      latestMessageAt: latestGroupMessage?.created_at ?? null,
      latestMessageText: latestGroupMessage?.content?.trim() || "Sobald im Gruppenchat geschrieben wird, erscheint die letzte Nachricht hier."
    };
  });

  return (
    <AppPageShell>
      <RiderMessagesWorkspace directMessages={directMessages} groupChats={groupChats} unreadCount={unreadCount} />
    </AppPageShell>
  );
}
