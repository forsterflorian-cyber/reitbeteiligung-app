import type { Route } from "next";
import Link from "next/link";

import { startOwnerTrialAction } from "@/app/actions";
import { EntityCard } from "@/components/blocks/entity-card";
import { RequestCard } from "@/components/blocks/request-card";
import { StatGrid, type StatItem } from "@/components/blocks/stat-grid";
import { Notice } from "@/components/notice";
import { AppPageShell } from "@/components/ui/app-page-shell";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { requireProfile } from "@/lib/auth";
import { hasUnreadOwnerMessage, loadOwnerWorkspaceData } from "@/lib/owner-workspace";
import { OWNER_PLAN_LIMITS_ENABLED, PAID_PLAN_CONTACT_EMAIL, canStartOwnerTrial, getOwnerPlan, getOwnerPlanUsageSummary } from "@/lib/plans";
import { getProfileDisplayName } from "@/lib/profiles";
import { readSearchParam } from "@/lib/search-params";
import { R1_CORE_MODE } from "@/lib/release-stage";
import type { Approval, Booking, Horse, RiderProfile, TrialRequest } from "@/types/database";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(value));
}

function formatDateTimeRange(startAt: string | null | undefined, endAt: string | null | undefined) {
  if (!startAt || !endAt) {
    return null;
  }

  return `${new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(startAt))} bis ${new Intl.DateTimeFormat("de-DE", {
    timeStyle: "short"
  }).format(new Date(endAt))}`;
}

