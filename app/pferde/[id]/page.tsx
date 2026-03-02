import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requestTrialAction } from "@/app/actions";
import { Notice } from "@/components/notice";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { isApproved } from "@/lib/approvals";
import { getProfileByUserId } from "@/lib/auth";
import {
  HORSE_IMAGE_SELECT_FIELDS,
  HORSE_SELECT_FIELDS,
  getHorseAge,
  getHorseImageUrl,
  sortHorseImages
} from "@/lib/horses";
import { readSearchParam } from "@/lib/search-params";
import { createClient } from "@/lib/supabase/server";
import type { Horse, HorseImage, TrialRequest, TrialRequestStatus } from "@/types/database";

function riderStatusText(status: TrialRequestStatus) {
  switch (status) {
    case "requested":
      return "Deine Anfrage ist eingegangen. Der Pferdehalter entscheidet als Nächstes.";
    case "accepted":
      return "Der Probetermin wurde angenommen. Vereinbart jetzt die Durchfuehrung.";
    case "completed":
      return "Der Probetermin wurde als durchgeführt markiert. Warte jetzt auf die Freischaltung.";
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
      (image): image is HorseImage & { path?: string | null; storage_path?: string | null } =>
        Boolean((image.path ?? image.storage_path) && image.id)
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

  // Only the current rider's latest trial request matters for the CTA state.
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
    <div className="space-y-6 sm:space-y-8">
      <Link className={buttonVariants("ghost", "min-h-0 justify-start px-0 py-0 text-sm font-semibold text-forest hover:bg-transparent hover:text-clay")} href="/suchen">
        Zurück zur Suche
      </Link>

      <PageHeader
        actions={
          <>
            {profile?.role === "rider" ? (
              <a className={buttonVariants("primary", "w-full sm:w-auto")} href="#probetermin">
                Probetermin anfragen
              </a>
            ) : null}
            {!user ? (
              <Link className={buttonVariants("primary", "w-full sm:w-auto")} href="/login">
                Anmelden um anzufragen
              </Link>
            ) : null}
            <Link className={buttonVariants("secondary", "w-full sm:w-auto")} href={calendarHref}>
              Kalender ansehen
            </Link>
          </>
        }
        subtitle={`Standort ${horse.plz}. Probetermine, Freischaltung und spätere Terminbuchung laufen über einen klaren Ablauf.`}
        title={horse.title}
      />

      <Notice text={error} tone="error" />
      <Notice text={message} tone="success" />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <SectionCard subtitle="Bilder und erste Eindruecke auf einen Blick." title="Galerie">
          <div className="space-y-4">
            {images.length > 0 ? (
              <>
                <img alt={horse.title} className="h-64 w-full rounded-2xl object-cover sm:h-80" src={images[0].url} />
                {images.length > 1 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {images.slice(1).map((image, index) => (
                      <img
                        alt={`Pferdebild ${index + 2} von ${horse.title}`}
                        className="h-24 w-full rounded-2xl object-cover"
                        key={image.id}
                        src={image.url}
                      />
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <EmptyState
                description="Dieses Pferdeprofil hat aktuell noch keine Bilder."
                title="Noch keine Bilder hinterlegt"
              />
            )}
          </div>
        </SectionCard>

        <SectionCard subtitle="Grunddaten, Status und die wichtigsten Eckpunkte." title="Auf einen Blick">
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Badge tone={horse.active ? "approved" : "neutral"}>{horse.active ? "Aktiv" : "Nicht aktiv"}</Badge>
              <Badge tone="neutral">PLZ {horse.plz}</Badge>
            </div>
            {facts.length > 0 ? (
              <div className="space-y-3">
                {facts.map((fact) => (
                  <div className="flex items-start gap-3 text-sm leading-6 text-stone-600" key={fact}>
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-clay" />
                    <span>{fact}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                description="Zu diesem Pferd liegen noch keine weiteren Merkmale vor."
                title="Noch keine Zusatzangaben"
              />
            )}
            {profile?.role === "owner" ? (
              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                <p className="text-sm leading-6 text-stone-600">
                  Du bist als Pferdehalter angemeldet. Probetermine, Freischaltungen und weitere Anfragen verwaltest du gesammelt in deinem Anfragenbereich.
                </p>
                <Link className={buttonVariants("secondary", "mt-4 w-full sm:w-auto")} href="/owner/anfragen">
                  Zu den Anfragen
                </Link>
              </div>
            ) : null}
          </div>
        </SectionCard>
      </div>

      <SectionCard subtitle="Das Pferdeprofil in ganzen Saetzen, ohne dass du dich durch Nachrichten suchen musst." title="Beschreibung">
        <p className="text-sm leading-7 text-stone-600 sm:text-base">
          {horse.description?.trim() || "Fuer dieses Pferdeprofil liegt noch keine Beschreibung vor."}
        </p>
      </SectionCard>

      {profile?.role === "rider" ? (
        <SectionCard
          bodyClassName="space-y-4"
          subtitle="Vor der Freischaltung bleibt die Kommunikation intern. Kontaktdaten werden erst danach sichtbar."
          title="Probetermin anfragen"
        >
          {approved ? (
            <div className="rounded-2xl border border-stone-200 bg-sand p-4">
              <div className="space-y-3">
                <StatusBadge status="approved" />
                <p className="text-sm leading-6 text-stone-600">
                  Du bist für dieses Pferd bereits freigeschaltet und kannst später freie Termine anfragen.
                </p>
              </div>
            </div>
          ) : null}

          {latestRequest ? (
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <div className="space-y-3">
                <StatusBadge status={latestRequest.status} />
                <p className="text-sm leading-6 text-stone-600">{riderStatusText(latestRequest.status)}</p>
              </div>
            </div>
          ) : null}

          {canRequest ? (
            <form action={requestTrialAction} className="space-y-4" id="probetermin">
              <input name="horseId" type="hidden" value={horse.id} />
              <div>
                <label htmlFor="message">Nachricht (optional)</label>
                <textarea
                  id="message"
                  name="message"
                  placeholder="Stelle dich kurz vor und nenne deinen Wunsch für den Probetermin."
                  rows={5}
                />
              </div>
              <SubmitButton idleLabel="Probetermin anfragen" pendingLabel="Wird gesendet..." />
            </form>
          ) : null}

          {!approved && !latestRequest && !canRequest ? (
            <EmptyState
              description="Aktuell kannst du für dieses Pferd keinen neuen Probetermin anfragen."
              title="Anfrage derzeit nicht möglich"
            />
          ) : null}
        </SectionCard>
      ) : null}
    </div>
  );
}
