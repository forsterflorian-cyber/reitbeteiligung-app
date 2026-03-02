import type { Route } from "next";
import Link from "next/link";

import { Notice } from "@/components/notice";
import { StatusBadge } from "@/components/status-badge";
import { requireProfile } from "@/lib/auth";
import { readSearchParam } from "@/lib/search-params";
import type { Approval, BookingRequest, Conversation, Horse, TrialRequest } from "@/types/database";

type TrialRequestListItem = TrialRequest & {
  horse?: Horse | null;
};

type BookingRequestListItem = BookingRequest & {
  horse?: Horse | null;
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
      ? supabase.from("conversations").select("id, horse_id, rider_id, owner_id, created_at").eq("rider_id", user.id).in("horse_id", horseIds)
      : Promise.resolve({ data: [] as Conversation[] })
  ]);

  const horses = new Map(((horsesData as Horse[] | null) ?? []).map((horse) => [horse.id, horse]));
  const approvals = new Map((((approvalsData as Approval[] | null) ?? []).map((approval) => [`${approval.horse_id}:${approval.rider_id}`, approval])));
  const conversations = new Map(
    (((conversationsData as Conversation[] | null) ?? []).map((conversation) => [`${conversation.horse_id}:${conversation.rider_id}`, conversation]))
  );
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
          <div className="rounded-3xl border border-dashed border-stone-300 bg-white p-5 text-sm text-stone-600">
            Du hast noch keine Probetermin-Anfragen gestellt.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((request) => {
              const approval = approvals.get(`${request.horse_id}:${request.rider_id}`) ?? null;
              const horse = request.horse;
              const conversation = conversations.get(`${request.horse_id}:${request.rider_id}`) ?? null;

              return (
                <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft" key={request.id}>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">Probetermin</p>
                      <p className="mt-1 font-semibold text-ink">{horse?.title ?? "Pferdeprofil nicht gefunden"}</p>
                      <p className="mt-1 text-sm text-stone-600">{horse ? `PLZ ${horse.plz}` : `Anfrage ${request.id.slice(0, 8)}`}</p>
                    </div>
                    <p className="text-sm text-stone-600">{request.message ?? "Keine Nachricht hinterlegt."}</p>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge status={request.status} />
                      {approval ? <StatusBadge status={approval.status} /> : null}
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
          <div className="rounded-3xl border border-dashed border-stone-300 bg-white p-5 text-sm text-stone-600">
            Du hast noch keine Terminanfrage gestellt.
          </div>
        ) : (
          <div className="space-y-3">
            {bookingItems.map((request) => (
              <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft" key={request.id}>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">Terminanfrage</p>
                    <p className="mt-1 font-semibold text-ink">{request.horse?.title ?? "Pferdeprofil nicht gefunden"}</p>
                    <p className="mt-1 text-sm text-stone-600">{request.horse ? `PLZ ${request.horse.plz}` : `Anfrage ${request.id.slice(0, 8)}`}</p>
                  </div>
                  <p className="text-sm font-semibold text-ink">{formatDateRange(request.requested_start_at, request.requested_end_at)}</p>
                  {request.recurrence_rrule ? <p className="text-sm text-stone-600">Wiederholung: {request.recurrence_rrule}</p> : null}
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={request.status} />
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <Link className="inline-flex min-h-[44px] items-center text-sm font-semibold text-forest hover:text-clay" href={`/pferde/${request.horse_id}/kalender` as Route}>
                      Zum Kalender
                    </Link>
                    <Link className="inline-flex min-h-[44px] items-center text-sm font-semibold text-forest hover:text-clay" href={`/pferde/${request.horse_id}` as Route}>
                      Pferdeprofil ansehen
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}