import type { Route } from "next";
import Link from "next/link";

import { cancelTrialRequestAction, endRiderRelationshipAction } from "@/app/actions";
import { EndRelationshipModal } from "@/components/end-relationship-modal";
import { Notice } from "@/components/notice";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { R1_CORE_MODE } from "@/lib/release-stage";
import { canCancelTrialRequest } from "@/lib/trial-lifecycle";
import type { Approval, TrialRequest } from "@/types/database";

export type RiderActiveRelationshipCard = {
  horseId: string;
  horseTitle: string;
  ownerName: string;
  approvedAt: string;
  lastTrialStartAt: string | null;
  lastTrialEndAt: string | null;
  conversationId: string | null;
};

export type RiderLifecycleCard = {
  requestId: string;
  horseId: string;
  horseTitle: string;
  ownerName: string;
  requestedStartAt: string | null;
  requestedEndAt: string | null;
  createdAt: string;
  messageText: string;
  status: TrialRequest["status"];
  approvalStatus: Approval["status"] | null;
  conversationId: string | null;
  isCompletedDecisionPending: boolean;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatDateRange(startAt: string | null, endAt: string | null) {
  if (!startAt || !endAt) {
    return "Zeitpunkt wird noch geklaert.";
  }

  return `${formatDateTime(startAt)} bis ${formatDateTime(endAt)}`;
}

const inlineLinkClassName = buttonVariants(
  "ghost",
  "min-h-0 justify-start px-0 py-0 text-sm font-semibold text-forest hover:bg-transparent hover:text-clay"
);

type RiderRelationshipsWorkspaceProps = {
  activeRelationships: RiderActiveRelationshipCard[];
  archiveItems: RiderLifecycleCard[];
  clarificationItems: RiderLifecycleCard[];
  error: string | null;
  message: string | null;
};

function SectionJumpLinks({
  activeCount,
  archiveCount,
  clarificationCount
}: {
  activeCount: number;
  archiveCount: number;
  clarificationCount: number;
}) {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap gap-2">
        <a className={buttonVariants("ghost", "min-h-[40px] rounded-xl border border-stone-200 px-3 py-2")} href="#aktiv">
          Aktiv ({activeCount})
        </a>
        <a className={buttonVariants("ghost", "min-h-[40px] rounded-xl border border-stone-200 px-3 py-2")} href="#in-klaerung">
          In Klaerung ({clarificationCount})
        </a>
        <a className={buttonVariants("ghost", "min-h-[40px] rounded-xl border border-stone-200 px-3 py-2")} href="#archiv">
          Archiv ({archiveCount})
        </a>
      </div>
    </Card>
  );
}

