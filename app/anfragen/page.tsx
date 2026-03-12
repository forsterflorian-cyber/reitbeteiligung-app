import {
  RiderRelationshipsWorkspace,
  type RiderActiveRelationshipCard,
  type RiderLifecycleCard
} from "@/components/rider/rider-relationships-workspace";
import { RiderOperationalWorkspace } from "@/components/rider/rider-operational-workspace";
import { AppPageShell } from "@/components/ui/app-page-shell";
import { requireProfile } from "@/lib/auth";
import { getRiderRelationshipSection, getRelationshipKey, isCompletedTrialAwaitingDecision } from "@/lib/relationship-state";
import { loadRiderOperationalWorkspaceData, loadRiderWorkspaceData } from "@/lib/rider-workspace";
import { readSearchParam } from "@/lib/search-params";

export default async function AnfragenPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { supabase, user } = await requireProfile("rider");
  const error = readSearchParam(searchParams, "error");
  const message = readSearchParam(searchParams, "message");
  const selectedBookingId = readSearchParam(searchParams, "rescheduleBooking");
  const { activeRelationships, approvalStatusMap, conversationInfo, conversationMap, requests } = await loadRiderWorkspaceData(supabase, user.id);
  const operationalWorkspace = await loadRiderOperationalWorkspaceData(supabase, user.id, activeRelationships, {
    selectedBookingId
  });

  const activeRelationshipCards: RiderActiveRelationshipCard[] = activeRelationships.map((item) => {
    const contact = item.conversation ? conversationInfo.get(item.conversation.id) ?? null : null;

    return {
      horseId: item.approval.horse_id,
      horseTitle: item.horse?.title ?? "Pferdeprofil nicht gefunden",
      ownerName: contact?.partner_name?.trim() || "Pferdehalter",
      approvedAt: item.approval.created_at,
      lastTrialStartAt: item.latestTrial?.requested_start_at ?? null,
      lastTrialEndAt: item.latestTrial?.requested_end_at ?? null,
      conversationId: item.conversation?.id ?? null
    };
  });

  const lifecycleCards = requests
    .map((item) => {
      const relationshipKey = getRelationshipKey(item.horse_id, item.rider_id);
      const approvalStatus = approvalStatusMap.get(relationshipKey) ?? null;
      const section = getRiderRelationshipSection(item.status, approvalStatus);
      const conversation = conversationMap.get(relationshipKey) ?? null;
      const contact = conversation ? conversationInfo.get(conversation.id) ?? null : null;

      return {
        card: {
          requestId: item.id,
          horseId: item.horse_id,
          horseTitle: item.horse?.title ?? "Pferdeprofil nicht gefunden",
          ownerName: contact?.partner_name?.trim() || "Pferdehalter",
          requestedStartAt: item.requested_start_at ?? null,
          requestedEndAt: item.requested_end_at ?? null,
          createdAt: item.created_at,
          messageText: item.message?.trim() || "Keine Nachricht hinterlegt.",
          status: item.status,
          approvalStatus,
          conversationId: conversation?.id ?? null,
          isCompletedDecisionPending: isCompletedTrialAwaitingDecision(item.status, approvalStatus)
        } satisfies RiderLifecycleCard,
        section
      };
    })
    .filter((item) => item.section !== "active")
    .sort((left, right) => {
      const leftSortValue = Date.parse(left.card.requestedStartAt ?? left.card.createdAt);
      const rightSortValue = Date.parse(right.card.requestedStartAt ?? right.card.createdAt);

      return rightSortValue - leftSortValue;
    });

  const clarificationItems = lifecycleCards.filter((item) => item.section === "in_clarification").map((item) => item.card);
  const archiveItems = lifecycleCards.filter((item) => item.section === "archive").map((item) => item.card);

  return (
    <AppPageShell>
      <RiderOperationalWorkspace items={operationalWorkspace} pagePath="/anfragen" />
      <RiderRelationshipsWorkspace
        activeRelationships={activeRelationshipCards}
        archiveItems={archiveItems}
        clarificationItems={clarificationItems}
        error={error}
        message={message}
      />
    </AppPageShell>
  );
}
