import Link from "next/link";

import { requireProfile } from "@/lib/auth";
import type { Horse, TrialRequest } from "@/types/database";

function statusLabel(status: string) {
  switch (status.toLowerCase()) {
    case "approved":
      return "Bestaetigt";
    case "rejected":
      return "Abgelehnt";
    case "pending":
      return "Offen";
    default:
      return status;
  }
}

export default async function AnfragenPage() {
  const { profile, supabase, user } = await requireProfile();
  let requests: TrialRequest[] = [];

  if (profile.role === "owner") {
    const { data: horses } = await supabase.from("horses").select("id").eq("owner_id", user.id);
    const horseIds = ((horses as Pick<Horse, "id">[] | null) ?? []).map((horse) => horse.id);

    if (horseIds.length > 0) {
      const { data } = await supabase
        .from("trial_requests")
        .select("id, horse_id, rider_id, status, message, created_at")
        .in("horse_id", horseIds)
        .order("created_at", { ascending: false })
        .limit(8);

      requests = (data as TrialRequest[] | null) ?? [];
    }
  } else {
    const { data } = await supabase
      .from("trial_requests")
      .select("id, horse_id, rider_id, status, message, created_at")
      .eq("rider_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8);

    requests = (data as TrialRequest[] | null) ?? [];
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-clay">Anfragen</p>
        <h1 className="text-3xl font-semibold text-forest sm:text-4xl">Probetermin-Anfragen</h1>
        <p className="text-sm text-stone-600 sm:text-base">
          {profile.role === "owner"
            ? "Pruefe neue Anfragen fuer deine Reitbeteiligungen und entscheide, was du freischalten moechtest."
            : "Behalte im Blick, welche Probetermine bereits bestaetigt oder noch offen sind."}
        </p>
      </div>
      {requests.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-stone-300 bg-white p-5 text-sm text-stone-600">
          Noch keine Probetermin-Anfragen vorhanden.
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft" key={request.id}>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">Probetermin</p>
                  <p className="mt-1 font-semibold text-ink">Anfrage {request.id.slice(0, 8)}</p>
                </div>
                <p className="text-sm text-stone-600">{request.message ?? "Keine Nachricht hinterlegt."}</p>
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex rounded-full bg-sand px-3 py-1 text-xs font-semibold text-forest">{statusLabel(request.status)}</span>
                  {profile.role === "owner" ? (
                    <Link className="text-sm font-semibold text-forest hover:text-clay" href="/owner/horses">
                      Freischalten pruefen
                    </Link>
                  ) : (
                    <Link className="text-sm font-semibold text-forest hover:text-clay" href="/suchen">
                      Termin anfragen
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
