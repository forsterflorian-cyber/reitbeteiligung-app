import type { Route } from "next";
import Link from "next/link";

import {
  cancelOperationalBookingForOwnerAction,
  createAvailabilityDayAction,
  createAvailabilityRuleAction,
  createCalendarBlockV1Action,
  deleteAvailabilityRuleAction,
  deleteCalendarBlockAction
} from "@/app/actions";
import { rescheduleOperationalBookingForOwnerAction } from "@/app/actions";
import { OperationalWeekOverview } from "@/components/calendar/operational-week-overview";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Notice } from "@/components/notice";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { canCancelOperationalBooking, canRescheduleOperationalBooking } from "@/lib/booking-guards";
import type { OperationalWeekDay } from "@/lib/operational-week";
import { BOOKING_REQUEST_STATUS } from "@/lib/statuses";
import type { AvailabilityRule, Booking, BookingRequest, CalendarBlock, Horse, TrialRequest } from "@/types/database";

type OwnerOperationalSlot = {
  availabilityRuleId: string;
  endAt: string;
  startAt: string;
};

type OwnerBookingCard = Booking & {
  riderName: string | null;
};

type OwnerCanceledBookingCard = BookingRequest & {
  riderName: string | null;
};

type OwnerRescheduledBookingCard = BookingRequest & {
  riderName: string | null;
};

