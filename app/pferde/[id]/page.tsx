import Link from "next/link";
import { notFound } from "next/navigation";

import { requestTrialAction } from "@/app/actions";
import { Notice } from "@/components/notice";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { isApproved } from "@/lib/approvals";
import { getViewerContext } from "@/lib/auth";
import { readSearchParam } from "@/lib/search-params";
import type { Horse, TrialRequest } from "@/types/database";

function riderStatusText(status: string) {
  switch (status) {
    case "requested":
      return "Deine Anfrage ist eingegangen. Der Pferdehalter entscheidet als Naechstes.";
    case "accepted":
      return "Der Probetermin wurde angenommen. Vereinbart jetzt die Durchfuehrung.";
    case "completed":
      return "Der Probetermin wurde als durchgefuehrt markiert. Warte jetzt auf die Freischaltung.";
    case "declined":
      return "Die letzte Anfrage wurde abgelehnt. Du kannst bei Bedarf erneut anfragen.";
    default:
      return null;
  }
}

export default async function PferdDetailPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { profile, supabase, user } = await getViewerContext();
  const error = readSearchParam(searchParams, "error");
  const message = readSearchParam(searchParams, "message");
  const { data } = await supabase
    .from("horses")
    .select("id, owner_id, title, plz, description, active, created_at")
    .eq("id", params.id)
    .maybeSingle();

  const horse = (data as Horse | null) ?? null;

  if (!horse) {
    notFound();
  }

  let latestRequest: TrialRequest | null = null;
  let approved = false;

  if (profile?.role === "rider" && user) {
    const { data: requestData } = await supabase
      .from("trial_requests")
      .select("id, horse_id, rider_id, status, message, created_at")
      .eq("horse_id", horse.id)
      .eq("rider_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    latestRequest = (requestData as TrialRequest | null) ?? null;
    approved = await isApproved(horse.id, user.id, supabase);
  }

  const canRequest = profile?.role === "rider" && (!latestRequest || latestRequest.status === "declined") && !approved;

  return (
    <div className="space-y-5">
      <Link className="inline-flex min-h-[44px] items-center text-sm font-semibold text-forest hover:text-clay" href="/suchen">
        Zurueck zur Suche
      </Link>
      <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft sm:p-6">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-clay">Pferdeprofil</p>
            <h1 className="mt-2 text-3xl font-semibold text-forest sm:text-4xl">{horse.title}</h1>
            <p className="mt-2 text-sm text-stone-600">PLZ {horse.plz}</p>
          </div>
          <p className="text-sm text-stone-600 sm:text-base">{horse.description ?? "Fuer dieses Pferdeprofil liegt noch keine Beschreibung vor."}</p>
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${horse.active ? "bg-emerald-100 text-emerald-800" : "bg-stone-200 text-stone-700"}`}>{horse.active ? "Aktiv" : "Nicht aktiv"}</span>
        </div>
      </section>
      <Notice text={error} tone="error" />
      <Notice text={message} tone="success" />
      {profile?.role === "rider" ? (
        <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft sm:p-6">
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-ink">Probetermin anfragen</h2>
              <p className="mt-2 text-sm text-stone-600">Sende dem Pferdehalter eine kurze Nachricht zu deiner Anfrage.</p>
            </div>
            {approved ? (
              <div className="space-y-3 rounded-2xl bg-sand p-4">
                <StatusBadge status="approved" />
                <p className="text-sm text-stone-600">Du bist fuer dieses Pferd bereits freigeschaltet und kannst spaeter freie Termine anfragen.</p>
              </div>
            ) : null}
            {latestRequest ? (
              <div className="space-y-3 rounded-2xl bg-sand p-4">
                <StatusBadge status={latestRequest.status} />
                <p className="text-sm text-stone-600">{riderStatusText(latestRequest.status)}</p>
              </div>
            ) : null}
            {canRequest ? (
              <form action={requestTrialAction} className="space-y-4">
                <input name="horseId" type="hidden" value={horse.id} />
                <div>
                  <label htmlFor="message">Nachricht (optional)</label>
                  <textarea id="message" name="message" placeholder="Stelle dich kurz vor und nenne deinen Wunsch fuer den Probetermin." rows={5} />
                </div>
                <SubmitButton idleLabel="Probetermin anfragen" pendingLabel="Wird gesendet..." />
              </form>
            ) : null}
          </div>
        </section>
      ) : null}
      {!user ? (
        <Link
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl bg-forest px-4 py-3 text-sm font-semibold text-white hover:bg-forest/90"
          href="/login"
        >
          Anmelden um Probetermin anzufragen
        </Link>
      ) : null}
      {profile?.role === "owner" ? (
        <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft sm:p-6">
          <p className="text-sm text-stone-600">Du bist als Pferdehalter angemeldet. Probetermine verwaltest du unter deinen Anfragen.</p>
          <Link className="mt-3 inline-flex min-h-[44px] items-center text-sm font-semibold text-forest hover:text-clay" href="/owner/anfragen">
            Zu den Anfragen
          </Link>
        </section>
      ) : null}
    </div>
  );
}

