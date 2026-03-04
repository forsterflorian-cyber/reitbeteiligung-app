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
import type { AvailabilityRule, Horse } from "@/types/database";

type SuchenPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

type HorseWithTrialInfo = Horse & {
  nextTrialSlot: AvailabilityRule | null;
  trialSlotCount: number;
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

function formatDateRange(startAt: string, endAt: string) {
  return `${new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(startAt))} bis ${new Intl.DateTimeFormat("de-DE", {
    timeStyle: "short"
  }).format(new Date(endAt))}`;
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
  const nowIso = new Date().toISOString();

  const [{ data: horsesData, error: horsesError }, { data: trialRulesData, error: trialRulesError }] = await Promise.all([
    supabase
      .from("horses")
      .select(HORSE_SELECT_FIELDS)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("availability_rules")
      .select("id, horse_id, slot_id, start_at, end_at, active, is_trial_slot, created_at")
      .eq("active", true)
      .eq("is_trial_slot", true)
      .gte("end_at", nowIso)
      .order("start_at", { ascending: true })
      .limit(240)
  ]);

  const allHorses = Array.isArray(horsesData) ? (horsesData as Horse[]) : [];
  const trialRules = (trialRulesData as AvailabilityRule[] | null) ?? [];
  const nextTrialSlotByHorse = new Map<string, AvailabilityRule>();
  const trialSlotCountByHorse = new Map<string, number>();

  trialRules.forEach((rule) => {
    if (!nextTrialSlotByHorse.has(rule.horse_id)) {
      nextTrialSlotByHorse.set(rule.horse_id, rule);
    }

    trialSlotCountByHorse.set(rule.horse_id, (trialSlotCountByHorse.get(rule.horse_id) ?? 0) + 1);
  });

  const horsesWithTrialSlots: HorseWithTrialInfo[] = allHorses
    .filter((horse) => nextTrialSlotByHorse.has(horse.id))
    .map((horse) => ({
      ...horse,
      nextTrialSlot: nextTrialSlotByHorse.get(horse.id) ?? null,
      trialSlotCount: trialSlotCountByHorse.get(horse.id) ?? 0
    }));

  const horses = plzFilter
    ? horsesWithTrialSlots.filter((horse) => matchesPlzRadius(horse.plz, plzFilter, radiusKm))
    : horsesWithTrialSlots;

  const loadError = horsesError ?? trialRulesError;
  const horsesLoadErrorMessage = loadError ? `Pferdeprofile konnten nicht geladen werden: ${loadError.message}` : null;

  return (
    <AppPageShell>
      <PageHeader
        backdropVariant="hero"
        subtitle="Hier erscheinen nur Pferde mit kommenden Probeterminen. So kommst du direkt in den Anfrage-Flow."
        surface
        title="Reitbeteiligung finden"
      />
      {!user ? <Notice text="Melde dich an, um einen Probetermin anzufragen und sp?ter freigeschaltet zu werden." /> : null}
      {invalidPlzFilter ? <Notice text="Bitte gib f?r die Suche eine 5-stellige PLZ ein." tone="error" /> : null}
      <Notice text={horsesLoadErrorMessage} tone="error" />
      {loadError ? (
        <Notice text="Die Pferdeprofile konnten derzeit nicht geladen werden. Bitte pr?fe sp?ter erneut oder ?ffne /diagnose." tone="error" />
      ) : null}

      <SectionCard subtitle="Die Umkreissuche arbeitet aktuell als leichter PLZ-Bereichsfilter, bis echte Distanzdaten verf?gbar sind." title="PLZ-Umkreissuche">
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

      <SectionCard subtitle="Nur Pferde mit mindestens einem kommenden Probetermin werden hier f?r R1 gelistet." title="Pferde mit Probeterminen">
        {loadError ? null : horses.length === 0 ? (
          <EmptyState
            description={plzFilter ? "Im gew?hlten PLZ-Bereich sind aktuell keine Pferde mit kommenden Probeterminen sichtbar." : "Sobald Pferdehalter neue Probetermine einstellen, erscheinen die Pferde hier automatisch."}
            title="Aktuell keine Probetermine sichtbar"
          />
        ) : (
          <div className="space-y-4">
            {horses.map((horse) => {
              const age = getHorseAge(horse.birth_year ?? null);
              const nextTrialSlot = horse.nextTrialSlot;
              const horseHref = `/pferde/${horse.id}` as Route;

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
                      {horse.height_cm ? <div>Stockma?: {horse.height_cm} cm</div> : null}
                      {horse.breed ? <div>Rasse: {horse.breed}</div> : null}
                      {horse.color ? <div>Farbe: {horse.color}</div> : null}
                      {horse.sex ? <div>Geschlecht: {horse.sex}</div> : null}
                      {age !== null ? <div>Alter: {age} Jahre</div> : null}
                    </div>
                    {nextTrialSlot ? (
                      <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
                        <p className="text-sm font-semibold text-stone-900">N?chster Probetermin</p>
                        <p className="mt-1 text-sm text-stone-600">{formatDateRange(nextTrialSlot.start_at, nextTrialSlot.end_at)}</p>
                        <p className="mt-1 text-xs text-stone-500">{horse.trialSlotCount} kommender Probetermin{horse.trialSlotCount === 1 ? "" : "e"} eingestellt.</p>
                      </div>
                    ) : null}
                    <p className="text-sm leading-6 text-stone-600">{horse.description ?? "Noch keine Beschreibung vorhanden."}</p>
                    <Link className={buttonVariants("primary", "w-full sm:w-auto")} href={horseHref}>
                      Probetermine ansehen
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
