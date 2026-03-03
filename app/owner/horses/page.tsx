import type { Route } from "next";
import Link from "next/link";

import { saveHorseAction, startOwnerTrialAction } from "@/app/actions";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { AppPageShell } from "@/components/ui/app-page-shell";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { requireProfile } from "@/lib/auth";
import { HORSE_GESCHLECHTER } from "@/lib/horses";
import { PAID_PLAN_CONTACT_EMAIL, canStartOwnerTrial, getOwnerPlan, getOwnerPlanUsage, getOwnerPlanUsageSummary } from "@/lib/plans";
import { readSearchParam } from "@/lib/search-params";

export default async function OwnerHorsesPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { profile, supabase, user } = await requireProfile("owner");
  const currentYear = new Date().getFullYear();
  const error = readSearchParam(searchParams, "error");
  const message = readSearchParam(searchParams, "message");
  const ownerPlanUsage = await getOwnerPlanUsage(supabase, user.id);
  const ownerPlan = getOwnerPlan(profile, ownerPlanUsage);
  const ownerPlanUsageSummary = getOwnerPlanUsageSummary(ownerPlan, ownerPlanUsage);
  const showStartTrial = canStartOwnerTrial(profile);
  const manageHref = "/owner/pferde-verwalten" as Route;
  const upgradeHref = `mailto:${PAID_PLAN_CONTACT_EMAIL}?subject=${encodeURIComponent("Bezahlten Tarif anfragen")}`;

  return (
    <AppPageShell>
      <PageHeader
        actions={
          <Link className={buttonVariants("secondary", "w-full sm:w-auto")} href={manageHref}>
            Zu Pferde verwalten
          </Link>
        }
        backdropVariant="hero"
        subtitle={"Lege hier ein neues Pferdeprofil an. Bestehende Pferde verwaltest du getrennt in deiner Übersicht."}
        surface
        title="Neues Pferd anlegen"
      />
      <Notice text={error} tone="error" />
      <Notice text={message} tone="success" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <SectionCard subtitle={"Bilder, Kalender und Detailpflege stehen direkt nach dem ersten Speichern zur Verfügung."} title="Pferdeprofil">
          <form action={saveHorseAction} className="space-y-4">
            <div>
              <label htmlFor="title">Titel</label>
              <input id="title" name="title" placeholder="Freizeitpferd in Potsdam" required type="text" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="plz">PLZ</label>
                <input id="plz" inputMode="numeric" maxLength={5} minLength={5} name="plz" pattern="[0-9]{5}" placeholder="14467" required type="text" />
              </div>
              <div>
                <label htmlFor="locationAddress">Genauer Standort</label>
                <input id="locationAddress" name="locationAddress" placeholder="Stallname, Straße oder Anfahrtspunkt" type="text" />
              </div>
            </div>
            <div>
              <label htmlFor="locationNotes">Hinweise zum Standort</label>
              <textarea
                id="locationNotes"
                name="locationNotes"
                placeholder="Parken, Treffpunkt, ÖPNV, Hallenzugang oder worauf man beim ersten Probetermin achten sollte."
                rows={3}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="heightCm">Stockmaß (cm)</label>
                <input id="heightCm" max={220} min={50} name="heightCm" placeholder="165" type="number" />
              </div>
              <div>
                <label htmlFor="breed">Rasse</label>
                <input id="breed" name="breed" placeholder="Hannoveraner" type="text" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="color">Farbe</label>
                <input id="color" name="color" placeholder="Brauner" type="text" />
              </div>
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
            </div>
            <div>
              <label htmlFor="birthYear">Geburtsjahr</label>
              <input id="birthYear" max={currentYear} min={1980} name="birthYear" placeholder="2014" type="number" />
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
        <SectionCard subtitle={"Dein aktueller Tarif und der nächste sinnvolle Schritt."} title={"Tarif & nächster Schritt"}>
          <div className="space-y-4 text-sm leading-6 text-stone-600">
            <div className="flex flex-wrap gap-2">
              <Badge tone={ownerPlan.key === "paid" ? "approved" : ownerPlan.key === "trial" ? "pending" : "neutral"}>{ownerPlan.label}</Badge>
            </div>
            <p>{ownerPlan.summary}</p>
            {ownerPlan.key !== "paid" ? <p>{ownerPlanUsageSummary}</p> : null}
            <p>Nach dem ersten Speichern findest du Bearbeiten, Kalender, Standort und Bilder in deiner Verwaltung.</p>
            <div className="flex flex-col gap-2">
              <Link className={buttonVariants("secondary", "w-full")} href={manageHref}>
                Zu Pferde verwalten
              </Link>
              {showStartTrial ? (
                <form action={startOwnerTrialAction}>
                  <input name="redirectTo" type="hidden" value="/owner/horses" />
                  <Button className="w-full" type="submit" variant="secondary">
                    Start Trial
                  </Button>
                </form>
              ) : null}
              {ownerPlan.key !== "paid" ? (
                <a className={buttonVariants(showStartTrial ? "ghost" : "secondary", "w-full")} href={upgradeHref}>
                  Bezahlten Tarif anfragen
                </a>
              ) : null}
            </div>
          </div>
        </SectionCard>
      </div>
    </AppPageShell>
  );
}
