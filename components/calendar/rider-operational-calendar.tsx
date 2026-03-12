import type { Route } from "next";
import Link from "next/link";

import {
  cancelOperationalBookingForRiderAction,
  requestBookingAction,
  rescheduleOperationalBookingForRiderAction
} from "@/app/actions";
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
import { formatBookingQuotaMinutes, formatWeeklyHoursLimit, type RiderWeeklyBookingQuota } from "@/lib/booking-limits";
import { BOOKING_REQUEST_STATUS } from "@/lib/statuses";
import type { Booking, BookingRequest, Horse } from "@/types/database";

type RiderOperationalSlot = {
  availabilityRuleId: string;
  endAt: string;
  startAt: string;
};

type RiderOperationalCalendarProps = {
  canceledBookings: BookingRequest[];
  detailHref: Route;
  error: string | null;
  horse: Horse;
  message: string | null;
  openSlots: RiderOperationalSlot[];
  rescheduleBooking: Booking | null;
  rescheduledBookings: BookingRequest[];
  upcomingBookings: Booking[];
  weeklyQuota: RiderWeeklyBookingQuota | null;
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

export function RiderOperationalCalendar({
  canceledBookings,
  detailHref,
  error,
  horse,
  message,
  openSlots,
  rescheduleBooking,
  rescheduledBookings,
  upcomingBookings,
  weeklyQuota
}: RiderOperationalCalendarProps) {
  const clearRescheduleHref = `/pferde/${horse.id}/kalender#meine-buchungen` as Route;

  return (
    <div className="space-y-6 sm:space-y-8">
      <Link className={buttonVariants("ghost", "min-h-0 justify-start px-0 py-0 text-sm font-semibold text-forest hover:bg-transparent hover:text-clay")} href={detailHref}>
        Zurueck zum Pferdeprofil
      </Link>

      <PageHeader
        subtitle="Du siehst hier nur operative Slots fuer eine aktive Reitbeteiligung."
        title={`Operativer Kalender fuer ${horse.title}`}
      />

      <div className="space-y-3" id="kalender-feedback">
        <Notice text={error} tone="error" />
        <Notice text={message} tone="success" />
      </div>

      <SectionCard
        subtitle="Die Probephase ist abgeschlossen. Jetzt geht es nur noch um freie Alltags-Slots und deine gebuchten Termine."
        title="Aktive Reitbeteiligung"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge tone="approved">Freigeschaltet</Badge>
            <Badge tone="neutral">{horse.location_address ?? `PLZ ${horse.plz}`}</Badge>
          </div>
          {weeklyQuota && typeof weeklyQuota.weekly_hours_limit === "number" ? (
            <Card className="border-stone-200 bg-stone-50/80 p-5">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-stone-900">Wochenkontingent</p>
                <p className="text-sm text-stone-600">Fuer die aktuelle Kalenderwoche zaehlen nur noch aktive operative Einzeltermine.</p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Limit</p>
                  <p className="mt-1 text-sm font-semibold text-stone-900">{formatWeeklyHoursLimit(weeklyQuota.weekly_hours_limit)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Belegt</p>
                  <p className="mt-1 text-sm font-semibold text-stone-900">{formatBookingQuotaMinutes(weeklyQuota.booked_minutes)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Verbleibend</p>
                  <p className="mt-1 text-sm font-semibold text-stone-900">
                    {formatBookingQuotaMinutes(weeklyQuota.remaining_minutes ?? 0)}
                  </p>
                </div>
              </div>
            </Card>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        id="umbuchen"
        subtitle={
          rescheduleBooking
            ? "Waehle einen bereits freien operativen Slot. Die alte Belegung wird atomar ersetzt und bleibt als Historie sichtbar."
            : "Freie Slots werden direkt gebucht. Konflikte und Doppelbelegungen blockt das System sofort."
        }
        title={rescheduleBooking ? "Freie Slots fuer die Umbuchung" : "Freie operative Slots"}
      >
        {rescheduleBooking ? (
          <Card className="mb-4 border-sand bg-sand/30 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-stone-900">Aktuell markierter Termin</p>
                <p className="text-sm text-stone-700">{formatDateRange(rescheduleBooking.start_at, rescheduleBooking.end_at)}</p>
                <p className="text-xs text-stone-600">Der bisherige Termin wird bei erfolgreicher Umbuchung als &quot;umgebucht&quot; historisiert.</p>
              </div>
              <Link className={buttonVariants("ghost", "min-h-0 justify-start px-0 py-0 text-sm font-semibold text-forest hover:bg-transparent hover:text-clay")} href={clearRescheduleHref}>
                Umbuchung abbrechen
              </Link>
            </div>
          </Card>
        ) : null}
        {openSlots.length === 0 ? (
          <EmptyState
            description={
              rescheduleBooking
                ? "Aktuell gibt es keinen alternativen freien Slot fuer diese Umbuchung."
                : "Aktuell gibt es fuer dieses Pferd keine freien operativen Slots."
            }
            title={rescheduleBooking ? "Kein alternativer Slot frei" : "Keine freien Slots"}
          />
        ) : (
          <div className="space-y-3">
            {openSlots.map((slot) => (
              <Card className="p-5" key={slot.availabilityRuleId}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-stone-900">{formatDateRange(slot.startAt, slot.endAt)}</p>
                    <p className="text-sm text-stone-600">
                      {rescheduleBooking ? "Freier Zielslot fuer die Umbuchung." : "Direkt buchbarer Slot fuer aktive Reitbeteiligungen."}
                    </p>
                  </div>
                  <form action={rescheduleBooking ? rescheduleOperationalBookingForRiderAction : requestBookingAction} className="w-full sm:w-auto">
                    {rescheduleBooking ? <input name="bookingId" type="hidden" value={rescheduleBooking.id} /> : null}
                    <input name="horseId" type="hidden" value={horse.id} />
                    <input name="ruleId" type="hidden" value={slot.availabilityRuleId} />
                    <input name="startAt" type="hidden" value={slot.startAt} />
                    <input name="endAt" type="hidden" value={slot.endAt} />
                    <input name="recurrenceRrule" type="hidden" value="" />
                    <SubmitButton
                      className="w-full sm:w-auto"
                      idleLabel={rescheduleBooking ? "Auf diesen Slot umbuchen" : "Direkt buchen"}
                      pendingLabel={rescheduleBooking ? "Wird umgebucht..." : "Wird gebucht..."}
                    />
                  </form>
                </div>
              </Card>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        id="meine-buchungen"
        subtitle="Hier siehst du die bereits bestaetigten Termine fuer dieses Pferd."
        title="Meine gebuchten Termine"
      >
        {upcomingBookings.length === 0 && canceledBookings.length === 0 ? (
          <EmptyState
            description="Sobald du einen operativen Slot direkt buchst, erscheint der Termin hier."
            title="Noch kein Termin gebucht"
          />
        ) : (
          <div className="space-y-3">
            {upcomingBookings.map((booking) => (
              <Card className={`p-5 ${rescheduleBooking?.id === booking.id ? "border-sand bg-sand/20" : ""}`} key={booking.id}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-stone-900">{formatDateRange(booking.start_at, booking.end_at)}</p>
                    <p className="text-sm text-stone-600">Direkt gebuchter Termin im operativen Kalender.</p>
                    {!canCancelOperationalBooking({ startAt: booking.start_at, status: BOOKING_REQUEST_STATUS.accepted }) ? (
                      <p className="text-xs text-stone-500">Bereits begonnene Termine bleiben sichtbar, koennen aber nicht mehr storniert werden.</p>
                    ) : null}
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
                      <form action={cancelOperationalBookingForRiderAction} className="w-full sm:w-auto">
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
              </Card>
            ))}
            {rescheduledBookings.length > 0 ? (
              <div className="space-y-3 border-t border-stone-200 pt-5">
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-stone-900">Umgebucht</h3>
                  <p className="text-sm text-stone-600">Diese operativen Termine wurden auf einen anderen freien Slot verschoben.</p>
                </div>
                {rescheduledBookings.map((request) => (
                  <Card className="p-5" key={request.id}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-stone-900">
                          {request.requested_start_at && request.requested_end_at
                            ? formatDateRange(request.requested_start_at, request.requested_end_at)
                            : "Zeitpunkt wird noch geprueft"}
                        </p>
                        <p className="text-sm text-stone-600">Der Termin wurde erfolgreich auf einen anderen operativen Slot umgebucht.</p>
                      </div>
                      <StatusBadge status={request.status} />
                    </div>
                  </Card>
                ))}
              </div>
            ) : null}
            {canceledBookings.length > 0 ? (
              <div className="space-y-3 border-t border-stone-200 pt-5">
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-stone-900">Storniert</h3>
                  <p className="text-sm text-stone-600">Diese operativen Termine sind historisiert und blockieren keinen aktiven Slot mehr.</p>
                </div>
                {canceledBookings.map((request) => (
                  <Card className="p-5" key={request.id}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-stone-900">
                          {request.requested_start_at && request.requested_end_at
                            ? formatDateRange(request.requested_start_at, request.requested_end_at)
                            : "Zeitpunkt wird noch geprueft"}
                        </p>
                        <p className="text-sm text-stone-600">Der Termin wurde storniert und der Slot ist wieder frei.</p>
                      </div>
                      <StatusBadge status={request.status} />
                    </div>
                  </Card>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
