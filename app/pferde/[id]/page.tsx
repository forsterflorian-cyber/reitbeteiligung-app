import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requestTrialAction } from "@/app/actions";
import { Notice } from "@/components/notice";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { isApproved } from "@/lib/approvals";
import { getProfileByUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { HORSE_IMAGE_SELECT_FIELDS, HORSE_SELECT_FIELDS, getHorseAge, getHorseImageUrl, sortHorseImages } from "@/lib/horses";
import { readSearchParam } from "@/lib/search-params";
import type { Horse, HorseImage, TrialRequest, TrialRequestStatus } from "@/types/database";

function riderStatusText(status: TrialRequestStatus) {
  switch (status) {
    case "requested":
      return "Deine Anfrage ist eingegangen. Der Pferdehalter entscheidet als Naechstes.";
    case "accepted":
      return "Der Probetermin wurde angenommen. Vereinbart jetzt die Durchfuehrung.";
    case "completed":
      return "Der Probetermin wurde als durchgefuehrt markiert. Warte jetzt auf die Freischaltung.";
    case "declined":
      return "Die letzte Anfrage wurde abgelehnt. Du kannst bei Bedarf erneut anfragen.";
    default:
      return null;
  }
}

function horseFacts(horse: Horse) {
  const age = getHorseAge(horse.birth_year ?? null);

  return [
    horse.height_cm ? `${horse.height_cm} cm Stockmass` : null,
    horse.breed ? `Rasse: ${horse.breed}` : null,
    horse.color ? `Farbe: ${horse.color}` : null,
    horse.sex ? `Geschlecht: ${horse.sex}` : null,
    age !== null ? `Alter: ${age} Jahre` : null
  ].filter((value): value is string => Boolean(value));
}

export default async function PferdDetailPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const profile = user ? await getProfileByUserId(supabase, user.id) : null;
  const error = readSearchParam(searchParams, "error");
  const message = readSearchParam(searchParams, "message");
  const { data } = await supabase.from("horses").select(HORSE_SELECT_FIELDS).eq("id", params.id).maybeSingle();

  const horse = (data as Horse | null) ?? null;

  if (!horse) {
    notFound();
  }

  const { data: imageData } = await supabase
    .from("horse_images")
    .select(HORSE_IMAGE_SELECT_FIELDS)
    .eq("horse_id", horse.id)
    .order("created_at", { ascending: true })
    .limit(5);

  const rawImages = sortHorseImages(
    (Array.isArray(imageData) ? (imageData as HorseImage[]) : []).filter(
      (image): image is HorseImage & { path?: string | null; storage_path?: string | null } => Boolean((image.path ?? image.storage_path) && image.id)
    )
  );

  const resolvedImages = await Promise.all(
    rawImages.map(async (image) => {
      const url = await getHorseImageUrl(supabase, image.path ?? image.storage_path ?? null);
      return url ? { ...image, url } : null;
    })
  );

  const images = resolvedImages.filter((image): image is HorseImage & { url: string } => Boolean(image));

  let latestRequest: TrialRequest | null = null;
  let approved = false;

  if (profile?.role === "rider" && user) {
    const { data: requestData } = await supabase
      .from("trial_requests")
      .select("id, horse_id, rider_id, status, message, created_at")
      .eq("horse_id", horse.id)
      .eq("rider_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    latestRequest = (requestData as TrialRequest | null) ?? null;
    approved = await isApproved(horse.id, user.id, supabase);
  }

  const canRequest = profile?.role === "rider" && (!latestRequest || latestRequest.status === "declined") && !approved;
  const facts = horseFacts(horse);
  const calendarHref = `/pferde/${horse.id}/kalender` as Route;

  return (
    <div className="space-y-5">
      <Link className="inline-flex min-h-[44px] items-center text-sm font-semibold text-blue-800 hover:text-blue-700" href="/suchen">
        Zurueck zur Suche
      </Link>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          {images.length > 0 ? (
            <div className="space-y-3 p-3 sm:p-4">
              <img alt={horse.title} className="h-64 w-full rounded-xl object-cover sm:h-80" src={images[0].url} />
              {images.length > 1 ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {images.slice(1).map((image, index) => (
                    <img alt={`Pferdebild ${index + 2} von ${horse.title}`} className="h-20 w-full rounded-xl object-cover sm:h-24" key={image.id} src={image.url} />
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="m-4 flex h-64 items-center justify-center rounded-xl border border-dashed border-stone-300 bg-stone-50 text-sm text-stone-600 sm:h-80">
              Noch keine Bilder hinterlegt.
            </div>
          )}
        </section>
        <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          <div className="bg-gradient-to-r from-blue-800 to-blue-700 px-5 py-4 text-white sm:px-6">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-100">Pferdeprofil</p>
            <h1 className="mt-2 text-3xl font-semibold">{horse.title}</h1>
            <p className="mt-2 text-sm text-blue-50">Standort: {horse.plz}</p>
          </div>
          <div className="space-y-4 px-5 py-5 sm:px-6">
            {facts.length > 0 ? (
              <div className="space-y-2">
                {facts.map((fact) => (
                  <div className="flex items-center gap-2 text-sm text-stone-700" key={fact}>
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-700" />
                    <span>{fact}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-stone-600">Zu diesem Pferd liegen noch keine Zusatzangaben vor.</p>
            )}
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${horse.active ? "bg-emerald-100 text-emerald-800" : "bg-stone-200 text-stone-700"}`}>
              {horse.active ? "Aktiv" : "Nicht aktiv"}
            </span>
            <div className="space-y-3 border-t border-stone-200 pt-4">
              {profile?.role === "rider" ? (
                <a className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800" href="#probetermin">
                  Probetermin anfragen
                </a>
              ) : null}
              {!user ? (
                <Link className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800" href="/login">
                  Anmelden um Probetermin anzufragen
                </Link>
              ) : null}
              <Link className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-stone-300 px-4 py-3 text-sm font-semibold text-stone-900 hover:border-blue-700 hover:text-blue-800" href={calendarHref}>
                Kalender ansehen
              </Link>
            </div>
          </div>
        </section>
      </div>
      <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
        <h2 className="text-xl font-semibold text-stone-900">Beschreibung</h2>
        <p className="mt-3 text-sm text-stone-600 sm:text-base">{horse.description ?? "Fuer dieses Pferdeprofil liegt noch keine Beschreibung vor."}</p>
      </section>
      <Notice text={error} tone="error" />
      <Notice text={message} tone="success" />
      {profile?.role === "rider" ? (
        <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white" id="probetermin">
          <div className="bg-gradient-to-r from-blue-800 to-blue-700 px-5 py-4 text-white sm:px-6">
            <h2 className="text-2xl font-semibold">Probetermin anfragen</h2>
            <p className="mt-2 text-sm text-blue-50">Sende dem Pferdehalter eine kurze Nachricht zu deiner Anfrage.</p>
          </div>
          <div className="space-y-4 px-5 py-5 sm:px-6">
            {approved ? (
              <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <StatusBadge status="approved" />
                <p className="text-sm text-stone-600">Du bist fuer dieses Pferd bereits freigeschaltet und kannst spaeter freie Termine anfragen.</p>
              </div>
            ) : null}
            {latestRequest ? (
              <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
                <StatusBadge status={latestRequest.status} />
                <p className="text-sm text-stone-600">{riderStatusText(latestRequest.status)}</p>
              </div>
            ) : null}
            {canRequest ? (
              <form action={requestTrialAction} className="space-y-4">
                <input name="horseId" type="hidden" value={horse.id} />
                <div>
                  <label htmlFor="message">Nachricht (optional)</label>
                  <textarea id="message" name="message" placeholder="Stelle dich kurz vor und nenne deinen Wunsch fuer den Probetermin." rows={5} />
                </div>
                <SubmitButton idleLabel="Probetermin anfragen" pendingLabel="Wird gesendet..." />
              </form>
            ) : null}
          </div>
        </section>
      ) : null}
      {profile?.role === "owner" ? (
        <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
          <p className="text-sm text-stone-600">Du bist als Pferdehalter angemeldet. Probetermine verwaltest du unter deinen Anfragen.</p>
          <Link className="mt-3 inline-flex min-h-[44px] items-center rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800" href="/owner/anfragen">
            Zu den Anfragen
          </Link>
        </section>
      ) : null}
    </div>
  );
}