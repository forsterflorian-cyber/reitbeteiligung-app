import { OwnerTrialsWorkspace, type OwnerTrialPipelineCard, type OwnerTrialSlotCard } from "@/components/owner/owner-trials-workspace";
import { AppPageShell } from "@/components/ui/app-page-shell";
import { requireProfile } from "@/lib/auth";
import { hasUnreadOwnerMessage, loadOwnerWorkspaceData } from "@/lib/owner-workspace";
import { readSearchParam } from "@/lib/search-params";
import type { AvailabilityRule } from "@/types/database";

export default async function OwnerTrialRequestsPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { supabase, user } = await requireProfile("owner");
  const error = readSearchParam(searchParams, "error");
  const message = readSearchParam(searchParams, "message");
  const { approvalMap, conversationInfo, conversationMap, horses, latestMessages, trialPipelineItems } = await loadOwnerWorkspaceData(supabase, user.id);
  const horseIds = horses.map((horse) => horse.id);
  const nowIso = new Date().toISOString();
  const { data: trialSlotData } = horseIds.length > 0
    ? await supabase
        .from("availability_rules")
        .select("id, horse_id, slot_id, start_at, end_at, active, is_trial_slot, created_at")
        .in("horse_id", horseIds)
        .eq("active", true)
        .eq("is_trial_slot", true)
        .gte("end_at", nowIso)
        .order("start_at", { ascending: true })
        .limit(200)
    : { data: [] as AvailabilityRule[] };

  const trialSlots = (trialSlotData as AvailabilityRule[] | null) ?? [];
  const trialSlotsByHorse = new Map<string, AvailabilityRule[]>();

  trialSlots.forEach((slot) => {
    const existing = trialSlotsByHorse.get(slot.horse_id) ?? [];
    existing.push(slot);
    trialSlotsByHorse.set(slot.horse_id, existing);
  });

  const slotCards: OwnerTrialSlotCard[] = horses.map((horse) => {
    const slots = trialSlotsByHorse.get(horse.id) ?? [];
    const nextSlot = slots[0] ?? null;

    return {
      horseId: horse.id,
      horseTitle: horse.title,
      slotCount: slots.length,
      nextSlotStartAt: nextSlot?.start_at ?? null,
      nextSlotEndAt: nextSlot?.end_at ?? null
    };
  });

  const pipelineCards: OwnerTrialPipelineCard[] = trialPipelineItems.map((request) => {
    const approval = approvalMap.get(`${request.horse_id}:${request.rider_id}`) ?? null;
    const conversation = conversationMap.get(`${request.horse_id}:${request.rider_id}`) ?? null;
    const contact = conversation ? (conversationInfo.get(conversation.id) ?? null) : null;
    const latestMessage = conversation ? (latestMessages.get(conversation.id) ?? null) : null;

    return {
      requestId: request.id,
      horseId: request.horse_id,
      riderId: request.rider_id,
      horseTitle: request.horse?.title ?? "Pferdeprofil nicht gefunden",
      riderName: contact?.partner_name?.trim() || "Reiter",
      requestedStartAt: request.requested_start_at ?? null,
      requestedEndAt: request.requested_end_at ?? null,
      messageText: request.message?.trim() || "Keine Nachricht hinterlegt.",
      status: request.status,
      approvalStatus: approval?.status ?? null,
      hasUnread: hasUnreadOwnerMessage(conversation, latestMessage, user.id),
      conversationId: conversation?.id ?? null
    };
  });

  const requestedCount = pipelineCards.filter((item) => item.status === "requested").length;
  const nextStepCount = pipelineCards.filter((item) => item.status === "accepted" || item.status === "completed").length;

  return (
    <AppPageShell>
      <OwnerTrialsWorkspace
        error={error}
        message={message}
        nextStepCount={nextStepCount}
        requestedCount={requestedCount}
        slotCount={trialSlots.length}
        slotsByHorse={slotCards}
        trialPipeline={pipelineCards}
      />
    </AppPageShell>
  );
}
