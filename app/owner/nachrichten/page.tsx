import type { Route } from "next";
import Link from "next/link";

import { AppPageShell } from "@/components/ui/app-page-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { requireProfile } from "@/lib/auth";
import { loadLatestHorseGroupMessages } from "@/lib/message-summaries";
import { hasUnreadOwnerMessage, loadOwnerWorkspaceData } from "@/lib/owner-workspace";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export default async function OwnerMessagesPage() {
  const { supabase, user } = await requireProfile("owner");
  const { activeRelationships, conversationInfo, conversations, horseMap, latestMessages } = await loadOwnerWorkspaceData(supabase, user.id);

  const activeRelationshipKeys = new Set(activeRelationships.map((item) => `${item.approval.horse_id}:${item.approval.rider_id}`));
  const items = conversations
    .map((conversation) => {
      const latestMessage = latestMessages.get(conversation.id) ?? null;
      const contact = conversationInfo.get(conversation.id) ?? null;
      const riderName = contact?.partner_name?.trim() || "Reiter";
      const horse = horseMap.get(conversation.horse_id) ?? null;
      const hasUnread = hasUnreadOwnerMessage(conversation, latestMessage, user.id);
      const isActiveRelationship = activeRelationshipKeys.has(`${conversation.horse_id}:${conversation.rider_id}`);
      const sortValue = latestMessage ? Date.parse(latestMessage.created_at) : Date.parse(conversation.created_at);

      return {
        conversation,
        hasUnread,
        horse,
        isActiveRelationship,
        latestMessage,
        riderName,
        sortValue
      };
    })
    .sort((left, right) => right.sortValue - left.sortValue);

  const unreadCount = items.filter((item) => item.hasUnread).length;
  const groupHorseIds = [...new Set(activeRelationships.map((item) => item.approval.horse_id))];
  const activeRelationshipCountByHorse = activeRelationships.reduce((counts, item) => {
    counts.set(item.approval.horse_id, (counts.get(item.approval.horse_id) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
  const latestGroupMessageByHorse = await loadLatestHorseGroupMessages(supabase, groupHorseIds);

  return (
    <AppPageShell>
      <PageHeader
        actions={
          <>
            <Link className={buttonVariants("secondary", "w-full sm:w-auto")} href="/owner/anfragen">
              Probetermine
            </Link>
            <Link className={buttonVariants("ghost", "w-full sm:w-auto")} href="/owner/reitbeteiligungen">
              Reitbeteiligungen
            </Link>
          </>
        }
        backdropVariant="hero"
        eyebrow="Pferdehalter"
        subtitle="Alle 1:1-Chats aus Probeterminen plus die neuen Pferde-Gruppenchats an einem Ort."
        surface
        title="Nachrichten"
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">1:1-Chats</p>
          <p className="mt-2 text-2xl font-semibold text-stone-900">{items.length}</p>
          <p className="mt-1 text-sm text-stone-600">Alle aktiven Unterhaltungen mit Reitern.</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Ungelesen</p>
          <p className="mt-2 text-2xl font-semibold text-stone-900">{unreadCount}</p>
          <p className="mt-1 text-sm text-stone-600">Diese 1:1-Chats warten gerade auf deine Antwort.</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Pferde-Gruppenchats</p>
          <p className="mt-2 text-2xl font-semibold text-stone-900">{groupHorseIds.length}</p>
          <p className="mt-1 text-sm text-stone-600">Je aktives Pferd steht ein gemeinsamer Chat bereit.</p>
        </Card>
      </div>
      <SectionCard subtitle="Aktive Pferde mit freigeschalteten Reitbeteiligungen erhalten einen gemeinsamen Gruppenchat." title="Pferde-Gruppenchats">
        {groupHorseIds.length === 0 ? (
          <EmptyState description="Sobald ein Pferd mindestens eine aktive Reitbeteiligung hat, erscheint sein Gruppenchat hier." title="Noch kein Pferde-Gruppenchat" />
        ) : (
          <div className="space-y-3">
            {groupHorseIds.map((horseId) => {
              const horse = horseMap.get(horseId) ?? null;
              const latestGroupMessage = latestGroupMessageByHorse.get(horseId) ?? null;
              const activeCount = activeRelationshipCountByHorse.get(horseId) ?? 0;

              return (
                <Card className="p-5" key={horseId}>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">Pferde-Gruppenchat</p>
                      <p className="font-semibold text-ink">{horse?.title ?? "Pferdeprofil nicht gefunden"}</p>
                      <p className="text-sm text-stone-600">{activeCount} aktive Reitbeteiligung{activeCount === 1 ? "" : "en"}</p>
                    </div>
                    <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
                      <p className="text-sm font-semibold text-stone-900">{latestGroupMessage ? formatDateTime(latestGroupMessage.created_at) : "Noch keine Nachricht"}</p>
                      <p className="mt-2 text-sm leading-6 text-stone-600">{latestGroupMessage?.content?.trim() || "Sobald jemand im Pferde-Gruppenchat schreibt, erscheint die letzte Nachricht hier."}</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                      <Link className={buttonVariants("primary", "w-full sm:w-auto")} href={`/pferde/${horseId}/gruppenchat` as Route}>
                        Gruppenchat \u00f6ffnen
                      </Link>
                      <Link className={buttonVariants("ghost", "w-full sm:w-auto")} href={`/pferde/${horseId}` as Route}>
                        Pferdeprofil ansehen
                      </Link>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </SectionCard>
      <SectionCard subtitle="Neue Nachrichten stehen oben. Ungelesene Chats sind klar markiert." title="1:1-Chats zum Probetermin">
        {items.length === 0 ? (
          <EmptyState description="Sobald ein Probetermin einen Chat \u00f6ffnet, erscheint die Unterhaltung hier." title="Noch keine Nachrichten" />
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <Card className="p-5" key={item.conversation.id}>
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">{item.isActiveRelationship ? "Aktive Reitbeteiligung" : "Probetermin-Chat"}</p>
                      <p className="font-semibold text-ink">{item.horse?.title ?? "Pferdeprofil nicht gefunden"}</p>
                      <p className="text-sm text-stone-600">Reiter: {item.riderName}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.hasUnread ? <Badge tone="info">Ungelesen</Badge> : <Badge tone="neutral">Gelesen</Badge>}
                      {item.isActiveRelationship ? <Badge tone="approved">Aktiv</Badge> : <Badge tone="pending">Probe</Badge>}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
                    <p className="text-sm font-semibold text-stone-900">{item.latestMessage ? formatDateTime(item.latestMessage.created_at) : formatDateTime(item.conversation.created_at)}</p>
                    <p className="mt-2 text-sm leading-6 text-stone-600">{item.latestMessage?.content?.trim() || "Noch keine Nachricht hinterlegt."}</p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                    <Link className={buttonVariants("primary", "w-full sm:w-auto")} href={`/chat/${item.conversation.id}` as Route}>
                      Chat \u00f6ffnen
                    </Link>
                    <Link className={buttonVariants("ghost", "w-full sm:w-auto")} href={`/owner/reiter/${item.conversation.rider_id}` as Route}>
                      Reiterprofil ansehen
                    </Link>
                    <Link className={buttonVariants("ghost", "w-full sm:w-auto")} href={`/pferde/${item.conversation.horse_id}` as Route}>
                      Pferdeprofil ansehen
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </SectionCard>
    </AppPageShell>
  );
}
