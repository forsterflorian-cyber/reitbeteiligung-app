import type { Route } from "next";
import Link from "next/link";

import { cancelTrialRequestAction } from "@/app/actions";
import { Notice } from "@/components/notice";
import { AppPageShell } from "@/components/ui/app-page-shell";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { buttonVariants } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth";
import { readSearchParam } from "@/lib/search-params";
import type { Approval, Conversation, Horse, Message, TrialRequest } from "@/types/database";

type TrialRequestListItem = TrialRequest & {
  horse?: Horse | null;
};

type ActiveRelationshipItem = {
  approval: Approval;
  conversation: Conversation | null;
  horse: Horse | null;
  latestTrial: TrialRequestListItem | null;
};

type ContactInfoRecord = {
  partner_name: string | null;
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

function hasUnreadMessage(conversation: Conversation | null, latestMessage: Message | null, currentUserId: string) {
  if (!conversation || !latestMessage || latestMessage.sender_id === currentUserId) {
    return false;
  }

  const lastReadAt = conversation.rider_last_read_at ?? conversation.created_at;
  return Date.parse(latestMessage.created_at) > Date.parse(lastReadAt);
}

const inlineLinkClassName = buttonVariants(
  "ghost",
  "min-h-0 justify-start px-0 py-0 text-sm font-semibold text-forest hover:bg-transparent hover:text-clay"
);

export default async function AnfragenPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { supabase, user } = await requireProfile("rider");
  const error = readSearchParam(searchParams, "error");
  const message = readSearchParam(searchParams, "message");

  const [{ data: trialData }, { data: approvalsData }] = await Promise.all([
    supabase
      .from("trial_requests")
      .select("id, horse_id, rider_id, status, message, availability_rule_id, requested_start_at, requested_end_at, created_at")
      .eq("rider_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("approvals").select("horse_id, rider_id, status, created_at").eq("rider_id", user.id).eq("status", "approved")
  ]);

  const requests = (trialData as TrialRequest[] | null) ?? [];
  const approvalsArray = (approvalsData as Approval[] | null) ?? [];
  const approvalKeys = new Set(approvalsArray.map((approval) => `${approval.horse_id}:${approval.rider_id}`));
  const horseIds = [...new Set([...requests.map((request) => request.horse_id), ...approvalsArray.map((approval) => approval.horse_id)])];

  const [{ data: horseData }, { data: conversationsData }] = await Promise.all([
    horseIds.length > 0
      ? supabase.from("horses").select("id, owner_id, title, plz, description, active, created_at").in("id", horseIds)
      : Promise.resolve({ data: [] as Horse[] | null }),
    horseIds.length > 0
      ? supabase
          .from("conversations")
          .select("id, horse_id, rider_id, owner_id, owner_last_read_at, rider_last_read_at, created_at")
          .eq("rider_id", user.id)
          .in("horse_id", horseIds)
      : Promise.resolve({ data: [] as Conversation[] | null })
  ]);

  const horses = new Map((((horseData as Horse[] | null) ?? [])).map((horse) => [horse.id, horse]));
  const conversationsArray = (conversationsData as Conversation[] | null) ?? [];
  const conversationIds = conversationsArray.map((conversation) => conversation.id);

  const [{ data: latestMessagesData }, contactInfoEntries] = await Promise.all([
    conversationIds.length > 0
      ? supabase
          .from("messages")
          .select("id, conversation_id, sender_id, content, created_at")
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Message[] | null }),
    Promise.all(
      conversationsArray.map(async (conversation) => {
        const { data } = await supabase.rpc("get_conversation_contact_info", {
          p_conversation_id: conversation.id
        });
        const rows = Array.isArray(data) ? data : data ? [data] : [];
        return [conversation.id, ((rows[0] as ContactInfoRecord | undefined) ?? null)] as const;
      })
    )
  ]);

  const conversations = new Map(conversationsArray.map((conversation) => [`${conversation.horse_id}:${conversation.rider_id}`, conversation]));
  const conversationInfo = new Map(contactInfoEntries);
  const latestMessages = new Map<string, Message>();

  (((latestMessagesData as Message[] | null) ?? [])).forEach((latestMessage) => {
    if (!latestMessages.has(latestMessage.conversation_id)) {
      latestMessages.set(latestMessage.conversation_id, latestMessage);
    }
  });

  const items: TrialRequestListItem[] = requests.map((request) => ({
    ...request,
    horse: horses.get(request.horse_id) ?? null
  }));
  const latestTrialByHorseId = new Map<string, TrialRequestListItem>();

  items.forEach((item) => {
    if (!latestTrialByHorseId.has(item.horse_id)) {
      latestTrialByHorseId.set(item.horse_id, item);
    }
  });

  const activeRelationships: ActiveRelationshipItem[] = approvalsArray
    .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
    .map((approval) => {
      const key = `${approval.horse_id}:${approval.rider_id}`;

      return {
        approval,
        conversation: conversations.get(key) ?? null,
        horse: horses.get(approval.horse_id) ?? null,
        latestTrial: latestTrialByHorseId.get(approval.horse_id) ?? null
      };
    });

  const openTrialItems = items.filter((item) => !approvalKeys.has(`${item.horse_id}:${item.rider_id}`));
  const conversationCount = conversationsArray.length;

  return (
    <AppPageShell>
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
        subtitle="In R1 stehen Probetermine, Freischaltungen und deine Chats im Fokus. Das laufende Pferde-Management folgt später."
        surface
        title="Proben & Reitbeteiligungen"
      />
      <Notice text={error} tone="error" />
      <Notice text={message} tone="success" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Probetermine</p>
          <p className="mt-2 text-2xl font-semibold text-stone-900">{openTrialItems.length}</p>
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
        subtitle="Nach der Aufnahme stehen die Beziehung zum Pferd, der direkte Chat und der Gruppenchat im Fokus."
        title="Meine Reitbeteiligungen"
      >
        {activeRelationships.length === 0 ? (
          <EmptyState
            description="Sobald dich ein Pferdehalter nach einem Probetermin aufnimmt, erscheint die Beziehung hier mit Chat und Status."
            title="Noch keine aktive Reitbeteiligung"
          />
        ) : (
          <div className="space-y-3">
            {activeRelationships.map((item) => {
              const { approval, conversation, horse, latestTrial } = item;
              const contact = conversation ? conversationInfo.get(conversation.id) ?? null : null;
              const hasUnread = hasUnreadMessage(conversation, conversation ? latestMessages.get(conversation.id) ?? null : null, user.id);
              const ownerName = contact?.partner_name?.trim() || "Pferdehalter";

              return (
                <Card className="p-5" key={`${approval.horse_id}:${approval.rider_id}`}>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">Aktive Reitbeteiligung</p>
                      <p className="font-semibold text-ink">{horse?.title ?? "Pferdeprofil nicht gefunden"}</p>
                      <p className="text-sm text-stone-600">Pferdehalter: {ownerName}</p>
                    </div>
                    <p className="text-sm font-semibold text-ink">{`Freigeschaltet seit ${formatDateTime(approval.created_at)}`}</p>
                    {latestTrial?.requested_start_at && latestTrial?.requested_end_at ? (
                      <p className="text-sm text-stone-600">{`Letzter Probetermin: ${formatDateRange(latestTrial.requested_start_at, latestTrial.requested_end_at)}`}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="approved">Aktive Reitbeteiligung</Badge>
                      {hasUnread ? <Badge tone="info">Neue Nachricht</Badge> : null}
                    </div>
                    <Notice text="Das laufende Pferde-Management folgt später. Jetzt stehen Beziehung, 1:1-Chat und Gruppenchat im Fokus." tone="success" />
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {conversation ? (
                        <Link className={buttonVariants("primary", "w-full justify-center")} href={`/chat/${conversation.id}` as Route}>
                          1:1-Chat öffnen
                        </Link>
                      ) : (
                        <Link className={buttonVariants("primary", "w-full justify-center")} href={`/pferde/${approval.horse_id}` as Route}>
                          Pferdeprofil öffnen
                        </Link>
                      )}
                      <Link className={buttonVariants("secondary", "w-full justify-center")} href={`/pferde/${approval.horse_id}/gruppenchat` as Route}>
                        Gruppenchat öffnen
                      </Link>
                      <Link className={buttonVariants("ghost", "w-full justify-center")} href={`/pferde/${approval.horse_id}` as Route}>
                        Pferdeprofil ansehen
                      </Link>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                      {conversation ? (
                        <Link className={inlineLinkClassName} href={`/chat/${conversation.id}` as Route}>
                          Zum 1:1-Chat
                        </Link>
                      ) : null}
                      <Link className={inlineLinkClassName} href={`/pferde/${approval.horse_id}/gruppenchat` as Route}>
                        Zum Gruppenchat
                      </Link>
                      <Link className={inlineLinkClassName} href={`/pferde/${approval.horse_id}` as Route}>
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
      <SectionCard
        id="meine-probetermine"
        subtitle="Hier siehst du den Status deiner Probetermin-Anfragen bis zur Entscheidung über eine neue Reitbeteiligung."
        title="Meine Probetermine"
      >
        {openTrialItems.length === 0 ? (
          <EmptyState
            description="Sobald du einen Probetermin anfragst, erscheint er hier bis zur Annahme, Ablehnung oder Aufnahme."
            title="Noch keine Probetermin-Anfragen"
          />
        ) : (
          <div className="space-y-3">
            {openTrialItems.map((request) => {
              const horse = request.horse;
              const conversation = conversations.get(`${request.horse_id}:${request.rider_id}`) ?? null;
              const contact = conversation ? conversationInfo.get(conversation.id) ?? null : null;
              const hasUnread = hasUnreadMessage(conversation, conversation ? latestMessages.get(conversation.id) ?? null : null, user.id);
              const ownerName = contact?.partner_name?.trim() || "Pferdehalter";

              return (
                <Card className="p-5" key={request.id}>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">Probetermin</p>
                      <p className="font-semibold text-ink">{horse?.title ?? "Pferdeprofil nicht gefunden"}</p>
                      <p className="text-sm text-stone-600">Pferdehalter: {ownerName}</p>
                    </div>
                    {request.requested_start_at && request.requested_end_at ? (
                      <p className="text-sm font-semibold text-ink">{formatDateRange(request.requested_start_at, request.requested_end_at)}</p>
                    ) : null}
                    <p className="text-sm leading-6 text-stone-600">{request.message?.trim() || "Keine Nachricht hinterlegt."}</p>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge status={request.status} />
                      {hasUnread ? <Badge tone="info">Neue Nachricht</Badge> : null}
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                      <Link className={inlineLinkClassName} href={`/pferde/${request.horse_id}` as Route}>
                        Pferdeprofil ansehen
                      </Link>
                      {conversation ? (
                        <Link className={inlineLinkClassName} href={`/chat/${conversation.id}` as Route}>
                          Zum Chat
                        </Link>
                      ) : null}
                      {(request.status === "requested" || request.status === "accepted") ? (
                        <form action={cancelTrialRequestAction}>
                          <input name="requestId" type="hidden" value={request.id} />
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
              );
            })}
          </div>
        )}
      </SectionCard>
    </AppPageShell>
  );
}
