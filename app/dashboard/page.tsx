import type { Route } from "next";
import Link from "next/link";

import { EntityCard } from "@/components/blocks/entity-card";
import { RequestCard } from "@/components/blocks/request-card";
import { StatGrid, type StatItem } from "@/components/blocks/stat-grid";
import { Notice } from "@/components/notice";
import { AppPageShell } from "@/components/ui/app-page-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { requireProfile } from "@/lib/auth";
import { getOwnerPlan } from "@/lib/plans";
import { getProfileDisplayName } from "@/lib/profiles";
import { readSearchParam } from "@/lib/search-params";
import type { Approval, BookingRequest, Horse, RiderProfile, TrialRequest } from "@/types/database";

type DashboardPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

type DashboardRequestCard = {
  ctaLabel: string;
  description: string;
  eyebrow: string;
  href: Route;
  meta: string;
  sortValue: number;
  status: TrialRequest["status"] | BookingRequest["status"];
  title: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium"
  }).format(new Date(value));
}

function formatDateTimeRange(startAt: string | null | undefined, endAt: string | null | undefined) {
  if (!startAt || !endAt) {
    return null;
  }

  return `${new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(startAt))} bis ${new Intl.DateTimeFormat("de-DE", {
    timeStyle: "short"
  }).format(new Date(endAt))}`;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { profile, supabase, user } = await requireProfile();
  const message = readSearchParam(searchParams, "message");
  const displayName = getProfileDisplayName(profile, user.email);

  if (profile.role === "owner") {
    const ownerManageHref = "/owner/pferde-verwalten" as Route;
    const ownerCreateHref = "/owner/horses" as Route;
    const ownerRequestsHref = "/owner/anfragen" as Route;

    const { data: horsesData } = await supabase
      .from("horses")
      .select("id, owner_id, title, plz, description, active, created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    const ownerHorses = (horsesData as Horse[] | null) ?? [];
    const horseIds = ownerHorses.map((horse) => horse.id);
    const activeHorseCount = ownerHorses.filter((horse) => horse.active).length;

    let approvedApprovals: Array<Pick<Approval, "horse_id">> = [];
    let pendingTrialRequests: TrialRequest[] = [];
    let pendingBookingRequests: BookingRequest[] = [];

    if (horseIds.length > 0) {
      const [{ data: trialsData }, { data: bookingData }, { data: approvalsData }] = await Promise.all([
        supabase
          .from("trial_requests")
          .select("id, horse_id, rider_id, status, message, availability_rule_id, requested_start_at, requested_end_at, created_at")
          .in("horse_id", horseIds)
          .eq("status", "requested")
          .order("created_at", { ascending: false })
          .limit(6),
        supabase
          .from("booking_requests")
          .select("id, slot_id, availability_rule_id, horse_id, rider_id, status, requested_start_at, requested_end_at, recurrence_rrule, created_at")
          .in("horse_id", horseIds)
          .eq("status", "requested")
          .order("created_at", { ascending: false })
          .limit(6),
        supabase
          .from("approvals")
          .select("horse_id")
          .in("horse_id", horseIds)
          .eq("status", "approved")
      ]);

      approvedApprovals = (approvalsData as Array<Pick<Approval, "horse_id">> | null) ?? [];
      pendingTrialRequests = (trialsData as TrialRequest[] | null) ?? [];
      pendingBookingRequests = (bookingData as BookingRequest[] | null) ?? [];
    }

    const ownerPlan = getOwnerPlan(profile, {
      approvedRiderCount: approvedApprovals.length,
      horseCount: ownerHorses.length
    });

    const ownerStats: StatItem[] = [
      {
        label: "Pferdeprofile",
        value: ownerHorses.length,
        helper: "Alle aktuell angelegten Pferdeprofile."
      },
      {
        label: "Aktive Profile",
        value: activeHorseCount,
        helper: `${ownerHorses.length - activeHorseCount} Profile sind derzeit inaktiv.`
      },
      {
        label: "Neue Anfragen",
        value: pendingTrialRequests.length + pendingBookingRequests.length,
        helper: `${pendingTrialRequests.length} Probetermine und ${pendingBookingRequests.length} Terminanfragen warten auf dich.`
      },
      {
        label: "Tarif",
        value: ownerPlan.label,
        valueClassName: "text-xl",
        helper:
          ownerPlan.key === "paid"
            ? ownerPlan.summary
            : `${ownerPlan.summary} ${approvedApprovals.length} von ${ownerPlan.maxApprovedRiders} Reitbeteiligungen aktuell genutzt.`
      }
    ];

    // Dashboard cards are shaped here once so the visual component only renders,
    // independent of whether the source row came from a trial or a booking request.
    const pendingRequestCards: DashboardRequestCard[] = [
      ...pendingTrialRequests.map((request) => ({
        ctaLabel: "Details",
        description:
        formatDateTimeRange(request.requested_start_at, request.requested_end_at) ??
        request.message?.trim() ??
        "Keine Nachricht hinterlegt.",
        eyebrow: "Probetermin",
        href: ownerRequestsHref,
        meta: formatDate(request.created_at),
        sortValue: Date.parse(request.created_at),
        status: request.status,
        title: ownerHorses.find((horse) => horse.id === request.horse_id)?.title ?? "Pferdeprofil"
      })),
      ...pendingBookingRequests.map((request) => ({
        ctaLabel: "Details",
        description: request.requested_start_at
          ? `Angefragt für ${formatDate(request.requested_start_at)}.`
          : "Zeitpunkt wird noch geprüft.",
        eyebrow: "Terminanfrage",
        href: ownerRequestsHref,
        meta: formatDate(request.created_at),
        sortValue: Date.parse(request.created_at),
        status: request.status,
        title: ownerHorses.find((horse) => horse.id === request.horse_id)?.title ?? "Pferdeprofil"
      }))
    ].sort((left, right) => right.sortValue - left.sortValue);

    return (
      <AppPageShell>
        <PageHeader
          actions={
            <>
              <Link className={buttonVariants("primary", "w-full sm:w-auto")} href={ownerCreateHref}>
                Neues Pferd anlegen
              </Link>
              <Link className={buttonVariants("secondary", "w-full sm:w-auto")} href={ownerRequestsHref}>
                Anfragen ansehen
              </Link>
              <Link className={buttonVariants("ghost", "w-full sm:w-auto")} href={ownerManageHref}>
                Pferde verwalten
              </Link>
            </>
          }
          backdropVariant="hero"
          subtitle={`Hallo ${displayName}. Hier siehst du, was heute Aufmerksamkeit braucht.`}
          surface
          title="Übersicht"
        />
        <Notice text={message} tone="success" />
        <StatGrid items={ownerStats} />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <SectionCard
            action={
              <Link className={buttonVariants("secondary")} href={ownerManageHref}>
                Alle anzeigen
              </Link>
            }
            subtitle="Basisdaten, Status und direkter Einstieg in die Verwaltung."
            title="Meine Pferde"
          >
            <div className="space-y-4">
              {ownerHorses.length === 0 ? (
                <EmptyState
                  action={
                    <Link className={buttonVariants("primary")} href={ownerCreateHref}>
                      Erstes Pferd anlegen
                    </Link>
                  }
                  description="Lege dein erstes Pferdeprofil an, um Probetermine und Anfragen zu verwalten."
                  title="Noch kein Pferd angelegt"
                />
              ) : (
                ownerHorses.slice(0, 4).map((horse) => (
                  <EntityCard
                    actionLabel="Verwalten"
                    description={horse.description?.trim() || "Beschreibung folgt. Du kannst das Profil jederzeit weiter ausbauen."}
                    href={ownerManageHref}
                    key={horse.id}
                    statusLabel={horse.active ? "Aktiv" : "Inaktiv"}
                    statusTone={horse.active ? "approved" : "neutral"}
                    subtitle={`PLZ ${horse.plz}`}
                    title={horse.title}
                  />
                ))
              )}
            </div>
          </SectionCard>
          <SectionCard
            action={
              <Link className={buttonVariants("secondary")} href={ownerRequestsHref}>
                Zur Liste
              </Link>
            }
            subtitle="Offene Punkte, die zuerst beantwortet werden sollten."
            title="Neue Anfragen"
          >
            <div className="space-y-4">
              {pendingRequestCards.length === 0 ? (
                <EmptyState
                  description="Sobald neue Probetermine oder Terminanfragen eingehen, erscheinen sie hier gesammelt."
                  title="Keine neuen Anfragen"
                />
              ) : (
                pendingRequestCards.slice(0, 5).map((item, index) => (
                  <RequestCard
                    ctaLabel={item.ctaLabel}
                    description={item.description}
                    eyebrow={item.eyebrow}
                    href={item.href}
                    key={`${item.title}-${item.sortValue}-${index}`}
                    meta={item.meta}
                    status={item.status}
                    title={item.title}
                  />
                ))
              )}
            </div>
          </SectionCard>
        </div>
      </AppPageShell>
    );
  }

  const riderRequestsHref = "/anfragen" as Route;
  const riderProfileHref = "/rider/profile" as Route;
  const riderSearchHref = "/suchen" as Route;

  const [{ data: riderProfileData }, { data: trialRequestsData }] = await Promise.all([
    supabase.from("rider_profiles").select("user_id").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("trial_requests")
      .select("id, horse_id, rider_id, status, message, availability_rule_id, requested_start_at, requested_end_at, created_at")
      .eq("rider_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5)
  ]);

  const riderProfile = (riderProfileData as Pick<RiderProfile, "user_id"> | null) ?? null;
  const trials = (trialRequestsData as TrialRequest[] | null) ?? [];
  const riderHorseIds = [...new Set(trials.map((trial) => trial.horse_id))];
  let riderHorseMap = new Map<string, Pick<Horse, "id" | "title" | "plz">>();

  if (riderHorseIds.length > 0) {
    const { data: riderHorseData } = await supabase.from("horses").select("id, title, plz").in("id", riderHorseIds);
    riderHorseMap = new Map(
      (((riderHorseData as Array<Pick<Horse, "id" | "title" | "plz">> | null) ?? [])).map((horse) => [horse.id, horse])
    );
  }

  const openTrialCount = trials.filter((trial) => trial.status === "requested" || trial.status === "accepted").length;
  const riderStats: StatItem[] = [
    {
      label: "Profilstatus",
      value: <Badge tone={riderProfile ? "approved" : "pending"}>{riderProfile ? "Bereit" : "Unvollständig"}</Badge>,
      valueClassName: "text-base",
      helper: riderProfile ? "Dein Reiterprofil ist angelegt." : "Bitte vervollständige dein Reiterprofil für passende Anfragen."
    },
    {
      label: "Offene Probetermine",
      value: openTrialCount,
      helper: "Anfragen mit Status Ausstehend oder Angenommen."
    },
    {
      label: "Nächster Schritt",
      value: riderProfile ? "Pferde suchen" : "Profil ausfuellen",
      valueClassName: "text-xl",
      helper: riderProfile
        ? "Suche passende Pferde und frage einen Probetermin an."
        : "Ergänze dein Profil, damit Pferdehalter dich besser einschätzen können."
    }
  ];

  return (
    <AppPageShell>
      <PageHeader
        actions={
          <>
            <Link className={buttonVariants("primary", "w-full sm:w-auto")} href={riderSearchHref}>
              Pferde suchen
            </Link>
            <Link className={buttonVariants("secondary", "w-full sm:w-auto")} href={riderProfileHref}>
              Profil bearbeiten
            </Link>
            <Link className={buttonVariants("ghost", "w-full sm:w-auto")} href={riderRequestsHref}>
              Anfragen
            </Link>
          </>
        }
        backdropVariant="hero"
        subtitle={`Hallo ${displayName}. Hier siehst du deinen Profilstatus und die nächsten Probetermine auf einen Blick.`}
        surface
        title="Übersicht"
      />
      <Notice text={message} tone="success" />
      <StatGrid className="xl:grid-cols-3" items={riderStats} />
      <SectionCard
        action={
          <Link className={buttonVariants("secondary")} href={riderRequestsHref}>
            Alle Anfragen
          </Link>
        }
        subtitle="Die neuesten Probetermine und ihr aktueller Stand."
        title="Neueste Probetermine"
      >
        <div className="space-y-4">
          {trials.length === 0 ? (
            <EmptyState
              action={
                <Link className={buttonVariants("primary")} href={riderSearchHref}>
                  Passende Pferde finden
                </Link>
              }
              description="Sobald du deinen ersten Probetermin anfragst, erscheint er hier in der Übersicht."
              title="Noch keine Probetermine"
            />
          ) : (
            trials.map((trial) => {
              const horse = riderHorseMap.get(trial.horse_id);

              return (
                <RequestCard
                  ctaLabel="Details"
                  description={formatDateTimeRange(trial.requested_start_at, trial.requested_end_at) ?? trial.message?.trim() ?? "Keine Nachricht hinterlegt."}
                  eyebrow={horse?.plz ? `PLZ ${horse.plz}` : "Pferdeprofil"}
                  href={riderRequestsHref}
                  key={trial.id}
                  meta={formatDate(trial.created_at)}
                  status={trial.status}
                  timeline
                  title={horse?.title ?? "Pferdeprofil"}
                />
              );
            })
          )}
        </div>
      </SectionCard>
      {!riderProfile ? (
        <SectionCard subtitle="Ohne Profil sehen Pferdehalter nur sehr wenig von dir." title="Profil vervollstaendigen">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-stone-600">Ergaenze Erfahrung, Gewicht und Notizen, damit deine Anfragen besser einschaetzbar sind.</p>
            <Link className={buttonVariants("secondary", "w-full sm:w-auto")} href={riderProfileHref}>
              Jetzt bearbeiten
            </Link>
          </div>
        </SectionCard>
      ) : null}
    </AppPageShell>
  );
}
