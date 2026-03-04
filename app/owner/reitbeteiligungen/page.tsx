import type { Route } from "next";
import Link from "next/link";

import { deleteRiderRelationshipAction, updateApprovalAction } from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Notice } from "@/components/notice";
import { AppPageShell } from "@/components/ui/app-page-shell";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { requireProfile } from "@/lib/auth";
import { hasUnreadOwnerMessage, loadOwnerWorkspaceData } from "@/lib/owner-workspace";
import { readSearchParam } from "@/lib/search-params";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatDateRange(startAt: string | null | undefined, endAt: string | null | undefined) {
  if (!startAt || !endAt) {
    return "Zeitpunkt wird noch geklärt.";
  }

  return `${formatDateTime(startAt)} bis ${formatDateTime(endAt)}`;
}

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
  const horseCount = new Set(activeRelationships.map((item) => item.approval.horse_id)).size;

  return (
    <AppPageShell>
      <PageHeader
        actions={
          <>
            <Link className={buttonVariants("secondary", "w-full sm:w-auto")} href="/owner/pferde-verwalten">
              Pferde verwalten
            </Link>
            <Link className={buttonVariants("ghost", "w-full sm:w-auto")} href="/owner/anfragen">
              Probetermine
            </Link>
            <Link className={buttonVariants("ghost", "w-full sm:w-auto")} href="/owner/nachrichten">
              Nachrichten
            </Link>
          </>
        }
        backdropVariant="hero"
        eyebrow="Pferdehalter"
        subtitle="Hier steht in R1 nur der Kern im Fokus: bestehende Reitbeteiligungen, der Pferde-Chat und das saubere Entfernen einer Beziehung."
        surface
        title="Reitbeteiligungen"
      />
      <Notice text={error} tone="error" />
      <Notice text={message} tone="success" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Aktiv</p>
          <p className="mt-2 text-2xl font-semibold text-stone-900">{activeRelationships.length}</p>
          <p className="mt-1 text-sm text-stone-600">Diese Reitbeteiligungen sind aktuell freigeschaltet.</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Pferde</p>
          <p className="mt-2 text-2xl font-semibold text-stone-900">{horseCount}</p>
          <p className="mt-1 text-sm text-stone-600">So viele Pferde haben bereits mindestens eine aktive Reitbeteiligung.</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Ungelesen</p>
          <p className="mt-2 text-2xl font-semibold text-stone-900">{unreadCount}</p>
          <p className="mt-1 text-sm text-stone-600">Diese Pferde-Chats warten aktuell auf deine Antwort.</p>
        </Card>
      </div>
      <SectionCard
        id="aktive-reitbeteiligungen"
        subtitle="In R1 verwaltest du hier bestehende Beziehungen, erreichst den Pferde-Chat und kannst die Freischaltung wieder entziehen."
        title="Aktive Reitbeteiligungen"
      >
        {activeRelationships.length === 0 ? (
          <EmptyState
            description="Sobald du nach einem Probetermin einen Reiter aufnimmst, erscheint die Beziehung hier mit Chat und Verwaltungsaktionen."
            title="Noch keine aktive Reitbeteiligung"
          />
        ) : (
          <div className="space-y-3">
            {activeRelationships.map((item) => {
              const { approval, conversation, horse, latestTrial } = item;
              const contact = conversation ? conversationInfo.get(conversation.id) ?? null : null;
              const riderName = contact?.partner_name?.trim() || "Reiter";
              const latestMessage = conversation ? latestMessages.get(conversation.id) ?? null : null;
              const hasUnread = hasUnreadOwnerMessage(conversation, latestMessage, user.id);

              return (
                <Card className="p-5" key={`${approval.horse_id}:${approval.rider_id}`}>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">Aktive Reitbeteiligung</p>
                      <p className="font-semibold text-ink">{horse?.title ?? "Pferdeprofil nicht gefunden"}</p>
                      <p className="text-sm text-stone-600">Reiter: {riderName}</p>
                    </div>
                    <p className="text-sm font-semibold text-ink">{`Freigeschaltet seit ${formatDateTime(approval.created_at)}`}</p>
                    {latestTrial?.requested_start_at && latestTrial?.requested_end_at ? (
                      <p className="text-sm text-stone-600">{`Letzter Probetermin: ${formatDateRange(latestTrial.requested_start_at, latestTrial.requested_end_at)}`}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="approved">Aktive Reitbeteiligung</Badge>
                      {hasUnread ? <Badge tone="info">Neue Nachricht</Badge> : null}
                    </div>
                    <Notice text="Das laufende Pferde-Management folgt nach R1. Jetzt stehen Pferde-Chat und saubere Beziehungsverwaltung im Fokus." tone="success" />
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {conversation ? (
                        <Link className={buttonVariants("primary", "w-full justify-center")} href={`/chat/${conversation.id}` as Route}>
                          Pferde-Chat ?ffnen
                        </Link>
                      ) : (
                        <Link className={buttonVariants("primary", "w-full justify-center")} href={`/pferde/${approval.horse_id}` as Route}>
                          Pferdeprofil ?ffnen
                        </Link>
                      )}
                      {latestTrial ? (
                        <form action={updateApprovalAction}>
                          <input name="requestId" type="hidden" value={latestTrial.id} />
                          <input name="status" type="hidden" value="revoked" />
                          <Button className="w-full" type="submit" variant="secondary">
                            Freischaltung entziehen
                          </Button>
                        </form>
                      ) : (
                        <div />
                      )}
                    </div>
                    <form action={deleteRiderRelationshipAction}>
                      <input name="horseId" type="hidden" value={approval.horse_id} />
                      <input name="riderId" type="hidden" value={approval.rider_id} />
                      <ConfirmSubmitButton
                        confirmMessage={"M?chtest du diese Reitbeteiligung wirklich l?schen? Die Beziehung wird vollst?ndig entfernt."}
                        idleLabel={"Reitbeteiligung l?schen"}
                        pendingLabel={"Wird gel?scht..."}
                      />
                    </form>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                      <Link className={buttonVariants("ghost", "min-h-0 justify-start px-0 py-0 text-sm font-semibold text-forest hover:bg-transparent hover:text-clay")} href={`/pferde/${approval.horse_id}` as Route}>
                        Pferdeprofil ansehen
                      </Link>
                      <Link className={buttonVariants("ghost", "min-h-0 justify-start px-0 py-0 text-sm font-semibold text-forest hover:bg-transparent hover:text-clay")} href={`/owner/reiter/${approval.rider_id}` as Route}>
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
