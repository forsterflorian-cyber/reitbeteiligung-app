import type { Route } from "next";
import Link from "next/link";

import { Notice } from "@/components/notice";
import { StatusBadge } from "@/components/status-badge";
import { requireProfile } from "@/lib/auth";
import type { Approval, Horse, TrialRequest } from "@/types/database";

type TrialRequestListItem = TrialRequest & {
  horse?: Horse | null;
};

export default async function AnfragenPage() {
  const { supabase, user } = await requireProfile("rider");
  const { data } = await supabase
    .from("trial_requests")
    .select("id, horse_id, rider_id, status, message, created_at")
    .eq("rider_id", user.id)
    .order("created_at", { ascending: false })
    .limit(12);

  const requests = (data as TrialRequest[] | null) ?? [];
  const horseIds = [...new Set(requests.map((request) => request.horse_id))];
  const [{ data: horsesData }, { data: approvalsData }] = await Promise.all([
    horseIds.length > 0
      ? supabase.from("horses").select("id, owner_id, title, plz, description, active, created_at").in("id", horseIds)
      : Promise.resolve({ data: [] as Horse[] }),
    horseIds.length > 0
      ? supabase.from("approvals").select("horse_id, rider_id, status, created_at").eq("rider_id", user.id).in("horse_id", horseIds)
      : Promise.resolve({ data: [] as Approval[] })
  ]);

  const horses = new Map(((horsesData as Horse[] | null) ?? []).map((horse) => [horse.id, horse]));
  const approvals = new Map(
    (((approvalsData as Approval[] | null) ?? []).map((approval) => [`${approval.horse_id}:${approval.rider_id}`, approval]))
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
      {items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-stone-300 bg-white p-5 text-sm text-stone-600">
          Du hast noch keine Probetermin-Anfragen gestellt.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((request) => {
            const approval = approvals.get(`${request.horse_id}:${request.rider_id}`) ?? null;
            const horse = request.horse;

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
                  <Link className="inline-flex min-h-[44px] items-center text-sm font-semibold text-forest hover:text-clay" href={`/pferde/${request.horse_id}` as Route}>
                    Pferdeprofil ansehen
                  </Link>
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
