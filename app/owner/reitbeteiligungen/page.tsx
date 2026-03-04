import { OwnerRelationshipsWorkspace } from "@/components/owner/owner-relationships-workspace";
import { AppPageShell } from "@/components/ui/app-page-shell";
import { requireProfile } from "@/lib/auth";
import { hasUnreadOwnerMessage, loadOwnerWorkspaceData } from "@/lib/owner-workspace";
import { readSearchParam } from "@/lib/search-params";

export default async function OwnerRelationshipsPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { supabase, user } = await requireProfile("owner");
  const error = readSearchParam(searchParams, "error");
  const message = readSearchParam(searchParams, "message");
  const { activeRelationships, conversationInfo, latestMessages } = await loadOwnerWorkspaceData(supabase, user.id);

  const unreadCount = activeRelationships.reduce((count, item) => {
    const latestMessage = item.conversation ? latestMessages.get(item.conversation.id) ?? null : null;
    return hasUnreadOwnerMessage(item.conversation, latestMessage, user.id) ? count + 1 : count;
  }, 0);

  const relationshipCards = activeRelationships.map((item) => {
    const contact = item.conversation ? conversationInfo.get(item.conversation.id) ?? null : null;
    const latestMessage = item.conversation ? latestMessages.get(item.conversation.id) ?? null : null;

    return {
      horseId: item.approval.horse_id,
      riderId: item.approval.rider_id,
      horseTitle: item.horse?.title ?? "Pferdeprofil nicht gefunden",
      riderName: contact?.partner_name?.trim() || "Reiter",
      approvedAt: item.approval.created_at,
      lastTrialStartAt: item.latestTrial?.requested_start_at ?? null,
      lastTrialEndAt: item.latestTrial?.requested_end_at ?? null,
      hasUnread: hasUnreadOwnerMessage(item.conversation, latestMessage, user.id),
      conversationId: item.conversation?.id ?? null,
      latestTrialId: item.latestTrial?.id ?? null
    };
  });

  return (
    <AppPageShell>
      <OwnerRelationshipsWorkspace
        activeCount={relationshipCards.length}
        error={error}
        horseCount={new Set(relationshipCards.map((item) => item.horseId)).size}
        message={message}
        relationships={relationshipCards}
        unreadCount={unreadCount}
      />
    </AppPageShell>
  );
}
