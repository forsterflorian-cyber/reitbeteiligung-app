import type { Route } from "next";
import Link from "next/link";

import { Notice } from "@/components/notice";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { buttonVariants } from "@/components/ui/button";
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
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        subtitle="Hier findest du freigeschaltete Pferdeprofile und kommst direkt zur Anfrage für deinen Probetermin."
        title="Reitbeteiligung finden"
      />
      {!user ? <Notice text="Melde dich an, um einen Probetermin anzufragen und später freigeschaltet zu werden." /> : null}
      <Notice text={horsesLoadErrorMessage} tone="error" />
      {horsesError ? (
        <Notice text="Die Pferdeprofile konnten derzeit nicht geladen werden. Bitte prüfe später erneut oder öffne /diagnose." tone="error" />
      ) : null}
      <SectionCard subtitle="Alle aktuell aktiven Pferdeprofile mit den wichtigsten Basisdaten auf einen Blick." title="Pferdeprofile">
        {horsesError ? null : horses.length === 0 ? (
          <EmptyState
            description="Sobald neue Pferdeprofile veröffentlicht werden, erscheinen sie hier automatisch."
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
                    </div>
                    <div className="grid gap-2 text-sm text-stone-600 sm:grid-cols-2 xl:grid-cols-3">
                      {horse.height_cm ? <div>Stockmaß: {horse.height_cm} cm</div> : null}
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
    </div>
  );
}