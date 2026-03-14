import type { Route } from "next";
import Link from "next/link";

import {
  cancelOperationalBookingForRiderAction,
  requestBookingAction,
  rescheduleOperationalBookingForRiderAction
} from "@/app/actions";
import { OperationalWeekOverview } from "@/components/calendar/operational-week-overview";
import { RiderBookingWindowForm } from "@/components/calendar/rider-booking-window-form";
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
import type { Booking, BookingRequest, DailyActivityWithActorName, Horse } from "@/types/database";

type RiderOperationalSlot = {
  availabilityRuleId: string;
  endAt: string;
  startAt: string;
};

type RiderOperationalCalendarProps = {
  canceledBookings: BookingRequest[];
  dailyActivities?: Record<string, DailyActivityWithActorName[]>;
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
  dailyActivities,
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
  const bookingMode = horse.booking_mode;
  const isSlotMode = bookingMode === "slots";

  // Used for window/free modes — derive rule options from the already-computed
  // open slots so the calendar page needs no changes.
  const windowBookingRuleOptions = openSlots.map((slot) => ({
    endAt: slot.endAt,
    id: slot.availabilityRuleId,
    label: formatSlotSummary(slot.startAt, slot.endAt),
    startAt: slot.startAt
  }));

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

      {/* ── Meine naechsten Termine ── shared between both modes ──────────── */}
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
                          confirmMessage="Moechtest du diesen operativen Termin wirklich stornieren?"
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

      {/* ── Booking section — mode-specific ───────────────────────────────── */}
      {isSlotMode ? (
        // Slots mode: rider may only pick from pre-defined available slots
        <SectionCard
          action={<Badge tone={openSlots.length > 0 ? "approved" : "neutral"}>{openSlots.length} frei</Badge>}
          id="umbuchen"
          subtitle={
            rescheduleBooking
              ? "Waehle einen freien Slot aus. Der bisherige Termin wird dabei ersetzt und bleibt nur in der Historie sichtbar."
              : "Buchungen sind auf freigegebene Slots beschraenkt. Waehle einen der verfuegbaren Slots aus."
          }
          title={rescheduleBooking ? "Freie Slots fuer deine Umbuchung" : "Freie Slots"}
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
                    ? "Aktuell gibt es keinen anderen freien Slot fuer diese Umbuchung."
                    : "Aktuell gibt es fuer dieses Pferd keine freien Slots."
                }
                title={rescheduleBooking ? "Kein anderer Slot frei" : "Keine freien Slots"}
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
                          <Badge tone="approved">{rescheduleBooking ? "Frei fuer Umbuchung" : "Slot frei"}</Badge>
                          <p className="text-sm text-stone-600">
                            {rescheduleBooking ? "Dieser Slot kann direkt deinen aktuellen ersetzen." : "Diesen Slot kannst du direkt buchen."}
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
                          idleLabel={rescheduleBooking ? "Diesen Slot waehlen" : "Jetzt buchen"}
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
      ) : (
        // Window / free mode: rider picks start/end within an open availability window
        <SectionCard
          id="umbuchen"
          subtitle={
            rescheduleBooking
              ? "Waehle einen neuen Termin. Der bisherige Termin wird dabei ersetzt und bleibt nur in der Historie sichtbar."
              : bookingMode === "window"
                ? "Waehle ein offenes Zeitfenster und passe Beginn und Ende nach Bedarf an."
                : "Waehle ein offenes Fenster und deinen Wunschtermin innerhalb davon."
          }
          title={
            rescheduleBooking
              ? "Termin umbuchen"
              : bookingMode === "window"
                ? "Offene Zeitfenster"
                : "Termin buchen"
          }
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

            {windowBookingRuleOptions.length === 0 ? (
              <EmptyState
                description={
                  rescheduleBooking
                    ? "Aktuell gibt es kein anderes offenes Zeitfenster fuer diese Umbuchung."
                    : bookingMode === "window"
                      ? "Aktuell gibt es fuer dieses Pferd keine offenen Zeitfenster."
                      : "Aktuell gibt es fuer dieses Pferd keine freien Zeiten."
                }
                title={
                  rescheduleBooking
                    ? "Kein anderes Zeitfenster verfuegbar"
                    : bookingMode === "window"
                      ? "Keine offenen Zeitfenster"
                      : "Keine freien Zeiten"
                }
              />
            ) : (
              <form action={rescheduleBooking ? rescheduleOperationalBookingForRiderAction : requestBookingAction} className="space-y-4">
                {rescheduleBooking ? <input name="bookingId" type="hidden" value={rescheduleBooking.id} /> : null}
                <input name="horseId" type="hidden" value={horse.id} />
                <RiderBookingWindowForm rules={windowBookingRuleOptions} />
                <SubmitButton
                  className={buttonVariants("primary", "w-full")}
                  idleLabel={rescheduleBooking ? "Diesen Termin waehlen" : "Termin buchen"}
                  pendingLabel={rescheduleBooking ? "Wird umgebucht..." : "Wird gebucht..."}
                />
              </form>
            )}
          </div>
        </SectionCard>
      )}

      {/* ── Weekly overview — informational in both modes ──────────────────── */}
      <OperationalWeekOverview
        dailyActivities={dailyActivities}
        days={weekDays}
        hideAvailableEntries={bookingMode === "free"}
        nextWeekHref={nextWeekHref}
        previousWeekHref={previousWeekHref}
        subtitle={
          bookingMode === "free"
            ? "Gebuchte und blockierte Zeiten dieser Woche im Ueberblick."
            : bookingMode === "window"
              ? "Offene Zeitfenster, gebuchte Zeiten und Blocker dieser Woche im Ueberblick."
              : "Freie Slots, gebuchte Zeiten und Blocker dieser Woche kompakt im Ueberblick."
        }
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
