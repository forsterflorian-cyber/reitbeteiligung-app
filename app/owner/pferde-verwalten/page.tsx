import type { Route } from "next";
import Link from "next/link";

import { deleteHorseAction, deleteHorseImageAction, saveHorseAction, uploadHorseImagesAction } from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { requireProfile } from "@/lib/auth";
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
import type { Horse, HorseImage } from "@/types/database";

type HorseImageWithUrl = HorseImage & {
  url: string;
};

const deletePrompt =
  "Moechtest du dieses Pferdeprofil wirklich loeschen? Bilder werden entfernt. Weitere Anfragen, Freischaltungen, Verfuegbarkeiten, Kalender-Sperren und Chats werden je nach Datenlage mitgeloescht oder blockieren das Loeschen.";

export default async function OwnerManageHorsesPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { supabase, user } = await requireProfile("owner");
  const managePath = "/owner/pferde-verwalten";
  const createPath = "/owner/horses" as Route;
  const error = readSearchParam(searchParams, "error");
  const message = readSearchParam(searchParams, "message");
  const editTarget = readSearchParam(searchParams, "edit");
  const currentYear = new Date().getFullYear();
  const { data: horsesData, error: horsesError } = await supabase
    .from("horses")
    .select(HORSE_SELECT_FIELDS)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  const horses = Array.isArray(horsesData) ? (horsesData as Horse[]) : [];
  const horseIds = horses.map((horse) => horse.id);
  const horsesLoadErrorMessage = horsesError ? `Pferdeprofile konnten nicht geladen werden: ${horsesError.message}` : null;

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
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-clay">Pferdehalter</p>
        <h1 className="text-3xl font-semibold text-forest sm:text-4xl">Pferde verwalten</h1>
        <p className="text-sm text-stone-600 sm:text-base">
          Hier siehst du alle angelegten Pferde mit Basisinfos und klaren Aktionen fuer Ansicht, Bearbeiten, Kalender und Loeschen.
        </p>
      </div>
      <Notice text={error} tone="error" />
      <Notice text={horsesLoadErrorMessage} tone="error" />
      <Notice text={horseImagesErrorMessage} tone="error" />
      <Notice text={message} tone="success" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-stone-600">{horses.length === 0 ? "Noch kein Pferd angelegt." : `${horses.length} Pferdeprofil${horses.length === 1 ? "" : "e"} vorhanden.`}</p>
        <Link className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-forest px-4 py-3 text-sm font-semibold text-white hover:bg-forest/90" href={createPath}>
          Neues Pferd anlegen
        </Link>
      </div>
      {horsesError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Die Pferdeprofile konnten derzeit nicht geladen werden. Bitte pruefe spaeter erneut oder oeffne /diagnose.
        </div>
      ) : horses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-5 text-sm text-stone-600">
          Noch kein Pferd angelegt. Lege zuerst ein neues Pferdeprofil an.
        </div>
      ) : (
        <div className="space-y-4">
          {horses.map((horse) => {
            const images = imageMap.get(horse.id) ?? [];
            const primaryImage = images[0]?.url ?? null;
            const age = getHorseAge(horse.birth_year ?? null);
            const imageCountLabel = `${images.length} / ${MAX_HORSE_IMAGES} Bilder`;
            const isEditing = editTarget === horse.id;
            const editPath = `${managePath}?edit=${horse.id}`;

            return (
              <article className="rounded-2xl border border-stone-200 bg-white p-5" key={horse.id}>
                <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)] lg:items-start">
                  {primaryImage ? (
                    <img alt={horse.title} className="h-40 w-full rounded-xl object-cover lg:h-32" src={primaryImage} />
                  ) : (
                    <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-stone-300 bg-stone-50 text-sm text-stone-500">
                      Kein Bild
                    </div>
                  )}
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-clay">Pferdeprofil</p>
                        <h2 className="text-xl font-semibold text-ink">{horse.title}</h2>
                        <p className="text-sm text-stone-600">PLZ {horse.plz}</p>
                      </div>
                      <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${horse.active ? "bg-emerald-100 text-emerald-800" : "bg-stone-200 text-stone-700"}`}>
                        {horse.active ? "Aktiv" : "Inaktiv"}
                      </span>
                    </div>
                    <div className="grid gap-2 text-sm text-stone-600 sm:grid-cols-2 xl:grid-cols-3">
                      <div>{horse.breed ? `Rasse: ${horse.breed}` : "Rasse: offen"}</div>
                      <div>{horse.height_cm ? `Stockmass: ${horse.height_cm} cm` : "Stockmass: offen"}</div>
                      <div>{horse.color ? `Farbe: ${horse.color}` : "Farbe: offen"}</div>
                      <div>{horse.sex ? `Geschlecht: ${horse.sex}` : "Geschlecht: offen"}</div>
                      <div>{age !== null ? `Alter: ${age} Jahre` : "Alter: offen"}</div>
                      <div>{imageCountLabel}</div>
                    </div>
                    <div className="flex flex-col gap-2 xl:flex-row xl:flex-wrap">
                      <Link className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold text-ink hover:border-forest hover:text-forest" href={`/pferde/${horse.id}` as Route}>
                        Pferdeprofil ansehen
                      </Link>
                      <Link
                        className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold text-ink hover:border-forest hover:text-forest"
                        href={{ pathname: managePath as Route, query: { edit: horse.id }, hash: `bearbeiten-${horse.id}` }}
                      >
                        Pferd bearbeiten
                      </Link>
                      <Link className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold text-ink hover:border-forest hover:text-forest" href={`/pferde/${horse.id}/kalender` as Route}>
                        Kalender
                      </Link>
                      <form action={deleteHorseAction}>
                        <input name="horseId" type="hidden" value={horse.id} />
                        <input name="redirectTo" type="hidden" value={managePath} />
                        <ConfirmSubmitButton
                          className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:border-rose-400 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-70"
                          confirmMessage={deletePrompt}
                          idleLabel="Pferd loeschen"
                          pendingLabel="Wird geloescht..."
                        />
                      </form>
                    </div>
                  </div>
                </div>
                {isEditing ? (
                  <div className="mt-5 border-t border-stone-200 pt-5" id={`bearbeiten-${horse.id}`}>
                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
                      <section className="space-y-4">
                        <div>
                          <h3 className="text-lg font-semibold text-ink">Pferdeprofil bearbeiten</h3>
                          <p className="mt-1 text-sm text-stone-600">Aendere Stammdaten, Sichtbarkeit und Beschreibung deines Pferdes.</p>
                        </div>
                        <form action={saveHorseAction} className="space-y-4">
                          <input name="horseId" type="hidden" value={horse.id} />
                          <input name="redirectTo" type="hidden" value={editPath} />
                          <div>
                            <label htmlFor={`title-${horse.id}`}>Titel</label>
                            <input defaultValue={horse.title} id={`title-${horse.id}`} name="title" required type="text" />
                          </div>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <label htmlFor={`plz-${horse.id}`}>PLZ</label>
                              <input defaultValue={horse.plz} id={`plz-${horse.id}`} name="plz" required type="text" />
                            </div>
                            <div>
                              <label htmlFor={`heightCm-${horse.id}`}>Stockmass (cm)</label>
                              <input defaultValue={horse.height_cm ?? ""} id={`heightCm-${horse.id}`} max={220} min={50} name="heightCm" type="number" />
                            </div>
                          </div>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <label htmlFor={`breed-${horse.id}`}>Rasse</label>
                              <input defaultValue={horse.breed ?? ""} id={`breed-${horse.id}`} name="breed" type="text" />
                            </div>
                            <div>
                              <label htmlFor={`color-${horse.id}`}>Farbe</label>
                              <input defaultValue={horse.color ?? ""} id={`color-${horse.id}`} name="color" type="text" />
                            </div>
                          </div>
                          <div className="grid gap-4 sm:grid-cols-2">
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
                          </div>
                          <div>
                            <label htmlFor={`description-${horse.id}`}>Beschreibung</label>
                            <textarea defaultValue={horse.description ?? ""} id={`description-${horse.id}`} name="description" rows={5} />
                          </div>
                          <label className="flex min-h-[44px] items-center gap-3 rounded-xl border border-stone-300 px-4 py-3 text-sm text-ink">
                            <input className="h-4 w-4 rounded border-stone-300" defaultChecked={horse.active} name="active" type="checkbox" />
                            Pferdeprofil veroeffentlichen
                          </label>
                          <SubmitButton idleLabel="Aenderungen speichern" pendingLabel="Wird aktualisiert..." />
                        </form>
                      </section>
                      <section className="space-y-4">
                        <div>
                          <h3 className="text-lg font-semibold text-ink">Bilder verwalten</h3>
                          <p className="mt-1 text-sm text-stone-600">Lade Bilder hoch, entferne sie wieder und halte die Galerie aktuell.</p>
                        </div>
                        {images.length > 0 ? (
                          <div className="grid grid-cols-2 gap-3">
                            {images.map((image, index) => (
                              <div className="space-y-2" key={image.id}>
                                <img alt={`Pferdebild ${index + 1} von ${horse.title}`} className="h-28 w-full rounded-xl border border-stone-200 object-cover" loading="lazy" src={image.url} />
                                <form action={deleteHorseImageAction}>
                                  <input name="imageId" type="hidden" value={image.id} />
                                  <input name="redirectTo" type="hidden" value={editPath} />
                                  <ConfirmSubmitButton
                                    className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-ink hover:border-forest hover:text-forest disabled:cursor-not-allowed disabled:opacity-70"
                                    confirmMessage="Moechtest du dieses Bild wirklich entfernen?"
                                    idleLabel="Bild entfernen"
                                    pendingLabel="Wird entfernt..."
                                  />
                                </form>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-600">
                            Noch keine Bilder hochgeladen.
                          </div>
                        )}
                        {images.length >= MAX_HORSE_IMAGES ? (
                          <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
                            Die maximale Anzahl von {MAX_HORSE_IMAGES} Bildern ist erreicht.
                          </div>
                        ) : (
                          <form action={uploadHorseImagesAction} className="space-y-3" encType="multipart/form-data">
                            <input name="horseId" type="hidden" value={horse.id} />
                            <input name="redirectTo" type="hidden" value={editPath} />
                            <div>
                              <label htmlFor={`images-${horse.id}`}>Bilder hochladen</label>
                              <input accept="image/*" id={`images-${horse.id}`} multiple name="images" type="file" />
                            </div>
                            <SubmitButton idleLabel="Bilder speichern" pendingLabel="Wird hochgeladen..." />
                          </form>
                        )}
                      </section>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}