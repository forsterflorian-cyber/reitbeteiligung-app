import type { Route } from "next";
import Link from "next/link";

import { updateApprovalAction, updateTrialRequestStatusAction } from "@/app/actions";
import { Notice } from "@/components/notice";
import { AppPageShell } from "@/components/ui/app-page-shell";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/status-badge";
import { requireProfile } from "@/lib/auth";
import { hasUnreadOwnerMessage, loadOwnerWorkspaceData } from "@/lib/owner-workspace";
import { readSearchParam } from "@/lib/search-params";
import type { AvailabilityRule } from "@/types/database";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatDateRange(startAt: string | null | undefined, endAt: string | null | undefined) {
  if (!startAt || !endAt) {
    return "Zeitpunkt wird noch geprüft.";
  }

  return `${formatDateTime(startAt)} bis ${formatDateTime(endAt)}`;
}

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

  const requestedCount = trialPipelineItems.filter((item) => item.status === "requested").length;
  const acceptedCount = trialPipelineItems.filter((item) => item.status === "accepted").length;
  const completedCount = trialPipelineItems.filter((item) => item.status === "completed").length;

  return (
    <AppPageShell>
      <PageHeader
        actions={
          <>
            <Link className={buttonVariants("secondary", "w-full sm:w-auto")} href="/owner/pferde-verwalten">
              Pferde verwalten
            </Link>
            <Link className={buttonVariants("ghost", "w-full sm:w-auto")} href="/owner/reitbeteiligungen">
              Reitbeteiligungen
            </Link>
            <Link className={buttonVariants("ghost", "w-full sm:w-auto")} href="/owner/nachrichten">
              Nachrichten
            </Link>
          </>
        }
        backdropVariant="hero"
        eyebrow="Pferdehalter"
        subtitle="Hier pflegst du zuerst die eingestellten Probetermine und bearbeitest danach eingehende Anfragen bis zur Aufnahme."
        surface
        title="Probetermine"
      />
      <Notice text={error} tone="error" />
      <Notice text={message} tone="success" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Eingestellt</p>
          <p className="mt-2 text-2xl font-semibold text-stone-900">{trialSlots.length}</p>
          <p className="mt-1 text-sm text-stone-600">So viele kommende Probetermine sind aktuell aktiv.</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Neue Anfragen</p>
          <p className="mt-2 text-2xl font-semibold text-stone-900">{requestedCount}</p>
          <p className="mt-1 text-sm text-stone-600">Diese Reiter warten auf deine erste Rückmeldung.</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Nächster Schritt</p>
          <p className="mt-2 text-2xl font-semibold text-stone-900">{acceptedCount + completedCount}</p>
          <p className="mt-1 text-sm text-stone-600">Angenommene oder durchgeführte Probetermine brauchen deine Folgeentscheidung.</p>
        </Card>
      </div>
      <SectionCard subtitle="Bestehende Probetermine zuerst prüfen. Neue oder geänderte Slots pflegst du direkt im Pferdeprofil." title="Eingestellte Probetermine">
        {horses.length === 0 ? (
          <EmptyState
            action={
              <Link className={buttonVariants("primary")} href="/owner/horses">
                Neues Pferd anlegen
              </Link>
            }
            description="Lege zuerst ein Pferdeprofil an. Danach kannst du dort konkrete Probetermine pflegen."
            title="Noch kein Pferd vorhanden"
          />
        ) : (
          <div className="space-y-3">
            {horses.map((horse) => {
              const slots = trialSlotsByHorse.get(horse.id) ?? [];
              const nextSlot = slots[0] ?? null;

              return (
                <Card className="p-5" key={horse.id}>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">Pferdeprofil</p>
                      <p className="font-semibold text-ink">{horse.title}</p>
                      <p className="text-sm text-stone-600">{slots.length > 0 ? `${slots.length} kommender Probetermin${slots.length === 1 ? "" : "e"}` : "Noch kein Probetermin eingestellt"}</p>
                    </div>
                    {nextSlot ? <p className="text-sm font-semibold text-ink">Nächster Slot: {formatDateRange(nextSlot.start_at, nextSlot.end_at)}</p> : null}
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Link className={buttonVariants("primary", "w-full justify-center")} href={`/pferde/${horse.id}` as Route}>
                        Pferdeprofil öffnen
                      </Link>
                      <Link className={buttonVariants("secondary", "w-full justify-center")} href={`/pferde/${horse.id}/kalender#kalender-liste` as Route}>
                        Probetermine pflegen
                      </Link>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </SectionCard>
      <SectionCard subtitle="Von der ersten Anfrage bis zur Aufnahme als Reitbeteiligung." title="Eingehende Probeanfragen">
        {trialPipelineItems.length === 0 ? (
          <EmptyState
            description="Sobald Reiter einen Probetermin anfragen, erscheint er hier gesammelt mit allen nächsten Schritten."
            title="Noch keine Probetermine"
          />
        ) : (
          <div className="space-y-3">
            {trialPipelineItems.map((request) => {
              const approval = approvalMap.get(`${request.horse_id}:${request.rider_id}`) ?? null;
              const conversation = conversationMap.get(`${request.horse_id}:${request.rider_id}`) ?? null;
              const contact = conversation ? (conversationInfo.get(conversation.id) ?? null) : null;
              const riderName = contact?.partner_name?.trim() || "Reiter";
              const latestMessage = conversation ? (latestMessages.get(conversation.id) ?? null) : null;
              const hasUnread = hasUnreadOwnerMessage(conversation, latestMessage, user.id);

              return (
                <Card className="p-5" key={request.id}>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">Probetermin</p>
                      <p className="font-semibold text-ink">{request.horse?.title ?? "Pferdeprofil nicht gefunden"}</p>
                      <p className="text-sm text-stone-600">Reiter: {riderName}</p>
                    </div>
                    <p className="text-sm font-semibold text-ink">{formatDateRange(request.requested_start_at, request.requested_end_at)}</p>
                    <p className="text-sm leading-6 text-stone-600">{request.message?.trim() || "Keine Nachricht hinterlegt."}</p>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge status={request.status} />
                      {approval ? <StatusBadge status={approval.status} /> : null}
                      {hasUnread ? <Badge tone="info">Neue Nachricht</Badge> : null}
                    </div>
                    {request.status === "requested" ? (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <form action={updateTrialRequestStatusAction}>
                          <input name="requestId" type="hidden" value={request.id} />
                          <input name="status" type="hidden" value="accepted" />
                          <Button className="w-full" type="submit" variant="primary">
                            Annehmen
                          </Button>
                        </form>
                        <form action={updateTrialRequestStatusAction}>
                          <input name="requestId" type="hidden" value={request.id} />
                          <input name="status" type="hidden" value="declined" />
                          <Button className="w-full border-rose-300 text-rose-700 hover:border-rose-400 hover:bg-rose-50 hover:text-rose-700" type="submit" variant="secondary">
                            Ablehnen
                          </Button>
                        </form>
                      </div>
                    ) : null}
                    {request.status === "accepted" ? (
                      <form action={updateTrialRequestStatusAction}>
                        <input name="requestId" type="hidden" value={request.id} />
                        <input name="status" type="hidden" value="completed" />
                        <Button className="w-full" type="submit" variant="primary">
                          Als durchgeführt markieren
                        </Button>
                      </form>
                    ) : null}
                    {request.status === "completed" ? (
                      <form action={updateApprovalAction}>
                        <input name="requestId" type="hidden" value={request.id} />
                        <input name="status" type="hidden" value="approved" />
                        <Button className="w-full" type="submit" variant="primary">
                          Als Reitbeteiligung aufnehmen
                        </Button>
                      </form>
                    ) : null}
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                      <Link className={buttonVariants("ghost", "min-h-0 justify-start px-0 py-0 text-sm font-semibold text-forest hover:bg-transparent hover:text-clay")} href={`/pferde/${request.horse_id}` as Route}>
                        Pferdeprofil ansehen
                      </Link>
                      <Link className={buttonVariants("ghost", "min-h-0 justify-start px-0 py-0 text-sm font-semibold text-forest hover:bg-transparent hover:text-clay")} href={`/owner/reiter/${request.rider_id}` as Route}>
                        Reiterprofil ansehen
                      </Link>
                      {conversation ? (
                        <Link className={buttonVariants("ghost", "min-h-0 justify-start px-0 py-0 text-sm font-semibold text-forest hover:bg-transparent hover:text-clay")} href={`/chat/${conversation.id}` as Route}>
                          Zum Chat
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </SectionCard>
    </AppPageShell>
  );
}
