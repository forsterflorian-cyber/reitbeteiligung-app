import type { Route } from "next";
import Link from "next/link";

import { Notice } from "@/components/notice";
import { createClient } from "@/lib/supabase/server";
import { HORSE_IMAGE_SELECT_FIELDS, HORSE_SELECT_FIELDS, getHorseImageUrl } from "@/lib/horses";
import type { Horse, HorseImage } from "@/types/database";

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
  console.log("[suchen] horses length", horses.length);
  const horseIds = horses.map((horse) => horse.id);

  let imageMap = new Map<string, string>();

  if (horseIds.length > 0) {
    const { data: imageData } = await supabase
      .from("horse_images")
      .select(HORSE_IMAGE_SELECT_FIELDS)
      .in("horse_id", horseIds)
      .order("created_at", { ascending: true });

    const images = Array.isArray(imageData) ? (imageData as HorseImage[]) : [];

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
      <Notice text={horsesLoadErrorMessage} tone="error" />
      {horses.length > 0 ? (
        <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-soft">
          <p className="text-sm font-semibold text-ink">Direktliste</p>
          <div className="mt-3 flex flex-col gap-2">
            {horses.map((horse) => (
              <Link
                className="rounded-2xl border border-stone-200 px-4 py-3 text-sm font-semibold text-forest hover:border-forest/40 hover:text-clay"
                href={`/pferde/${horse.id}` as Route}
                key={horse.id}
              >
                {horse.title} - {horse.plz}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
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
            const imageUrl = imageMap.get(horse.id) ?? null;

            return (
              <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft" key={horse.id}>
                <div className="space-y-3">
                  {imageUrl ? <img alt={horse.title} className="h-40 w-full rounded-3xl object-cover" src={imageUrl} /> : null}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">Pferdeprofil</p>
                    <h2 className="mt-1 text-xl font-semibold text-ink">{horse.title}</h2>
                    <p className="mt-1 text-sm text-stone-600">PLZ {horse.plz}</p>
                  </div>
                  <div className="space-y-1 text-sm text-stone-600">
                    {horse.stockmass_cm ? <div>Stockmass: {horse.stockmass_cm} cm</div> : null}
                    {horse.rasse ? <div>Rasse: {horse.rasse}</div> : null}
                    {horse.farbe ? <div>Farbe: {horse.farbe}</div> : null}
                    {horse.alter ? <div>Alter: {horse.alter} Jahre</div> : null}
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
