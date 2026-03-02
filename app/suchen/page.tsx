import type { Route } from "next";
import Link from "next/link";

import { Notice } from "@/components/notice";
import { createClient } from "@/lib/supabase/server";
import { HORSE_SELECT_FIELDS, getHorseAge } from "@/lib/horses";
import type { Horse } from "@/types/database";

export default async function SuchenPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const { data: horsesData, error: horsesError } = await supabase
    .from("horses")
    .select(HORSE_SELECT_FIELDS)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(8);

  const horses = Array.isArray(horsesData) ? (horsesData as Horse[]) : [];
  const horsesLoadErrorMessage = horsesError ? `Pferdeprofile konnten nicht geladen werden: ${horsesError.message}` : null;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-clay">Suchen</p>
        <h1 className="text-3xl font-semibold text-forest sm:text-4xl">Reitbeteiligung finden</h1>
        <p className="text-sm text-stone-600 sm:text-base">Hier findest du freigeschaltete Pferdeprofile und kommst direkt zur Anfrage fuer deinen Probetermin.</p>
      </div>
      {!user ? <Notice text="Melde dich an, um einen Probetermin anzufragen und spaeter freigeschaltet zu werden." /> : null}
      <Notice text={horsesLoadErrorMessage} tone="error" />
      <div className="space-y-3">
        {horsesError ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            Die Pferdeprofile konnten derzeit nicht geladen werden. Bitte pruefe spaeter erneut oder oeffne /diagnose.
          </div>
        ) : horses.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-stone-300 bg-white p-5 text-sm text-stone-600">
            Aktuell sind keine freigeschalteten Reitbeteiligungen sichtbar.
          </div>
        ) : (
          horses.map((horse) => {
            const age = getHorseAge(horse.birth_year ?? null);

            return (
              <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft" key={horse.id}>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">Pferdeprofil</p>
                    <h2 className="mt-1 text-xl font-semibold text-ink">{horse.title}</h2>
                    <p className="mt-1 text-sm text-stone-600">PLZ {horse.plz}</p>
                  </div>
                  <div className="space-y-1 text-sm text-stone-600">
                    {horse.height_cm ? <div>Stockmass: {horse.height_cm} cm</div> : null}
                    {horse.breed ? <div>Rasse: {horse.breed}</div> : null}
                    {horse.color ? <div>Farbe: {horse.color}</div> : null}
                    {horse.sex ? <div>Geschlecht: {horse.sex}</div> : null}
                    {age !== null ? <div>Alter: {age} Jahre</div> : null}
                  </div>
                  <p className="text-sm text-stone-600">{horse.description ?? "Noch keine Beschreibung vorhanden."}</p>
                  <Link
                    className="inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl bg-forest px-4 py-3 text-sm font-semibold text-white hover:bg-forest/90"
                    href={`/pferde/${horse.id}` as Route}
                  >
                    Pferdeprofil ansehen
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}