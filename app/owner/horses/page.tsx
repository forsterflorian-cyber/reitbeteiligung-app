import type { Route } from "next";
import Link from "next/link";

import { saveHorseAction } from "@/app/actions";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { requireProfile } from "@/lib/auth";
import { HORSE_GESCHLECHTER } from "@/lib/horses";
import { readSearchParam } from "@/lib/search-params";

export default async function OwnerHorsesPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { supabase, user } = await requireProfile("owner");
  const currentYear = new Date().getFullYear();
  const error = readSearchParam(searchParams, "error");
  const message = readSearchParam(searchParams, "message");
  const { count } = await supabase.from("horses").select("id", { count: "exact", head: true }).eq("owner_id", user.id);
  const manageHref = "/owner/pferde-verwalten" as Route;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-clay">Pferdehalter</p>
        <h1 className="text-3xl font-semibold text-forest sm:text-4xl">Neues Pferd anlegen</h1>
        <p className="text-sm text-stone-600 sm:text-base">
          Lege hier ein neues Pferdeprofil an. Bestehende Pferde verwaltest du getrennt in der Uebersicht fuer deine Pferde.
        </p>
      </div>
      <Notice text={error} tone="error" />
      <Notice text={message} tone="success" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
          <h2 className="text-xl font-semibold text-ink">Pferdeprofil</h2>
          <p className="mt-2 text-sm text-stone-600">Bilder und weitere Pflegeoptionen stehen direkt nach dem ersten Speichern zur Verfuegung.</p>
          <form action={saveHorseAction} className="mt-5 space-y-4">
            <div>
              <label htmlFor="title">Titel</label>
              <input id="title" name="title" placeholder="Freizeitpferd in Potsdam" required type="text" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="plz">PLZ</label>
                <input id="plz" name="plz" placeholder="14467" required type="text" />
              </div>
              <div>
                <label htmlFor="heightCm">Stockmass (cm)</label>
                <input id="heightCm" max={220} min={50} name="heightCm" placeholder="165" type="number" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="breed">Rasse</label>
                <input id="breed" name="breed" placeholder="Hannoveraner" type="text" />
              </div>
              <div>
                <label htmlFor="color">Farbe</label>
                <input id="color" name="color" placeholder="Brauner" type="text" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="sex">Geschlecht</label>
                <select defaultValue="" id="sex" name="sex">
                  <option value="">Bitte waehlen</option>
                  {HORSE_GESCHLECHTER.map((geschlecht) => (
                    <option key={geschlecht} value={geschlecht}>
                      {geschlecht.charAt(0).toUpperCase() + geschlecht.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="birthYear">Geburtsjahr</label>
                <input id="birthYear" max={currentYear} min={1980} name="birthYear" placeholder="2014" type="number" />
              </div>
            </div>
            <div>
              <label htmlFor="description">Beschreibung</label>
              <textarea id="description" name="description" placeholder="Beschreibe Charakter, Tagesablauf und Wunsch an eine Reitbeteiligung." rows={5} />
            </div>
            <label className="flex min-h-[44px] items-center gap-3 rounded-xl border border-stone-300 px-4 py-3 text-sm text-ink">
              <input className="h-4 w-4 rounded border-stone-300" defaultChecked name="active" type="checkbox" />
              Pferdeprofil direkt veroeffentlichen
            </label>
            <SubmitButton idleLabel="Pferdeprofil speichern" pendingLabel="Wird gespeichert..." />
          </form>
        </section>
        <aside className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-clay">Naechster Schritt</p>
            <h2 className="mt-2 text-xl font-semibold text-ink">Pferde verwalten</h2>
          </div>
          <p className="text-sm text-stone-600">
            {count && count > 0
              ? `Du hast aktuell ${count} Pferdeprofil${count === 1 ? "" : "e"} angelegt.`
              : "Du hast aktuell noch kein Pferdeprofil angelegt."}
          </p>
          <p className="text-sm text-stone-600">Dort findest du eine strukturierte Liste mit Basisinfos, Bearbeiten, Loeschen, Kalender und Bildverwaltung.</p>
          <Link className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-stone-300 px-4 py-3 text-sm font-semibold text-ink hover:border-forest hover:text-forest" href={manageHref}>
            Zu Pferde verwalten
          </Link>
        </aside>
      </div>
    </div>
  );
}