type OwnerHorseCalendarV1Props = {
  activeRelationshipCount: number;
  calendarBlocks: CalendarBlock[];
  defaultOperationalDate: string;
  defaultTrialDate: string;
  detailHref: Route;
  error: string | null;
  horse: Horse;
  message: string | null;
  nextTrialRequest: TrialRequest | null;
  nextTrialRiderName: string | null;
  nextWeekHref: Route;
  operationalRules: AvailabilityRule[];
  canceledBookings: OwnerCanceledBookingCard[];
  openSlots: OwnerOperationalSlot[];
  previousWeekHref: Route;
  rescheduleBooking: OwnerBookingCard | null;
  rescheduledBookings: OwnerRescheduledBookingCard[];
  todayWeekHref: Route;
  upcomingBookings: OwnerBookingCard[];
  trialRules: AvailabilityRule[];
  weekDays: OperationalWeekDay[];
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

export function OwnerHorseCalendarV1({
  activeRelationshipCount,
  calendarBlocks,
  defaultOperationalDate,
  defaultTrialDate,
  detailHref,
  error,
  horse,
  message,
  nextTrialRequest,
  nextTrialRiderName,
  nextWeekHref,
  operationalRules,
  canceledBookings,
  openSlots,
  previousWeekHref,
  rescheduleBooking,
  rescheduledBookings,
  todayWeekHref,
  upcomingBookings,
  trialRules,
  weekDays
}: OwnerHorseCalendarV1Props) {
  const clearRescheduleHref = `/pferde/${horse.id}/kalender#operativer-kalender` as Route;

  return (
    <div className="space-y-6 sm:space-y-8">
      <Link className={buttonVariants("ghost", "min-h-0 justify-start px-0 py-0 text-sm font-semibold text-forest hover:bg-transparent hover:text-clay")} href={detailHref}>
        Zurueck zum Pferdeprofil
      </Link>

      <PageHeader
        subtitle="Probephase, aktive Reitbeteiligungen und operative Slots bleiben hier bewusst getrennt."
        title={`Kalender fuer ${horse.title}`}
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
              {horse.description?.trim() || "Hier trennst du Probetermine vom spaeteren operativen Alltag."}
            </p>
          </div>
          <div className="flex flex-col gap-3 lg:items-end">
            <div className="ui-kpi-row">
              <Badge tone={horse.active ? "approved" : "neutral"}>{horse.active ? "Aktiv" : "Inaktiv"}</Badge>
              <Badge tone="pending">{trialRules.length} Probetermine</Badge>
              <Badge tone="info">{operationalRules.length} operative Slots</Badge>
            </div>
            {nextTrialRequest ? (
              <Card className="w-full max-w-sm border-stone-200 bg-white/90 p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-stone-900">Naechstes Probereiten</p>
                    <StatusBadge status={nextTrialRequest.status} />
                  </div>
                  <p className="text-sm font-medium text-stone-800">
                    {formatDateRange(nextTrialRequest.requested_start_at as string, nextTrialRequest.requested_end_at as string)}
                  </p>
                  <p className="text-xs leading-5 text-stone-600">
                    {nextTrialRiderName ? `Mit ${nextTrialRiderName}` : "Mit einem Reiter aus deinen offenen Probeterminen"}
                  </p>
                </div>
              </Card>
            ) : null}
            <Link className={buttonVariants("secondary", "w-full lg:w-auto")} href="/owner/reitbeteiligungen">
              Aktive Reitbeteiligungen
            </Link>
          </div>
        </div>
      </div>

      <SectionCard
        id="probephase"
        subtitle="Nur diese Slots werden in Suche und Pferdeprofil als Probetermine angeboten."
        title="Probephase"
      >
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
          <Card className="p-5 sm:p-6">
            <div className="space-y-5">
              <div className="space-y-1">
                <p className="ui-eyebrow">Eingestellte Probetermine</p>
                <p className="text-sm text-stone-600">Reiter sehen nur diese expliziten Probefenster.</p>
              </div>
              {trialRules.length === 0 ? (
                <EmptyState description="Noch keine Probetermine eingestellt." title="Keine Probe-Slots" />
              ) : (
                <div className="space-y-2">
                  {trialRules.slice(0, 8).map((rule) => (
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
                            confirmMessage="Moechtest du diesen Probetermin wirklich entfernen?"
                            idleLabel="Entfernen"
                            pendingLabel="Wird entfernt..."
                          />
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <form action={createAvailabilityRuleAction} className="space-y-4">
              <input name="horseId" type="hidden" value={horse.id} />
              <input name="selectedDate" type="hidden" value={defaultTrialDate} />
              <input name="weekOffset" type="hidden" value="0" />
              <input name="monthOffset" type="hidden" value="0" />
              <input name="availabilityPreset" type="hidden" value="custom" />
              <input name="isTrialSlot" type="hidden" value="on" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-stone-900">Neue Probetermine anlegen</p>
                <p className="text-sm text-stone-600">Aus dem Wochenmuster entstehen fuer die naechsten 8 Wochen konkrete Probefenster.</p>
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
                  <label htmlFor="trialStartTime">Von</label>
                  <input defaultValue="17:00" id="trialStartTime" name="startTime" required step={900} type="time" />
                </div>
                <div>
                  <label htmlFor="trialEndTime">Bis</label>
                  <input defaultValue="18:00" id="trialEndTime" name="endTime" required step={900} type="time" />
                </div>
              </div>
              <SubmitButton idleLabel="Probetermine speichern" pendingLabel="Wird gespeichert..." />
            </form>
          </Card>
        </div>
      </SectionCard>

      <div className="space-y-6 sm:space-y-8" id="aktive-reitbeteiligung">
        <div className="border-t-2 border-stone-200 pt-6 sm:pt-8">
          <p className="ui-eyebrow">Aktive Reitbeteiligung</p>
          <h2 className="mt-1 font-serif text-2xl text-stone-900 sm:text-3xl">Laufender Betrieb</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">Operative Slots, Wochenplanung und Buchungen – sichtbar nur fuer aktiv freigeschaltete Reitbeteiligungen.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Aktive Reitbeteiligungen</p>
            <p className="mt-2 text-3xl font-semibold text-stone-900">{activeRelationshipCount}</p>
            <p className="mt-2 text-sm text-stone-600">Nur diese Beziehungen erhalten operativen Kalenderzugriff.</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Direktbuchungen</p>
            <p className="mt-2 text-3xl font-semibold text-stone-900">{upcomingBookings.length}</p>
            <p className="mt-2 text-sm text-stone-600">Anstehende operative Termine dieser Reitbeteiligungen.</p>
          </Card>
        </div>

        <OperationalWeekOverview
          days={weekDays}
          nextWeekHref={nextWeekHref}
          previousWeekHref={previousWeekHref}
          subtitle="Die Wochenansicht zeigt nur freie operative Slots, aktuell wirksame Buchungen und Blocks."
          title="Wochenansicht"
          todayHref={todayWeekHref}
        />

        <SectionCard
          id="operativer-kalender"
          subtitle="Diese offenen Slots gelten fuer den laufenden Alltag nach der Aufnahme."
          title="Operativer Kalender"
        >
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
          <div className="space-y-5">
            <Card className="p-5 sm:p-6">
              <div className="space-y-5">
                <div className="space-y-1">
                  <p className="ui-eyebrow">Offene operative Slots</p>
                  <p className="text-sm text-stone-600">Bestehende Slots bleiben stehen, Konflikte und Doppelbelegungen verhindert das System beim Buchen.</p>
                </div>
                {operationalRules.length === 0 ? (
                  <EmptyState description="Lege zuerst das erste operative Zeitfenster an." title="Noch keine operativen Slots" />
                ) : (
                  <div className="space-y-2">
                    {operationalRules.slice(0, 10).map((rule) => (
                      <div className="rounded-2xl border border-stone-200 bg-white px-3 py-3" key={rule.id}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-stone-900">{formatDateRange(rule.start_at, rule.end_at)}</p>
                            <p className="text-xs text-stone-500">Nur fuer aktive Reitbeteiligungen sichtbar</p>
                          </div>
                          <form action={deleteAvailabilityRuleAction} className="w-full sm:w-auto">
                            <input name="ruleId" type="hidden" value={rule.id} />
                            <ConfirmSubmitButton
                              className={buttonVariants("secondary", "w-full text-sm sm:w-auto")}
                              confirmMessage="Moechtest du dieses operative Zeitfenster wirklich entfernen?"
                              idleLabel="Entfernen"
                              pendingLabel="Wird entfernt..."
                            />
                          </form>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-5 sm:p-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="ui-eyebrow">Naechste Direktbuchungen</p>
                  <p className="text-sm text-stone-600">So siehst du sofort, welche Slots bereits belegt wurden.</p>
                </div>
                {rescheduleBooking ? (
                  <div className="space-y-3 rounded-2xl border border-sand bg-sand/30 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-stone-900">Termin wird umgebucht</p>
                        <p className="text-sm text-stone-700">{formatDateRange(rescheduleBooking.start_at, rescheduleBooking.end_at)}</p>
                        <p className="text-xs text-stone-600">
                          {`Gebucht von ${rescheduleBooking.riderName ?? "Reiter"}`}
                        </p>
                      </div>
                      <Link className={buttonVariants("ghost", "min-h-0 justify-start px-0 py-0 text-sm font-semibold text-forest hover:bg-transparent hover:text-clay")} href={clearRescheduleHref}>
                        Umbuchung abbrechen
                      </Link>
                    </div>
                    {openSlots.length === 0 ? (
                      <EmptyState description="Aktuell gibt es keinen alternativen freien Slot fuer diese Umbuchung." title="Kein alternativer Slot frei" />
                    ) : (
                      <div className="space-y-2" id="umbuchen">
                        {openSlots.map((slot) => (
                          <div className="rounded-2xl border border-stone-200 bg-white px-3 py-3" key={slot.availabilityRuleId}>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="space-y-1">
                                <p className="text-sm font-semibold text-stone-900">{formatDateRange(slot.startAt, slot.endAt)}</p>
                                <p className="text-xs text-stone-500">Freier Zielslot fuer die Umbuchung</p>
                              </div>
                              <form action={rescheduleOperationalBookingForOwnerAction} className="w-full sm:w-auto">
                                <input name="bookingId" type="hidden" value={rescheduleBooking.id} />
                                <input name="ruleId" type="hidden" value={slot.availabilityRuleId} />
                                <input name="startAt" type="hidden" value={slot.startAt} />
                                <input name="endAt" type="hidden" value={slot.endAt} />
                                <SubmitButton className="w-full sm:w-auto" idleLabel="Auf diesen Slot umbuchen" pendingLabel="Wird umgebucht..." />
                              </form>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
                {upcomingBookings.length === 0 ? (
                  <EmptyState description="Sobald eine aktive Reitbeteiligung direkt bucht, erscheint der Termin hier." title="Noch keine Buchung" />
                ) : (
                  <div className="space-y-2">
                    {upcomingBookings.slice(0, 6).map((booking) => (
                      <div className={`rounded-2xl border px-3 py-3 ${rescheduleBooking?.id === booking.id ? "border-sand bg-sand/20" : "border-stone-200 bg-white"}`} key={booking.id}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-stone-900">{formatDateRange(booking.start_at, booking.end_at)}</p>
                            <p className="text-xs text-stone-500">
                              {`Gebucht von ${booking.riderName ?? "Reiter"}`}
                            </p>
                          </div>
                          {canCancelOperationalBooking({ startAt: booking.start_at, status: BOOKING_REQUEST_STATUS.accepted }) ? (
                            <div className="grid w-full grid-cols-1 gap-2 sm:w-auto">
                              {canRescheduleOperationalBooking({ startAt: booking.start_at, status: BOOKING_REQUEST_STATUS.accepted }) ? (
                                rescheduleBooking?.id === booking.id ? (
                                  <Link className={buttonVariants("ghost", "w-full justify-center sm:w-auto")} href={clearRescheduleHref}>
                                    Umbuchung abbrechen
                                  </Link>
                                ) : (
                                  <Link className={buttonVariants("secondary", "w-full justify-center sm:w-auto")} href={`/pferde/${horse.id}/kalender?rescheduleBooking=${booking.id}#umbuchen` as Route}>
                                    Termin umbuchen
                                  </Link>
                                )
                              ) : null}
                              <form action={cancelOperationalBookingForOwnerAction} className="w-full sm:w-auto">
                                <input name="bookingId" type="hidden" value={booking.id} />
                                <ConfirmSubmitButton
                                  className={buttonVariants("secondary", "w-full border-rose-300 text-rose-700 hover:border-rose-400 hover:bg-rose-50 hover:text-rose-700 sm:w-auto")}
                                  confirmMessage="Moechtest du diesen operativen Termin wirklich stornieren? Der Slot wird danach wieder freigegeben."
                                  idleLabel="Termin stornieren"
                                  pendingLabel="Wird storniert..."
                                />
                              </form>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {rescheduledBookings.length > 0 ? (
                  <div className="space-y-3 border-t border-stone-200 pt-4">
                    <div className="space-y-1">
                      <p className="ui-eyebrow">Umgebucht</p>
                      <p className="text-sm text-stone-600">Diese operativen Termine wurden auf einen neuen freien Slot verschoben.</p>
                    </div>
                    <div className="space-y-2">
                      {rescheduledBookings.slice(0, 6).map((booking) => (
                        <div className="rounded-2xl border border-stone-200 bg-sand/20 px-3 py-3" key={booking.id}>
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-stone-900">
                                {booking.requested_start_at && booking.requested_end_at
                                  ? formatDateRange(booking.requested_start_at, booking.requested_end_at)
                                  : "Zeitpunkt wird noch geprueft"}
                              </p>
                              <p className="text-xs text-stone-500">
                                {`Umbuchung fuer ${booking.riderName ?? "Reiter"}`}
                              </p>
                            </div>
                            <StatusBadge status={booking.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {canceledBookings.length > 0 ? (
                  <div className="space-y-3 border-t border-stone-200 pt-4">
                    <div className="space-y-1">
                      <p className="ui-eyebrow">Storniert</p>
                      <p className="text-sm text-stone-600">Diese operativen Termine bleiben als Historie sichtbar und blockieren keinen aktiven Slot mehr.</p>
                    </div>
                    <div className="space-y-2">
                      {canceledBookings.slice(0, 6).map((booking) => (
                        <div className="rounded-2xl border border-stone-200 bg-stone-50 px-3 py-3" key={booking.id}>
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-stone-900">
                                {booking.requested_start_at && booking.requested_end_at
                                  ? formatDateRange(booking.requested_start_at, booking.requested_end_at)
                                  : "Zeitpunkt wird noch geprueft"}
                              </p>
                              <p className="text-xs text-stone-500">
                                {`Storniert von ${booking.riderName ?? "Reiter"}`}
                              </p>
                            </div>
                            <StatusBadge status={booking.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </Card>

            {calendarBlocks.length > 0 ? (
              <Card className="p-5 sm:p-6">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="ui-eyebrow">Aktive Sperren</p>
                    <p className="text-sm text-stone-600">Diese Zeitraeume koennen nicht gebucht werden.</p>
                  </div>
                  <div className="space-y-2">
                    {calendarBlocks.slice(0, 8).map((block) => (
                      <div className="rounded-2xl border border-stone-300 bg-stone-50 px-3 py-3" key={block.id}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-stone-900">{block.title ?? "Sperre"}</p>
                            <p className="text-xs text-stone-500">{formatDateRange(block.start_at, block.end_at)}</p>
                          </div>
                          <form action={deleteCalendarBlockAction} className="w-full sm:w-auto">
                            <input name="blockId" type="hidden" value={block.id} />
                            <ConfirmSubmitButton
                              className={buttonVariants("secondary", "w-full text-sm sm:w-auto")}
                              confirmMessage="Moechtest du diese Sperre wirklich entfernen?"
                              idleLabel="Sperre entfernen"
                              pendingLabel="Wird entfernt..."
                            />
                          </form>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            ) : null}
          </div>

          <div className="space-y-5">
            <Card className="p-5 sm:p-6">
              <form action={createAvailabilityDayAction} className="space-y-4">
                <input name="horseId" type="hidden" value={horse.id} />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-stone-900">Neuen operativen Slot anlegen</p>
                  <p className="text-sm text-stone-600">Minimal-V1: konkrete Einzeltermine statt komplexer Regeln.</p>
                </div>
                <div>
                  <label htmlFor="operationalDate">Datum</label>
                  <input defaultValue={defaultOperationalDate} id="operationalDate" name="selectedDate" required type="date" />
                </div>
                <div className="ui-field-grid sm:grid-cols-2">
                  <div>
                    <label htmlFor="operationalStartTime">Von</label>
                    <input defaultValue="17:00" id="operationalStartTime" name="startTime" required step={900} type="time" />
                  </div>
                  <div>
                    <label htmlFor="operationalEndTime">Bis</label>
                    <input defaultValue="18:00" id="operationalEndTime" name="endTime" required step={900} type="time" />
                  </div>
                </div>
                <p className="text-sm leading-6 text-stone-600">Dieses Fenster wird bewusst nicht als Probetermin markiert und steht nur aktiven Reitbeteiligungen offen.</p>
                <SubmitButton idleLabel="Operativen Slot speichern" pendingLabel="Wird gespeichert..." />
              </form>
            </Card>

            <Card className="p-5 sm:p-6">
              <form action={createCalendarBlockV1Action} className="space-y-4">
                <input name="horseId" type="hidden" value={horse.id} />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-stone-900">Zeitraum blockieren</p>
                  <p className="text-sm text-stone-600">Sperrt den Zeitraum und storniert betroffene Buchungen automatisch.</p>
                </div>
                <div>
                  <label htmlFor="blockDate">Datum</label>
                  <input defaultValue={defaultOperationalDate} id="blockDate" name="selectedDate" required type="date" />
                </div>
                <div className="ui-field-grid sm:grid-cols-2">
                  <div>
                    <label htmlFor="blockStartTime">Von</label>
                    <input defaultValue="09:00" id="blockStartTime" name="startTime" required step={900} type="time" />
                  </div>
                  <div>
                    <label htmlFor="blockEndTime">Bis</label>
                    <input defaultValue="18:00" id="blockEndTime" name="endTime" required step={900} type="time" />
                  </div>
                </div>
                <div>
                  <label htmlFor="blockTitle">Titel <span className="font-normal text-stone-400">(optional)</span></label>
                  <input id="blockTitle" name="title" placeholder="z. B. Hufschmied oder Stallruhe" type="text" />
                </div>
                <SubmitButton idleLabel="Zeitraum blockieren" pendingLabel="Wird gespeichert..." />
              </form>
            </Card>
          </div>
        </div>
        </SectionCard>
      </div>
    </div>
  );
}
