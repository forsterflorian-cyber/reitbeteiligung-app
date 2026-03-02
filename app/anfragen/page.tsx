import type { Route } from "next";
import Link from "next/link";

import { Notice } from "@/components/notice";
import { StatusBadge } from "@/components/status-badge";
import { requireProfile } from "@/lib/auth";
import { readSearchParam } from "@/lib/search-params";
import type { Approval, Conversation, Horse, TrialRequest } from "@/types/database";

type TrialRequestListItem = TrialRequest & {
  horse?: Horse | null;
};

export default async function AnfragenPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { supabase, user } = await requireProfile("rider");
  const error = readSearchParam(searchParams, "error");
  const message = readSearchParam(searchParams, "message");
  const { data } = await supabase
    .from("trial_requests")
    .select("id, horse_id, rider_id, status, message, created_at")
    .eq("rider_id", user.id)
    .order("created_at", { ascending: false })
    .limit(12);

  const requests = (data as TrialRequest[] | null) ?? [];
  const horseIds = [...new Set(requests.map((request) => request.horse_id))];
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

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-clay">Anfragen</p>
        <h1 className="text-3xl font-semibold text-forest sm:text-4xl">Meine Probetermine</h1>
        <p className="text-sm text-stone-600 sm:text-base">Hier siehst du alle Probetermin-Anfragen, ihren Status und ob du bereits freigeschaltet wurdest.</p>
      </div>
      <Notice text={error} tone="error" />
      <Notice text={message} tone="success" />
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
      <Notice text="Nur freigeschaltete Reiter koennen spaeter freie Termine anfragen." />
    </div>
  );
}
