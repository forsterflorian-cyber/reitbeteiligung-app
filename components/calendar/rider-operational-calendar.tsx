import type { Route } from "next";
import Link from "next/link";

import {
  cancelOperationalBookingForRiderAction,
  requestBookingAction,
  rescheduleOperationalBookingForRiderAction
} from "@/app/actions";
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
import { formatBookingQuotaMinutes, formatWeeklyHoursLimit, type RiderWeeklyBookingQuota } from "@/lib/booking-limits";
import type { OperationalWeekDay } from "@/lib/operational-week";
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
  nextWeekHref: Route;
  openSlots: RiderOperationalSlot[];
  previousWeekHref: Route;
  rescheduleBooking: Booking | null;
  rescheduledBookings: BookingRequest[];
  todayWeekHref: Route;
  upcomingBookings: Booking[];
  weekDays: OperationalWeekDay[];
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

function isSameCalendarDay(startAt: string, endAt: string) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  return (
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate()
  );
}

function formatDayLabel(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "short",
    weekday: "short"
  }).format(new Date(value));
}

function formatTimeLabel(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatSlotSummary(startAt: string, endAt: string) {
  if (!isSameCalendarDay(startAt, endAt)) {
    return formatDateRange(startAt, endAt);
  }

  return `${formatTimeLabel(startAt)} - ${formatTimeLabel(endAt)} Uhr`;
}

export function RiderOperationalCalendar({
  canceledBookings,
  detailHref,
  error,
  horse,
  message,
  nextWeekHref,
  openSlots,
  previousWeekHref,
  rescheduleBooking,
  rescheduledBookings,
  todayWeekHref,
  upcomingBookings,
  weekDays,
  weeklyQuota
}: RiderOperationalCalendarProps) {
  const clearRescheduleHref = `/pferde/${horse.id}/kalender#meine-buchungen` as Route;
  const historyCount = rescheduledBookings.length + canceledBookings.length;

  return (
    <div className="space-y-6 sm:space-y-8">
      <Link className={buttonVariants("ghost", "min-h-0 justify-start px-0 py-0 text-sm font-semibold text-forest hover:bg-transparent hover:text-clay")} href={detailHref}>
        Zurueck zum Pferdeprofil
      </Link>

      <PageHeader
        actions={
          <>
            <Badge tone="approved">Aktive Reitbeteiligung</Badge>
            <Badge tone="neutral">{horse.location_address ?? `PLZ ${horse.plz}`}</Badge>
          </>
        }
        subtitle="Deine naechsten Termine stehen zuerst. Freie Zeiten und die Wochenuebersicht kommen direkt danach."
        title={`Kalender fuer ${horse.title}`}
      />

      <div className="space-y-3" id="kalender-feedback">
        <Notice text={error} tone="error" />
        <Notice text={message} tone="success" />
      </div>

      <SectionCard
        action={<Badge tone={upcomingBookings.length > 0 ? "info" : "neutral"}>{upcomingBookings.length} geplant</Badge>}
        id="meine-buchungen"
        subtitle="Nur aktuell wirksame Termine. Umbuchen und Stornieren bleiben direkt am Termin."
        title="Meine naechsten Termine"
      >
        {upcomingBookings.length === 0 ? (
          <EmptyState
            description="Sobald du einen freien Termin buchst, erscheint er hier mit den passenden Aktionen."
            title="Noch kein Termin geplant"
          />
        ) : (
          <div className="space-y-2.5">
            {upcomingBookings.map((booking) => (
              <Card className={`p-4 ${rescheduleBooking?.id === booking.id ? "border-sand bg-sand/20" : ""}`} key={booking.id}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <div className="min-w-[136px] rounded-2xl border border-stone-200 bg-stone-50 px-3 py-3 text-center">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">{formatDayLabel(booking.start_at)}</p>
                      <p className="mt-1 text-sm font-semibold text-stone-900">{formatSlotSummary(booking.start_at, booking.end_at)}</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <Badge tone={rescheduleBooking?.id === booking.id ? "pending" : "info"}>
                          {rescheduleBooking?.id === booking.id ? "Fuer Umbuchung markiert" : "Gebucht"}
                        </Badge>
                        {canRescheduleOperationalBooking({ startAt: booking.start_at, status: BOOKING_REQUEST_STATUS.accepted }) ? (
                          <Badge tone="neutral">Aenderbar</Badge>
                        ) : null}
                      </div>
                      <p className="text-sm text-stone-600">
                        {canCancelOperationalBooking({ startAt: booking.start_at, status: BOOKING_REQUEST_STATUS.accepted })
                          ? "Du kannst diesen Termin noch umbuchen oder stornieren."
                          : "Bereits begonnene Termine bleiben sichtbar, koennen aber nicht mehr geaendert werden."}
                      </p>
                    </div>
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
                            Umbuchen
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
          </div>
        )}
      </SectionCard>

      <SectionCard
        action={<Badge tone={openSlots.length > 0 ? "approved" : "neutral"}>{openSlots.length} frei</Badge>}
        id="umbuchen"
        subtitle={
          rescheduleBooking
            ? "Waehle einen freien Termin aus. Der bisherige Termin wird dabei ersetzt und bleibt nur in der Historie sichtbar."
            : "Freie Zeiten kannst du direkt buchen, solange sie noch verfuegbar sind."
        }
        title={rescheduleBooking ? "Freie Termine fuer deine Umbuchung" : "Freie Termine"}
      >
        <div className="space-y-4">
          {weeklyQuota && typeof weeklyQuota.weekly_hours_limit === "number" ? (
            <Card className="border-stone-200 bg-stone-50/80 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-stone-900">Wochenkontingent</p>
                  <p className="text-sm text-stone-600">Gezaehlt werden nur aktuell wirksame Termine dieser Kalenderwoche.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[360px]">
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
              </div>
            </Card>
          ) : null}
          {rescheduleBooking ? (
            <Card className="border-sand bg-sand/30 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-stone-900">Du buchst gerade diesen Termin um</p>
                  <p className="text-sm text-stone-700">{formatDateRange(rescheduleBooking.start_at, rescheduleBooking.end_at)}</p>
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
                  ? "Aktuell gibt es keinen anderen freien Termin fuer diese Umbuchung."
                  : "Aktuell gibt es fuer dieses Pferd keine freien Termine."
              }
              title={rescheduleBooking ? "Kein anderer Termin frei" : "Keine freien Termine"}
            />
          ) : (
            <div className="grid gap-2.5 lg:grid-cols-2">
              {openSlots.map((slot) => (
                <Card className="p-4" key={`${slot.availabilityRuleId}:${slot.startAt}`}>
                  <div className="flex h-full flex-col gap-4">
                    <div className="flex items-start gap-3">
                      <div className="min-w-[132px] rounded-2xl border border-stone-200 bg-stone-50 px-3 py-3 text-center">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">{formatDayLabel(slot.startAt)}</p>
                        <p className="mt-1 text-sm font-semibold text-stone-900">{formatSlotSummary(slot.startAt, slot.endAt)}</p>
                      </div>
                      <div className="space-y-2">
                        <Badge tone="approved">{rescheduleBooking ? "Frei fuer Umbuchung" : "Frei"}</Badge>
                        <p className="text-sm text-stone-600">
                          {rescheduleBooking ? "Dieser Termin kann direkt dein aktuelles Zeitfenster ersetzen." : "Diesen Termin kannst du direkt buchen."}
                        </p>
                      </div>
                    </div>
                    <form action={rescheduleBooking ? rescheduleOperationalBookingForRiderAction : requestBookingAction} className="mt-auto w-full">
                      {rescheduleBooking ? <input name="bookingId" type="hidden" value={rescheduleBooking.id} /> : null}
                      <input name="horseId" type="hidden" value={horse.id} />
                      <input name="ruleId" type="hidden" value={slot.availabilityRuleId} />
                      <input name="startAt" type="hidden" value={slot.startAt} />
                      <input name="endAt" type="hidden" value={slot.endAt} />
                      <input name="recurrenceRrule" type="hidden" value="" />
                      <SubmitButton
                        className={buttonVariants("primary", "w-full")}
                        idleLabel={rescheduleBooking ? "Diesen Termin waehlen" : "Jetzt buchen"}
                        pendingLabel={rescheduleBooking ? "Wird umgebucht..." : "Wird gebucht..."}
                      />
                    </form>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      <OperationalWeekOverview
        days={weekDays}
        nextWeekHref={nextWeekHref}
        previousWeekHref={previousWeekHref}
        subtitle="Freie Termine, gebuchte Zeiten und Blocks dieser Woche kompakt im Ueberblick."
        title="Diese Woche"
        todayHref={todayWeekHref}
      />

      {historyCount > 0 ? (
        <SectionCard
          action={<Badge tone="neutral">{historyCount} Eintraege</Badge>}
          subtitle="Vergangene Aenderungen. Diese Eintraege zaehlen nicht als aktuelle Belegung."
          title="Historie"
        >
          <div className="space-y-3">
            {rescheduledBookings.length > 0 ? (
              <details className="rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-3">
                <summary className="cursor-pointer list-item">
                  <div className="inline-flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-stone-900">Umgebucht</span>
                    <Badge tone="neutral">{rescheduledBookings.length}</Badge>
                  </div>
                </summary>
                <div className="mt-3 space-y-2">
                  {rescheduledBookings.map((request) => (
                    <div className="flex flex-col gap-2 rounded-2xl border border-stone-200 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between" key={request.id}>
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-stone-900">
                          {request.requested_start_at && request.requested_end_at
                            ? formatDateRange(request.requested_start_at, request.requested_end_at)
                            : "Zeitpunkt wird noch geprueft"}
                        </p>
                        <p className="text-xs text-stone-500">Nicht mehr als aktueller Termin sichtbar.</p>
                      </div>
                      <StatusBadge status={request.status} />
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
            {canceledBookings.length > 0 ? (
              <details className="rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-3">
                <summary className="cursor-pointer list-item">
                  <div className="inline-flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-stone-900">Storniert</span>
                    <Badge tone="neutral">{canceledBookings.length}</Badge>
                  </div>
                </summary>
                <div className="mt-3 space-y-2">
                  {canceledBookings.map((request) => (
                    <div className="flex flex-col gap-2 rounded-2xl border border-stone-200 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between" key={request.id}>
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-stone-900">
                          {request.requested_start_at && request.requested_end_at
                            ? formatDateRange(request.requested_start_at, request.requested_end_at)
                            : "Zeitpunkt wird noch geprueft"}
                        </p>
                        <p className="text-xs text-stone-500">Der Termin ist beendet und blockiert keinen aktuellen Slot mehr.</p>
                      </div>
                      <StatusBadge status={request.status} />
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
