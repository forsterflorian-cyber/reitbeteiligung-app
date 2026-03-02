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
      .limit(5);

    const ownerHorses = (horses as Horse[] | null) ?? [];

    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-clay">Uebersicht</p>
          <h1 className="text-3xl font-semibold text-forest sm:text-4xl">Bereich fuer Pferdehalter</h1>
          <p className="text-sm text-stone-600 sm:text-base">
            Verwalte neue Pferde, bestehende Pferdeprofile, Anfragen und spaeter auch Verfuegbarkeiten in einer klaren Verwaltungsansicht.
          </p>
        </div>
        <Notice text={message} tone="success" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <p className="text-sm text-stone-500">Pferdeprofile</p>
            <p className="mt-2 text-4xl font-semibold text-forest">{ownerHorses.length}</p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <p className="text-sm text-stone-500">Premium</p>
            <p className="mt-2 text-lg font-semibold text-ink">{profile.is_premium ? "Aktiv" : "Nicht aktiv"}</p>
            <p className="mt-2 text-sm text-stone-600">Mit Premium aktivierst du spaeter Verfuegbarkeiten und Terminanfragen.</p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <p className="text-sm text-stone-500">Schnellzugriff</p>
            <div className="mt-3 flex flex-col gap-2">
              <Link className="inline-flex min-h-[44px] items-center rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold text-ink hover:border-forest hover:text-forest" href="/owner/horses">
                Neues Pferd anlegen
              </Link>
              <Link className="inline-flex min-h-[44px] items-center rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold text-ink hover:border-forest hover:text-forest" href="/owner/pferde-verwalten">
                Pferde verwalten
              </Link>
            </div>
          </div>
        </div>
        <section className="rounded-2xl border border-stone-200 bg-white p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-ink">Letzte Pferdeprofile</h2>
              <p className="mt-1 text-sm text-stone-600">Die letzten angelegten Pferde mit Status und direktem Zugriff.</p>
            </div>
            <Link className="inline-flex min-h-[44px] items-center rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold text-ink hover:border-forest hover:text-forest" href="/owner/pferde-verwalten">
              Alle anzeigen
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {ownerHorses.length === 0 ? (
              <p className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-600">Du hast noch kein Pferd angelegt.</p>
            ) : (
              ownerHorses.map((horse) => (
                <div className="rounded-xl border border-stone-200 p-4" key={horse.id}>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="font-semibold text-ink">{horse.title}</p>
                      <p className="text-sm text-stone-600">PLZ {horse.plz}</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${horse.active ? "bg-emerald-100 text-emerald-700" : "bg-stone-200 text-stone-600"}`}>
                        {horse.active ? "Aktiv" : "Inaktiv"}
                      </span>
                      <Link className="inline-flex min-h-[44px] items-center rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold text-ink hover:border-forest hover:text-forest" href={`/pferde/${horse.id}`}>
                        Pferdeprofil ansehen
                      </Link>
                    </div>
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
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-clay">Uebersicht</p>
        <h1 className="text-3xl font-semibold text-forest sm:text-4xl">Bereich fuer Reiter</h1>
        <p className="text-sm text-stone-600 sm:text-base">Halte dein Profil aktuell und verfolge Probetermin-Anfragen in einer kompakten, klaren Ansicht.</p>
      </div>
      <Notice text={message} tone="success" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <p className="text-sm text-stone-500">Profilstatus</p>
          <p className="mt-2 text-lg font-semibold text-ink">{riderProfile ? "Bereit" : "Bitte vervollstaendigen"}</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <p className="text-sm text-stone-500">Probetermin-Anfragen</p>
          <p className="mt-2 text-4xl font-semibold text-forest">{trials.length}</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <p className="text-sm text-stone-500">Schnellzugriff</p>
          <Link className="mt-3 inline-flex min-h-[44px] items-center rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold text-ink hover:border-forest hover:text-forest" href="/rider/profile">
            Reiterprofil bearbeiten
          </Link>
        </div>
      </div>
      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="text-xl font-semibold text-ink">Neueste Probetermine</h2>
        <div className="mt-4 space-y-3">
          {trials.length === 0 ? (
            <p className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-600">Du hast noch keine Probetermin-Anfragen.</p>
          ) : (
            trials.map((trial) => (
              <div className="rounded-xl border border-stone-200 p-4" key={trial.id}>
                <div className="space-y-2">
                  <div>
                    <p className="font-semibold text-ink">Probetermin {trial.id.slice(0, 8)}</p>
                    <p className="text-sm text-stone-600">{trial.message ?? "Keine Nachricht hinterlegt."}</p>
                  </div>
                  <span className="inline-flex rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-forest">
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