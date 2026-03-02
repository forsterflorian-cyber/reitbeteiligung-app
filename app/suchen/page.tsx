import type { Route } from "next";
import Link from "next/link";

import { Notice } from "@/components/notice";
import { createClient } from "@/lib/supabase/server";
import { HORSE_IMAGE_SELECT_FIELDS, HORSE_SELECT_FIELDS, getHorseImageUrl } from "@/lib/horses";
import type { Horse, HorseImage } from "@/types/database";

function horseFacts(horse: Horse) {
  return [
    horse.stockmass_cm ? `${horse.stockmass_cm} cm` : null,
    horse.rasse,
    horse.farbe,
    horse.alter ? `${horse.alter} Jahre` : null
  ].filter((value): value is string => Boolean(value));
}

export default async function SuchenPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const { data } = await supabase
    .from("horses")
    .select(HORSE_SELECT_FIELDS)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(8);

  const horses = (data as Horse[] | null) ?? [];
  const horseIds = horses.map((horse) => horse.id);

  let imageMap = new Map<string, string>();

  if (horseIds.length > 0) {
    const { data: imageData } = await supabase
      .from("horse_images")
      .select(HORSE_IMAGE_SELECT_FIELDS)
      .in("horse_id", horseIds)
      .order("created_at", { ascending: true });

    const images = (imageData as HorseImage[] | null) ?? [];

    images.forEach((image) => {
      if (!imageMap.has(image.horse_id)) {
        imageMap.set(image.horse_id, getHorseImageUrl(supabase, image.storage_path));
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-clay">Suchen</p>
        <h1 className="text-3xl font-semibold text-forest sm:text-4xl">Reitbeteiligung finden</h1>
        <p className="text-sm text-stone-600 sm:text-base">Hier findest du freigeschaltete Pferdeprofile und kommst direkt zur Anfrage fuer deinen Probetermin.</p>
      </div>
      {!user ? <Notice text="Melde dich an, um einen Probetermin anzufragen und spaeter freigeschaltet zu werden." /> : null}
      <div className="space-y-3">
        {horses.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-stone-300 bg-white p-5 text-sm text-stone-600">
            Aktuell sind keine freigeschalteten Reitbeteiligungen sichtbar.
          </div>
        ) : (
          horses.map((horse) => {
            const imageUrl = imageMap.get(horse.id) ?? null;
            const facts = horseFacts(horse);

            return (
              <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft" key={horse.id}>
                <div className="space-y-3">
                  {imageUrl ? <img alt={horse.title} className="h-40 w-full rounded-3xl object-cover" src={imageUrl} /> : null}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">Pferdeprofil</p>
                    <h2 className="mt-1 text-xl font-semibold text-ink">{horse.title}</h2>
                    <p className="mt-1 text-sm text-stone-600">PLZ {horse.plz}</p>
                  </div>
                  {facts.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {facts.map((fact) => (
                        <span className="inline-flex rounded-full bg-sand px-3 py-1 text-xs font-semibold text-ink" key={fact}>
                          {fact}
                        </span>
                      ))}
                    </div>
                  ) : null}
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
