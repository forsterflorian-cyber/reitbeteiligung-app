import type { Route } from "next";
import Link from "next/link";

import { saveHorseAction } from "@/app/actions";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { buttonVariants } from "@/components/ui/button";
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
  const existingCount = count ?? 0;

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        actions={
          <Link className={buttonVariants("secondary", "w-full sm:w-auto")} href={manageHref}>
            Zu Pferde verwalten
          </Link>
        }
        subtitle="Lege hier ein neues Pferdeprofil an. Bestehende Pferde verwaltest du getrennt in deiner Übersicht."
        title="Neues Pferd anlegen"
      />
      <Notice text={error} tone="error" />
      <Notice text={message} tone="success" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <SectionCard
          subtitle="Bilder und weitere Pflegeoptionen stehen direkt nach dem ersten Speichern zur Verfügung."
          title="Pferdeprofil"
        >
          <form action={saveHorseAction} className="space-y-4">
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
                <label htmlFor="heightCm">Stockmaß (cm)</label>
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
                  <option value="">Bitte wählen</option>
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
              Pferdeprofil direkt veröffentlichen
            </label>
            <SubmitButton idleLabel="Pferdeprofil speichern" pendingLabel="Wird gespeichert..." />
          </form>
        </SectionCard>
        <SectionCard subtitle="So geht es direkt nach dem ersten Speichern weiter." title="Nächster Schritt">
          <div className="space-y-4 text-sm leading-6 text-stone-600">
            <p>
              {existingCount > 0
                ? `Du hast aktuell ${existingCount} Pferdeprofil${existingCount === 1 ? "" : "e"} angelegt.`
                : "Du hast aktuell noch kein Pferdeprofil angelegt."}
            </p>
            <p>Dort findest du eine strukturierte Liste mit Basisinfos, Bearbeiten, Löschen, Kalender und Bildverwaltung.</p>
            <Link className={buttonVariants("secondary", "w-full")} href={manageHref}>
              Zu Pferde verwalten
            </Link>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}