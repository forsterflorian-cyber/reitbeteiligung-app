import type { Route } from "next";
import Link from "next/link";

import {
  cancelOperationalBookingForOwnerAction,
  createAvailabilityDayAction,
  rescheduleOperationalBookingForOwnerAction
} from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionCard } from "@/components/ui/section-card";
import type { HorseBookingMode } from "@/types/database";
import type { OwnerOperationalWorkspaceItem } from "@/lib/owner-workspace";

function formatDateRange(startAt: string, endAt: string) {
  return `${new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(startAt))} bis ${new Intl.DateTimeFormat("de-DE", {
    timeStyle: "short"
  }).format(new Date(endAt))}`;
}

function getTodayDateInputValue() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
}

function getOpenSlotsTitle(mode: HorseBookingMode, hasSelectedBooking: boolean): string {
  if (hasSelectedBooking) {
    if (mode === "slots") return "Freie Zielslots fuer die Umbuchung";
    if (mode === "window") return "Offene Zeitfenster fuer die Umbuchung";
    return "Freie Zeiten fuer die Umbuchung";
  }
  if (mode === "slots") return "Freie Slots in den naechsten Tagen";
  if (mode === "window") return "Offene Zeitfenster in den naechsten Tagen";
  return "Freie Zeiten in den naechsten Tagen";
}

function getOpenSlotsSubtitle(mode: HorseBookingMode, hasSelectedBooking: boolean): string {
  if (hasSelectedBooking) {
    if (mode === "slots") return "Nur derzeit freie und fachlich gueltige Zielslots werden angeboten.";
    return "Gueltige freie Zeitfenster fuer diese Umbuchung.";
  }
  if (mode === "slots") return "So siehst du sofort, wo noch Platz ist, ohne erst in die Detailansicht zu gehen.";
  if (mode === "window") return "Offene Zeitfenster fuer dieses Pferd – Reiter koennen Start und Ende selbst waehlen.";
  return "Freie Zeitraeume fuer dieses Pferd – Reiter buchen direkt ohne Slotbindung.";
}

function getEmptySlotTitle(mode: HorseBookingMode, hasSelectedBooking: boolean): string {
  if (hasSelectedBooking) {
    if (mode === "slots") return "Kein Zielslot frei";
    return "Kein freies Zeitfenster";
  }
  if (mode === "slots") return "Keine freien Slots";
  if (mode === "window") return "Keine offenen Zeitfenster";
  return "Keine freien Zeiten";
}

function getEmptySlotDescription(mode: HorseBookingMode, hasSelectedBooking: boolean): string {
  if (hasSelectedBooking) {
    if (mode === "slots") return "Aktuell gibt es keinen anderen freien Zielslot fuer diese Umbuchung.";
    return "Aktuell gibt es kein anderes freies Zeitfenster fuer diese Umbuchung.";
  }
  if (mode === "slots") return "Im Moment ist fuer dieses Pferd kein freier operativer Slot hinterlegt.";
  if (mode === "window") return "Im Moment ist fuer dieses Pferd kein offenes Zeitfenster hinterlegt.";
  return "Im Moment ist fuer dieses Pferd kein freier Zeitraum hinterlegt.";
}

type OwnerOperationalWorkspaceProps = {
  items: OwnerOperationalWorkspaceItem[];
  pagePath: string;
  sectionId?: string;
  subtitle?: string;
  title?: string;
};