function ActiveRelationshipCard({ item }: { item: RiderActiveRelationshipCard }) {
  const messagesHref = item.conversationId ? (`/nachrichten#chat-${item.conversationId}` as Route) : ("/nachrichten" as Route);

  return (
    <Card className="p-5">
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">Aktive Reitbeteiligung</p>
          <p className="font-semibold text-ink">{item.horseTitle}</p>
          <p className="text-sm text-stone-600">Pferdehalter: {item.ownerName}</p>
        </div>
        <p className="text-sm font-semibold text-ink">{`Freigeschaltet seit ${formatDateTime(item.approvedAt)}`}</p>
        {item.lastTrialStartAt && item.lastTrialEndAt ? (
          <p className="text-sm text-stone-600">{`Letzter Probetermin: ${formatDateRange(item.lastTrialStartAt, item.lastTrialEndAt)}`}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Badge tone="approved">Aktiv</Badge>
          <Badge tone="neutral">Nachrichten separat</Badge>
        </div>
        <p className="text-sm leading-6 text-stone-600">
          Kommunikation findest du gesammelt unter Nachrichten. Hier bleibt der Status deiner Reitbeteiligung im Fokus.
        </p>
        <div className={`grid gap-2 ${R1_CORE_MODE ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
          <Link className={buttonVariants("primary", "w-full justify-center")} href={messagesHref}>
            Nachrichten oeffnen
          </Link>
          <Link className={buttonVariants("secondary", "w-full justify-center")} href={`/pferde/${item.horseId}` as Route}>
            Pferdeprofil ansehen
          </Link>
          {!R1_CORE_MODE ? (
            <Link className={buttonVariants("ghost", "w-full justify-center")} href={`/pferde/${item.horseId}/kalender` as Route}>
              Kalender oeffnen
            </Link>
          ) : null}
        </div>
        <EndRelationshipModal
          action={endRiderRelationshipAction}
          description={`Du beendest deine aktive Reitbeteiligung für "${item.horseTitle}" bei ${item.ownerName}.`}
          hiddenFields={{ horseId: item.horseId, redirectTo: "/anfragen" }}
        />
      </div>
    </Card>
  );
}

function LifecycleCard({
  item,
  section
}: {
  item: RiderLifecycleCard;
  section: "archive" | "clarification";
}) {
  const messagesHref = item.conversationId ? (`/nachrichten#chat-${item.conversationId}` as Route) : null;

  return (
    <Card className="p-5">
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">{section === "clarification" ? "In Klaerung" : "Archiv"}</p>
          <p className="font-semibold text-ink">{item.horseTitle}</p>
          <p className="text-sm text-stone-600">Pferdehalter: {item.ownerName}</p>
        </div>
        <p className="text-sm font-semibold text-ink">
          {item.requestedStartAt && item.requestedEndAt ? formatDateRange(item.requestedStartAt, item.requestedEndAt) : formatDateTime(item.createdAt)}
        </p>
        <p className="text-sm leading-6 text-stone-600">{item.messageText}</p>
        <div className="flex flex-wrap gap-2">
          {item.isCompletedDecisionPending ? <Badge tone="info">Durchgefuehrt, Entscheidung offen</Badge> : <StatusBadge status={item.status} />}
          {section === "archive" && item.approvalStatus ? <StatusBadge status={item.approvalStatus} /> : null}
        </div>
        {item.isCompletedDecisionPending ? (
          <Notice text="Der Probetermin ist bereits durchgefuehrt. Die Entscheidung zur Reitbeteiligung steht noch aus." tone="success" />
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <Link className={inlineLinkClassName} href={`/pferde/${item.horseId}` as Route}>
            Pferdeprofil ansehen
          </Link>
          {messagesHref ? (
            <Link className={inlineLinkClassName} href={messagesHref}>
              Nachrichten oeffnen
            </Link>
          ) : null}
          {section === "clarification" && canCancelTrialRequest(item.status) ? (
            <form action={cancelTrialRequestAction}>
              <input name="requestId" type="hidden" value={item.requestId} />
              <button
                className={buttonVariants(
                  "ghost",
                  "min-h-0 justify-start px-0 py-0 text-sm font-semibold text-rose-700 hover:bg-transparent hover:text-rose-800"
                )}
                type="submit"
              >
                Anfrage zurueckziehen
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

export function RiderRelationshipsWorkspace({
  activeRelationships,
  archiveItems,
  clarificationItems,
  error,
  message
}: RiderRelationshipsWorkspaceProps) {
  return (
    <>
      <PageHeader
        actions={
          <>
            <Link className={buttonVariants("primary", "w-full sm:w-auto")} href="/suchen">
              Pferde finden
            </Link>
            <Link className={buttonVariants("secondary", "w-full sm:w-auto")} href="/nachrichten">
              Nachrichten
            </Link>
            <Link className={buttonVariants("ghost", "w-full sm:w-auto")} href="/profil">
              Profil
            </Link>
          </>
        }
        backdropVariant="hero"
        eyebrow="Reiter"
        subtitle="Hier ist sauber getrennt, was aktiv laeuft, was noch offen ist und was nur noch zur Historie gehoert."
        surface
        title="Meine Reitbeteiligungen"
      />
      <Notice text={error} tone="error" />
      <Notice text={message} tone="success" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Aktiv</p>
          <p className="mt-2 text-2xl font-semibold text-stone-900">{activeRelationships.length}</p>
          <p className="mt-1 text-sm text-stone-600">Bestaetigte Reitbeteiligungen mit laufender Freischaltung.</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">In Klaerung</p>
          <p className="mt-2 text-2xl font-semibold text-stone-900">{clarificationItems.length}</p>
          <p className="mt-1 text-sm text-stone-600">Offene Anfragen, geplante Proben und Entscheidungen, die noch ausstehen.</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Archiv</p>
          <p className="mt-2 text-2xl font-semibold text-stone-900">{archiveItems.length}</p>
          <p className="mt-1 text-sm text-stone-600">Abgeschlossene, abgelehnte oder spaeter beendete Faelle ohne aktive Folge.</p>
        </Card>
      </div>
      <SectionJumpLinks
        activeCount={activeRelationships.length}
        archiveCount={archiveItems.length}
        clarificationCount={clarificationItems.length}
      />
      <SectionCard
        id="aktiv"
        subtitle="Nur bestaetigte aktive Reitbeteiligungen. Nachrichten laufen separat ueber den eigenen Navigationspunkt."
        title="Aktiv"
      >
        {activeRelationships.length === 0 ? (
          <EmptyState
            description="Sobald dich ein Pferdehalter freischaltet, erscheint die Reitbeteiligung hier."
            title="Noch keine aktive Reitbeteiligung"
          />
        ) : (
          <div className="space-y-3">
            {activeRelationships.map((item) => (
              <ActiveRelationshipCard item={item} key={item.horseId} />
            ))}
          </div>
        )}
      </SectionCard>
      <SectionCard
        id="in-klaerung"
        subtitle="Offene Anfragen, geplante Probetermine und bereits durchgefuehrte Termine mit ausstehender Entscheidung."
        title="In Klaerung"
      >
        {clarificationItems.length === 0 ? (
          <EmptyState
            description="Gerade ist kein Fall offen. Neue Probeanfragen oder Entscheidungen erscheinen hier zuerst."
            title="Nichts offen"
          />
        ) : (
          <div className="space-y-3">
            {clarificationItems.map((item) => (
              <LifecycleCard item={item} key={item.requestId} section="clarification" />
            ))}
          </div>
        )}
      </SectionCard>
      <SectionCard
        id="archiv"
        subtitle="Durchgefuehrte Probetermine ohne aktive Folge sowie abgelehnte oder spaeter beendete Faelle."
        title="Archiv"
      >
        {archiveItems.length === 0 ? (
          <EmptyState
            description="Sobald ein Fall ohne aktive Folge abgeschlossen ist, taucht er hier auf."
            title="Noch keine Historie"
          />
        ) : (
          <div className="space-y-3">
            {archiveItems.map((item) => (
              <LifecycleCard item={item} key={item.requestId} section="archive" />
            ))}
          </div>
        )}
      </SectionCard>
    </>
  );
}
