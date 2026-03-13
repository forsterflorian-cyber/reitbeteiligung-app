import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";

import { deleteHorseAction, deleteHorseImageAction, saveHorseAction, startOwnerTrialAction, uploadHorseImagesAction } from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { Backdrop } from "@/components/ui/backdrop";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
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
import { PAID_PLAN_CONTACT_EMAIL, canStartOwnerTrial, getOwnerPlan, getOwnerPlanUsage, getOwnerPlanUsageSummary } from "@/lib/plans";
import { readSearchParam } from "@/lib/search-params";
import type { BookingRequest, Horse, HorseImage, TrialRequest } from "@/types/database";

type HorseImageWithUrl = HorseImage & {
  url: string;
};

const deletePrompt =
  "Möchtest du dieses Pferdeprofil wirklich löschen? Bilder werden entfernt. Weitere Anfragen, Freischaltungen, Verfügbarkeiten, Kalender-Sperren und Chats werden je nach Datenlage mitgelöscht oder blockieren das Löschen.";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium"
  }).format(new Date(value));
}

export default async function OwnerManageHorsesPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { profile, supabase, user } = await requireProfile("owner");
  const managePath = "/owner/pferde-verwalten";
  const createPath = "/owner/horses" as Route;
  const error = readSearchParam(searchParams, "error");
  const message = readSearchParam(searchParams, "message");
  const editTarget = readSearchParam(searchParams, "edit");
  const currentYear = new Date().getFullYear();
  const ownerPlanUsage = await getOwnerPlanUsage(supabase, user.id);
  const ownerPlan = getOwnerPlan(profile, ownerPlanUsage);
  const ownerPlanUsageSummary = getOwnerPlanUsageSummary(ownerPlan, ownerPlanUsage);
  const showStartTrial = canStartOwnerTrial(profile);
  const upgradeHref = `mailto:${PAID_PLAN_CONTACT_EMAIL}?subject=${encodeURIComponent("Bezahlten Tarif anfragen")}`;
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
  let openTrialRequests: TrialRequest[] = [];
  let openBookingRequests: BookingRequest[] = [];

  if (horseIds.length > 0) {
    const [{ data: imageData, error: imageError }, { data: trialData }, { data: bookingData }] = await Promise.all([
      supabase
        .from("horse_images")
        .select(HORSE_IMAGE_SELECT_FIELDS)
        .in("horse_id", horseIds)
        .order("created_at", { ascending: true }),
      supabase
        .from("trial_requests")
        .select("id, horse_id, rider_id, status, message, created_at")
        .in("horse_id", horseIds)
        .eq("status", "requested"),
      supabase
        .from("booking_requests")
        .select("id, slot_id, availability_rule_id, horse_id, rider_id, status, requested_start_at, requested_end_at, recurrence_rrule, created_at")
        .in("horse_id", horseIds)
        .eq("status", "requested")
    ]);

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
    openTrialRequests = (trialData as TrialRequest[] | null) ?? [];
    openBookingRequests = (bookingData as BookingRequest[] | null) ?? [];
  }

  const imageMap = new Map<string, HorseImageWithUrl[]>();
  const openTrialCountByHorse = new Map<string, number>();
  const openBookingCountByHorse = new Map<string, number>();

  horseImages.forEach((image) => {
    const existing = imageMap.get(image.horse_id) ?? [];
    existing.push(image);
    imageMap.set(image.horse_id, existing);
  });

  openTrialRequests.forEach((request) => {
    openTrialCountByHorse.set(request.horse_id, (openTrialCountByHorse.get(request.horse_id) ?? 0) + 1);
  });

  openBookingRequests.forEach((request) => {
    openBookingCountByHorse.set(request.horse_id, (openBookingCountByHorse.get(request.horse_id) ?? 0) + 1);
  });

  const activeHorseCount = horses.filter((horse) => horse.active).length;
  const inactiveHorseCount = horses.length - activeHorseCount;
  const horseWithImagesCount = horses.filter((horse) => (imageMap.get(horse.id)?.length ?? 0) > 0).length;
  const totalOpenRequests = openTrialRequests.length + openBookingRequests.length;

  return (
    <div className="relative isolate space-y-6">
      <Backdrop className="!inset-x-0 !top-0 !bottom-auto !h-[340px]" variant="hero" />
      <Backdrop className="top-12 h-[520px]" variant="section" />
      <div className="relative z-10 space-y-6">
        <PageHeader
          actions={
            <>
              <Link className={buttonVariants("primary")} href={createPath}>
                Neues Pferd anlegen
              </Link>
              <Link className={buttonVariants("secondary")} href="/owner/anfragen">
                Probetermine
              </Link>
              <Link className={buttonVariants("ghost")} href="/owner/reitbeteiligungen">
                Reitbeteiligungen
              </Link>
            </>
          }
          backdropVariant="hero"
          eyebrow="Pferdehalter"
          subtitle="Deine Verwaltungsansicht für Desktop und Mobil: Bilder, Status, offene Anfragen und die wichtigsten Aktionen liegen direkt an jedem Pferdeprofil."
          surface
          title="Pferde verwalten"
        />
        <Notice text={error} tone="error" />
        <Notice text={horsesLoadErrorMessage} tone="error" />
        <Notice text={horseImagesErrorMessage} tone="error" />
        <Notice text={message} tone="success" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <p className="text-sm font-semibold text-stone-500">Pferdeprofile</p>
          <p className="mt-3 text-4xl font-semibold text-forest">{horses.length}</p>
          <p className="mt-2 text-sm text-stone-600">Insgesamt angelegte Pferdeprofile.</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <p className="text-sm font-semibold text-stone-500">Aktiv</p>
          <p className="mt-3 text-4xl font-semibold text-forest">{activeHorseCount}</p>
          <p className="mt-2 text-sm text-stone-600">{inactiveHorseCount} inaktiv oder noch nicht veröffentlicht.</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <p className="text-sm font-semibold text-stone-500">Mit Bildern</p>
          <p className="mt-3 text-4xl font-semibold text-forest">{horseWithImagesCount}</p>
          <p className="mt-2 text-sm text-stone-600">{horses.length - horseWithImagesCount} ohne Galeriebilder.</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <p className="text-sm font-semibold text-stone-500">Offene Anfragen</p>
          <p className="mt-3 text-4xl font-semibold text-forest">{totalOpenRequests}</p>
          <p className="mt-2 text-sm text-stone-600">{openTrialRequests.length} Probetermine und {openBookingRequests.length} Terminanfragen warten.</p>
        </div>
      </div>
      {horsesError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Die Pferdeprofile konnten derzeit nicht geladen werden. Bitte prüfe später erneut oder öffne /diagnose.
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
            const trialCount = openTrialCountByHorse.get(horse.id) ?? 0;
            const bookingCount = openBookingCountByHorse.get(horse.id) ?? 0;
            const isEditing = editTarget === horse.id;
            const editPath = `${managePath}?edit=${horse.id}`;

            return (
              <article className="rounded-2xl border border-stone-200 bg-white p-5" key={horse.id}>
                <div className="grid gap-5 xl:grid-cols-[180px_minmax(0,1fr)_280px] xl:items-start">
                  <div className="space-y-3">
                    {primaryImage ? (
                      <Image alt={horse.title} className="h-40 w-full rounded-xl object-cover xl:h-32" height={160} src={primaryImage} unoptimized width={320} />
                    ) : (
                      <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-stone-300 bg-stone-50 text-sm text-stone-500">
                        Kein Bild
                      </div>
                    )}
                    <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-600">{imageCountLabel}</div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-clay">Pferdeprofil</p>
                        <h2 className="text-xl font-semibold text-stone-900">{horse.title}</h2>
                        <p className="text-sm text-stone-600">PLZ {horse.plz}</p>
                        {horse.location_address ? <p className="text-sm text-stone-600">{horse.location_address}</p> : null}
                        <p className="text-xs text-stone-500">Angelegt am {formatDate(horse.created_at)}</p>
                      </div>
                      <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${horse.active ? "border border-stone-200 bg-sand text-forest" : "border border-stone-200 bg-white text-stone-700"}`}>
                        {horse.active ? "Aktiv" : "Inaktiv"}
                      </span>
                    </div>
                    <div className="grid gap-2 text-sm text-stone-600 sm:grid-cols-2 xl:grid-cols-3">
                      <div>{horse.breed ? `Rasse: ${horse.breed}` : "Rasse: offen"}</div>
                      <div>{horse.height_cm ? `Stockmaß: ${horse.height_cm} cm` : "Stockmaß: offen"}</div>
                      <div>{horse.color ? `Farbe: ${horse.color}` : "Farbe: offen"}</div>
                      <div>{horse.sex ? `Geschlecht: ${horse.sex}` : "Geschlecht: offen"}</div>
                      <div>{age !== null ? `Alter: ${age} Jahre` : "Alter: offen"}</div>
                      <div>{horse.location_address ? "Standort vorhanden" : "Standort: offen"}</div>
                      <div>{horse.location_notes?.trim() ? "Standorthinweise vorhanden" : "Standorthinweise: offen"}</div>
                      <div>{horse.description?.trim() ? "Beschreibung vorhanden" : "Beschreibung: offen"}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex rounded-full border border-stone-200 bg-sand px-3 py-1 text-xs font-semibold text-ink">{trialCount} offene Probetermine</span>
                      <span className="inline-flex rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">{bookingCount} offene Terminanfragen</span>
                    </div>
                  </div>
                  <div className="space-y-3 rounded-2xl border border-stone-200 bg-stone-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Aktionen</p>
                    <div className="rounded-xl border border-stone-200 bg-white px-3 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">{"N\u00e4chster Schritt"}</p>
                      <p className="mt-2 text-sm font-semibold text-stone-900">
                        {trialCount > 0
                          ? `${trialCount} Probetermine prüfen`
                          : bookingCount > 0
                            ? `${bookingCount} Terminanfragen prüfen`
                            : "Kalender aktuell halten"}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-stone-600">
                        {trialCount > 0 || bookingCount > 0
                          ? "Gehe direkt in die Anfragen, damit nichts liegen bleibt."
                          : "Halte Verfügbarkeiten, Bilder und Sichtbarkeit dieses Pferdes aktuell."}
                      </p>
                    </div>
                    <Link className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-forest px-4 py-2 text-sm font-semibold text-white hover:bg-forest/90" href={`/pferde/${horse.id}` as Route}>
                      Pferdeprofil ansehen
                    </Link>
                    <Link
                      className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900 hover:border-forest hover:text-forest"
                      href={{ pathname: managePath as Route, query: { edit: horse.id }, hash: `bearbeiten-${horse.id}` }}
                    >
                      Pferd editieren
                    </Link>
                    <Link className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900 hover:border-forest hover:text-forest" href="/owner/reitbeteiligungen">
                      Reitbeteiligungen
                    </Link>
                    <Link className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900 hover:border-forest hover:text-forest" href={`/pferde/${horse.id}/kalender` as Route}>
                      Kalender
                    </Link>
                    <form action={deleteHorseAction}>
                      <input name="horseId" type="hidden" value={horse.id} />
                      <input name="redirectTo" type="hidden" value={managePath} />
                      <ConfirmSubmitButton
                        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:border-rose-400 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-70"
                        confirmMessage={deletePrompt}
                        idleLabel={"Pferd l\u00f6schen"}
                        pendingLabel="Wird gelöscht..."
                      />
                    </form>
                  </div>
                </div>
                {isEditing ? (
                  <div className="mt-5 overflow-hidden rounded-2xl border border-stone-200 bg-sand/60" id={`bearbeiten-${horse.id}`}>
                    <div className="border-b border-stone-200 px-5 py-4">
                      <h3 className="text-lg font-semibold text-stone-900">Pferdeprofil bearbeiten</h3>
                      <p className="mt-1 text-sm text-stone-600">Stammdaten, Sichtbarkeit und Galerie direkt an einem Ort.</p>
                    </div>
                    <div className="grid gap-5 px-5 py-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
                      <section className="space-y-4">
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
                              <input defaultValue={horse.plz} id={`plz-${horse.id}`} inputMode="numeric" maxLength={5} minLength={5} name="plz" pattern="[0-9]{5}" required type="text" />
                            </div>
                            <div>
                              <label htmlFor={`locationAddress-${horse.id}`}>Genauer Standort</label>
                              <input defaultValue={horse.location_address ?? ""} id={`locationAddress-${horse.id}`} name="locationAddress" type="text" />
                            </div>
                          </div>
                          <div>
                            <label htmlFor={`locationNotes-${horse.id}`}>Hinweise zum Standort</label>
                            <textarea defaultValue={horse.location_notes ?? ""} id={`locationNotes-${horse.id}`} name="locationNotes" rows={3} />
                          </div>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <label htmlFor={`heightCm-${horse.id}`}>Stockmaß (cm)</label>
                              <input defaultValue={horse.height_cm ?? ""} id={`heightCm-${horse.id}`} max={220} min={50} name="heightCm" type="number" />
                            </div>
                            <div>
                              <label htmlFor={`breed-${horse.id}`}>Rasse</label>
                              <input defaultValue={horse.breed ?? ""} id={`breed-${horse.id}`} name="breed" type="text" />
                            </div>
                          </div>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <label htmlFor={`color-${horse.id}`}>Farbe</label>
                              <input defaultValue={horse.color ?? ""} id={`color-${horse.id}`} name="color" type="text" />
                            </div>
                            <div>
                              <label htmlFor={`sex-${horse.id}`}>Geschlecht</label>
                              <select defaultValue={horse.sex ?? ""} id={`sex-${horse.id}`} name="sex">
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
                            <label htmlFor={`birthYear-${horse.id}`}>Geburtsjahr</label>
                            <input defaultValue={horse.birth_year ?? ""} id={`birthYear-${horse.id}`} max={currentYear} min={1980} name="birthYear" type="number" />
                          </div>
                          <div>
                            <label htmlFor={`description-${horse.id}`}>Beschreibung</label>
                            <textarea defaultValue={horse.description ?? ""} id={`description-${horse.id}`} name="description" rows={5} />
                          </div>
                          <div>
                            <label className="mb-2 block text-sm font-medium text-stone-700">Buchungsmodus</label>
                            <div className="space-y-2">
                              <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 has-[:checked]:border-forest has-[:checked]:bg-sand">
                                <input
                                  className="mt-0.5 h-4 w-4 shrink-0 border-stone-300"
                                  defaultChecked={horse.booking_mode !== "free"}
                                  name="bookingMode"
                                  type="radio"
                                  value="slots"
                                />
                                <span>
                                  <span className="font-semibold">Nur freigegebene Slots</span>
                                  <span className="mt-0.5 block text-xs text-stone-500">
                                    Reiter können nur explizit freigegebene Zeitfenster buchen.
                                  </span>
                                </span>
                              </label>
                              <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 has-[:checked]:border-forest has-[:checked]:bg-sand">
                                <input
                                  className="mt-0.5 h-4 w-4 shrink-0 border-stone-300"
                                  defaultChecked={horse.booking_mode === "free"}
                                  name="bookingMode"
                                  type="radio"
                                  value="free"
                                />
                                <span>
                                  <span className="font-semibold">Freies Buchen</span>
                                  <span className="mt-0.5 block text-xs text-stone-500">
                                    Reiter können selbst Zeiten innerhalb der Verfügbarkeitsfenster wählen.
                                  </span>
                                </span>
                              </label>
                            </div>
                          </div>
                          <label className="flex min-h-[44px] items-center gap-3 rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900">
                            <input className="h-4 w-4 rounded border-stone-300" defaultChecked={horse.active} name="active" type="checkbox" />
                            Pferdeprofil veröffentlichen
                          </label>
                          <SubmitButton idleLabel="Änderungen speichern" pendingLabel="Wird aktualisiert..." />
                        </form>
                      </section>
                      <section className="space-y-4">
                        <div>
                          <h3 className="text-lg font-semibold text-stone-900">Bilder verwalten</h3>
                          <p className="mt-1 text-sm text-stone-600">Lade bis zu {MAX_HORSE_IMAGES} Bilder hoch und halte die Galerie aktuell.</p>
                        </div>
                        {images.length > 0 ? (
                          <div className="grid grid-cols-2 gap-3">
                            {images.map((image, index) => (
                              <div className="space-y-2" key={image.id}>
                                <Image alt={`Pferdebild ${index + 1} von ${horse.title}`} className="h-28 w-full rounded-xl border border-stone-200 object-cover" height={112} loading="lazy" src={image.url} unoptimized width={224} />
                                <form action={deleteHorseImageAction}>
                                  <input name="imageId" type="hidden" value={image.id} />
                                  <input name="redirectTo" type="hidden" value={editPath} />
                                  <ConfirmSubmitButton
                                    className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900 hover:border-forest hover:text-forest disabled:cursor-not-allowed disabled:opacity-70"
                                    confirmMessage="Möchtest du dieses Bild wirklich entfernen?"
                                    idleLabel="Bild entfernen"
                                    pendingLabel="Wird entfernt..."
                                  />
                                </form>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-stone-300 bg-white p-4 text-sm text-stone-600">Noch keine Bilder hochgeladen.</div>
                        )}
                        {images.length >= MAX_HORSE_IMAGES ? (
                          <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600">Die maximale Anzahl von {MAX_HORSE_IMAGES} Bildern ist erreicht.</div>
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
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Status im ersten Release</p>
              <div className="flex flex-wrap gap-2">
                <Badge tone={ownerPlan.key === "paid" ? "approved" : ownerPlan.key === "trial" ? "pending" : "neutral"}>{ownerPlan.label}</Badge>
                {showStartTrial ? <Badge tone="info">Start Trial verf\u00fcgbar</Badge> : null}
              </div>
              <p className="text-sm text-stone-600">{ownerPlan.summary}</p>
              {ownerPlan.key !== "paid" ? <p className="text-sm text-stone-600">{ownerPlanUsageSummary}</p> : null}
            </div>
            <div className="flex flex-col gap-2 sm:min-w-[220px]">
              {showStartTrial ? (
                <form action={startOwnerTrialAction}>
                  <input name="redirectTo" type="hidden" value="/owner/pferde-verwalten" />
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
        </div>
      </div>
    </div>
  );
}
