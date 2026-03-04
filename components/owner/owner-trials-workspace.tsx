import type { Route } from "next";
import Link from "next/link";

import { updateApprovalAction, updateTrialRequestStatusAction } from "@/app/actions";
import { Notice } from "@/components/notice";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { canAcceptTrialRequest, canApproveTrialRequest, canCompleteTrialRequest } from "@/lib/trial-lifecycle";
import type { Approval, TrialRequest } from "@/types/database";

export type OwnerTrialSlotCard = {
  horseId: string;
  horseTitle: string;
  slotCount: number;
  nextSlotStartAt: string | null;
  nextSlotEndAt: string | null;
};

export type OwnerTrialPipelineCard = {
  requestId: string;
  horseId: string;
  riderId: string;
  horseTitle: string;
  riderName: string;
  requestedStartAt: string | null;
  requestedEndAt: string | null;
  messageText: string;
  status: TrialRequest["status"];
  approvalStatus: Approval["status"] | null;
  hasUnread: boolean;
  conversationId: string | null;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatDateRange(startAt: string | null, endAt: string | null) {
  if (!startAt || !endAt) {
    return "Zeitpunkt wird noch geprüft.";
  }

  return `${formatDateTime(startAt)} bis ${formatDateTime(endAt)}`;
}

type OwnerTrialsWorkspaceProps = {
  error: string | null;
  message: string | null;
  slotCount: number;
  requestedCount: number;
  nextStepCount: number;
  slotsByHorse: OwnerTrialSlotCard[];
  trialPipeline: OwnerTrialPipelineCard[];
};

export function OwnerTrialsWorkspace({
  error,
  message,
  nextStepCount,
  requestedCount,
  slotCount,
  slotsByHorse,
  trialPipeline
}: OwnerTrialsWorkspaceProps) {
  return (
    <>
      <PageHeader
        actions={
          <>
            <Link className={buttonVariants("secondary", "w-full sm:w-auto")} href="/owner/pferde-verwalten">
              Pferde verwalten
            </Link>
            <Link className={buttonVariants("ghost", "w-full sm:w-auto")} href="/owner/reitbeteiligungen">
              Reitbeteiligungen
            </Link>
            <Link className={buttonVariants("ghost", "w-full sm:w-auto")} href="/owner/nachrichten">
              Nachrichten
            </Link>
          </>
        }
        backdropVariant="hero"
        eyebrow="Pferdehalter"
        subtitle="Hier pflegst du zuerst die eingestellten Probetermine und bearbeitest danach eingehende Anfragen bis zur Aufnahme."
        surface
        title="Probetermine"
      />
      <Notice text={error} tone="error" />
      <Notice text={message} tone="success" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Eingestellt</p>
          <p className="mt-2 text-2xl font-semibold text-stone-900">{slotCount}</p>
          <p className="mt-1 text-sm text-stone-600">So viele kommende Probetermine sind aktuell aktiv.</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Neue Anfragen</p>
          <p className="mt-2 text-2xl font-semibold text-stone-900">{requestedCount}</p>
          <p className="mt-1 text-sm text-stone-600">Diese Reiter warten auf deine erste Rückmeldung.</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Nächster Schritt</p>
          <p className="mt-2 text-2xl font-semibold text-stone-900">{nextStepCount}</p>
          <p className="mt-1 text-sm text-stone-600">Angenommene oder durchgeführte Probetermine brauchen deine Folgeentscheidung.</p>
        </Card>
      </div>
      <SectionCard subtitle="Bestehende Probetermine zuerst prüfen. Neue oder geänderte Slots pflegst du direkt im Pferdeprofil." title="Eingestellte Probetermine">
        {slotsByHorse.length === 0 ? (
          <EmptyState
            action={
              <Link className={buttonVariants("primary")} href="/owner/horses">
                Neues Pferd anlegen
              </Link>
            }
            description="Lege zuerst ein Pferdeprofil an. Danach kannst du dort konkrete Probetermine pflegen."
            title="Noch kein Pferd vorhanden"
          />
        ) : (
          <div className="space-y-3">
            {slotsByHorse.map((horse) => (
              <Card className="p-5" key={horse.horseId}>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">Pferdeprofil</p>
                    <p className="font-semibold text-ink">{horse.horseTitle}</p>
                    <p className="text-sm text-stone-600">
                      {horse.slotCount > 0 ? `${horse.slotCount} kommender Probetermin${horse.slotCount === 1 ? "" : "e"}` : "Noch kein Probetermin eingestellt"}
                    </p>
                  </div>
                  {horse.nextSlotStartAt && horse.nextSlotEndAt ? (
                    <p className="text-sm font-semibold text-ink">Nächster Slot: {formatDateRange(horse.nextSlotStartAt, horse.nextSlotEndAt)}</p>
                  ) : null}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Link className={buttonVariants("primary", "w-full justify-center")} href={`/pferde/${horse.horseId}` as Route}>
                      Pferdeprofil öffnen
                    </Link>
                    <Link className={buttonVariants("secondary", "w-full justify-center")} href={`/pferde/${horse.horseId}/kalender#kalender-liste` as Route}>
                      Probetermine pflegen
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </SectionCard>
      <SectionCard subtitle="Von der ersten Anfrage bis zur Aufnahme als Reitbeteiligung." title="Eingehende Probeanfragen">
        {trialPipeline.length === 0 ? (
          <EmptyState
            description="Sobald Reiter einen Probetermin anfragen, erscheint er hier gesammelt mit allen nächsten Schritten."
            title="Noch keine Probetermine"
          />
        ) : (
          <div className="space-y-3">
            {trialPipeline.map((request) => (
              <Card className="p-5" key={request.requestId}>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">Probetermin</p>
                    <p className="font-semibold text-ink">{request.horseTitle}</p>
                    <p className="text-sm text-stone-600">Reiter: {request.riderName}</p>
                  </div>
                  <p className="text-sm font-semibold text-ink">{formatDateRange(request.requestedStartAt, request.requestedEndAt)}</p>
                  <p className="text-sm leading-6 text-stone-600">{request.messageText}</p>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={request.status} />
                    {request.approvalStatus ? <StatusBadge status={request.approvalStatus} /> : null}
                    {request.hasUnread ? <Badge tone="info">Neue Nachricht</Badge> : null}
                  </div>
                  {canAcceptTrialRequest(request.status) ? (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <form action={updateTrialRequestStatusAction}>
                        <input name="requestId" type="hidden" value={request.requestId} />
                        <input name="status" type="hidden" value="accepted" />
                        <Button className="w-full" type="submit" variant="primary">
                          Annehmen
                        </Button>
                      </form>
                      <form action={updateTrialRequestStatusAction}>
                        <input name="requestId" type="hidden" value={request.requestId} />
                        <input name="status" type="hidden" value="declined" />
                        <Button className="w-full border-rose-300 text-rose-700 hover:border-rose-400 hover:bg-rose-50 hover:text-rose-700" type="submit" variant="secondary">
                          Ablehnen
                        </Button>
                      </form>
                    </div>
                  ) : null}
                  {canCompleteTrialRequest(request.status) ? (
                    <form action={updateTrialRequestStatusAction}>
                      <input name="requestId" type="hidden" value={request.requestId} />
                      <input name="status" type="hidden" value="completed" />
                      <Button className="w-full" type="submit" variant="primary">
                        Als durchgeführt markieren
                      </Button>
                    </form>
                  ) : null}
                  {canApproveTrialRequest(request.status) ? (
                    <form action={updateApprovalAction}>
                      <input name="requestId" type="hidden" value={request.requestId} />
                      <input name="status" type="hidden" value="approved" />
                      <Button className="w-full" type="submit" variant="primary">
                        Als Reitbeteiligung aufnehmen
                      </Button>
                    </form>
                  ) : null}
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                    <Link className={buttonVariants("ghost", "min-h-0 justify-start px-0 py-0 text-sm font-semibold text-forest hover:bg-transparent hover:text-clay")} href={`/pferde/${request.horseId}` as Route}>
                      Pferdeprofil ansehen
                    </Link>
                    <Link className={buttonVariants("ghost", "min-h-0 justify-start px-0 py-0 text-sm font-semibold text-forest hover:bg-transparent hover:text-clay")} href={`/owner/reiter/${request.riderId}` as Route}>
                      Reiterprofil ansehen
                    </Link>
                    {request.conversationId ? (
                      <Link className={buttonVariants("ghost", "min-h-0 justify-start px-0 py-0 text-sm font-semibold text-forest hover:bg-transparent hover:text-clay")} href={`/chat/${request.conversationId}` as Route}>
                        Zum Chat
                      </Link>
                    ) : null}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </SectionCard>
    </>
  );
}
