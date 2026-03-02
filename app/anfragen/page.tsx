import type { Route } from "next";
import Link from "next/link";

import { Notice } from "@/components/notice";
import { StatusBadge } from "@/components/status-badge";
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
    return "Zeitpunkt wird geprueft";
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
      .select("id, horse_id, rider_id, status, message, created_at")
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
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-clay">Anfragen</p>
        <h1 className="text-3xl font-semibold text-forest sm:text-4xl">Meine Anfragen</h1>
        <p className="text-sm text-stone-600 sm:text-base">Hier siehst du deine Probetermine, Freischaltungen und konkrete Terminanfragen.</p>
      </div>
      <Notice text={error} tone="error" />
      <Notice text={message} tone="success" />
      <section className="space-y-3">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-ink">Meine Probetermine</h2>
          <p className="text-sm text-stone-600">Hier siehst du den Status deiner Probetermin-Anfragen und ob du bereits freigeschaltet wurdest.</p>
        </div>
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-5 text-sm text-stone-600">
            Du hast noch keine Probetermin-Anfragen gestellt.
          </div>
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
                <div className="rounded-2xl border border-stone-200 bg-white p-5" key={request.id}>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">Probetermin</p>
                      <p className="mt-1 font-semibold text-ink">{horse?.title ?? "Pferdeprofil nicht gefunden"}</p>
                      <p className="mt-1 text-sm text-stone-600">{horse ? `Pferdehalter: ${ownerName}` : "Pferdeprofil nicht mehr verfuegbar"}</p>
                    </div>
                    <p className="text-sm text-stone-600">{request.message ?? "Keine Nachricht hinterlegt."}</p>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge status={request.status} />
                      {approval ? <StatusBadge status={approval.status} /> : null}
                      {hasUnread ? <span className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800">Neue Nachricht</span> : null}
                    </div>
                    {approval?.status === "approved" && conversation ? (
                      <p className="text-sm text-emerald-700">Kontaktdaten sind jetzt im Chat sichtbar.</p>
                    ) : null}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <Link className="inline-flex min-h-[44px] items-center text-sm font-semibold text-forest hover:text-clay" href={`/pferde/${request.horse_id}` as Route}>
                        Pferdeprofil ansehen
                      </Link>
                      {conversation ? (
                        <Link className="inline-flex min-h-[44px] items-center text-sm font-semibold text-forest hover:text-clay" href={`/chat/${conversation.id}` as Route}>
                          Zum Chat
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      <section className="space-y-3">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-ink">Meine Terminanfragen</h2>
          <p className="text-sm text-stone-600">Nur freigeschaltete Reiter koennen innerhalb eines Verfuegbarkeitsfensters einen Termin anfragen.</p>
        </div>
        {bookingItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-5 text-sm text-stone-600">
            Du hast noch keine Terminanfrage gestellt.
          </div>
        ) : (
          <div className="space-y-3">
            {bookingItems.map((request) => {
              const conversation = conversations.get(`${request.horse_id}:${request.rider_id}`) ?? null;
              const contact = conversation ? conversationInfo.get(conversation.id) ?? null : null;
              const hasUnread = hasUnreadMessage(conversation, conversation ? latestMessages.get(conversation.id) ?? null : null, user.id);
              const ownerName = contact?.partner_name?.trim() || "Pferdehalter";

              return (
                <div className="rounded-2xl border border-stone-200 bg-white p-5" key={request.id}>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">Terminanfrage</p>
                      <p className="mt-1 font-semibold text-ink">{request.horse?.title ?? "Pferdeprofil nicht gefunden"}</p>
                      <p className="mt-1 text-sm text-stone-600">{request.horse ? `Pferdehalter: ${ownerName}` : "Pferdeprofil nicht mehr verfuegbar"}</p>
                    </div>
                    <p className="text-sm font-semibold text-ink">{formatDateRange(request.requested_start_at, request.requested_end_at)}</p>
                    {request.recurrence_rrule ? <p className="text-sm text-stone-600">Wiederholung: {request.recurrence_rrule}</p> : null}
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge status={request.status} />
                      {hasUnread ? <span className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800">Neue Nachricht</span> : null}
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <Link className="inline-flex min-h-[44px] items-center text-sm font-semibold text-forest hover:text-clay" href={`/pferde/${request.horse_id}/kalender` as Route}>
                        Zum Kalender
                      </Link>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                        <Link className="inline-flex min-h-[44px] items-center text-sm font-semibold text-forest hover:text-clay" href={`/pferde/${request.horse_id}` as Route}>
                          Pferdeprofil ansehen
                        </Link>
                        {conversation ? (
                          <Link className="inline-flex min-h-[44px] items-center text-sm font-semibold text-forest hover:text-clay" href={`/chat/${conversation.id}` as Route}>
                            Zum Chat
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}