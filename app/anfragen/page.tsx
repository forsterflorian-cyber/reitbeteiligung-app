import type { Route } from "next";
import Link from "next/link";

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
import type { Approval, BookingRequest, Conversation, Horse, Message, TrialRequest } from "@/types/database";

type TrialRequestListItem = TrialRequest & {
  horse?: Horse | null;
};

type BookingRequestListItem = BookingRequest & {
  horse?: Horse | null;
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
    return "Zeitpunkt wird geprüft";
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
  const [{ data: trialData }, { data: bookingData }] = await Promise.all([
    supabase
      .from("trial_requests")
      .select("id, horse_id, rider_id, status, message, availability_rule_id, requested_start_at, requested_end_at, created_at")
      .eq("rider_id", user.id)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("booking_requests")
      .select("id, slot_id, availability_rule_id, horse_id, rider_id, status, requested_start_at, requested_end_at, recurrence_rrule, created_at")
      .eq("rider_id", user.id)
      .order("created_at", { ascending: false })
      .limit(12)
  ]);

  const requests = (trialData as TrialRequest[] | null) ?? [];
  const bookingRequests = (bookingData as BookingRequest[] | null) ?? [];
  const horseIds = [...new Set([...requests.map((request) => request.horse_id), ...bookingRequests.map((request) => request.horse_id)])];
  const [{ data: horsesData }, { data: approvalsData }, { data: conversationsData }] = await Promise.all([
    horseIds.length > 0
      ? supabase.from("horses").select("id, owner_id, title, plz, description, active, created_at").in("id", horseIds)
      : Promise.resolve({ data: [] as Horse[] }),
    horseIds.length > 0
      ? supabase.from("approvals").select("horse_id, rider_id, status, created_at").eq("rider_id", user.id).in("horse_id", horseIds)
      : Promise.resolve({ data: [] as Approval[] }),
    horseIds.length > 0
      ? supabase
          .from("conversations")
          .select("id, horse_id, rider_id, owner_id, owner_last_read_at, rider_last_read_at, created_at")
          .eq("rider_id", user.id)
          .in("horse_id", horseIds)
      : Promise.resolve({ data: [] as Conversation[] })
  ]);

  const conversationsArray = (conversationsData as Conversation[] | null) ?? [];
  const conversationIds = conversationsArray.map((conversation) => conversation.id);
  const { data: latestMessagesData } = conversationIds.length > 0
    ? await supabase
        .from("messages")
        .select("id, conversation_id, sender_id, content, created_at")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false })
    : { data: [] as Message[] };

  const contactInfoEntries = await Promise.all(
    conversationsArray.map(async (conversation) => {
      const { data } = await supabase.rpc("get_conversation_contact_info", {
        p_conversation_id: conversation.id
      });
      const rows = Array.isArray(data) ? data : data ? [data] : [];
      const record = (rows[0] as ContactInfoRecord | undefined) ?? null;
      return [conversation.id, record] as const;
    })
  );

  const horses = new Map(((horsesData as Horse[] | null) ?? []).map((horse) => [horse.id, horse]));
  const approvals = new Map((((approvalsData as Approval[] | null) ?? []).map((approval) => [`${approval.horse_id}:${approval.rider_id}`, approval])));
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
  const bookingItems: BookingRequestListItem[] = bookingRequests.map((request) => ({
    ...request,
    horse: horses.get(request.horse_id) ?? null
  }));

  return (
    <AppPageShell>
      <PageHeader
        backdropVariant="hero"
        subtitle="Hier siehst du deine Probetermine, Freischaltungen und konkrete Terminanfragen."
        surface
        title="Meine Anfragen"
      />
      <Notice text={error} tone="error" />
      <Notice text={message} tone="success" />
      <SectionCard
        subtitle="Hier siehst du den Status deiner Probetermin-Anfragen und ob du bereits freigeschaltet wurdest."
        title="Meine Probetermine"
      >
        {items.length === 0 ? (
          <EmptyState
            description="Sobald du einen Probetermin anfragst, erscheint er hier mit Status, Chat und Freischaltung."
            title="Noch keine Probetermin-Anfragen"
          />
        ) : (
          <div className="space-y-3">
            {items.map((request) => {
              const approval = approvals.get(`${request.horse_id}:${request.rider_id}`) ?? null;
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
                      <p className="text-sm text-stone-600">{horse ? `Pferdehalter: ${ownerName}` : "Pferdeprofil nicht mehr verfügbar"}</p>
                    </div>
                    {request.requested_start_at && request.requested_end_at ? (
                      <p className="text-sm font-semibold text-ink">{formatDateRange(request.requested_start_at, request.requested_end_at)}</p>
                    ) : null}
                    <p className="text-sm leading-6 text-stone-600">{request.message ?? "Keine Nachricht hinterlegt."}</p>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge status={request.status} />
                      {approval ? <StatusBadge status={approval.status} /> : null}
                      {hasUnread ? <Badge tone="info">Neue Nachricht</Badge> : null}
                    </div>
                    {approval?.status === "approved" && conversation ? (
                      <Notice text="Kontaktdaten sind jetzt im Chat sichtbar." tone="success" />
                    ) : null}
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                      <Link className={inlineLinkClassName} href={`/pferde/${request.horse_id}` as Route}>
                        Pferdeprofil ansehen
                      </Link>
                      {conversation ? (
                        <Link className={inlineLinkClassName} href={`/chat/${conversation.id}` as Route}>
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
      <SectionCard
        subtitle="Nur freigeschaltete Reiter können innerhalb eines Verfügbarkeitsfensters einen Termin anfragen."
        title="Meine Terminanfragen"
      >
        {bookingItems.length === 0 ? (
          <EmptyState
            description="Sobald du einen konkreten Termin anfragst, erscheint er hier mit Zeitfenster und aktuellem Status."
            title="Noch keine Terminanfrage"
          />
        ) : (
          <div className="space-y-3">
            {bookingItems.map((request) => {
              const conversation = conversations.get(`${request.horse_id}:${request.rider_id}`) ?? null;
              const contact = conversation ? conversationInfo.get(conversation.id) ?? null : null;
              const hasUnread = hasUnreadMessage(conversation, conversation ? latestMessages.get(conversation.id) ?? null : null, user.id);
              const ownerName = contact?.partner_name?.trim() || "Pferdehalter";

              return (
                <Card className="p-5" key={request.id}>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">Terminanfrage</p>
                      <p className="font-semibold text-ink">{request.horse?.title ?? "Pferdeprofil nicht gefunden"}</p>
                      <p className="text-sm text-stone-600">{request.horse ? `Pferdehalter: ${ownerName}` : "Pferdeprofil nicht mehr verfügbar"}</p>
                    </div>
                    <p className="text-sm font-semibold text-ink">{formatDateRange(request.requested_start_at, request.requested_end_at)}</p>
                    {request.recurrence_rrule ? <p className="text-sm text-stone-600">Wiederholung: {request.recurrence_rrule}</p> : null}
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge status={request.status} />
                      {hasUnread ? <Badge tone="info">Neue Nachricht</Badge> : null}
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                      <Link className={inlineLinkClassName} href={`/pferde/${request.horse_id}/kalender` as Route}>
                        Zum Kalender
                      </Link>
                      <Link className={inlineLinkClassName} href={`/pferde/${request.horse_id}` as Route}>
                        Pferdeprofil ansehen
                      </Link>
                      {conversation ? (
                        <Link className={inlineLinkClassName} href={`/chat/${conversation.id}` as Route}>
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
