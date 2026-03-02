import Link from "next/link";

import { Notice } from "@/components/notice";
import { requireProfile } from "@/lib/auth";
import { readSearchParam } from "@/lib/search-params";
import type { Horse, TrialRequest, TrialRequestStatus } from "@/types/database";

type DashboardPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function translateStatus(status: TrialRequestStatus) {
  switch (status) {
    case "requested":
      return "Angefragt";
    case "accepted":
      return "Angenommen";
    case "declined":
      return "Abgelehnt";
    case "completed":
      return "Durchgefuehrt";
    default:
      return status;
  }
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { profile, supabase, user } = await requireProfile();
  const message = readSearchParam(searchParams, "message");

  if (profile.role === "owner") {
    const { data: horses } = await supabase
      .from("horses")
      .select("id, owner_id, title, plz, description, active, created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(4);

    const ownerHorses = (horses as Horse[] | null) ?? [];

    return (
      <div className="space-y-5">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-clay">Übersicht</p>
          <h1 className="text-3xl font-semibold text-forest sm:text-4xl">Bereich fuer Pferdehalter</h1>
          <p className="text-sm text-stone-600 sm:text-base">
            Verwalte deine Reitbeteiligung mobil, halte Inserate aktuell und pruefe schnell, was bereits freigeschaltet ist.
          </p>
        </div>
        <Notice text={message} tone="success" />
        <div className="space-y-3">
          <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft">
            <p className="text-sm text-stone-500">Reitbeteiligungen</p>
            <p className="mt-2 text-4xl font-semibold text-forest">{ownerHorses.length}</p>
          </div>
          <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft">
            <p className="text-sm text-stone-500">Freischalten</p>
            <p className="mt-2 text-xl font-semibold text-ink">{profile.is_premium ? "Bereits freigeschaltet" : "Noch nicht freigeschaltet"}</p>
            <p className="mt-2 text-sm text-stone-600">Mit Premium kannst du spaeter Verfuegbarkeiten und Termin anfragen freischalten.</p>
          </div>
          <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft">
            <p className="text-sm text-stone-500">Schnellzugriff</p>
            <Link className="mt-2 inline-flex text-sm font-semibold text-forest hover:text-clay" href="/owner/horses">
              Reitbeteiligung bearbeiten
            </Link>
          </div>
        </div>
        <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-ink">Letzte Reitbeteiligungen</h2>
            <Link className="text-sm font-semibold text-forest hover:text-clay" href="/owner/horses">
              Alle Reitbeteiligungen ansehen
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {ownerHorses.length === 0 ? (
              <p className="rounded-2xl bg-sand p-4 text-sm text-stone-600">Du hast noch keine Reitbeteiligung angelegt.</p>
            ) : (
              ownerHorses.map((horse) => (
                <div className="rounded-2xl bg-sand p-4" key={horse.id}>
                  <div className="space-y-2">
                    <div>
                      <p className="font-semibold text-ink">{horse.title}</p>
                      <p className="text-sm text-stone-600">PLZ {horse.plz}</p>
                    </div>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${horse.active ? "bg-emerald-100 text-emerald-700" : "bg-stone-200 text-stone-600"}`}>
                      {horse.active ? "Freigeschaltet" : "Nicht freigeschaltet"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    );
  }

  const [{ data: riderProfile }, { data: trialRequests }] = await Promise.all([
    supabase.from("rider_profiles").select("user_id").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("trial_requests")
      .select("id, horse_id, rider_id, status, message, created_at")
      .eq("rider_id", user.id)
      .order("created_at", { ascending: false })
      .limit(4)
  ]);

  const trials = (trialRequests as TrialRequest[] | null) ?? [];

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-clay">Übersicht</p>
        <h1 className="text-3xl font-semibold text-forest sm:text-4xl">Bereich fuer Reiter</h1>
        <p className="text-sm text-stone-600 sm:text-base">Halte dein Profil aktuell und verfolge Probetermin-Anfragen in einer kompakten mobilen Ansicht.</p>
      </div>
      <Notice text={message} tone="success" />
      <div className="space-y-3">
        <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft">
          <p className="text-sm text-stone-500">Profilstatus</p>
          <p className="mt-2 text-xl font-semibold text-ink">{riderProfile ? "Bereit" : "Bitte vervollstaendigen"}</p>
        </div>
        <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft">
          <p className="text-sm text-stone-500">Probetermin-Anfragen</p>
          <p className="mt-2 text-4xl font-semibold text-forest">{trials.length}</p>
        </div>
        <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft">
          <p className="text-sm text-stone-500">Schnellzugriff</p>
          <Link className="mt-2 inline-flex text-sm font-semibold text-forest hover:text-clay" href="/rider/profile">
            Reiterprofil bearbeiten
          </Link>
        </div>
      </div>
      <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft">
        <h2 className="text-xl font-semibold text-ink">Neueste Probetermine</h2>
        <div className="mt-4 space-y-3">
          {trials.length === 0 ? (
            <p className="rounded-2xl bg-sand p-4 text-sm text-stone-600">Du hast noch keine Probetermin-Anfragen.</p>
          ) : (
            trials.map((trial) => (
              <div className="rounded-2xl bg-sand p-4" key={trial.id}>
                <div className="space-y-2">
                  <div>
                    <p className="font-semibold text-ink">Probetermin {trial.id.slice(0, 8)}</p>
                    <p className="text-sm text-stone-600">{trial.message ?? "Keine Nachricht hinterlegt."}</p>
                  </div>
                  <span className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-forest">
                    {translateStatus(trial.status)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
