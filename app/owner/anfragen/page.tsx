import type { Route } from "next";
import Link from "next/link";

import { updateApprovalAction, updateTrialRequestStatusAction } from "@/app/actions";
import { Notice } from "@/components/notice";
import { StatusBadge } from "@/components/status-badge";
import { requireProfile } from "@/lib/auth";
import { readSearchParam } from "@/lib/search-params";
import type { Approval, Conversation, Horse, TrialRequest } from "@/types/database";

type OwnerRequestItem = TrialRequest & {
  horse?: Horse | null;
};

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
  let conversations: Conversation[] = [];

  if (horseIds.length > 0) {
    const [{ data: requestsData }, { data: approvalsData }, { data: conversationsData }] = await Promise.all([
      supabase
        .from("trial_requests")
        .select("id, horse_id, rider_id, status, message, created_at")
        .in("horse_id", horseIds)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("approvals").select("horse_id, rider_id, status, created_at").in("horse_id", horseIds),
      supabase.from("conversations").select("id, horse_id, rider_id, owner_id, created_at").eq("owner_id", user.id).in("horse_id", horseIds)
    ]);

    requests = (requestsData as TrialRequest[] | null) ?? [];
    approvals = (approvalsData as Approval[] | null) ?? [];
    conversations = (conversationsData as Conversation[] | null) ?? [];
  }

  const horseMap = new Map(horses.map((horse) => [horse.id, horse]));
  const approvalMap = new Map(approvals.map((approval) => [`${approval.horse_id}:${approval.rider_id}`, approval]));
  const conversationMap = new Map(conversations.map((conversation) => [`${conversation.horse_id}:${conversation.rider_id}`, conversation]));
  const items: OwnerRequestItem[] = requests.map((request) => ({
    ...request,
    horse: horseMap.get(request.horse_id) ?? null
  }));

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-clay">Anfragen</p>
        <h1 className="text-3xl font-semibold text-forest sm:text-4xl">Probetermin verwalten</h1>
        <p className="text-sm text-stone-600 sm:text-base">Nimm Probetermine an, lehne sie ab oder schalte eine Reitbeteiligung nach dem Termin frei.</p>
      </div>
      <Notice text={error} tone="error" />
      <Notice text={message} tone="success" />
      {items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-stone-300 bg-white p-5 text-sm text-stone-600">
          Fuer deine Pferdeprofile liegen noch keine Probetermin-Anfragen vor.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((request) => {
            const approval = approvalMap.get(`${request.horse_id}:${request.rider_id}`) ?? null;
            const conversation = conversationMap.get(`${request.horse_id}:${request.rider_id}`) ?? null;

            return (
              <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft" key={request.id}>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">Pferdeprofil</p>
                    <p className="mt-1 font-semibold text-ink">{request.horse?.title ?? "Pferdeprofil nicht gefunden"}</p>
                    <p className="mt-1 text-sm text-stone-600">Reiter {request.rider_id.slice(0, 8)}</p>
                  </div>
                  <p className="text-sm text-stone-600">{request.message ?? "Keine Nachricht hinterlegt."}</p>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={request.status} />
                    {approval ? <StatusBadge status={approval.status} /> : null}
                  </div>
                  {approval?.status === "approved" && conversation ? (
                    <p className="text-sm text-emerald-700">Kontaktdaten sind jetzt im Chat sichtbar.</p>
                  ) : null}
                  <div className="space-y-2">
                    {request.status === "requested" ? (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <form action={updateTrialRequestStatusAction}>
                          <input name="requestId" type="hidden" value={request.id} />
                          <input name="status" type="hidden" value="accepted" />
                          <button className="inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-700" type="submit">
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
                        <button className="inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700" type="submit">
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
    </div>
  );
}
