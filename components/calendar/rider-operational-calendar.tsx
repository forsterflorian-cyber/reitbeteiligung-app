import type { Route } from "next";
import Link from "next/link";

import { requestBookingAction } from "@/app/actions";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import type { Booking, Horse } from "@/types/database";

type RiderOperationalSlot = {
  availabilityRuleId: string;
  endAt: string;
  startAt: string;
};

type RiderOperationalCalendarProps = {
  detailHref: Route;
  error: string | null;
  horse: Horse;
  message: string | null;
  openSlots: RiderOperationalSlot[];
  upcomingBookings: Booking[];
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
  detailHref,
  error,
  horse,
  message,
  openSlots,
  upcomingBookings
}: RiderOperationalCalendarProps) {
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
        <div className="flex flex-wrap gap-2">
          <Badge tone="approved">Freigeschaltet</Badge>
          <Badge tone="neutral">{horse.location_address ?? `PLZ ${horse.plz}`}</Badge>
        </div>
      </SectionCard>

      <SectionCard
        id="operative-slots"
        subtitle="Freie Slots werden direkt gebucht. Konflikte und Doppelbelegungen blockt das System sofort."
        title="Freie operative Slots"
      >
        {openSlots.length === 0 ? (
          <EmptyState
            description="Aktuell gibt es fuer dieses Pferd keine freien operativen Slots."
            title="Keine freien Slots"
          />
        ) : (
          <div className="space-y-3">
            {openSlots.map((slot) => (
              <Card className="p-5" key={slot.availabilityRuleId}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-stone-900">{formatDateRange(slot.startAt, slot.endAt)}</p>
                    <p className="text-sm text-stone-600">Direkt buchbarer Slot fuer aktive Reitbeteiligungen.</p>
                  </div>
                  <form action={requestBookingAction} className="w-full sm:w-auto">
                    <input name="horseId" type="hidden" value={horse.id} />
                    <input name="ruleId" type="hidden" value={slot.availabilityRuleId} />
                    <input name="startAt" type="hidden" value={slot.startAt} />
                    <input name="endAt" type="hidden" value={slot.endAt} />
                    <input name="recurrenceRrule" type="hidden" value="" />
                    <SubmitButton className="w-full sm:w-auto" idleLabel="Direkt buchen" pendingLabel="Wird gebucht..." />
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
        {upcomingBookings.length === 0 ? (
          <EmptyState
            description="Sobald du einen operativen Slot direkt buchst, erscheint der Termin hier."
            title="Noch kein Termin gebucht"
          />
        ) : (
          <div className="space-y-3">
            {upcomingBookings.map((booking) => (
              <Card className="p-5" key={booking.id}>
                <p className="text-sm font-semibold text-stone-900">{formatDateRange(booking.start_at, booking.end_at)}</p>
                <p className="mt-1 text-sm text-stone-600">Direkt gebuchter Termin im operativen Kalender.</p>
              </Card>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
