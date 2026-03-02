import type { Route } from "next";
import Link from "next/link";

import { Notice } from "@/components/notice";
import { requireProfile } from "@/lib/auth";
import { readSearchParam } from "@/lib/search-params";
import type { BookingRequest, Horse, TrialRequest, TrialRequestStatus } from "@/types/database";

type DashboardPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

type PendingOwnerRequest = {
  created_at: string;
  href: Route;
  horseTitle: string;
  label: string;
  secondary: string;
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium"
  }).format(new Date(value));
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { profile, supabase, user } = await requireProfile();
  const message = readSearchParam(searchParams, "message");

  if (profile.role === "owner") {
    const { data: horsesData } = await supabase
      .from("horses")
      .select("id, owner_id, title, plz, description, active, created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    const ownerHorses = (horsesData as Horse[] | null) ?? [];
    const horseIds = ownerHorses.map((horse) => horse.id);
    const activeHorseCount = ownerHorses.filter((horse) => horse.active).length;
    const inactiveHorseCount = ownerHorses.length - activeHorseCount;

    let pendingTrialRequests: TrialRequest[] = [];
    let pendingBookingRequests: BookingRequest[] = [];

    if (horseIds.length > 0) {
      const [{ data: trialsData }, { data: bookingData }] = await Promise.all([
        supabase
          .from("trial_requests")
          .select("id, horse_id, rider_id, status, message, created_at")
          .in("horse_id", horseIds)
          .eq("status", "requested")
          .order("created_at", { ascending: false })
          .limit(6),
        supabase
          .from("booking_requests")
          .select("id, slot_id, availability_rule_id, horse_id, rider_id, status, requested_start_at, requested_end_at, recurrence_rrule, created_at")
          .in("horse_id", horseIds)
          .eq("status", "requested")
          .order("created_at", { ascending: false })
          .limit(6)
      ]);

      pendingTrialRequests = (trialsData as TrialRequest[] | null) ?? [];
      pendingBookingRequests = (bookingData as BookingRequest[] | null) ?? [];
    }

    const pendingRequestsTotal = pendingTrialRequests.length + pendingBookingRequests.length;
    const ownerRequestsHref = "/owner/anfragen" as Route;
    const pendingRequestItems: PendingOwnerRequest[] = [
      ...pendingTrialRequests.map((request) => ({
        created_at: request.created_at,
        href: ownerRequestsHref,
        horseTitle: ownerHorses.find((horse) => horse.id === request.horse_id)?.title ?? "Pferdeprofil nicht gefunden",
        label: "Neuer Probetermin",
        secondary: request.message?.trim() || "Ohne Nachricht"
      })),
      ...pendingBookingRequests.map((request) => ({
        created_at: request.created_at,
        href: ownerRequestsHref,
        horseTitle: ownerHorses.find((horse) => horse.id === request.horse_id)?.title ?? "Pferdeprofil nicht gefunden",
        label: "Neue Terminanfrage",
        secondary: request.requested_start_at
          ? `Gewuenschter Start: ${formatDate(request.requested_start_at)}`
          : "Zeitpunkt wird geprueft"
      }))
    ]
      .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
      .slice(0, 5);

    const recentHorses = ownerHorses.slice(0, 5);

    return (
      <div className="space-y-6">
        <section className="overflow-hidden rounded-2xl border border-blue-800 bg-gradient-to-br from-blue-800 via-blue-700 to-blue-600 text-white">
          <div className="space-y-5 px-5 py-6 sm:px-6">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-100">Uebersicht</p>
              <h1 className="text-3xl font-semibold sm:text-4xl">Hallo {user.email?.split("@")[0] ?? "Pferdehalter"}!</h1>
              <p className="max-w-3xl text-sm text-blue-50 sm:text-base">
                Hier siehst du sofort, wie viele Pferde aktiv sind und welche neuen Anfragen auf deine Freigabe oder Antwort warten.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-semibold text-blue-800 hover:bg-blue-50" href="/owner/horses">
                Neues Pferd anlegen
              </Link>
              <Link className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-blue-300/60 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10" href="/owner/pferde-verwalten">
                Pferde verwalten
              </Link>
              <Link className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-blue-300/60 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10" href="/owner/anfragen">
                Anfragen ansehen
              </Link>
            </div>
          </div>
        </section>
        <Notice text={message} tone="success" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <p className="text-sm font-semibold text-stone-500">Pferdeprofile</p>
            <p className="mt-3 text-4xl font-semibold text-blue-800">{ownerHorses.length}</p>
            <p className="mt-2 text-sm text-stone-600">Insgesamt angelegte Pferdeprofile.</p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <p className="text-sm font-semibold text-stone-500">Aktiv</p>
            <p className="mt-3 text-4xl font-semibold text-blue-800">{activeHorseCount}</p>
            <p className="mt-2 text-sm text-stone-600">{inactiveHorseCount} inaktiv oder noch nicht veroeffentlicht.</p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <p className="text-sm font-semibold text-stone-500">Neue Anfragen</p>
            <p className="mt-3 text-4xl font-semibold text-blue-800">{pendingRequestsTotal}</p>
            <p className="mt-2 text-sm text-stone-600">
              {pendingTrialRequests.length} Probetermin-Anfragen und {pendingBookingRequests.length} Terminanfragen warten auf dich.
            </p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <p className="text-sm font-semibold text-stone-500">Premium</p>
            <p className="mt-3 text-lg font-semibold text-stone-900">{profile.is_premium ? "Aktiv" : "Nicht aktiv"}</p>
            <p className="mt-2 text-sm text-stone-600">Mit Premium lassen sich Verfuegbarkeiten und Buchungsanfragen freischalten.</p>
          </div>
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
          <section className="rounded-2xl border border-stone-200 bg-white p-5">
            <div className="flex flex-col gap-3 border-b border-stone-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-stone-900">Meine Pferde</h2>
                <p className="mt-1 text-sm text-stone-600">Die letzten Pferdeprofile mit Status und direktem Einstieg in die Verwaltung.</p>
              </div>
              <Link className="inline-flex min-h-[44px] items-center rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-900 hover:border-blue-700 hover:text-blue-800" href="/owner/pferde-verwalten">
                Alle anzeigen
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {recentHorses.length === 0 ? (
                <p className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-600">Du hast noch kein Pferd angelegt.</p>
              ) : (
                recentHorses.map((horse) => (
                  <div className="rounded-xl border border-stone-200 p-4" key={horse.id}>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="space-y-1">
                        <p className="font-semibold text-stone-900">{horse.title}</p>
                        <p className="text-sm text-stone-600">PLZ {horse.plz}</p>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${horse.active ? "bg-emerald-100 text-emerald-700" : "bg-stone-200 text-stone-700"}`}>
                          {horse.active ? "Aktiv" : "Inaktiv"}
                        </span>
                        <Link className="inline-flex min-h-[44px] items-center rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800" href="/owner/pferde-verwalten">
                          Verwalten
                        </Link>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
          <section className="rounded-2xl border border-stone-200 bg-white p-5">
            <div className="flex flex-col gap-3 border-b border-stone-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-stone-900">Neue Anfragen</h2>
                <p className="mt-1 text-sm text-stone-600">Die wichtigsten offenen Punkte fuer heute.</p>
              </div>
              <Link className="inline-flex min-h-[44px] items-center rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-900 hover:border-blue-700 hover:text-blue-800" href="/owner/anfragen">
                Zur Liste
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {pendingRequestItems.length === 0 ? (
                <p className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-600">Aktuell gibt es keine neuen Anfragen.</p>
              ) : (
                pendingRequestItems.map((item, index) => (
                  <Link className="block rounded-xl border border-stone-200 p-4 hover:border-blue-700" href={item.href} key={`${item.label}-${item.created_at}-${index}`}>
                    <div className="space-y-2">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">{item.label}</p>
                          <p className="font-semibold text-stone-900">{item.horseTitle}</p>
                        </div>
                        <span className="text-xs font-semibold text-stone-500">{formatDate(item.created_at)}</span>
                      </div>
                      <p className="text-sm text-stone-600">{item.secondary}</p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>
        </div>
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
      <section className="overflow-hidden rounded-2xl border border-blue-800 bg-gradient-to-br from-blue-800 via-blue-700 to-blue-600 text-white">
        <div className="space-y-4 px-5 py-6 sm:px-6">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-100">Uebersicht</p>
          <h1 className="text-3xl font-semibold sm:text-4xl">Hallo {user.email?.split("@")[0] ?? "Reiter"}!</h1>
          <p className="max-w-3xl text-sm text-blue-50 sm:text-base">Behalte deine Probetermine und dein Profil in einer kompakten, mobil und am Desktop gut lesbaren Uebersicht im Blick.</p>
        </div>
      </section>
      <Notice text={message} tone="success" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <p className="text-sm font-semibold text-stone-500">Profilstatus</p>
          <p className="mt-3 text-lg font-semibold text-stone-900">{riderProfile ? "Bereit" : "Bitte vervollstaendigen"}</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <p className="text-sm font-semibold text-stone-500">Probetermin-Anfragen</p>
          <p className="mt-3 text-4xl font-semibold text-blue-800">{trials.length}</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <p className="text-sm font-semibold text-stone-500">Schnellzugriff</p>
          <Link className="mt-3 inline-flex min-h-[44px] items-center rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800" href="/rider/profile">
            Reiterprofil bearbeiten
          </Link>
        </div>
      </div>
      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="text-xl font-semibold text-stone-900">Neueste Probetermine</h2>
        <div className="mt-4 space-y-3">
          {trials.length === 0 ? (
            <p className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-600">Du hast noch keine Probetermin-Anfragen.</p>
          ) : (
            trials.map((trial) => (
              <div className="rounded-xl border border-stone-200 p-4" key={trial.id}>
                <div className="space-y-2">
                  <div>
                    <p className="font-semibold text-stone-900">Probetermin {trial.id.slice(0, 8)}</p>
                    <p className="text-sm text-stone-600">{trial.message ?? "Keine Nachricht hinterlegt."}</p>
                  </div>
                  <span className="inline-flex rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-blue-800">
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