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
import { getUpcomingTrialSlots, type TrialSlot } from "@/lib/trial-slots";
import { getProfileByUserId } from "@/lib/auth";
import {
  HORSE_IMAGE_SELECT_FIELDS,
  HORSE_SELECT_FIELDS,
  getHorseAge,
  getHorseImageUrl,
  sortHorseImages
} from "@/lib/horses";
import { readSearchParam } from "@/lib/search-params";
import { R1_CORE_MODE } from "@/lib/release-stage";
import { createClient } from "@/lib/supabase/server";
import type { AvailabilityRule, Horse, HorseImage, TrialRequest, TrialRequestStatus } from "@/types/database";

function riderStatusText(status: TrialRequestStatus) {
  switch (status) {
    case "requested":
      return "Deine Anfrage ist eingegangen. Der Pferdehalter entscheidet als Nächstes.";
    case "accepted":
      return "Der Probetermin wurde angenommen. Vereinbart jetzt die Durchführung.";
    case "completed":
      return "Der Probetermin wurde als durchgeführt markiert. Warte jetzt auf die Freischaltung.";
    case "declined":
      return "Die letzte Anfrage wurde abgelehnt. Du kannst bei Bedarf erneut anfragen.";
    default:
      return null;
  }
}

function formatTrialSlotRange(startAt: string, endAt: string) {
  return `${new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(startAt))} bis ${new Intl.DateTimeFormat("de-DE", {
    timeStyle: "short"
  }).format(new Date(endAt))}`;
}

