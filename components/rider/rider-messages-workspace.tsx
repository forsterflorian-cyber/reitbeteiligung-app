import type { Route } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";

export type RiderDirectMessageCard = {
  conversationId: string;
  horseId: string;
  horseTitle: string;
  ownerName: string;
  hasUnread: boolean;
  isActiveRelationship: boolean;
  isDecisionPendingAfterCompletion: boolean;
  latestMessageAt: string;
  latestMessageText: string;
};

export type RiderGroupChatCard = {
  horseId: string;
  horseTitle: string;
  latestMessageAt: string | null;
  latestMessageText: string;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

type RiderMessagesWorkspaceProps = {
  directMessages: RiderDirectMessageCard[];
  groupChats: RiderGroupChatCard[];
  unreadCount: number;
};

export function RiderMessagesWorkspace({ directMessages, groupChats, unreadCount }: RiderMessagesWorkspaceProps) {
  return (
    <>
      <PageHeader
        actions={
          <>
            <Link className={buttonVariants("secondary", "w-full sm:w-auto")} href="/anfragen">
              Meine Reitbeteiligungen
            </Link>
            <Link className={buttonVariants("ghost", "w-full sm:w-auto")} href="/suchen">
              Pferde finden
            </Link>
          </>
        }
        backdropVariant="hero"
        eyebrow="Reiter"
        subtitle="Alle Unterhaltungen sind hier gebuendelt, getrennt von Statuslisten und Beziehungsklaerung."
        surface
        title="Nachrichten"
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">1:1-Chats</p>
          <p className="mt-2 text-2xl font-semibold text-stone-900">{directMessages.length}</p>
          <p className="mt-1 text-sm text-stone-600">Direkte Unterhaltungen zu Probeterminen und laufenden Beziehungen.</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Ungelesen</p>
          <p className="mt-2 text-2xl font-semibold text-stone-900">{unreadCount}</p>
          <p className="mt-1 text-sm text-stone-600">Diese Chats warten gerade auf deine Antwort.</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Gruppenchats</p>
          <p className="mt-2 text-2xl font-semibold text-stone-900">{groupChats.length}</p>
          <p className="mt-1 text-sm text-stone-600">Fuer aktive Reitbeteiligungen steht jeweils ein Pferde-Gruppenchat bereit.</p>
        </Card>
      </div>
      <SectionCard subtitle="Neue Nachrichten stehen oben. Aktive Beziehungen und noch offene Faelle sind klar markiert." title="1:1-Chats">
        {directMessages.length === 0 ? (
          <EmptyState
            description="Sobald ein sichtbarer Chat zu einem Probetermin oder einer aktiven Reitbeteiligung besteht, erscheint er hier."
            title="Noch keine Nachrichten"
          />
        ) : (
          <div className="space-y-3">
            {directMessages.map((item) => (
              <Card className="p-5" id={`chat-${item.conversationId}`} key={item.conversationId}>
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">
                        {item.isActiveRelationship ? "Aktive Reitbeteiligung" : item.isDecisionPendingAfterCompletion ? "Entscheidung offen" : "In Klaerung"}
                      </p>
                      <p className="font-semibold text-ink">{item.horseTitle}</p>
                      <p className="text-sm text-stone-600">Pferdehalter: {item.ownerName}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.hasUnread ? <Badge tone="info">Ungelesen</Badge> : <Badge tone="neutral">Gelesen</Badge>}
                      {item.isActiveRelationship ? (
                        <Badge tone="approved">Aktiv</Badge>
                      ) : item.isDecisionPendingAfterCompletion ? (
                        <Badge tone="info">Durchgefuehrt, Entscheidung offen</Badge>
                      ) : (
                        <Badge tone="pending">In Klaerung</Badge>
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
                    <p className="text-sm font-semibold text-stone-900">{formatDateTime(item.latestMessageAt)}</p>
                    <p className="mt-2 text-sm leading-6 text-stone-600">{item.latestMessageText}</p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                    <Link className={buttonVariants("primary", "w-full sm:w-auto")} href={`/chat/${item.conversationId}` as Route}>
                      Chat oeffnen
                    </Link>
                    <Link className={buttonVariants("ghost", "w-full sm:w-auto")} href={`/pferde/${item.horseId}` as Route}>
                      Pferdeprofil ansehen
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </SectionCard>
      <SectionCard subtitle="Der gemeinsame Pferde-Chat ist nur fuer aktive Reitbeteiligungen verfuegbar." title="Pferde-Gruppenchats">
        {groupChats.length === 0 ? (
          <EmptyState
            description="Sobald du fuer ein Pferd aktiv freigeschaltet bist, erscheint sein Gruppenchat hier."
            title="Noch kein Gruppenchat"
          />
        ) : (
          <div className="space-y-3">
            {groupChats.map((item) => (
              <Card className="p-5" id={`group-${item.horseId}`} key={item.horseId}>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">Pferde-Gruppenchat</p>
                    <p className="font-semibold text-ink">{item.horseTitle}</p>
                    <p className="text-sm text-stone-600">Gemeinsame Abstimmung mit Pferdehalter und aktiven Reitbeteiligungen.</p>
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
                    <p className="text-sm font-semibold text-stone-900">{item.latestMessageAt ? formatDateTime(item.latestMessageAt) : "Noch keine Nachricht"}</p>
                    <p className="mt-2 text-sm leading-6 text-stone-600">{item.latestMessageText}</p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                    <Link className={buttonVariants("primary", "w-full sm:w-auto")} href={`/pferde/${item.horseId}/gruppenchat` as Route}>
                      Gruppenchat oeffnen
                    </Link>
                    <Link className={buttonVariants("ghost", "w-full sm:w-auto")} href={`/pferde/${item.horseId}` as Route}>
                      Pferdeprofil ansehen
                    </Link>
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