export default async function DashboardPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { profile, supabase, user } = await requireProfile();
  const message = readSearchParam(searchParams, "message");
  const displayName = getProfileDisplayName(profile, user.email);

  if (profile.role === "owner") {
    const ownerManageHref = "/owner/pferde-verwalten" as Route;
    const ownerCreateHref = "/owner/horses" as Route;
    const ownerTrialsHref = "/owner/anfragen" as Route;
    const ownerRelationshipsHref = "/owner/reitbeteiligungen" as Route;
    const ownerMessagesHref = "/owner/nachrichten" as Route;

    const { activeRelationships, horses, latestMessages, trialPipelineItems } = await loadOwnerWorkspaceData(supabase, user.id);
    const unreadCount = activeRelationships.reduce((count, item) => {
      const latestMessage = item.conversation ? (latestMessages.get(item.conversation.id) ?? null) : null;
      return hasUnreadOwnerMessage(item.conversation, latestMessage, user.id) ? count + 1 : count;
    }, 0);

    const ownerPlanUsage = {
      approvedRiderCount: activeRelationships.length,
      horseCount: horses.length
    };
    const ownerPlan = OWNER_PLAN_LIMITS_ENABLED ? getOwnerPlan(profile, ownerPlanUsage) : null;
    const ownerPlanUsageSummary = ownerPlan ? getOwnerPlanUsageSummary(ownerPlan, ownerPlanUsage) : null;
    const showStartTrial = OWNER_PLAN_LIMITS_ENABLED ? canStartOwnerTrial(profile) : false;
    const upgradeHref = `mailto:${PAID_PLAN_CONTACT_EMAIL}?subject=${encodeURIComponent("Bezahlten Tarif anfragen")}`;

    const ownerStats: StatItem[] = [
      {
        label: "Pferdeprofile",
        value: horses.length,
        helper: "Deine angelegten Pferdeprofile."
      },
      {
        label: "Probetermine",
        value: trialPipelineItems.length,
        helper: "Diese Probetermine brauchen eine Entscheidung."
      },
      {
        label: "Reitbeteiligungen",
        value: activeRelationships.length,
        helper: "Diese Beziehungen laufen bereits aktiv."
      },
      {
        label: "Nachrichten",
        value: unreadCount,
        helper: unreadCount > 0 ? "Ungelesene Chats warten auf dich." : "Alle Chats sind aktuell gelesen."
      }
    ];

    const pendingCards = trialPipelineItems
      .slice(0, 4)
      .map((request) => ({
        ctaLabel: "Probetermine \u00f6ffnen",
        description:
          formatDateTimeRange(request.requested_start_at, request.requested_end_at) ??
          request.message?.trim() ??
          "Keine Nachricht hinterlegt.",
        eyebrow: "Probetermin",
        href: ownerTrialsHref,
        meta: formatDate(request.created_at),
        sortValue: Date.parse(request.created_at),
        status: request.status,
        title: request.horse?.title ?? "Pferdeprofil"
      }))
      .sort((left, right) => right.sortValue - left.sortValue);

    return (
      <AppPageShell>
        <PageHeader
          actions={
            <>
              <Link className={buttonVariants("primary", "w-full sm:w-auto")} href={ownerManageHref}>
                Pferde verwalten
              </Link>
              <Link className={buttonVariants("secondary", "w-full sm:w-auto")} href={ownerCreateHref}>
                Neues Pferd anlegen
              </Link>
              <Link className={buttonVariants("ghost", "w-full sm:w-auto")} href={ownerTrialsHref}>
                Probetermine
              </Link>
            </>
          }
          backdropVariant="hero"
          subtitle={`Hallo ${displayName}. Von hier springst du direkt in Pferde, Probetermine und dein laufendes Tagesgesch\u00e4ft.`}
          surface
          title="Übersicht"
        />
        <Notice text={message} tone="success" />
        <StatGrid items={ownerStats} />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <SectionCard
            action={<Link className={buttonVariants("secondary")} href={ownerManageHref}>Zur Verwaltung</Link>}
            subtitle="Bestehende Pferde zuerst, das neue Pferd liegt bewusst im Untermenü."
            title="Pferde im Blick"
          >
            <div className="space-y-4">
              {horses.length === 0 ? (
                <EmptyState
                  action={<Link className={buttonVariants("primary")} href={ownerCreateHref}>Erstes Pferd anlegen</Link>}
                  description="Lege zuerst ein Pferdeprofil an, damit Probetermine und Reitbeteiligungen starten können."
                  title="Noch kein Pferd angelegt"
                />
              ) : (
                horses.slice(0, 4).map((horse) => (
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
            action={<Link className={buttonVariants("secondary")} href={ownerMessagesHref}>Nachrichten</Link>}
            subtitle="Was gerade zuerst beantwortet oder bearbeitet werden sollte."
            title="Sofort im Fokus"
          >
            <div className="space-y-4">
              {pendingCards.length === 0 ? (
                <EmptyState
                  description="Gerade ist nichts offen. Wenn etwas Neues reinkommt, landet es hier zuerst."
                  title="Alles auf Stand"
                />
              ) : (
                pendingCards.slice(0, 4).map((item, index) => (
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
        {OWNER_PLAN_LIMITS_ENABLED ? (
          <SectionCard
            action={
              (ownerPlan?.key !== "paid" || showStartTrial) ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {showStartTrial ? (
                    <form action={startOwnerTrialAction}>
                      <input name="redirectTo" type="hidden" value="/dashboard" />
                      <Button className="w-full sm:w-auto" type="submit" variant="secondary">
                        Start Trial
                      </Button>
                    </form>
                  ) : null}
                  {ownerPlan?.key !== "paid" ? (
                    <a className={buttonVariants(showStartTrial ? "ghost" : "secondary")} href={upgradeHref}>
                      Bezahlten Tarif anfragen
                    </a>
                  ) : null}
                  <Link className={buttonVariants("ghost")} href={ownerRelationshipsHref}>
                    Reitbeteiligungen öffnen
                  </Link>
                </div>
              ) : undefined
            }
            subtitle="Der Release-Status steht bewusst am Ende, damit vorher die Kernarbeit im Fokus bleibt."
            title="Status im ersten Release"
          >
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge tone={ownerPlan?.key === "paid" ? "approved" : ownerPlan?.key === "trial" ? "pending" : "neutral"}>{ownerPlan?.label}</Badge>
              </div>
              <p className="text-sm leading-6 text-stone-600">{ownerPlan?.summary}</p>
              {ownerPlan?.key !== "paid" ? <p className="text-sm leading-6 text-stone-600">{ownerPlanUsageSummary}</p> : null}
            </div>
          </SectionCard>
        ) : null}
      </AppPageShell>
    );
  }

  const riderRequestsHref = "/anfragen" as Route;
  const riderProfileHref = "/rider/profile" as Route;
  const riderSearchHref = "/suchen" as Route;

  const [{ data: riderProfileData }, { data: trialRequestsData }, { data: riderApprovalsData }, { data: upcomingBookingsData }] = await Promise.all([
    supabase.from("rider_profiles").select("user_id").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("trial_requests")
      .select("id, horse_id, rider_id, status, message, availability_rule_id, requested_start_at, requested_end_at, created_at")
      .eq("rider_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("approvals").select("horse_id, rider_id, status, created_at").eq("rider_id", user.id).eq("status", "approved"),
    !R1_CORE_MODE
      ? supabase
          .from("bookings")
          .select("id, booking_request_id, availability_rule_id, slot_id, horse_id, rider_id, start_at, end_at, created_at")
          .eq("rider_id", user.id)
          .gte("start_at", new Date().toISOString())
          .order("start_at", { ascending: true })
          .limit(4)
      : Promise.resolve({ data: [] as Booking[] | null })
  ]);

  const riderProfile = (riderProfileData as Pick<RiderProfile, "user_id"> | null) ?? null;
  const trials = (trialRequestsData as TrialRequest[] | null) ?? [];
  const activeApprovals = (riderApprovalsData as Approval[] | null) ?? [];
  const upcomingBookings = (upcomingBookingsData as Booking[] | null) ?? [];
  const nextBooking = !R1_CORE_MODE ? upcomingBookings[0] ?? null : null;
  const activeRelationshipKeys = new Set(activeApprovals.map((approval) => `${approval.horse_id}:${approval.rider_id}`));
  const openTrials = trials.filter((trial) => (trial.status === "requested" || trial.status === "accepted") && !activeRelationshipKeys.has(`${trial.horse_id}:${trial.rider_id}`));
  const openTrialCount = openTrials.length;
  const riderHorseIds = [...new Set([...trials.map((trial) => trial.horse_id), ...(!R1_CORE_MODE ? upcomingBookings.map((booking) => booking.horse_id) : [])])];
  let riderHorseMap = new Map<string, Pick<Horse, "id" | "title" | "plz">>();

  if (riderHorseIds.length > 0) {
    const { data: riderHorseData } = await supabase.from("horses").select("id, title, plz").in("id", riderHorseIds);
    riderHorseMap = new Map(
      (((riderHorseData as Array<Pick<Horse, "id" | "title" | "plz">> | null) ?? [])).map((horse) => [horse.id, horse])
    );
  }

  const focusTrial = openTrials[0] ?? null;
  const nextBookingHorse = nextBooking ? (riderHorseMap.get(nextBooking.horse_id) ?? null) : null;

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
      label: "Aktive Reitbeteiligungen",
      value: activeApprovals.length,
      helper: activeApprovals.length > 0 ? "Diese Reitbeteiligungen sind bereits aktiv freigeschaltet." : "Nach der Freischaltung erscheinen aktive Reitbeteiligungen hier."
    }
  ];

  return (
    <AppPageShell>
      <PageHeader
        actions={
          <>
            <Link className={buttonVariants("primary", "w-full sm:w-auto")} href={riderSearchHref}>
              Pferde finden
            </Link>
            <Link className={buttonVariants("secondary", "w-full sm:w-auto")} href={riderRequestsHref}>
              Proben & Chats
            </Link>
            <Link className={buttonVariants("ghost", "w-full sm:w-auto")} href={riderProfileHref}>
              Profil bearbeiten
            </Link>
          </>
        }
        backdropVariant="hero"
        subtitle={`Hallo ${displayName}. Hier stehen offene Probetermine, Freischaltungen und deine Chats direkt im Fokus.`}
        surface
        title="Übersicht"
      />
      <Notice text={message} tone="success" />
      <SectionCard subtitle="Dein n\u00e4chster Probetermin oder der schnellste Einstieg in deine aktiven Reitbeteiligungen." title="Als N\u00e4chstes">
        {focusTrial ? (
          <RequestCard
            ctaLabel="Zur Anfrage"
            description={formatDateTimeRange(focusTrial.requested_start_at, focusTrial.requested_end_at) ?? focusTrial.message?.trim() ?? "Keine Nachricht hinterlegt."}
            eyebrow={riderHorseMap.get(focusTrial.horse_id)?.plz ? `PLZ ${riderHorseMap.get(focusTrial.horse_id)?.plz}` : "Probetermin"}
            href={riderRequestsHref}
            meta={formatDate(focusTrial.created_at)}
            status={focusTrial.status}
            title={riderHorseMap.get(focusTrial.horse_id)?.title ?? "Pferdeprofil"}
          />
        ) : nextBooking ? (
          <Card className="p-5">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="approved">Nächste Buchung</Badge>
                <p className="text-sm text-stone-500">{formatDate(nextBooking.start_at)}</p>
              </div>
              <p className="text-lg font-semibold text-stone-900">{nextBookingHorse?.title ?? "Reitbeteiligung"}</p>
              <p className="text-sm text-stone-600">{formatDateTimeRange(nextBooking.start_at, nextBooking.end_at)}</p>
              <Link className={buttonVariants("secondary", "w-full sm:w-auto")} href={riderRequestsHref}>
                Reitbeteiligung planen
              </Link>
            </div>
          </Card>
        ) : (
          <EmptyState
            action={<Link className={buttonVariants("primary")} href={riderSearchHref}>Passende Pferde finden</Link>}
            description="Sobald du einen Probetermin anfragst oder als Reitbeteiligung aufgenommen wirst, erscheint es hier zuerst."
            title="Noch nichts geplant"
          />
        )}
      </SectionCard>
      {!R1_CORE_MODE && upcomingBookings.length > 0 ? (
        <SectionCard
          action={<Link className={buttonVariants("secondary")} href={riderRequestsHref}>Zur Planung</Link>}
          subtitle="Deine n?chsten bereits best?tigten Termine als aktive Reitbeteiligung."
          title="N\u00e4chste Termine"
        >
          <div className="grid gap-3">
            {upcomingBookings.slice(0, 3).map((booking) => {
              const horse = riderHorseMap.get(booking.horse_id);

              return (
                <Card className="p-4" key={booking.id}>
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="approved">Best\u00e4tigt</Badge>
                      <p className="text-sm text-stone-500">{formatDate(booking.start_at)}</p>
                    </div>
                    <p className="font-semibold text-stone-900">{horse?.title ?? "Reitbeteiligung"}</p>
                    <p className="text-sm text-stone-600">{formatDateTimeRange(booking.start_at, booking.end_at)}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        </SectionCard>
      ) : null}
      <StatGrid className="xl:grid-cols-3" items={riderStats} />
      <SectionCard
        action={<Link className={buttonVariants("secondary")} href={riderRequestsHref}>Alle Anfragen</Link>}
        subtitle="Die neuesten Probetermine und ihr aktueller Stand."
        title="Neueste Probetermine"
      >
        <div className="space-y-4">
          {trials.length === 0 ? (
            <EmptyState
              action={<Link className={buttonVariants("primary")} href={riderSearchHref}>Passende Pferde finden</Link>}
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
        <SectionCard subtitle="Ohne Profil sehen Pferdehalter nur sehr wenig von dir." title="Profil vervollständigen">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-stone-600">Ergänze Erfahrung, Gewicht und Notizen, damit deine Anfragen besser einschätzbar sind.</p>
            <Link className={buttonVariants("secondary", "w-full sm:w-auto")} href={riderProfileHref}>
              Jetzt bearbeiten
            </Link>
          </div>
        </SectionCard>
      ) : null}
    </AppPageShell>
  );
}