function horseFacts(horse: Horse) {
  const age = getHorseAge(horse.birth_year ?? null);

  return [
    horse.height_cm ? `${horse.height_cm} cm Stockmass` : null,
    horse.breed ? `Rasse: ${horse.breed}` : null,
    horse.color ? `Farbe: ${horse.color}` : null,
    horse.sex ? `Geschlecht: ${horse.sex}` : null,
    age !== null ? `Alter: ${age} Jahre` : null,
    horse.location_address ? `Standort: ${horse.location_address}` : null,
    horse.location_notes ? `Hinweise: ${horse.location_notes}` : null
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
  let trialSlots: TrialSlot[] = [];

  // Only the current rider's latest trial request matters for the CTA state.
  if (profile?.role === "rider" && user) {
    const nowIso = new Date().toISOString();
    const [{ data: requestData }, { data: ruleData }, { data: occupancyData }, { data: reservedTrialData }] = await Promise.all([
      supabase
        .from("trial_requests")
        .select("id, horse_id, rider_id, status, message, availability_rule_id, requested_start_at, requested_end_at, created_at")
        .eq("horse_id", horse.id)
        .eq("rider_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("availability_rules")
        .select("id, horse_id, slot_id, start_at, end_at, active, is_trial_slot, created_at")
        .eq("horse_id", horse.id)
        .eq("active", true)
        .gte("end_at", nowIso)
        .order("start_at", { ascending: true })
        .limit(24),
      supabase.rpc("get_horse_calendar_occupancy", {
        p_horse_id: horse.id
      }),
      supabase
        .from("trial_requests")
        .select("availability_rule_id, requested_start_at, requested_end_at, status")
        .eq("horse_id", horse.id)
        .neq("status", "declined")
    ]);

    latestRequest = (requestData as TrialRequest | null) ?? null;
    approved = await isApproved(horse.id, user.id, supabase);

    trialSlots = !approved && (!latestRequest || latestRequest.status === "declined")
      ? getUpcomingTrialSlots({
          occupiedRanges: ((occupancyData as Array<{ start_at: string; end_at: string }> | null) ?? []),
          reservedRequests: ((reservedTrialData as Array<Pick<TrialRequest, "availability_rule_id" | "requested_start_at" | "requested_end_at" | "status">> | null) ?? []),
          rules: ((ruleData as AvailabilityRule[] | null) ?? [])
        })
      : [];
  }

  const latestRequestedSlotLabel =
    latestRequest?.requested_start_at && latestRequest?.requested_end_at
      ? formatTrialSlotRange(latestRequest.requested_start_at, latestRequest.requested_end_at)
      : null;
  const canSelectTrialSlot = profile?.role === "rider" && !approved && (!latestRequest || latestRequest.status === "declined");
  const hasExplicitTrialSlots = trialSlots.length > 0;
  const canRequest = canSelectTrialSlot;
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
            {!R1_CORE_MODE || profile?.role === "owner" ? (
              <Link className={buttonVariants("secondary", "w-full sm:w-auto")} href={calendarHref}>
                Kalender ansehen
              </Link>
            ) : null}
          </>
        }
        subtitle={`${horse.location_address ?? `PLZ ${horse.plz}`}. Probetermine, Freischaltung und spaetere Terminbuchung laufen ueber einen klaren Ablauf.`}
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
              {horse.location_address ? <Badge tone="info">Genauer Standort hinterlegt</Badge> : null}
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
          {horse.description?.trim() || "Für dieses Pferdeprofil liegt noch keine Beschreibung vor."}
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
                  Du bist für dieses Pferd bereits freigeschaltet. Konkrete Reittermine fragst du jetzt im Kalender an.
                </p>
                <Link className={buttonVariants("secondary", "w-full sm:w-auto")} href={calendarHref}>
                  Zum Kalender
                </Link>
              </div>
            </div>
          ) : null}

          {latestRequest ? (
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <div className="space-y-3">
                <StatusBadge status={latestRequest.status} />
                {latestRequestedSlotLabel ? <p className="text-sm font-semibold text-stone-900">{latestRequestedSlotLabel}</p> : null}
                <p className="text-sm leading-6 text-stone-600">{riderStatusText(latestRequest.status)}</p>
              </div>
            </div>
          ) : null}

          {canRequest ? (
            <form action={requestTrialAction} className="space-y-4" id="probetermin">
              <input name="horseId" type="hidden" value={horse.id} />
              {hasExplicitTrialSlots ? (
                <div className="space-y-2">
                  <label>Die naechsten freien Probetermine</label>
                  <div className="space-y-2">
                    {trialSlots.map((slot, index) => (
                      <label className="block" key={slot.availabilityRuleId}>
                        <input
                          className="peer sr-only"
                          defaultChecked={index === 0}
                          name="availabilityRuleId"
                          required
                          type="radio"
                          value={slot.availabilityRuleId}
                        />
                        <span className="flex min-h-[52px] items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-700 transition peer-checked:border-forest peer-checked:bg-sand peer-checked:text-stone-900">
                          <span>{formatTrialSlotRange(slot.startAt, slot.endAt)}</span>
                          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500 peer-checked:text-forest">Auswaehlen</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="text-sm text-stone-600">Die naechsten 10 explizit freigegebenen Probetermine werden direkt aus dem Kalender uebernommen.</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm leading-6 text-stone-600">
                  Fuer dieses Pferd sind aktuell keine festen Probetermine gepflegt. Du kannst stattdessen eine allgemeine Probeanfrage senden.
                </div>
              )}
              <div>
                <label htmlFor="message">Nachricht (optional)</label>
                <textarea
                  id="message"
                  name="message"
                  placeholder="Stelle dich kurz vor oder gib einen wichtigen Hinweis zum Probetermin mit."
                  rows={4}
                />
              </div>
              <SubmitButton
                idleLabel={hasExplicitTrialSlots ? "Probetermin anfragen" : "Allgemeine Probeanfrage senden"}
                pendingLabel="Wird gesendet..."
              />
            </form>
          ) : null}

          {canSelectTrialSlot && !hasExplicitTrialSlots ? (
            <p className="text-sm text-stone-500">Der Pferdehalter kann spaeter konkrete Probetermine im Kalender freigeben. Bis dahin geht eine allgemeine Anfrage ein.</p>
          ) : null}
        </SectionCard>
      ) : null}
    </div>
  );
}
