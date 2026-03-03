import type { Route } from "next";
import Link from "next/link";

import { Notice } from "@/components/notice";
import { AppPageShell } from "@/components/ui/app-page-shell";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { HORSE_SELECT_FIELDS, getHorseAge } from "@/lib/horses";
import { readSearchParam } from "@/lib/search-params";
import type { Horse } from "@/types/database";

type SuchenPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

const RADIUS_OPTIONS = [10, 25, 50, 100] as const;

function isFiveDigitPlz(value: string) {
  return /^\d{5}$/.test(value);
}

function getPrefixLengthForRadius(radiusKm: number) {
  if (radiusKm <= 10) {
    return 5;
  }

  if (radiusKm <= 25) {
    return 4;
  }

  if (radiusKm <= 50) {
    return 3;
  }

  return 2;
}

function matchesPlzRadius(horsePlz: string, searchPlz: string, radiusKm: number) {
  if (!isFiveDigitPlz(horsePlz) || !isFiveDigitPlz(searchPlz)) {
    return false;
  }

  const prefixLength = getPrefixLengthForRadius(radiusKm);
  return horsePlz.slice(0, prefixLength) === searchPlz.slice(0, prefixLength);
}

export default async function SuchenPage({ searchParams }: SuchenPageProps) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const rawPlzFilter = readSearchParam(searchParams, "plz");
  const rawRadius = readSearchParam(searchParams, "radiusKm");
  const parsedRadius = rawRadius ? Number.parseInt(rawRadius, 10) : 25;
  const radiusKm = RADIUS_OPTIONS.includes(parsedRadius as (typeof RADIUS_OPTIONS)[number]) ? parsedRadius : 25;
  const invalidPlzFilter = typeof rawPlzFilter === "string" && rawPlzFilter.length > 0 && !isFiveDigitPlz(rawPlzFilter);
  const plzFilter = invalidPlzFilter ? null : rawPlzFilter ?? null;

  const { data: horsesData, error: horsesError } = await supabase
    .from("horses")
    .select(HORSE_SELECT_FIELDS)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(60);

  const allHorses = Array.isArray(horsesData) ? (horsesData as Horse[]) : [];
  const horses = plzFilter ? allHorses.filter((horse) => matchesPlzRadius(horse.plz, plzFilter, radiusKm)) : allHorses;
  const horsesLoadErrorMessage = horsesError ? `Pferdeprofile konnten nicht geladen werden: ${horsesError.message}` : null;

  return (
    <AppPageShell>
      <PageHeader
        backdropVariant="hero"
        subtitle="Finde Pferdeprofile, filtere nach einer vereinfachten PLZ-Umkreissuche und springe direkt in den Probetermin-Flow."
        surface
        title="Reitbeteiligung finden"
      />
      {!user ? <Notice text="Melde dich an, um einen Probetermin anzufragen und spaeter freigeschaltet zu werden." /> : null}
      {invalidPlzFilter ? <Notice text="Bitte gib fuer die Suche eine 5-stellige PLZ ein." tone="error" /> : null}
      <Notice text={horsesLoadErrorMessage} tone="error" />
      {horsesError ? (
        <Notice text="Die Pferdeprofile konnten derzeit nicht geladen werden. Bitte pruefe spaeter erneut oder oeffne /diagnose." tone="error" />
      ) : null}

      <SectionCard subtitle="Die Umkreissuche arbeitet aktuell als leichter PLZ-Bereichsfilter, bis echte Distanzdaten verfuegbar sind." title="PLZ-Umkreissuche">
        <form className="space-y-4" method="get">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_220px_auto] lg:items-end">
            <div>
              <label htmlFor="plz">PLZ</label>
              <input
                defaultValue={rawPlzFilter ?? ""}
                id="plz"
                inputMode="numeric"
                maxLength={5}
                minLength={5}
                name="plz"
                pattern="[0-9]{5}"
                placeholder="10115"
                type="text"
              />
            </div>
            <div>
              <label htmlFor="radiusKm">Umkreis</label>
              <select defaultValue={String(radiusKm)} id="radiusKm" name="radiusKm">
                {RADIUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option} km
                  </option>
                ))}
              </select>
            </div>
            <button className={buttonVariants("primary", "w-full lg:w-auto")} type="submit">
              Filter anwenden
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard subtitle="Alle aktuell aktiven Pferdeprofile mit den wichtigsten Basisdaten auf einen Blick." title="Pferdeprofile">
        {horsesError ? null : horses.length === 0 ? (
          <EmptyState
            description={plzFilter ? "Im gewaelten PLZ-Bereich sind aktuell keine passenden Pferdeprofile aktiv." : "Sobald neue Pferdeprofile veroeffentlicht werden, erscheinen sie hier automatisch."}
            title="Aktuell keine Pferdeprofile sichtbar"
          />
        ) : (
          <div className="space-y-4">
            {horses.map((horse) => {
              const age = getHorseAge(horse.birth_year ?? null);

              return (
                <Card className="p-5" key={horse.id}>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">Pferdeprofil</p>
                      <h2 className="text-xl font-semibold text-ink">{horse.title}</h2>
                      <p className="text-sm text-stone-600">PLZ {horse.plz}</p>
                      {horse.location_address ? <p className="text-sm text-stone-600">{horse.location_address}</p> : null}
                    </div>
                    <div className="grid gap-2 text-sm text-stone-600 sm:grid-cols-2 xl:grid-cols-3">
                      {horse.height_cm ? <div>Stockmass: {horse.height_cm} cm</div> : null}
                      {horse.breed ? <div>Rasse: {horse.breed}</div> : null}
                      {horse.color ? <div>Farbe: {horse.color}</div> : null}
                      {horse.sex ? <div>Geschlecht: {horse.sex}</div> : null}
                      {age !== null ? <div>Alter: {age} Jahre</div> : null}
                    </div>
                    <p className="text-sm leading-6 text-stone-600">{horse.description ?? "Noch keine Beschreibung vorhanden."}</p>
                    <Link className={buttonVariants("primary", "w-full sm:w-auto")} href={`/pferde/${horse.id}` as Route}>
                      Pferdeprofil ansehen
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </SectionCard>
    </AppPageShell>
  );
}
