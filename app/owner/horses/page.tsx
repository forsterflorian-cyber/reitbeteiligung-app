import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { deleteHorseAction, deleteHorseImageAction, saveHorseAction, uploadHorseImagesAction } from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { getProfileByUserId } from "@/lib/auth";
import {
  HORSE_GESCHLECHTER,
  HORSE_IMAGE_SELECT_FIELDS,
  HORSE_SELECT_FIELDS,
  MAX_HORSE_IMAGES,
  getHorseAge,
  getHorseImageUrl,
  sortHorseImages
} from "@/lib/horses";
import { readSearchParam } from "@/lib/search-params";
import { createClient } from "@/lib/supabase/server";
import type { Horse, HorseImage } from "@/types/database";

type OwnerHorsesPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

type HorseImageWithUrl = HorseImage & {
  url: string;
};

const deletePrompt =
  "Moechtest du dieses Pferdeprofil wirklich loeschen? Bilder werden entfernt. Weitere Anfragen, Freischaltungen, Verfuegbarkeiten, Kalender-Sperren und Chats werden je nach Datenlage mitgeloescht oder blockieren das Loeschen.";

export default async function OwnerHorsesPage({ searchParams }: OwnerHorsesPageProps) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getProfileByUserId(supabase, user.id);

  if (!profile) {
    redirect("/onboarding");
  }

  if (profile.role !== "owner") {
    redirect("/dashboard");
  }

  const currentYear = new Date().getFullYear();
  const error = readSearchParam(searchParams, "error");
  const message = readSearchParam(searchParams, "message");
  const { data: horsesData, error: horsesError } = await supabase
    .from("horses")
    .select(HORSE_SELECT_FIELDS)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  const horses = Array.isArray(horsesData) ? (horsesData as Horse[]) : [];
  const horsesLoadErrorMessage = horsesError ? `Pferdeprofile konnten nicht geladen werden: ${horsesError.message}` : null;
  const horseIds = horses.map((horse) => horse.id);

  let horseImages: HorseImageWithUrl[] = [];
  let horseImagesErrorMessage: string | null = null;

  if (horseIds.length > 0) {
    const { data: imageData, error: imageError } = await supabase
      .from("horse_images")
      .select(HORSE_IMAGE_SELECT_FIELDS)
      .in("horse_id", horseIds)
      .order("created_at", { ascending: true });

    if (imageError) {
      horseImagesErrorMessage = `Pferdebilder konnten nicht geladen werden: ${imageError.message}`;
    }

    const images = sortHorseImages(
      (Array.isArray(imageData) ? (imageData as HorseImage[]) : []).filter(
        (image): image is HorseImage => Boolean((image.path ?? image.storage_path) && image.id)
      )
    );

    const resolvedImages = await Promise.all(
      images.map(async (image) => {
        const url = await getHorseImageUrl(supabase, image.path ?? image.storage_path ?? null);
        return url ? { ...image, url } : null;
      })
    );

    horseImages = resolvedImages.filter((image): image is HorseImageWithUrl => Boolean(image));
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
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-clay">Verwaltung</p>
        <h1 className="text-3xl font-semibold text-forest sm:text-4xl">Pferdeprofil anlegen</h1>
        <p className="text-sm text-stone-600 sm:text-base">Verwalte deine Pferdeprofile in einer stabilen Einspaltenansicht mit klaren Aktionen fuer Bearbeiten, Bilder und Loeschen.</p>
      </div>
      <Notice text={error} tone="error" />
      <Notice text={horsesLoadErrorMessage} tone="error" />
      <Notice text={horseImagesErrorMessage} tone="error" />
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
            <label htmlFor="heightCm">Stockmass (cm)</label>
            <input id="heightCm" max={220} min={50} name="heightCm" placeholder="165" type="number" />
          </div>
          <div>
            <label htmlFor="breed">Rasse</label>
            <input id="breed" name="breed" placeholder="Hannoveraner" type="text" />
          </div>
          <div>
            <label htmlFor="color">Farbe</label>
            <input id="color" name="color" placeholder="Brauner" type="text" />
          </div>
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
            Noch kein Pferd angelegt.
          </div>
        ) : (
          horses.map((horse) => {
            const images = imageMap.get(horse.id) ?? [];
            const primaryImage = images[0]?.url ?? null;
            const imageCountLabel = `${images.length} / ${MAX_HORSE_IMAGES} Bilder`;
            const age = getHorseAge(horse.birth_year ?? null);
            const editAnchor = `#bearbeiten-${horse.id}`;
            const deleteAnchor = `#loeschen-${horse.id}`;
            const imagesAtLimit = images.length >= MAX_HORSE_IMAGES;

            return (
              <article className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft sm:p-6" key={horse.id}>
                {primaryImage ? (
                  <img alt={horse.title} className="h-44 w-full rounded-3xl object-cover" src={primaryImage} />
                ) : (
                  <div className="flex h-44 items-center justify-center rounded-3xl border border-dashed border-stone-300 bg-sand text-sm font-semibold text-stone-500">
                    Kein Bild hinterlegt
                  </div>
                )}
                <div className="mt-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">Pferdeprofil</p>
                      <h3 className="mt-1 text-xl font-semibold text-ink">{horse.title}</h3>
                      <p className="mt-1 text-sm text-stone-600">PLZ {horse.plz}</p>
                    </div>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${horse.active ? "bg-emerald-100 text-emerald-800" : "bg-stone-200 text-stone-700"}`}>
                      {horse.active ? "Aktiv" : "Inaktiv"}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 text-sm text-stone-600 sm:grid-cols-2">
                    <div>{horse.height_cm ? `Stockmass: ${horse.height_cm} cm` : "Stockmass: offen"}</div>
                    <div>{horse.breed ? `Rasse: ${horse.breed}` : "Rasse: offen"}</div>
                    <div>{horse.color ? `Farbe: ${horse.color}` : "Farbe: offen"}</div>
                    <div>{horse.sex ? `Geschlecht: ${horse.sex}` : "Geschlecht: offen"}</div>
                    <div>{age !== null ? `Alter: ${age} Jahre` : "Alter: offen"}</div>
                    <div>{imageCountLabel}</div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <a className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-stone-300 px-4 py-2 text-sm font-semibold text-ink hover:border-forest hover:text-forest" href={editAnchor}>
                      Bearbeiten
                    </a>
                    <a className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:border-rose-400 hover:bg-rose-50" href={deleteAnchor}>
                      Loeschen
                    </a>
                    <Link
                      className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-stone-300 px-4 py-2 text-sm font-semibold text-ink hover:border-forest hover:text-forest"
                      href={`/pferde/${horse.id}/kalender` as Route}
                    >
                      Kalender
                    </Link>
                  </div>
                </div>
                <div className="mt-5 border-t border-stone-200 pt-4" id={`bearbeiten-${horse.id}`}>
                  <p className="text-sm font-semibold text-ink">Bearbeiten</p>
                  <form action={saveHorseAction} className="mt-3 space-y-4">
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
                      <label htmlFor={`heightCm-${horse.id}`}>Stockmass (cm)</label>
                      <input defaultValue={horse.height_cm ?? ""} id={`heightCm-${horse.id}`} max={220} min={50} name="heightCm" type="number" />
                    </div>
                    <div>
                      <label htmlFor={`breed-${horse.id}`}>Rasse</label>
                      <input defaultValue={horse.breed ?? ""} id={`breed-${horse.id}`} name="breed" type="text" />
                    </div>
                    <div>
                      <label htmlFor={`color-${horse.id}`}>Farbe</label>
                      <input defaultValue={horse.color ?? ""} id={`color-${horse.id}`} name="color" type="text" />
                    </div>
                    <div>
                      <label htmlFor={`sex-${horse.id}`}>Geschlecht</label>
                      <select defaultValue={horse.sex ?? ""} id={`sex-${horse.id}`} name="sex">
                        <option value="">Bitte waehlen</option>
                        {HORSE_GESCHLECHTER.map((geschlecht) => (
                          <option key={geschlecht} value={geschlecht}>
                            {geschlecht.charAt(0).toUpperCase() + geschlecht.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`birthYear-${horse.id}`}>Geburtsjahr</label>
                      <input defaultValue={horse.birth_year ?? ""} id={`birthYear-${horse.id}`} max={currentYear} min={1980} name="birthYear" type="number" />
                    </div>
                    <div>
                      <label htmlFor={`description-${horse.id}`}>Beschreibung</label>
                      <textarea defaultValue={horse.description ?? ""} id={`description-${horse.id}`} name="description" rows={5} />
                    </div>
                    <label className="flex min-h-[44px] items-center gap-3 rounded-2xl border border-stone-300 px-4 py-3 text-sm text-ink">
                      <input className="h-4 w-4 rounded border-stone-300" defaultChecked={horse.active} name="active" type="checkbox" />
                      Pferdeprofil veroeffentlichen
                    </label>
                    <SubmitButton idleLabel="Aenderungen speichern" pendingLabel="Wird aktualisiert..." />
                  </form>
                </div>
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
                  {imagesAtLimit ? (
                    <div className="mt-4 rounded-2xl border border-stone-200 bg-sand px-4 py-3 text-sm text-stone-600">
                      Die maximale Anzahl von {MAX_HORSE_IMAGES} Bildern ist erreicht.
                    </div>
                  ) : (
                    <form action={uploadHorseImagesAction} className="mt-4 space-y-3" encType="multipart/form-data">
                      <input name="horseId" type="hidden" value={horse.id} />
                      <div>
                        <label htmlFor={`images-${horse.id}`}>Bilder hochladen</label>
                        <input accept="image/*" id={`images-${horse.id}`} multiple name="images" type="file" />
                      </div>
                      <SubmitButton idleLabel="Bilder speichern" pendingLabel="Wird hochgeladen..." />
                    </form>
                  )}
                </div>
                <div className="mt-4 border-t border-stone-200 pt-4" id={`loeschen-${horse.id}`}>
                  <p className="text-sm font-semibold text-ink">Loeschen</p>
                  <p className="mt-2 text-sm text-stone-600">Beim Loeschen werden vorhandene Bilder entfernt. Bestehende Abhaengigkeiten koennen das Loeschen blockieren.</p>
                  <form action={deleteHorseAction} className="mt-3">
                    <input name="horseId" type="hidden" value={horse.id} />
                    <ConfirmSubmitButton
                      className="inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-rose-300 bg-white px-5 py-3 text-base font-semibold text-rose-700 hover:border-rose-400 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-70"
                      confirmMessage={deletePrompt}
                      idleLabel="Pferd loeschen"
                      pendingLabel="Wird geloescht..."
                    />
                  </form>
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}