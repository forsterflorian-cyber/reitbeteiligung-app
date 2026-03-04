import type { Route } from "next";
import Link from "next/link";

import { createAvailabilityRuleAction, deleteAvailabilityRuleAction } from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Notice } from "@/components/notice";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import type { AvailabilityRule, Horse, TrialRequest } from "@/types/database";

type OwnerR1TrialManagerProps = {
  defaultSlotDate: string;
  detailHref: Route;
  error: string | null;
  horse: Horse;
  message: string | null;
  nextTrialRequest: TrialRequest | null;
  nextTrialRiderName: string | null;
  rules: AvailabilityRule[];
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatDateRange(startAt: string, endAt: string) {
  return `${formatDateTime(startAt)} bis ${formatDateTime(endAt)}`;
}

export function OwnerR1TrialManager({
  defaultSlotDate,
  detailHref,
  error,
  horse,
  message,
  nextTrialRequest,
  nextTrialRiderName,
  rules
}: OwnerR1TrialManagerProps) {
  const ownerTrialRules = rules.filter((rule) => rule.is_trial_slot);

  return (
    <div className="space-y-6 sm:space-y-8">
      <Link className={buttonVariants("ghost", "min-h-0 justify-start px-0 py-0 text-sm font-semibold text-forest hover:bg-transparent hover:text-clay")} href={detailHref}>
        {"Zur?ck zum Pferdeprofil"}
      </Link>

      <PageHeader
        subtitle={"F?r R1 pflegst du hier nur konkrete Probetermine. Die gro?e Kalenderplanung bleibt bewusst ausgeblendet."}
        title={`Probetermine f?r ${horse.title}`}
      />

      <div className="space-y-3" id="kalender-feedback">
        <Notice text={error} tone="error" />
        <Notice text={message} tone="success" />
      </div>

      <div className="ui-horse-context">
        <div className="ui-horse-context-grid">
          <div className="space-y-2">
            <p className="ui-eyebrow">Pferdeprofil</p>
            <h2 className="font-serif text-2xl text-stone-900 sm:text-3xl">{horse.title}</h2>
            <p className="ui-inline-meta">{horse.location_address ?? `PLZ ${horse.plz}`} {horse.active ? "- Aktiv" : "- Inaktiv"}</p>
            <p className="text-sm leading-6 text-stone-600">
              {horse.description?.trim() || "Hier pflegst du die Probetermine f?r den ersten Release."}
            </p>
          </div>
          <div className="flex flex-col gap-3 lg:items-end">
            <div className="ui-kpi-row">
              <Badge tone={horse.active ? "approved" : "neutral"}>{horse.active ? "Aktiv" : "Inaktiv"}</Badge>
              <Badge tone="pending">{ownerTrialRules.length} aktive Probetermine</Badge>
            </div>
            {nextTrialRequest ? (
              <Card className="w-full max-w-sm border-stone-200 bg-white/90 p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-stone-900">N?chstes Probereiten</p>
                    <StatusBadge status={nextTrialRequest.status} />
                  </div>
                  <p className="text-sm font-medium text-stone-800">
                    {formatDateRange(nextTrialRequest.requested_start_at as string, nextTrialRequest.requested_end_at as string)}
                  </p>
                  <p className="text-xs leading-5 text-stone-600">
                    {nextTrialRiderName ? `Mit ${nextTrialRiderName}` : "Mit einem Reiter aus deinen offenen Probeterminen"}
                  </p>
                  <Link
                    className={buttonVariants("ghost", "min-h-0 justify-start px-0 py-0 text-sm font-semibold text-forest hover:bg-transparent")}
                    href="/owner/anfragen"
                  >
                    Zu den Probeterminen
                  </Link>
                </div>
              </Card>
            ) : null}
            <Link className={buttonVariants("secondary", "w-full lg:w-auto")} href={detailHref}>
              {"Pferdeprofil ?ffnen"}
            </Link>
          </div>
        </div>
      </div>

      <SectionCard
        id="kalender-liste"
        subtitle={"Reiter sehen nur diese Termine in der Suche und im Pferdeprofil. Mehr braucht R1 an dieser Stelle nicht."}
        title="Probetermine pflegen"
      >
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
          <Card className="p-5 sm:p-6">
            <div className="space-y-5">
              <div className="space-y-1">
                <p className="ui-eyebrow">Eingestellte Probetermine</p>
                <p className="text-sm text-stone-600">Nur diese Termine sind f?r Reiter sichtbar.</p>
              </div>
              {ownerTrialRules.length === 0 ? (
                <p className="text-sm text-stone-500">Noch keine Probetermine eingestellt.</p>
              ) : (
                <div className="space-y-2">
                  {ownerTrialRules.slice(0, 6).map((rule) => (
                    <div className="rounded-2xl border border-stone-200 bg-white px-3 py-3" key={rule.id}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-stone-900">{formatDateRange(rule.start_at, rule.end_at)}</p>
                          <p className="text-xs text-stone-500">Direkt als Probetermin sichtbar</p>
                        </div>
                        <form action={deleteAvailabilityRuleAction} className="w-full sm:w-auto">
                          <input name="ruleId" type="hidden" value={rule.id} />
                          <ConfirmSubmitButton
                            className={buttonVariants("secondary", "w-full text-sm sm:w-auto")}
                            confirmMessage={"M?chtest du diesen Probetermin wirklich entfernen?"}
                            idleLabel="Entfernen"
                            pendingLabel="Wird entfernt..."
                          />
                        </form>
                      </div>
                    </div>
                  ))}
                  {ownerTrialRules.length > 6 ? (
                    <p className="text-xs text-stone-500">+ {ownerTrialRules.length - 6} weitere Probetermine sind bereits aktiv.</p>
                  ) : null}
                </div>
              )}
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <form action={createAvailabilityRuleAction} className="space-y-4">
              <input name="horseId" type="hidden" value={horse.id} />
              <input name="selectedDate" type="hidden" value={defaultSlotDate} />
              <input name="weekOffset" type="hidden" value="0" />
              <input name="monthOffset" type="hidden" value="0" />
              <input name="availabilityPreset" type="hidden" value="custom" />
              <input name="isTrialSlot" type="hidden" value="on" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-stone-900">Neuen Probetermin anlegen</p>
                <p className="text-sm text-stone-600">W?hle Tage und Uhrzeit. Daraus werden f?r die n?chsten 8 Wochen konkrete Probetermine erzeugt.</p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
                {[["1", "Mo"], ["2", "Di"], ["3", "Mi"], ["4", "Do"], ["5", "Fr"], ["6", "Sa"], ["0", "So"]].map(([value, label]) => (
                  <label className="block" key={value}>
                    <input className="peer sr-only" name="weekday" type="checkbox" value={value} />
                    <span className="flex min-h-[52px] items-center justify-center rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm font-medium text-stone-700 transition peer-checked:border-forest peer-checked:bg-sand peer-checked:text-stone-900">{label}</span>
                  </label>
                ))}
              </div>
              <div className="ui-field-grid sm:grid-cols-2">
                <div>
                  <label htmlFor="trialStartTimeR1">Von</label>
                  <input defaultValue="17:00" id="trialStartTimeR1" name="startTime" required step={900} type="time" />
                </div>
                <div>
                  <label htmlFor="trialEndTimeR1">Bis</label>
                  <input defaultValue="18:00" id="trialEndTimeR1" name="endTime" required step={900} type="time" />
                </div>
              </div>
              <SubmitButton idleLabel="Probetermine speichern" pendingLabel="Wird gespeichert..." />
            </form>
          </Card>
        </div>
      </SectionCard>
    </div>
  );
}
