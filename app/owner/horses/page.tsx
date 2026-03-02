import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { deleteHorseAction, deleteHorseImageAction, saveHorseAction, uploadHorseImagesAction } from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { HORSE_GESCHLECHTER, HORSE_IMAGE_SELECT_FIELDS, HORSE_SELECT_FIELDS, MAX_HORSE_IMAGES, getHorseImageUrl } from "@/lib/horses";
import { getProfileByUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { readSearchParam } from "@/lib/search-params";
import type { Horse, HorseImage } from "@/types/database";

type OwnerHorsesPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

type HorseImageWithUrl = HorseImage & {
  url: string;
};

const deletePrompt =
  "Moechtest du dieses Pferdeprofil wirklich loeschen? Alle Probetermine, Freischaltungen, Verfuegbarkeiten, Kalender-Sperren, Bilder und Chats werden mitgeloescht.";

export default async function OwnerHorsesPage({ searchParams }: OwnerHorsesPageProps) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  console.log("[owner/horses] auth user", user.id);

  const profile = await getProfileByUserId(supabase, user.id);

  if (!profile) {
    redirect("/onboarding");
  }

  if (profile.role !== "owner") {
    redirect("/dashboard");
  }

  const error = readSearchParam(searchParams, "error");
  const message = readSearchParam(searchParams, "message");
  const { data, error: horsesError } = await supabase
    .from("horses")
    .select(HORSE_SELECT_FIELDS)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  const horses = (data as Horse[] | null) ?? [];
  const horsesLoadErrorMessage = horsesError ? `Pferdeprofile konnten nicht geladen werden: ${horsesError.message}` : null;
  const horseIds = horses.map((horse) => horse.id);

  let horseImages: HorseImageWithUrl[] = [];

  if (horseIds.length > 0) {
    const { data: imageData } = await supabase
      .from("horse_images")
      .select(HORSE_IMAGE_SELECT_FIELDS)
      .in("horse_id", horseIds)
      .order("created_at", { ascending: true });

    const images = (imageData as HorseImage[] | null) ?? [];
    horseImages = images.map((image) => ({
      ...image,
      url: getHorseImageUrl(supabase, image.storage_path)
    }));
  }

  const imageMap = new Map<string, HorseImageWithUrl[]>();

  horseImages.forEach((image) => {
    const existing = imageMap.get(image.horse_id) ?? [];
    existing.push(image);
    imageMap.set(image.horse_id, existing);
  });

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-clay">Inserat</p>
        <h1 className="text-3xl font-semibold text-forest sm:text-4xl">Pferdeprofil anlegen</h1>
        <p className="text-sm text-stone-600 sm:text-base">Bearbeite dein Pferdeprofil in einer mobilen Einspaltenansicht ohne horizontales Scrollen.</p>
      </div>
      <Notice text={error} tone="error" />
      <Notice text={horsesLoadErrorMessage} tone="error" />
      <Notice text={message} tone="success" />
      <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft sm:p-6">
        <h2 className="text-xl font-semibold text-ink">Neues Pferdeprofil</h2>
        <p className="mt-2 text-sm text-stone-600">Bilder kannst du nach dem ersten Speichern hinzufuegen.</p>
        <form action={saveHorseAction} className="mt-4 space-y-4">
          <div>
            <label htmlFor="title">Titel</label>
            <input id="title" name="title" placeholder="Freizeitpferd in Potsdam" required type="text" />
          </div>
          <div>
            <label htmlFor="plz">PLZ</label>
            <input id="plz" name="plz" placeholder="14467" required type="text" />
          </div>
          <div>
            <label htmlFor="stockmassCm">Stockmass (cm)</label>
            <input id="stockmassCm" min={1} name="stockmassCm" placeholder="165" type="number" />
          </div>
          <div>
            <label htmlFor="rasse">Rasse</label>
            <input id="rasse" name="rasse" placeholder="Hannoveraner" type="text" />
          </div>
          <div>
            <label htmlFor="farbe">Farbe</label>
            <input id="farbe" name="farbe" placeholder="Brauner" type="text" />
          </div>
          <div>
            <label htmlFor="geschlecht">Geschlecht</label>
            <select defaultValue="" id="geschlecht" name="geschlecht">
              <option value="">Bitte waehlen</option>
              {HORSE_GESCHLECHTER.map((geschlecht) => (
                <option key={geschlecht} value={geschlecht}>
                  {geschlecht.charAt(0).toUpperCase() + geschlecht.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="alter">Alter</label>
            <input id="alter" min={1} name="alter" placeholder="12" type="number" />
          </div>
          <div>
            <label htmlFor="description">Beschreibung</label>
            <textarea id="description" name="description" placeholder="Beschreibe Erfahrung, Tage und den gewuenschten Ablauf fuer den Probetermin." rows={5} />
          </div>
          <label className="flex min-h-[44px] items-center gap-3 rounded-2xl border border-stone-300 px-4 py-3 text-sm text-ink">
            <input className="h-4 w-4 rounded border-stone-300" defaultChecked name="active" type="checkbox" />
            Pferdeprofil veroeffentlichen
          </label>
          <SubmitButton idleLabel="Pferdeprofil speichern" pendingLabel="Wird gespeichert..." />
        </form>
      </section>
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-ink">Bestehende Pferdeprofile</h2>
        {horsesError ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            Die Pferdeprofile konnten derzeit nicht geladen werden. Bitte pruefe spaeter erneut oder oeffne /diagnose.
          </div>
        ) : horses.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-stone-300 bg-white p-5 text-sm text-stone-600">
            Noch kein Pferdeprofil vorhanden.
          </div>
        ) : (
          horses.map((horse) => {
            const images = imageMap.get(horse.id) ?? [];
            const imageCountLabel = `${images.length} / ${MAX_HORSE_IMAGES} Bilder`;

            return (
              <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft sm:p-6" key={horse.id}>
                <form action={saveHorseAction} className="space-y-4">
                  <input name="horseId" type="hidden" value={horse.id} />
                  <div>
                    <label htmlFor={`title-${horse.id}`}>Titel</label>
                    <input defaultValue={horse.title} id={`title-${horse.id}`} name="title" required type="text" />
                  </div>
                  <div>
                    <label htmlFor={`plz-${horse.id}`}>PLZ</label>
                    <input defaultValue={horse.plz} id={`plz-${horse.id}`} name="plz" required type="text" />
                  </div>
                  <div>
                    <label htmlFor={`stockmassCm-${horse.id}`}>Stockmass (cm)</label>
                    <input defaultValue={horse.stockmass_cm ?? ""} id={`stockmassCm-${horse.id}`} min={1} name="stockmassCm" type="number" />
                  </div>
                  <div>
                    <label htmlFor={`rasse-${horse.id}`}>Rasse</label>
                    <input defaultValue={horse.rasse ?? ""} id={`rasse-${horse.id}`} name="rasse" type="text" />
                  </div>
                  <div>
                    <label htmlFor={`farbe-${horse.id}`}>Farbe</label>
                    <input defaultValue={horse.farbe ?? ""} id={`farbe-${horse.id}`} name="farbe" type="text" />
                  </div>
                  <div>
                    <label htmlFor={`geschlecht-${horse.id}`}>Geschlecht</label>
                    <select defaultValue={horse.geschlecht ?? ""} id={`geschlecht-${horse.id}`} name="geschlecht">
                      <option value="">Bitte waehlen</option>
                      {HORSE_GESCHLECHTER.map((geschlecht) => (
                        <option key={geschlecht} value={geschlecht}>
                          {geschlecht.charAt(0).toUpperCase() + geschlecht.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`alter-${horse.id}`}>Alter</label>
                    <input defaultValue={horse.alter ?? ""} id={`alter-${horse.id}`} min={1} name="alter" type="number" />
                  </div>
                  <div>
                    <label htmlFor={`description-${horse.id}`}>Beschreibung</label>
                    <textarea defaultValue={horse.description ?? ""} id={`description-${horse.id}`} name="description" rows={5} />
                  </div>
                  <label className="flex min-h-[44px] items-center gap-3 rounded-2xl border border-stone-300 px-4 py-3 text-sm text-ink">
                    <input className="h-4 w-4 rounded border-stone-300" defaultChecked={horse.active} name="active" type="checkbox" />
                    Pferdeprofil veroeffentlichen
                  </label>
                  <SubmitButton idleLabel="Pferdeprofil aktualisieren" pendingLabel="Wird aktualisiert..." />
                </form>
                <Link
                  className="mt-4 inline-flex min-h-[44px] items-center text-sm font-semibold text-forest hover:text-clay"
                  href={`/pferde/${horse.id}/kalender` as Route}
                >
                  Kalender verwalten
                </Link>
                <div className="mt-4 border-t border-stone-200 pt-4">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-ink">Bilder</p>
                    <p className="text-sm text-stone-600">{imageCountLabel}. Du kannst maximal {MAX_HORSE_IMAGES} Bilder hochladen.</p>
                  </div>
                  {images.length > 0 ? (
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      {images.map((image, index) => (
                        <div className="space-y-2" key={image.id}>
                          <img
                            alt={`Pferdebild ${index + 1} von ${horse.title}`}
                            className="h-28 w-full rounded-2xl border border-stone-200 object-cover"
                            loading="lazy"
                            src={image.url}
                          />
                          <form action={deleteHorseImageAction}>
                            <input name="imageId" type="hidden" value={image.id} />
                            <ConfirmSubmitButton
                              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-ink hover:border-forest hover:text-forest disabled:cursor-not-allowed disabled:opacity-70"
                              confirmMessage="Moechtest du dieses Bild wirklich entfernen?"
                              idleLabel="Bild entfernen"
                              pendingLabel="Wird entfernt..."
                            />
                          </form>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-2xl border border-dashed border-stone-300 bg-sand p-4 text-sm text-stone-600">
                      Noch keine Bilder hochgeladen.
                    </div>
                  )}
                  <form action={uploadHorseImagesAction} className="mt-4 space-y-3" encType="multipart/form-data">
                    <input name="horseId" type="hidden" value={horse.id} />
                    <div>
                      <label htmlFor={`images-${horse.id}`}>Bilder hochladen</label>
                      <input accept="image/*" id={`images-${horse.id}`} multiple name="images" type="file" />
                    </div>
                    <SubmitButton idleLabel="Bilder speichern" pendingLabel="Wird hochgeladen..." />
                  </form>
                </div>
                <div className="mt-4 border-t border-stone-200 pt-4">
                  <p className="text-sm text-stone-600">Dieses Pferdeprofil wird inklusive aller zugehoerigen Anfragen, Freischaltungen, Verfuegbarkeiten, Kalender-Sperren, Bilder und Chats geloescht.</p>
                  <form action={deleteHorseAction} className="mt-3">
                    <input name="horseId" type="hidden" value={horse.id} />
                    <ConfirmSubmitButton
                      className="inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-rose-300 bg-white px-5 py-3 text-base font-semibold text-rose-700 hover:border-rose-400 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-70"
                      confirmMessage={deletePrompt}
                      idleLabel="Pferdeprofil loeschen"
                      pendingLabel="Wird geloescht..."
                    />
                  </form>
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
