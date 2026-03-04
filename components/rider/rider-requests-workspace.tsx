import type { Route } from "next";
import Link from "next/link";

import { cancelTrialRequestAction } from "@/app/actions";
import { Notice } from "@/components/notice";
import { StatusBadge } from "@/components/status-badge";
import { canCancelTrialRequest } from "@/lib/trial-lifecycle";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import type { TrialRequest } from "@/types/database";

export type RiderTrialCard = {
  id: string;
  horseId: string;
  horseTitle: string;
  ownerName: string;
  requestedStartAt: string | null;
  requestedEndAt: string | null;
  messageText: string;
  status: TrialRequest["status"];
  hasUnread: boolean;
  conversationId: string | null;
};

export type RiderRelationshipCard = {
  horseId: string;
  horseTitle: string;
  ownerName: string;
  approvedAt: string;
  lastTrialStartAt: string | null;
  lastTrialEndAt: string | null;
  hasUnread: boolean;
  conversationId: string | null;
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

const inlineLinkClassName = buttonVariants(
  "ghost",
  "min-h-0 justify-start px-0 py-0 text-sm font-semibold text-forest hover:bg-transparent hover:text-clay"
);

type RiderRequestsWorkspaceProps = {
  error: string | null;
  message: string | null;
  conversationCount: number;
  activeRelationships: RiderRelationshipCard[];
  openTrials: RiderTrialCard[];
};

export function RiderRequestsWorkspace({
  activeRelationships,
  conversationCount,
  error,
  message,
  openTrials
}: RiderRequestsWorkspaceProps) {
  return (
    <>
      <PageHeader
        actions={
          <>
            <Link className={buttonVariants("primary", "w-full sm:w-auto")} href="/suchen">
              Pferde finden
            </Link>
            <a className={buttonVariants("secondary", "w-full sm:w-auto")} href="#meine-probetermine">
              Probetermine
            </a>
            <a className={buttonVariants("ghost", "w-full sm:w-auto")} href="#aktive-reitbeteiligungen">
              Meine Reitbeteiligungen
            </a>
          </>
        }
        backdropVariant="hero"
        eyebrow="Reiter"
        subtitle="Hier behältst du Probetermine, Freischaltungen und deine Chats im Blick. Weitere Termin- und Planungsfunktionen folgen später."
        surface
        title="Proben & Reitbeteiligungen"
      />
      <Notice text={error} tone="error" />
      <Notice text={message} tone="success" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Probetermine</p>
          <p className="mt-2 text-2xl font-semibold text-stone-900">{openTrials.length}</p>
          <p className="mt-1 text-sm text-stone-600">Alle Anfragen bis zur Aufnahme als Reitbeteiligung.</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Reitbeteiligungen</p>
          <p className="mt-2 text-2xl font-semibold text-stone-900">{activeRelationships.length}</p>
          <p className="mt-1 text-sm text-stone-600">Diese Pferde haben dich bereits als Reitbeteiligung aufgenommen.</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Chats</p>
          <p className="mt-2 text-2xl font-semibold text-stone-900">{conversationCount}</p>
          <p className="mt-1 text-sm text-stone-600">So viele Unterhaltungen laufen aktuell in der Plattform.</p>
        </Card>
      </div>
      <SectionCard
        id="aktive-reitbeteiligungen"
        subtitle="Nach der Aufnahme stehen die Beziehung zum Pferd sowie der direkte und gemeinsame Chat im Fokus."
        title="Meine Reitbeteiligungen"
      >
        {activeRelationships.length === 0 ? (
          <EmptyState
            description="Sobald dich ein Pferdehalter nach einem Probetermin aufnimmt, erscheint die Beziehung hier mit Chat und Status."
            title="Noch keine aktive Reitbeteiligung"
          />
        ) : (
          <div className="space-y-3">
            {activeRelationships.map((item) => (
              <Card className="p-5" key={item.horseId}>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">Aktive Reitbeteiligung</p>
                    <p className="font-semibold text-ink">{item.horseTitle}</p>
                    <p className="text-sm text-stone-600">Pferdehalter: {item.ownerName}</p>
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
                    text="Weitere Termin- und Planungsfunktionen folgen später. Aktuell stehen Beziehung, 1:1-Chat und Gruppenchat im Fokus."
                    tone="success"
                  />
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
                    <Link className={buttonVariants("ghost", "w-full justify-center")} href={`/pferde/${item.horseId}` as Route}>
                      Pferdeprofil ansehen
                    </Link>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                    {item.conversationId ? (
                      <Link className={inlineLinkClassName} href={`/chat/${item.conversationId}` as Route}>
                        Zum 1:1-Chat
                      </Link>
                    ) : null}
                    <Link className={inlineLinkClassName} href={`/pferde/${item.horseId}/gruppenchat` as Route}>
                      Zum Gruppenchat
                    </Link>
                    <Link className={inlineLinkClassName} href={`/pferde/${item.horseId}` as Route}>
                      Pferdeprofil ansehen
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </SectionCard>
      <SectionCard
        id="meine-probetermine"
        subtitle="Hier siehst du den Status deiner Probetermin-Anfragen bis zur Entscheidung über eine neue Reitbeteiligung."
        title="Meine Probetermine"
      >
        {openTrials.length === 0 ? (
          <EmptyState
            description="Sobald du einen Probetermin anfragst, erscheint er hier bis zur Annahme, Ablehnung oder Aufnahme."
            title="Noch keine Probetermin-Anfragen"
          />
        ) : (
          <div className="space-y-3">
            {openTrials.map((item) => (
              <Card className="p-5" key={item.id}>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">Probetermin</p>
                    <p className="font-semibold text-ink">{item.horseTitle}</p>
                    <p className="text-sm text-stone-600">Pferdehalter: {item.ownerName}</p>
                  </div>
                  {item.requestedStartAt && item.requestedEndAt ? (
                    <p className="text-sm font-semibold text-ink">{formatDateRange(item.requestedStartAt, item.requestedEndAt)}</p>
                  ) : null}
                  <p className="text-sm leading-6 text-stone-600">{item.messageText}</p>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={item.status} />
                    {item.hasUnread ? <Badge tone="info">Neue Nachricht</Badge> : null}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                    <Link className={inlineLinkClassName} href={`/pferde/${item.horseId}` as Route}>
                      Pferdeprofil ansehen
                    </Link>
                    {item.conversationId ? (
                      <Link className={inlineLinkClassName} href={`/chat/${item.conversationId}` as Route}>
                        Zum Chat
                      </Link>
                    ) : null}
                    {canCancelTrialRequest(item.status) ? (
                      <form action={cancelTrialRequestAction}>
                        <input name="requestId" type="hidden" value={item.id} />
                        <button
                          className={buttonVariants(
                            "ghost",
                            "min-h-0 justify-start px-0 py-0 text-sm font-semibold text-rose-700 hover:bg-transparent hover:text-rose-800"
                          )}
                          type="submit"
                        >
                          Anfrage zurückziehen
                        </button>
                      </form>
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

