import type { Route } from "next";
import Link from "next/link";

import { acceptBookingRequestAction, declineBookingRequestAction, updateApprovalAction, updateTrialRequestStatusAction } from "@/app/actions";
import { Notice } from "@/components/notice";
import { StatusBadge } from "@/components/status-badge";
import { requireProfile } from "@/lib/auth";
import { readSearchParam } from "@/lib/search-params";
import type { Approval, BookingRequest, Conversation, Horse, Message, TrialRequest } from "@/types/database";

type OwnerRequestItem = TrialRequest & {
  horse?: Horse | null;
};

type OwnerBookingRequestItem = BookingRequest & {
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

  const lastReadAt = conversation.owner_last_read_at ?? conversation.created_at;
  return Date.parse(latestMessage.created_at) > Date.parse(lastReadAt);
}

export default async function OwnerAnfragenPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { supabase, user } = await requireProfile("owner");
  const error = readSearchParam(searchParams, "error");
  const message = readSearchParam(searchParams, "message");
  const { data: horsesData } = await supabase
    .from("horses")
    .select("id, owner_id, title, plz, description, active, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  const horses = (horsesData as Horse[] | null) ?? [];
  const horseIds = horses.map((horse) => horse.id);

  let requests: TrialRequest[] = [];
  let approvals: Approval[] = [];
  let conversationsArray: Conversation[] = [];
  let bookingRequests: BookingRequest[] = [];

  if (horseIds.length > 0) {
    const [{ data: requestsData }, { data: approvalsData }, { data: conversationsData }, { data: bookingRequestsData }] = await Promise.all([
      supabase
        .from("trial_requests")
        .select("id, horse_id, rider_id, status, message, created_at")
        .in("horse_id", horseIds)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("approvals").select("horse_id, rider_id, status, created_at").in("horse_id", horseIds),
      supabase
        .from("conversations")
        .select("id, horse_id, rider_id, owner_id, owner_last_read_at, rider_last_read_at, created_at")
        .eq("owner_id", user.id)
        .in("horse_id", horseIds),
      supabase
        .from("booking_requests")
        .select("id, slot_id, availability_rule_id, horse_id, rider_id, status, requested_start_at, requested_end_at, recurrence_rrule, created_at")
        .in("horse_id", horseIds)
        .order("created_at", { ascending: false })
        .limit(20)
    ]);

    requests = (requestsData as TrialRequest[] | null) ?? [];
    approvals = (approvalsData as Approval[] | null) ?? [];
    conversationsArray = (conversationsData as Conversation[] | null) ?? [];
    bookingRequests = (bookingRequestsData as BookingRequest[] | null) ?? [];
  }

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

  const horseMap = new Map(horses.map((horse) => [horse.id, horse]));
  const approvalMap = new Map(approvals.map((approval) => [`${approval.horse_id}:${approval.rider_id}`, approval]));
  const conversationMap = new Map(conversationsArray.map((conversation) => [`${conversation.horse_id}:${conversation.rider_id}`, conversation]));
  const conversationInfo = new Map(contactInfoEntries);
  const latestMessages = new Map<string, Message>();

  (((latestMessagesData as Message[] | null) ?? [])).forEach((latestMessage) => {
    if (!latestMessages.has(latestMessage.conversation_id)) {
      latestMessages.set(latestMessage.conversation_id, latestMessage);
    }
  });

  const items: OwnerRequestItem[] = requests.map((request) => ({
    ...request,
    horse: horseMap.get(request.horse_id) ?? null
  }));
  const bookingItems: OwnerBookingRequestItem[] = bookingRequests.map((request) => ({
    ...request,
    horse: horseMap.get(request.horse_id) ?? null
  }));

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-clay">Anfragen</p>
        <h1 className="text-3xl font-semibold text-forest sm:text-4xl">Anfragen verwalten</h1>
        <p className="text-sm text-stone-600 sm:text-base">Bearbeite Probetermine, Freischaltungen und konkrete Terminanfragen deiner Reiter.</p>
      </div>
      <Notice text={error} tone="error" />
      <Notice text={message} tone="success" />
      <section className="space-y-3">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-ink">Probetermine</h2>
          <p className="text-sm text-stone-600">Nimm Probetermine an, lehne sie ab oder schalte eine Reitbeteiligung nach dem Termin frei.</p>
        </div>
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-5 text-sm text-stone-600">
            Fuer deine Pferdeprofile liegen noch keine Probetermin-Anfragen vor.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((request) => {
              const approval = approvalMap.get(`${request.horse_id}:${request.rider_id}`) ?? null;
              const conversation = conversationMap.get(`${request.horse_id}:${request.rider_id}`) ?? null;
              const contact = conversation ? conversationInfo.get(conversation.id) ?? null : null;
              const riderName = contact?.partner_name?.trim() || "Reiter";
              const hasUnread = hasUnreadMessage(conversation, conversation ? latestMessages.get(conversation.id) ?? null : null, user.id);

              return (
                <div className="rounded-2xl border border-stone-200 bg-white p-5" key={request.id}>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">Pferdeprofil</p>
                      <p className="mt-1 font-semibold text-ink">{request.horse?.title ?? "Pferdeprofil nicht gefunden"}</p>
                      <p className="mt-1 text-sm text-stone-600">Reiter: {riderName}</p>
                    </div>
                    <p className="text-sm text-stone-600">{request.message ?? "Keine Nachricht hinterlegt."}</p>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge status={request.status} />
                      {approval ? <StatusBadge status={approval.status} /> : null}
                      {hasUnread ? <span className="inline-flex rounded-full border border-stone-200 bg-sand px-3 py-1 text-xs font-semibold text-ink">Neue Nachricht</span> : null}
                    </div>
                    {approval?.status === "approved" && conversation ? (
                      <p className="rounded-xl border border-stone-200 bg-sand px-3 py-2 text-sm text-ink">Kontaktdaten sind jetzt im Chat sichtbar.</p>
                    ) : null}
                    <div className="space-y-2">
                      {request.status === "requested" ? (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <form action={updateTrialRequestStatusAction}>
                            <input name="requestId" type="hidden" value={request.id} />
                            <input name="status" type="hidden" value="accepted" />
                            <button className="inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl bg-forest px-4 py-3 text-sm font-semibold text-white hover:bg-forest/90" type="submit">
                              Annehmen
                            </button>
                          </form>
                          <form action={updateTrialRequestStatusAction}>
                            <input name="requestId" type="hidden" value={request.id} />
                            <input name="status" type="hidden" value="declined" />
                            <button className="inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-700" type="submit">
                              Ablehnen
                            </button>
                          </form>
                        </div>
                      ) : null}
                      {request.status === "accepted" ? (
                        <form action={updateTrialRequestStatusAction}>
                          <input name="requestId" type="hidden" value={request.id} />
                          <input name="status" type="hidden" value="completed" />
                          <button className="inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl bg-forest px-4 py-3 text-sm font-semibold text-white hover:bg-forest/90" type="submit">
                            Als durchgefuehrt markieren
                          </button>
                        </form>
                      ) : null}
                      {request.status === "completed" ? (
                        <form action={updateApprovalAction}>
                          <input name="requestId" type="hidden" value={request.id} />
                          <input name="status" type="hidden" value={approval?.status === "approved" ? "revoked" : "approved"} />
                          <button
                            className={`inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold text-white ${
                              approval?.status === "approved" ? "bg-stone-600 hover:bg-stone-700" : "bg-forest hover:bg-forest/90"
                            }`}
                            type="submit"
                          >
                            {approval?.status === "approved" ? "Freischaltung entziehen" : "Reitbeteiligung freischalten"}
                          </button>
                        </form>
                      ) : null}
                    </div>
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
          <h2 className="text-xl font-semibold text-ink">Terminanfragen</h2>
          <p className="text-sm text-stone-600">Hier bearbeitest du konkrete Buchungsanfragen innerhalb deiner Verfuegbarkeitsfenster.</p>
        </div>
        {bookingItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-5 text-sm text-stone-600">
            Fuer deine Pferdeprofile liegen noch keine Terminanfragen vor.
          </div>
        ) : (
          <div className="space-y-3">
            {bookingItems.map((request) => {
              const conversation = conversationMap.get(`${request.horse_id}:${request.rider_id}`) ?? null;
              const contact = conversation ? conversationInfo.get(conversation.id) ?? null : null;
              const riderName = contact?.partner_name?.trim() || "Reiter";
              const hasUnread = hasUnreadMessage(conversation, conversation ? latestMessages.get(conversation.id) ?? null : null, user.id);

              return (
                <div className="rounded-2xl border border-stone-200 bg-white p-5" key={request.id}>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">Terminanfrage</p>
                      <p className="mt-1 font-semibold text-ink">{request.horse?.title ?? "Pferdeprofil nicht gefunden"}</p>
                      <p className="mt-1 text-sm text-stone-600">Reiter: {riderName}</p>
                    </div>
                    <p className="text-sm font-semibold text-ink">{formatDateRange(request.requested_start_at, request.requested_end_at)}</p>
                    {request.recurrence_rrule ? <p className="text-sm text-stone-600">Wiederholung: {request.recurrence_rrule}</p> : null}
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge status={request.status} />
                      {hasUnread ? <span className="inline-flex rounded-full border border-stone-200 bg-sand px-3 py-1 text-xs font-semibold text-ink">Neue Nachricht</span> : null}
                    </div>
                    {request.status === "requested" ? (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <form action={acceptBookingRequestAction}>
                          <input name="requestId" type="hidden" value={request.id} />
                          <button className="inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl bg-forest px-4 py-3 text-sm font-semibold text-white hover:bg-forest/90" type="submit">
                            Annehmen
                          </button>
                        </form>
                        <form action={declineBookingRequestAction}>
                          <input name="requestId" type="hidden" value={request.id} />
                          <button className="inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-700" type="submit">
                            Ablehnen
                          </button>
                        </form>
                      </div>
                    ) : null}
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