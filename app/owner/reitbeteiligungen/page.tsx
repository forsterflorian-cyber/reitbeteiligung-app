import type { Route } from "next";
import Link from "next/link";

import { acceptBookingRequestAction, declineBookingRequestAction, deleteRiderRelationshipAction, saveRiderBookingLimitAction, updateApprovalAction } from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
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
import { formatWeeklyHoursLimit } from "@/lib/booking-limits";
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
    return "Zeitpunkt wird geprüft";
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
  const { activeRelationships, bookingItems, conversationInfo, latestMessages } = await loadOwnerWorkspaceData(supabase, user.id);

  const unreadCount = activeRelationships.reduce((count, item) => {
    const latestMessage = item.conversation ? (latestMessages.get(item.conversation.id) ?? null) : null;
    return hasUnreadOwnerMessage(item.conversation, latestMessage, user.id) ? count + 1 : count;
  }, 0);

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
        subtitle="Hier läuft das operative Tagesgeschäft: aktive Reitbeteiligungen, offene Zeitfenster und konkrete Terminbuchungen."
        surface
        title="Reitbeteiligungen"
      />
      <Notice text={error} tone="error" />
      <Notice text={message} tone="success" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Aktiv</p>
          <p className="mt-2 text-2xl font-semibold text-stone-900">{activeRelationships.length}</p>
          <p className="mt-1 text-sm text-stone-600">Freigeschaltete Reitbeteiligungen im laufenden Betrieb.</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Terminanfragen</p>
          <p className="mt-2 text-2xl font-semibold text-stone-900">{bookingItems.length}</p>
          <p className="mt-1 text-sm text-stone-600">Konkrete Buchungen innerhalb deiner offenen Zeitfenster.</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Ungelesen</p>
          <p className="mt-2 text-2xl font-semibold text-stone-900">{unreadCount}</p>
          <p className="mt-1 text-sm text-stone-600">Nachrichten, die du in laufenden Beziehungen noch nicht gelesen hast.</p>
        </Card>
      </div>
      <SectionCard id="aktive-reitbeteiligungen" subtitle="Aktive Reitbeteiligungen mit Wochenkontingent, Kalenderzugriff und Verwaltungsaktionen." title="Aktive Reitbeteiligungen">
        {activeRelationships.length === 0 ? (
          <EmptyState
            description="Sobald du nach einem Probetermin einen Reiter aufnimmst, erscheint die laufende Reitbeteiligung hier."
            title="Noch keine aktive Reitbeteiligung"
          />
        ) : (
          <div className="space-y-3">
            {activeRelationships.map((item) => {
              const { approval, conversation, horse, latestTrial, riderBookingLimit } = item;
              const contact = conversation ? (conversationInfo.get(conversation.id) ?? null) : null;
              const riderName = contact?.partner_name?.trim() || "Reiter";
              const latestMessage = conversation ? (latestMessages.get(conversation.id) ?? null) : null;
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
                      <p className="text-sm text-stone-600">{`Durchgeführter Probetermin: ${formatDateRange(latestTrial.requested_start_at, latestTrial.requested_end_at)}`}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="approved">Aktive Reitbeteiligung</Badge>
                      {hasUnread ? <Badge tone="info">Neue Nachricht</Badge> : null}
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <a className={buttonVariants("primary", "w-full")} href={`/pferde/${approval.horse_id}/kalender#kalender-bearbeiten`}>
                        Offene Zeiten verwalten
                      </a>
                      <a className={buttonVariants("secondary", "w-full")} href={`/pferde/${approval.horse_id}/kalender#offene-terminanfragen`}>
                        Terminanfragen prüfen
                      </a>
                    </div>
                    <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-stone-900">Wochenkontingent</p>
                          <p className="text-sm text-stone-600">Lege fest, wie viele Stunden diese Reitbeteiligung pro Woche selbstständig buchen darf.</p>
                        </div>
                        <form action={saveRiderBookingLimitAction} className="space-y-3">
                          <input name="horseId" type="hidden" value={approval.horse_id} />
                          <input name="riderId" type="hidden" value={approval.rider_id} />
                          <div>
                            <label htmlFor={`weeklyHoursLimit-active-${approval.horse_id}-${approval.rider_id}`}>Stunden pro Woche</label>
                            <input
                              defaultValue={riderBookingLimit?.weekly_hours_limit ?? ""}
                              id={`weeklyHoursLimit-active-${approval.horse_id}-${approval.rider_id}`}
                              max={40}
                              min={1}
                              name="weeklyHoursLimit"
                              placeholder="z. B. 4"
                              type="number"
                            />
                          </div>
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs text-stone-500">
                              {riderBookingLimit
                                ? `Aktuell: ${formatWeeklyHoursLimit(riderBookingLimit.weekly_hours_limit)}`
                                : "Aktuell ist kein festes Wochenkontingent hinterlegt."}
                            </p>
                            <Button className="w-full sm:w-auto" type="submit" variant="secondary">
                              Kontingent speichern
                            </Button>
                          </div>
                        </form>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {latestTrial ? (
                        <form action={updateApprovalAction}>
                          <input name="requestId" type="hidden" value={latestTrial.id} />
                          <input name="status" type="hidden" value="revoked" />
                          <Button className="w-full" type="submit" variant="secondary">
                            Freischaltung entziehen
                          </Button>
                        </form>
                      ) : null}
                      <form action={deleteRiderRelationshipAction}>
                        <input name="horseId" type="hidden" value={approval.horse_id} />
                        <input name="riderId" type="hidden" value={approval.rider_id} />
                        <ConfirmSubmitButton
                          confirmMessage={"Möchtest du diese Reitbeteiligung wirklich löschen? Das Wochenkontingent wird ebenfalls entfernt."}
                          idleLabel={"Reitbeteiligung löschen"}
                          pendingLabel={"Wird gelöscht..."}
                        />
                      </form>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                      <Link className={buttonVariants("ghost", "min-h-0 justify-start px-0 py-0 text-sm font-semibold text-forest hover:bg-transparent hover:text-clay")} href={`/pferde/${approval.horse_id}/kalender` as Route}>
                        Kalender öffnen
                      </Link>
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
      <SectionCard id="buchungsanfragen" subtitle="Konkrete Buchungen aus offenen Zeitfenstern deiner aktiven Reitbeteiligungen." title="Offene Terminanfragen">
        {bookingItems.length === 0 ? (
          <EmptyState
            description="Sobald freigeschaltete Reiter konkrete Termine anfragen, erscheinen sie hier gesammelt."
            title="Noch keine Terminanfragen"
          />
        ) : (
          <div className="space-y-3">
            {bookingItems.map((request) => {
              const pairKey = `${request.horse_id}:${request.rider_id}`;
              const relationship = activeRelationships.find((item) => `${item.approval.horse_id}:${item.approval.rider_id}` === pairKey) ?? null;
              const conversation = relationship?.conversation ?? null;
              const contact = conversation ? (conversationInfo.get(conversation.id) ?? null) : null;
              const riderName = contact?.partner_name?.trim() || "Reiter";
              const latestMessage = conversation ? (latestMessages.get(conversation.id) ?? null) : null;
              const hasUnread = hasUnreadOwnerMessage(conversation, latestMessage, user.id);
              const riderBookingLimit = relationship?.riderBookingLimit ?? null;

              return (
                <Card className="p-5" key={request.id}>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">Terminanfrage</p>
                      <p className="font-semibold text-ink">{request.horse?.title ?? "Pferdeprofil nicht gefunden"}</p>
                      <p className="text-sm text-stone-600">Reiter: {riderName}</p>
                    </div>
                    <p className="text-sm font-semibold text-ink">{formatDateRange(request.requested_start_at, request.requested_end_at)}</p>
                    {request.recurrence_rrule ? <p className="text-sm text-stone-600">Wiederholung: {request.recurrence_rrule}</p> : null}
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge status={request.status} />
                      {riderBookingLimit ? <Badge tone="neutral">{formatWeeklyHoursLimit(riderBookingLimit.weekly_hours_limit)}</Badge> : null}
                      {hasUnread ? <Badge tone="info">Neue Nachricht</Badge> : null}
                    </div>
                    {request.status === "requested" ? (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <form action={acceptBookingRequestAction}>
                          <input name="requestId" type="hidden" value={request.id} />
                          <Button className="w-full" type="submit" variant="primary">
                            Annehmen
                          </Button>
                        </form>
                        <form action={declineBookingRequestAction}>
                          <input name="requestId" type="hidden" value={request.id} />
                          <Button className="w-full border-rose-300 text-rose-700 hover:border-rose-400 hover:bg-rose-50 hover:text-rose-700" type="submit" variant="secondary">
                            Ablehnen
                          </Button>
                        </form>
                      </div>
                    ) : null}
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                      <Link className={buttonVariants("ghost", "min-h-0 justify-start px-0 py-0 text-sm font-semibold text-forest hover:bg-transparent hover:text-clay")} href={`/pferde/${request.horse_id}/kalender` as Route}>
                        Zum Kalender
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
