import type { Route } from "next";
import Link from "next/link";

import {
  cancelOperationalBookingForRiderAction,
  requestBookingAction,
  rescheduleOperationalBookingForRiderAction
} from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionCard } from "@/components/ui/section-card";
import type { RiderOperationalWorkspaceItem } from "@/lib/rider-workspace";

function formatDateRange(startAt: string, endAt: string) {
  return `${new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(startAt))} bis ${new Intl.DateTimeFormat("de-DE", {
    timeStyle: "short"
  }).format(new Date(endAt))}`;
}

type RiderOperationalWorkspaceProps = {
  items: RiderOperationalWorkspaceItem[];
  pagePath: string;
  sectionId?: string;
  subtitle?: string;
  title?: string;
};

export function RiderOperationalWorkspace({
  items,
  pagePath,
  sectionId = "rider-alltag",
  subtitle = "Buchen, umbuchen und stornieren laufen hier direkt ueber deine aktiven Reitbeteiligungen.",
  title = "Tagesgeschaeft"
}: RiderOperationalWorkspaceProps) {
  return (
    <SectionCard id={sectionId} subtitle={subtitle} title={title}>
      {items.length === 0 ? (
        <EmptyState
          description="Sobald eine Reitbeteiligung aktiv ist, erscheinen hier deine naechsten Termine und freie Slots."
          title="Noch kein operatives Tagesgeschaeft"
        />
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const anchorId = `alltag-${item.horseId}`;
            const clearRescheduleHref = `${pagePath}#${anchorId}`;

            return (
              <Card className="p-5" id={anchorId} key={item.horseId}>
                <div className="space-y-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-clay">Aktive Reitbeteiligung</p>
                      <p className="text-lg font-semibold text-ink">{item.horseTitle}</p>
                      <p className="text-sm text-stone-600">
                        {item.selectedBooking
                          ? "Du buchst gerade auf einen anderen freien Slot um."
                          : "Freie Slots und deine naechsten Termine ohne Umweg ueber das Pferdeprofil."}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="approved">{item.upcomingBookings.length} Termin{item.upcomingBookings.length === 1 ? "" : "e"}</Badge>
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
                          <p className="text-sm font-semibold text-stone-900">Aktueller Termin fuer die Umbuchung</p>
                          <p className="text-sm text-stone-700">{formatDateRange(item.selectedBooking.startAt, item.selectedBooking.endAt)}</p>
                          <p className="text-xs text-stone-600">Die alte Belegung wird bei Erfolg atomar ersetzt und als Historie erhalten.</p>
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

                  <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <h3 className="text-base font-semibold text-stone-900">Naechste eigene Termine</h3>
                        <p className="text-sm text-stone-600">Stornieren und Umbuchen bleiben direkt an deinen eigenen Buchungen.</p>
                      </div>
                      {item.upcomingBookings.length === 0 ? (
                        <EmptyState
                          description="Sobald du einen Slot buchst, erscheint er hier mit Direktaktionen."
                          title="Noch kein Termin geplant"
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
                                    <p className="text-sm text-stone-600">Direkt gebuchter operativer Termin.</p>
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
                                        <form action={cancelOperationalBookingForRiderAction}>
                                          <input name="bookingId" type="hidden" value={booking.id} />
                                          <ConfirmSubmitButton
                                            className={buttonVariants("secondary", "w-full border-rose-300 text-rose-700 hover:border-rose-400 hover:bg-rose-50 hover:text-rose-700 sm:w-auto")}
                                            confirmMessage="Moechtest du diesen operativen Termin wirklich stornieren? Der Slot wird danach wieder freigegeben."
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

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <h3 className="text-base font-semibold text-stone-900">
                          {item.selectedBooking ? "Freie Zielslots fuer die Umbuchung" : "Freie Slots in den naechsten Tagen"}
                        </h3>
                        <p className="text-sm text-stone-600">
                          {item.selectedBooking
                            ? "Nur fachlich gueltige freie Zielslots werden angeboten."
                            : "Diese operativen Slots kannst du direkt ohne weiteren Seitensprung buchen."}
                        </p>
                      </div>
                      {item.openSlots.length === 0 ? (
                        <EmptyState
                          description={
                            item.selectedBooking
                              ? "Aktuell gibt es keinen anderen gueltigen freien Slot fuer diese Umbuchung."
                              : "Aktuell gibt es fuer dieses Pferd keinen freien operativen Slot."
                          }
                          title={item.selectedBooking ? "Kein Zielslot frei" : "Keine freien Slots"}
                        />
                      ) : (
                        <div className="space-y-3">
                          {item.openSlots.map((slot) => (
                            <Card className="p-4" key={`${slot.availabilityRuleId}:${slot.startAt}`}>
                              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="space-y-1">
                                  <p className="text-sm font-semibold text-stone-900">{formatDateRange(slot.startAt, slot.endAt)}</p>
                                  <p className="text-sm text-stone-600">
                                    {item.selectedBooking ? "Freier Zielslot fuer die aktuelle Umbuchung." : "Freier operativer Slot fuer deine naechste Buchung."}
                                  </p>
                                </div>
                                <form action={item.selectedBooking ? rescheduleOperationalBookingForRiderAction : requestBookingAction} className="w-full sm:w-auto">
                                  {item.selectedBooking ? <input name="bookingId" type="hidden" value={item.selectedBooking.id} /> : null}
                                  <input name="horseId" type="hidden" value={item.horseId} />
                                  <input name="ruleId" type="hidden" value={slot.availabilityRuleId} />
                                  <input name="startAt" type="hidden" value={slot.startAt} />
                                  <input name="endAt" type="hidden" value={slot.endAt} />
                                  <input name="recurrenceRrule" type="hidden" value="" />
                                  <SubmitButton
                                    className="w-full sm:w-auto"
                                    idleLabel={item.selectedBooking ? "Auf diesen Slot umbuchen" : "Direkt buchen"}
                                    pendingLabel={item.selectedBooking ? "Wird umgebucht..." : "Wird gebucht..."}
                                  />
                                </form>
                              </div>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
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
