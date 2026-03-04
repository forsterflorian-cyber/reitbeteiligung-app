import type { Route } from "next";
import Link from "next/link";

import { deleteRiderRelationshipAction, updateApprovalAction } from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Notice } from "@/components/notice";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";

type OwnerRelationshipCard = {
  horseId: string;
  riderId: string;
  horseTitle: string;
  riderName: string;
  approvedAt: string;
  lastTrialStartAt: string | null;
  lastTrialEndAt: string | null;
  hasUnread: boolean;
  conversationId: string | null;
  latestTrialId: string | null;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatDateRange(startAt: string | null, endAt: string | null) {
  if (!startAt || !endAt) {
    return "Zeitpunkt wird noch geklärt.";
  }

  return `${formatDateTime(startAt)} bis ${formatDateTime(endAt)}`;
}

type OwnerRelationshipsWorkspaceProps = {
  error: string | null;
  message: string | null;
  activeCount: number;
  horseCount: number;
  unreadCount: number;
  relationships: OwnerRelationshipCard[];
};

export function OwnerRelationshipsWorkspace({
  activeCount,
  error,
  horseCount,
  message,
  relationships,
  unreadCount
}: OwnerRelationshipsWorkspaceProps) {
  return (
    <>
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
        subtitle="Hier verwaltest du bestehende Beziehungen, erreichst 1:1- und Gruppenchat und kannst Reitbeteiligungen sauber wieder entfernen."
        surface
        title="Reitbeteiligungen"
      />
      <Notice text={error} tone="error" />
      <Notice text={message} tone="success" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Aktiv</p>
          <p className="mt-2 text-2xl font-semibold text-stone-900">{activeCount}</p>
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
          <p className="mt-1 text-sm text-stone-600">Diese 1:1-Chats warten aktuell auf deine Antwort.</p>
        </Card>
      </div>
      <SectionCard
        id="aktive-reitbeteiligungen"
        subtitle="Hier verwaltest du bestehende Beziehungen, erreichst den Pferde-Chat und kannst die Freischaltung wieder entziehen oder die Beziehung ganz entfernen."
        title="Aktive Reitbeteiligungen"
      >
        {relationships.length === 0 ? (
          <EmptyState
            description="Sobald du nach einem Probetermin einen Reiter aufnimmst, erscheint die Beziehung hier mit Chat und Verwaltungsaktionen."
            title="Noch keine aktive Reitbeteiligung"
          />
        ) : (
          <div className="space-y-3">
            {relationships.map((item) => (
              <Card className="p-5" key={`${item.horseId}:${item.riderId}`}>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">Aktive Reitbeteiligung</p>
                    <p className="font-semibold text-ink">{item.horseTitle}</p>
                    <p className="text-sm text-stone-600">Reiter: {item.riderName}</p>
                  </div>
                  <p className="text-sm font-semibold text-ink">{`Freigeschaltet seit ${formatDateTime(item.approvedAt)}`}</p>
                  {item.lastTrialStartAt && item.lastTrialEndAt ? (
                    <p className="text-sm text-stone-600">{`Letzter Probetermin: ${formatDateRange(item.lastTrialStartAt, item.lastTrialEndAt)}`}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="approved">Aktive Reitbeteiligung</Badge>
                    {item.hasUnread ? <Badge tone="info">Neue Nachricht</Badge> : null}
                  </div>
                  <Notice
                    text="Weitere Verwaltungs- und Terminfunktionen folgen später. Aktuell stehen Pferde-Chat und eine saubere Beziehungsverwaltung im Fokus."
                    tone="success"
                  />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {item.conversationId ? (
                      <Link className={buttonVariants("primary", "w-full justify-center")} href={`/chat/${item.conversationId}` as Route}>
                        1:1-Chat öffnen
                      </Link>
                    ) : (
                      <Link className={buttonVariants("primary", "w-full justify-center")} href={`/pferde/${item.horseId}` as Route}>
                        Pferdeprofil öffnen
                      </Link>
                    )}
                    <Link className={buttonVariants("secondary", "w-full justify-center")} href={`/pferde/${item.horseId}/gruppenchat` as Route}>
                      Gruppenchat öffnen
                    </Link>
                    {item.latestTrialId ? (
                      <form action={updateApprovalAction}>
                        <input name="requestId" type="hidden" value={item.latestTrialId} />
                        <input name="status" type="hidden" value="revoked" />
                        <input name="redirectTo" type="hidden" value="/owner/reitbeteiligungen" />
                        <input name="approvalContext" type="hidden" value="relationship" />
                        <Button className="w-full" type="submit" variant="secondary">
                          Freischaltung entziehen
                        </Button>
                      </form>
                    ) : null}
                  </div>
                  <form action={deleteRiderRelationshipAction}>
                    <input name="horseId" type="hidden" value={item.horseId} />
                    <input name="riderId" type="hidden" value={item.riderId} />
                    <input name="redirectTo" type="hidden" value="/owner/reitbeteiligungen" />
                    <ConfirmSubmitButton
                      confirmMessage="Möchtest du diese Reitbeteiligung wirklich löschen? Die Beziehung wird vollständig entfernt."
                      idleLabel="Reitbeteiligung löschen"
                      pendingLabel="Wird gelöscht..."
                    />
                  </form>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                    <Link className={buttonVariants("ghost", "min-h-0 justify-start px-0 py-0 text-sm font-semibold text-forest hover:bg-transparent hover:text-clay")} href={`/pferde/${item.horseId}` as Route}>
                      Pferdeprofil ansehen
                    </Link>
                    <Link className={buttonVariants("ghost", "min-h-0 justify-start px-0 py-0 text-sm font-semibold text-forest hover:bg-transparent hover:text-clay")} href={`/owner/reiter/${item.riderId}` as Route}>
                      Reiterprofil ansehen
                    </Link>
                    <Link className={buttonVariants("ghost", "min-h-0 justify-start px-0 py-0 text-sm font-semibold text-forest hover:bg-transparent hover:text-clay")} href={`/pferde/${item.horseId}/gruppenchat` as Route}>
                      Zum Gruppenchat
                    </Link>
                    {item.conversationId ? (
                      <Link className={buttonVariants("ghost", "min-h-0 justify-start px-0 py-0 text-sm font-semibold text-forest hover:bg-transparent hover:text-clay")} href={`/chat/${item.conversationId}` as Route}>
                        Zum 1:1-Chat
                      </Link>
                    ) : null}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </SectionCard>
    </>
  );
}
