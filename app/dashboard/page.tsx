import type { Route } from "next";
import Link from "next/link";

import { startOwnerTrialAction } from "@/app/actions";
import { EntityCard } from "@/components/blocks/entity-card";
import { RequestCard } from "@/components/blocks/request-card";
import { OwnerOperationalWorkspace } from "@/components/owner/owner-operational-workspace";
import { RiderOperationalWorkspace } from "@/components/rider/rider-operational-workspace";
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
import { hasUnreadOwnerMessage, loadOwnerOperationalWorkspaceData, loadOwnerWorkspaceData } from "@/lib/owner-workspace";
import { OWNER_PLAN_LIMITS_ENABLED, PAID_PLAN_CONTACT_EMAIL, canStartOwnerTrial, getOwnerPlan, getOwnerPlanUsageSummary } from "@/lib/plans";
import { getProfileDisplayName } from "@/lib/profiles";
import { getRiderRelationshipSection, getRelationshipKey, isCompletedTrialAwaitingDecision } from "@/lib/relationship-state";
import { hasUnreadRiderMessage, loadRiderOperationalWorkspaceData, loadRiderWorkspaceData } from "@/lib/rider-workspace";
import { R1_CORE_MODE } from "@/lib/release-stage";
import { readSearchParam } from "@/lib/search-params";
import type { Booking, RiderProfile } from "@/types/database";

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
  const selectedBookingId = readSearchParam(searchParams, "rescheduleBooking");
  const displayName = getProfileDisplayName(profile, user.email);

  if (profile.role === "owner") {
    const ownerManageHref = "/owner/pferde-verwalten" as Route;
    const ownerCreateHref = "/owner/horses" as Route;
    const ownerTrialsHref = "/owner/anfragen" as Route;
    const ownerRelationshipsHref = "/owner/reitbeteiligungen" as Route;
    const ownerMessagesHref = "/owner/nachrichten" as Route;

    const { activeRelationships, horses, latestMessages, trialPipelineItems } = await loadOwnerWorkspaceData(supabase, user.id);
    const operationalWorkspace = await loadOwnerOperationalWorkspaceData(supabase, horses, activeRelationships, {
      selectedBookingId
    });
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
        ctaLabel: "Probetermine oeffnen",
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
          subtitle={`Hallo ${displayName}. Von hier springst du direkt in Pferde, Probetermine und dein laufendes Tagesgeschaeft.`}
          surface
          title="Uebersicht"
        />
        <Notice text={message} tone="success" />
        <StatGrid items={ownerStats} />
        <OwnerOperationalWorkspace items={operationalWorkspace} pagePath="/dashboard" />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <SectionCard
            action={<Link className={buttonVariants("secondary")} href={ownerManageHref}>Zur Verwaltung</Link>}
            subtitle="Bestehende Pferde zuerst, das neue Pferd liegt bewusst im Untermenue."
            title="Pferde im Blick"
          >
            <div className="space-y-4">
              {horses.length === 0 ? (
                <EmptyState
                  action={<Link className={buttonVariants("primary")} href={ownerCreateHref}>Erstes Pferd anlegen</Link>}
                  description="Lege zuerst ein Pferdeprofil an, damit Probetermine und Reitbeteiligungen starten koennen."
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
              ownerPlan?.key !== "paid" || showStartTrial ? (
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
                    Reitbeteiligungen oeffnen
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

  const riderRelationshipsHref = "/anfragen" as Route;
  const riderMessagesHref = "/nachrichten" as Route;
  const riderProfileHref = "/rider/profile" as Route;
  const riderSearchHref = "/suchen" as Route;

  const [{ data: riderProfileData }, { data: upcomingBookingsData }, riderWorkspace] = await Promise.all([
    supabase.from("rider_profiles").select("user_id").eq("user_id", user.id).maybeSingle(),
    !R1_CORE_MODE
      ? supabase
          .from("bookings")
          .select("id, booking_request_id, availability_rule_id, slot_id, horse_id, rider_id, start_at, end_at, created_at")
          .eq("rider_id", user.id)
          .gte("start_at", new Date().toISOString())
          .order("start_at", { ascending: true })
          .limit(4)
      : Promise.resolve({ data: [] as Booking[] | null }),
    loadRiderWorkspaceData(supabase, user.id)
  ]);

  const riderProfile = (riderProfileData as Pick<RiderProfile, "user_id"> | null) ?? null;
  const upcomingBookings = (upcomingBookingsData as Booking[] | null) ?? [];
  const nextBooking = !R1_CORE_MODE ? upcomingBookings[0] ?? null : null;
  const { activeRelationships, approvalStatusMap, conversations, horseMap, latestMessages, requests } = riderWorkspace;
  const operationalWorkspace = await loadRiderOperationalWorkspaceData(supabase, user.id, activeRelationships, {
    selectedBookingId
  });
  const unreadCount = conversations.reduce((count, conversation) => {
    const latestMessage = latestMessages.get(conversation.id) ?? null;
    return hasUnreadRiderMessage(conversation, latestMessage, user.id) ? count + 1 : count;
  }, 0);
  const clarificationItems = requests
    .map((item) => {
      const approvalStatus = approvalStatusMap.get(getRelationshipKey(item.horse_id, item.rider_id)) ?? null;

      return {
        ...item,
        approvalStatus,
        isCompletedDecisionPending: isCompletedTrialAwaitingDecision(item.status, approvalStatus)
      };
    })
    .filter((item) => getRiderRelationshipSection(item.status, item.approvalStatus) === "in_clarification")
    .sort((left, right) => Date.parse(right.requested_start_at ?? right.created_at) - Date.parse(left.requested_start_at ?? left.created_at));
  const focusItem = clarificationItems[0] ?? null;
  const nextBookingHorse = nextBooking ? (horseMap.get(nextBooking.horse_id) ?? null) : null;

  const riderStats: StatItem[] = [
    {
      label: "Profilstatus",
      value: <Badge tone={riderProfile ? "approved" : "pending"}>{riderProfile ? "Bereit" : "Unvollstaendig"}</Badge>,
      valueClassName: "text-base",
      helper: riderProfile ? "Dein Reiterprofil ist angelegt." : "Bitte vervollstaendige dein Reiterprofil fuer passende Anfragen."
    },
    {
      label: "In Klaerung",
      value: clarificationItems.length,
      helper: "Offene Anfragen, geplante Proben und Entscheidungen, die noch ausstehen."
    },
    {
      label: "Aktive Reitbeteiligungen",
      value: activeRelationships.length,
      helper: activeRelationships.length > 0 ? "Diese Reitbeteiligungen sind bereits aktiv freigeschaltet." : "Aktive Reitbeteiligungen erscheinen hier nach der Freischaltung."
    },
    {
      label: "Nachrichten",
      value: unreadCount,
      helper: unreadCount > 0 ? "Ungelesene Chats warten unter Nachrichten." : "Alle Chats sind aktuell gelesen."
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
            <Link className={buttonVariants("secondary", "w-full sm:w-auto")} href={riderRelationshipsHref}>
              Meine Reitbeteiligungen
            </Link>
            <Link className={buttonVariants("ghost", "w-full sm:w-auto")} href={riderMessagesHref}>
              Nachrichten
            </Link>
          </>
        }
        backdropVariant="hero"
        subtitle={`Hallo ${displayName}. Hier siehst du getrennt, was aktiv ist, was noch in Klaerung ist und wo deine Nachrichten warten.`}
        surface
        title="Uebersicht"
      />
      <Notice text={message} tone="success" />
      <RiderOperationalWorkspace items={operationalWorkspace} pagePath="/dashboard" />
      <SectionCard subtitle="Dein naechster offener Fall oder der schnellste Einstieg in eine laufende Reitbeteiligung." title="Als Naechstes">
        {focusItem ? (
          <RequestCard
            ctaLabel="Meine Reitbeteiligungen"
            description={
              focusItem.isCompletedDecisionPending
                ? `Durchgefuehrt, Entscheidung offen. ${formatDateTimeRange(focusItem.requested_start_at, focusItem.requested_end_at) ?? focusItem.message?.trim() ?? "Keine Nachricht hinterlegt."}`
                : formatDateTimeRange(focusItem.requested_start_at, focusItem.requested_end_at) ?? focusItem.message?.trim() ?? "Keine Nachricht hinterlegt."
            }
            eyebrow={horseMap.get(focusItem.horse_id)?.plz ? `PLZ ${horseMap.get(focusItem.horse_id)?.plz}` : "In Klaerung"}
            href={riderRelationshipsHref}
            meta={formatDate(focusItem.created_at)}
            status={focusItem.status}
            title={horseMap.get(focusItem.horse_id)?.title ?? "Pferdeprofil"}
          />
        ) : nextBooking ? (
          <Card className="p-5">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="approved">Naechste Buchung</Badge>
                <p className="text-sm text-stone-500">{formatDate(nextBooking.start_at)}</p>
              </div>
              <p className="text-lg font-semibold text-stone-900">{nextBookingHorse?.title ?? "Reitbeteiligung"}</p>
              <p className="text-sm text-stone-600">{formatDateTimeRange(nextBooking.start_at, nextBooking.end_at)}</p>
              <Link className={buttonVariants("secondary", "w-full sm:w-auto")} href={`/pferde/${nextBooking.horse_id}/kalender` as Route}>
                Kalender oeffnen
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
          action={<Link className={buttonVariants("secondary")} href={riderRelationshipsHref}>Meine Reitbeteiligungen</Link>}
          subtitle="Deine naechsten bereits bestaetigten Termine als aktive Reitbeteiligung."
          title="Naechste Termine"
        >
          <div className="grid gap-3">
            {upcomingBookings.slice(0, 3).map((booking) => {
              const horse = horseMap.get(booking.horse_id) ?? null;

              return (
                <Card className="p-4" key={booking.id}>
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="approved">Bestaetigt</Badge>
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
      <StatGrid className="xl:grid-cols-4" items={riderStats} />
      <SectionCard
        action={<Link className={buttonVariants("secondary")} href={riderRelationshipsHref}>Zur Klaerung</Link>}
        subtitle="Die wichtigsten offenen Faelle fuer deine Reitbeteiligungen."
        title="In Klaerung"
      >
        <div className="space-y-4">
          {clarificationItems.length === 0 ? (
            <EmptyState
              action={<Link className={buttonVariants("primary")} href={riderSearchHref}>Passende Pferde finden</Link>}
              description="Sobald ein neuer Fall offen ist, erscheint er hier zuerst."
              title="Gerade nichts offen"
            />
          ) : (
            clarificationItems.slice(0, 4).map((item) => {
              const horse = horseMap.get(item.horse_id) ?? null;

              return (
                <RequestCard
                  ctaLabel="Details"
                  description={
                    item.isCompletedDecisionPending
                      ? `Durchgefuehrt, Entscheidung offen. ${formatDateTimeRange(item.requested_start_at, item.requested_end_at) ?? item.message?.trim() ?? "Keine Nachricht hinterlegt."}`
                      : formatDateTimeRange(item.requested_start_at, item.requested_end_at) ?? item.message?.trim() ?? "Keine Nachricht hinterlegt."
                  }
                  eyebrow={horse?.plz ? `PLZ ${horse.plz}` : "Pferdeprofil"}
                  href={riderRelationshipsHref}
                  key={item.id}
                  meta={formatDate(item.created_at)}
                  status={item.status}
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