export function OwnerOperationalWorkspace({
  items,
  pagePath,
  sectionId = "owner-alltag",
  subtitle = "Heutige Buchungen, naechste Termine und schnelle Tagesaktionen in einer Arbeitsebene pro Pferd.",
  title = "Tagesgeschaeft"
}: OwnerOperationalWorkspaceProps) {
  const todayDateValue = getTodayDateInputValue();

  return (
    <SectionCard id={sectionId} subtitle={subtitle} title={title}>
      {items.length === 0 ? (
        <EmptyState
          description="Sobald aktive Buchungen oder offene Zeitraeume existieren, erscheinen sie hier pro Pferd."
          title="Noch kein operatives Tagesgeschaeft"
        />
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const anchorId = `owner-alltag-${item.horseId}`;
            const clearRescheduleHref = `${pagePath}#${anchorId}`;
            const isSlotMode = item.bookingMode === "slots";

            return (
              <Card className="p-5" id={anchorId} key={item.horseId}>
                <div className="space-y-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-clay">Pferd im Tagesgeschaeft</p>
                      <p className="text-lg font-semibold text-ink">{item.horseTitle}</p>
                      <p className="text-sm text-stone-600">
                        {item.selectedBooking
                          ? isSlotMode
                            ? "Du planst gerade eine bestehende Buchung auf einen anderen freien Slot um."
                            : "Du planst gerade eine bestehende Buchung um."
                          : isSlotMode
                            ? "Freie Slots, naechste Buchungen und schnelle Tagesaktionen fuer dieses Pferd."
                            : item.bookingMode === "free"
                              ? "Naechste Buchungen und schnelle Tagesaktionen fuer dieses Pferd."
                              : "Naechste Buchungen, offene Zeitfenster und schnelle Tagesaktionen fuer dieses Pferd."}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="approved">{item.activeRiderCount} aktive Reitbeteiligung{item.activeRiderCount === 1 ? "" : "en"}</Badge>
                      <Link
                        className={buttonVariants("ghost", "min-h-0 px-0 py-0 text-sm font-semibold text-forest hover:bg-transparent hover:text-clay")}
                        href={`/pferde/${item.horseId}/kalender` as Route}
                      >
                        Kalender oeffnen
                      </Link>
                    </div>
                  </div>

                  {item.selectedBooking ? (
                    <Card className="border-sand bg-sand/30 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-stone-900">Ausgewaehlte Buchung fuer die Umbuchung</p>
                          <p className="text-sm text-stone-700">{formatDateRange(item.selectedBooking.startAt, item.selectedBooking.endAt)}</p>
                          <p className="text-sm text-stone-600">
                            {`Gebucht von ${item.selectedBooking.riderName ?? "Reiter"}`}
                          </p>
                        </div>
                        <Link
                          className={buttonVariants("ghost", "min-h-0 px-0 py-0 text-sm font-semibold text-forest hover:bg-transparent hover:text-clay")}
                          href={clearRescheduleHref as Route}
                        >
                          Umbuchung abbrechen
                        </Link>
                      </div>
                    </Card>
                  ) : null}

                  <div className={`grid gap-5 ${item.bookingMode === "free" ? "" : "xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]"}`}>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <h3 className="text-base font-semibold text-stone-900">Heutige und naechste Buchungen</h3>
                        <p className="text-sm text-stone-600">Du siehst sofort, wer wann kommt und kannst bestehende Buchungen direkt anpassen.</p>
                      </div>
                      {item.upcomingBookings.length === 0 ? (
                        <EmptyState
                          description="Sobald ein Reiter einen Termin belegt, erscheint die Buchung hier."
                          title="Noch keine operative Buchung"
                        />
                      ) : (
                        <div className="space-y-3">
                          {item.upcomingBookings.map((booking) => {
                            const rescheduleHref = `${pagePath}?rescheduleBooking=${booking.id}#${anchorId}`;

                            return (
                              <Card className={`p-4 ${item.selectedBooking?.id === booking.id ? "border-sand bg-sand/20" : ""}`} key={booking.id}>
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="space-y-1">
                                    <p className="text-sm font-semibold text-stone-900">{formatDateRange(booking.startAt, booking.endAt)}</p>
                                    <p className="text-sm text-stone-600">
                                      {`Gebucht von ${booking.riderName ?? "Reiter"}`}
                                    </p>
                                  </div>
                                  {(booking.canCancel || booking.canReschedule) ? (
                                    <div className="grid w-full gap-2 sm:w-auto">
                                      {booking.canReschedule ? (
                                        item.selectedBooking?.id === booking.id ? (
                                          <Link className={buttonVariants("ghost", "w-full justify-center sm:w-auto")} href={clearRescheduleHref as Route}>
                                            Umbuchung abbrechen
                                          </Link>
                                        ) : (
                                          <Link className={buttonVariants("secondary", "w-full justify-center sm:w-auto")} href={rescheduleHref as Route}>
                                            Termin umbuchen
                                          </Link>
                                        )
                                      ) : null}
                                      {booking.canCancel ? (
                                        <form action={cancelOperationalBookingForOwnerAction}>
                                          <input name="bookingId" type="hidden" value={booking.id} />
                                          <ConfirmSubmitButton
                                            className={buttonVariants("secondary", "w-full border-rose-300 text-rose-700 hover:border-rose-400 hover:bg-rose-50 hover:text-rose-700 sm:w-auto")}
                                            confirmMessage="Moechtest du diesen Termin wirklich stornieren?"
                                            idleLabel="Termin stornieren"
                                            pendingLabel="Wird storniert..."
                                          />
                                        </form>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                              </Card>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {item.bookingMode !== "free" ? (
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <h3 className="text-base font-semibold text-stone-900">
                            {getOpenSlotsTitle(item.bookingMode, !!item.selectedBooking)}
                          </h3>
                          <p className="text-sm text-stone-600">
                            {getOpenSlotsSubtitle(item.bookingMode, !!item.selectedBooking)}
                          </p>
                        </div>
                        {item.openSlots.length === 0 ? (
                          <EmptyState
                            description={getEmptySlotDescription(item.bookingMode, !!item.selectedBooking)}
                            title={getEmptySlotTitle(item.bookingMode, !!item.selectedBooking)}
                          />
                        ) : (
                          <div className="space-y-3">
                            {item.openSlots.map((slot) => (
                              <Card className="p-4" key={`${slot.availabilityRuleId}:${slot.startAt}`}>
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                  <div className="space-y-1">
                                    <p className="text-sm font-semibold text-stone-900">{formatDateRange(slot.startAt, slot.endAt)}</p>
                                    <p className="text-sm text-stone-600">
                                      {item.selectedBooking
                                        ? isSlotMode
                                          ? "Freier Zielslot fuer die markierte Buchung."
                                          : "Freies Zeitfenster fuer die markierte Buchung."
                                        : isSlotMode
                                          ? "Freier operativer Slot."
                                          : "Offenes Zeitfenster."}
                                    </p>
                                  </div>
                                  {item.selectedBooking && isSlotMode ? (
                                    <form action={rescheduleOperationalBookingForOwnerAction} className="w-full sm:w-auto">
                                      <input name="bookingId" type="hidden" value={item.selectedBooking.id} />
                                      <input name="ruleId" type="hidden" value={slot.availabilityRuleId} />
                                      <input name="startAt" type="hidden" value={slot.startAt} />
                                      <input name="endAt" type="hidden" value={slot.endAt} />
                                      <SubmitButton
                                        className="w-full sm:w-auto"
                                        idleLabel="Auf diesen Slot umbuchen"
                                        pendingLabel="Wird umgebucht..."
                                      />
                                    </form>
                                  ) : null}
                                </div>
                              </Card>
                            ))}
                          </div>
                        )}

                        <Card className="border-stone-200 bg-stone-50/80 p-4">
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <h3 className="text-sm font-semibold text-stone-900">Neuen Einzeltermin anlegen</h3>
                              <p className="text-sm text-stone-600">Fuer kurzfristige Tagesaenderungen kannst du hier direkt einen einzelnen operativen Termin anlegen.</p>
                            </div>
                            <form action={createAvailabilityDayAction} className="grid gap-3 sm:grid-cols-3">
                              <input name="horseId" type="hidden" value={item.horseId} />
                              <div>
                                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500" htmlFor={`owner-slot-date-${item.horseId}`}>Datum</label>
                                <input defaultValue={todayDateValue} id={`owner-slot-date-${item.horseId}`} name="selectedDate" required step={1} type="date" />
                              </div>
                              <div>
                                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500" htmlFor={`owner-slot-start-${item.horseId}`}>Beginn</label>
                                <input id={`owner-slot-start-${item.horseId}`} name="startTime" required step={900} type="time" />
                              </div>
                              <div>
                                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500" htmlFor={`owner-slot-end-${item.horseId}`}>Ende</label>
                                <input id={`owner-slot-end-${item.horseId}`} name="endTime" required step={900} type="time" />
                              </div>
                              <div className="sm:col-span-3">
                                <SubmitButton className="w-full sm:w-auto" idleLabel="Termin anlegen" pendingLabel="Wird gespeichert..." />
                              </div>
                            </form>
                          </div>
                        </Card>
                      </div>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
