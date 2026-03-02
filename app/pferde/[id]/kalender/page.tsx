import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  acceptBookingRequestAction,
  createAvailabilityRuleAction,
  createCalendarBlockAction,
  declineBookingRequestAction,
  deleteAvailabilityRuleAction,
  deleteCalendarBlockAction,
  requestBookingAction
} from "@/app/actions";
import { RequestCard } from "@/components/blocks/request-card";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Notice } from "@/components/notice";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { isApproved } from "@/lib/approvals";
import { getViewerContext } from "@/lib/auth";
import { HORSE_SELECT_FIELDS } from "@/lib/horses";
import { getOwnerPlan } from "@/lib/plans";
import { readSearchParam } from "@/lib/search-params";
import type { AvailabilityRule, BookingRequest, CalendarBlock, Horse, Profile } from "@/types/database";

type PferdKalenderPageProps = {
  params: { id: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

type CalendarOccupancyRow = {
  source: "booking" | "block" | string;
  start_at: string;
  end_at: string;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "short"
  }).format(new Date(value));
}

function formatDateRange(startAt: string, endAt: string) {
  return `${formatDateTime(startAt)} bis ${formatDateTime(endAt)}`;
}

function occupancyLabel(source: string) {
  return source === "booking" ? "Gebuchter Termin" : "Vom Pferdehalter blockiert";
}

function ruleLabel(rule: AvailabilityRule) {
  return formatDateRange(rule.start_at, rule.end_at);
}

function toDayKey(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function dayEnd(date: Date) {
  const start = dayStart(date);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1, 0, 0, 0, 0);
}

function overlapsDay(startAt: string, endAt: string, dayDate: Date) {
  const rangeStart = new Date(startAt).getTime();
  const rangeEnd = new Date(endAt).getTime();
  const dayRangeStart = dayStart(dayDate).getTime();
  const dayRangeEnd = dayEnd(dayDate).getTime();
  return rangeStart < dayRangeEnd && rangeEnd > dayRangeStart;
}

function buildUpcomingDays(count: number) {
  const days: Date[] = [];
  const start = dayStart(new Date());

  for (let index = 0; index < count; index += 1) {
    days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  }

  return days;
}

export default async function PferdKalenderPage({ params, searchParams }: PferdKalenderPageProps) {
  const { profile, supabase, user } = await getViewerContext();
  const error = readSearchParam(searchParams, "error");
  const message = readSearchParam(searchParams, "message");
  const { data } = await supabase.from("horses").select(HORSE_SELECT_FIELDS).eq("id", params.id).maybeSingle();
  const horse = (data as Horse | null) ?? null;

  if (!horse) {
    notFound();
  }

  const detailHref = `/pferde/${horse.id}` as Route;
  const isOwner = profile?.role === "owner" && user?.id === horse.owner_id;
  const isRider = profile?.role === "rider" && Boolean(user);
  const { data: ownerProfileData } = await supabase
    .from("profiles")
    .select("id, role, is_premium, created_at, display_name, phone")
    .eq("id", horse.owner_id)
    .maybeSingle();
  const ownerProfile = ((ownerProfileData as Profile | null) ?? null) || (isOwner ? profile : null);
  const ownerPlan = getOwnerPlan(ownerProfile);
  const bookingFeaturesEnabled = ownerPlan.bookingFeaturesEnabled;
  const riderApproved = isRider && user ? await isApproved(horse.id, user.id, supabase) : false;

  const [occupancyResult, rulesResult, ownerBlocksResult, ownerBookingRequestsResult, riderBookingRequestsResult] = await Promise.all([
    supabase.rpc("get_horse_calendar_occupancy", {
      p_horse_id: horse.id
    }),
    supabase
      .from("availability_rules")
      .select("id, horse_id, slot_id, start_at, end_at, active, created_at")
      .eq("horse_id", horse.id)
      .order("start_at", { ascending: true }),
    isOwner
      ? supabase
          .from("calendar_blocks")
          .select("id, horse_id, start_at, end_at, created_at")
          .eq("horse_id", horse.id)
          .order("start_at", { ascending: true })
      : Promise.resolve({ data: [] as CalendarBlock[] | null }),
    isOwner
      ? supabase
          .from("booking_requests")
          .select("id, slot_id, availability_rule_id, horse_id, rider_id, status, requested_start_at, requested_end_at, recurrence_rrule, created_at")
          .eq("horse_id", horse.id)
          .order("created_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] as BookingRequest[] | null }),
    isRider && user
      ? supabase
          .from("booking_requests")
          .select("id, slot_id, availability_rule_id, horse_id, rider_id, status, requested_start_at, requested_end_at, recurrence_rrule, created_at")
          .eq("horse_id", horse.id)
          .eq("rider_id", user.id)
          .order("created_at", { ascending: false })
          .limit(12)
      : Promise.resolve({ data: [] as BookingRequest[] | null })
  ]);

  const occupancy = ((occupancyResult.data as CalendarOccupancyRow[] | null) ?? []).sort(
    (left, right) => new Date(left.start_at).getTime() - new Date(right.start_at).getTime()
  );
  const occupancyError = occupancyResult.error;
  const rules = ((rulesResult.data as AvailabilityRule[] | null) ?? []).filter((rule) => rule.active);
  const ownerBlocks = (ownerBlocksResult.data as CalendarBlock[] | null) ?? [];
  const ownerBookingRequests = (ownerBookingRequestsResult.data as BookingRequest[] | null) ?? [];
  const riderBookingRequests = (riderBookingRequestsResult.data as BookingRequest[] | null) ?? [];
  const ruleMap = new Map(rules.map((rule) => [rule.id, rule]));
  const upcomingDays = buildUpcomingDays(14);

  const dayOverview = upcomingDays.map((day) => {
    const occupiedCount = occupancy.filter((entry) => overlapsDay(entry.start_at, entry.end_at, day)).length;
    const availableCount = rules.filter((rule) => overlapsDay(rule.start_at, rule.end_at, day)).length;
    const requestCount = ownerBookingRequests.filter(
      (request) =>
        request.status === "requested" &&
        request.requested_start_at &&
        request.requested_end_at &&
        overlapsDay(request.requested_start_at, request.requested_end_at, day)
    ).length;

    return {
      availableCount,
      date: day,
      isToday: toDayKey(day) === toDayKey(new Date()),
      occupiedCount,
      requestCount
    };
  });

  const requestedOwnerBookingItems = ownerBookingRequests.filter((request) => request.status === "requested");

  return (
    <div className="space-y-6 sm:space-y-8">
      <Link className={buttonVariants("ghost", "min-h-0 justify-start px-0 py-0 text-sm font-semibold text-forest hover:bg-transparent hover:text-clay")} href={detailHref}>
        Zurück zum Pferdeprofil
      </Link>

      <PageHeader
        subtitle="Kalender, Verfügbarkeiten und Terminanfragen auf einen Blick."
        title={`Kalender für ${horse.title}`}
      />

      <Notice text={error} tone="error" />
      <Notice text={message} tone="success" />
      {occupancyError ? <Notice text="Der Kalender konnte nicht geladen werden." tone="error" /> : null}

      <div className="ui-horse-context">
        <div className="ui-horse-context-grid">
          <div className="space-y-2">
            <p className="ui-eyebrow">Pferdeprofil</p>
            <h2 className="font-serif text-2xl text-stone-900 sm:text-3xl">{horse.title}</h2>
            <p className="ui-inline-meta">PLZ {horse.plz} {horse.active ? "· Aktiv" : "· Inaktiv"}</p>
            <p className="text-sm leading-6 text-stone-600">
              {horse.description?.trim() || "Hier steuerst du Verfügbarkeiten, Sperren und eingehende Terminanfragen für dieses Pferd."}
            </p>
          </div>
          <div className="flex flex-col gap-3 lg:items-end">
            <div className="ui-kpi-row">
              <Badge tone={horse.active ? "approved" : "neutral"}>{horse.active ? "Aktiv" : "Inaktiv"}</Badge>
              <Badge tone={bookingFeaturesEnabled ? "approved" : "pending"}>{bookingFeaturesEnabled ? "Premium aktiv" : ownerPlan.label}</Badge>
            </div>
            <Link className={buttonVariants("secondary", "w-full lg:w-auto")} href={detailHref}>
              Pferdeprofil öffnen
            </Link>
          </div>
        </div>
      </div>

      <SectionCard subtitle="Schneller Überblick über freie Zeiten, belegte Bereiche und offene Anfragen." title="Nächste 14 Tage">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge tone="approved">Freie Fenster</Badge>
            <Badge tone="rejected">Belegt</Badge>
            {isOwner ? <Badge tone="pending">Anfrage wartet</Badge> : null}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            {dayOverview.map((day) => (
              <Card className={day.isToday ? "border-stone-300 bg-sand p-3" : "p-3"} key={toDayKey(day.date)}>
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
                        {day.date.toLocaleDateString("de-DE", { weekday: "short" })}
                      </p>
                      <p className="mt-1 text-lg font-semibold text-stone-900">{formatDate(day.date.toISOString())}</p>
                    </div>
                    {day.isToday ? <Badge tone="approved">Heute</Badge> : null}
                  </div>
                  <div className="space-y-2 text-xs font-semibold">
                    <div className="flex items-center justify-between rounded-xl bg-sand px-3 py-2 text-forest">
                      <span>Frei</span>
                      <span>{day.availableCount}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-rose-50 px-3 py-2 text-rose-700">
                      <span>Belegt</span>
                      <span>{day.occupiedCount}</span>
                    </div>
                    {isOwner ? (
                      <div className="flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2 text-amber-700">
                        <span>Anfragen</span>
                        <span>{day.requestCount}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
        <div className="space-y-5">
          <SectionCard
            subtitle="Gebuchte Termine und blockierte Zeiten werden hier gesammelt als belegt dargestellt."
            title="Belegte Zeitraeume"
          >
            <div className="space-y-3">
              {occupancy.length === 0 ? (
                <EmptyState description="Aktuell sind keine belegten Zeitraeume eingetragen." title="Noch nichts belegt" />
              ) : (
                occupancy.map((entry, index) => (
                  <Card className="p-4" key={`${entry.source}-${entry.start_at}-${entry.end_at}-${index}`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-stone-900">{formatDateRange(entry.start_at, entry.end_at)}</p>
                        <p className="text-sm text-stone-600">{occupancyLabel(entry.source)}</p>
                      </div>
                      <Badge tone="rejected">Belegt</Badge>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </SectionCard>

          <SectionCard
            subtitle="Innerhalb dieser Zeitfenster koennen freigeschaltete Reiter einen einzelnen Termin anfragen."
            title="Verfügbare Zeitfenster"
          >
            <div className="space-y-3">
              {rules.length === 0 ? (
                <EmptyState
                  description="Aktuell gibt es noch keine offenen Verfügbarkeitsfenster."
                  title="Noch keine Zeitfenster"
                />
              ) : (
                rules.map((rule) => (
                  <Card className="p-4" key={rule.id}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-stone-900">{ruleLabel(rule)}</p>
                        <p className="text-sm text-stone-600">Freies Zeitfenster für Terminanfragen</p>
                      </div>
                      <Badge tone="approved">Verfügbar</Badge>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-5">
          {isRider ? (
            <SectionCard
              bodyClassName="space-y-5"
              subtitle="Wähle ein verfügbares Zeitfenster und fordere einen konkreten Termin an."
              title="Termin anfragen"
            >
              {!bookingFeaturesEnabled ? (
                <EmptyState
                  description="Terminbuchungen werden freigeschaltet, sobald der Pferdehalter Premium nutzt."
                  title="Terminbuchung noch nicht aktiv"
                />
              ) : riderApproved ? (
                rules.length > 0 ? (
                  <form action={requestBookingAction} className="space-y-4">
                    <input name="horseId" type="hidden" value={horse.id} />
                    <div>
                      <label htmlFor="ruleId">Verfügbarkeitsfenster</label>
                      <select defaultValue="" id="ruleId" name="ruleId" required>
                        <option value="">Bitte wählen</option>
                        {rules.map((rule) => (
                          <option key={rule.id} value={rule.id}>
                            {ruleLabel(rule)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="requestStartAt">Beginn</label>
                      <input id="requestStartAt" name="startAt" required type="datetime-local" />
                    </div>
                    <div>
                      <label htmlFor="requestEndAt">Ende</label>
                      <input id="requestEndAt" name="endAt" required type="datetime-local" />
                    </div>
                    <div>
                      <label htmlFor="recurrenceRrule">Wiederholung (optional)</label>
                      <input id="recurrenceRrule" name="recurrenceRrule" placeholder="FREQ=WEEKLY;INTERVAL=1;COUNT=6" type="text" />
                      <p className="mt-2 text-sm text-stone-600">Beispiel: jede Woche für sechs Termine.</p>
                    </div>
                    <SubmitButton idleLabel="Termin anfragen" pendingLabel="Wird gesendet..." />
                  </form>
                ) : (
                  <EmptyState
                    description="Aktuell gibt es keine offenen Verfügbarkeitsfenster für dieses Pferd."
                    title="Kein Zeitfenster verfuegbar"
                  />
                )
              ) : (
                <EmptyState
                  description="Erst nach deiner Freischaltung kannst du einen Termin anfragen."
                  title="Noch nicht freigeschaltet"
                />
              )}

              <div className="space-y-3 border-t border-stone-200 pt-5">
                <h3 className="text-base font-semibold text-stone-900">Meine Terminanfragen für dieses Pferd</h3>
                {riderBookingRequests.length === 0 ? (
                  <EmptyState
                    description="Sobald du eine Terminanfrage stellst, erscheint sie hier mit aktuellem Status."
                    title="Noch keine Terminanfrage"
                  />
                ) : (
                  riderBookingRequests.map((request) => {
                    const rule = request.availability_rule_id ? ruleMap.get(request.availability_rule_id) ?? null : null;

                    return (
                      <RequestCard
                        description={
                          request.recurrence_rrule
                            ? `Wiederholung: ${request.recurrence_rrule}`
                            : rule
                              ? `Fenster: ${ruleLabel(rule)}`
                              : "Kein Zeitfenster mehr vorhanden."
                        }
                        eyebrow={
                          request.requested_start_at && request.requested_end_at
                            ? formatDateRange(request.requested_start_at, request.requested_end_at)
                            : "Zeitpunkt wird geprüft"
                        }
                        key={request.id}
                        meta={formatDateTime(request.created_at)}
                        status={request.status}
                        timeline
                        title="Terminanfrage"
                      />
                    );
                  })
                )}
              </div>
            </SectionCard>
          ) : null}

          {isOwner ? (
            bookingFeaturesEnabled ? (
              <>
                <SectionCard subtitle="Lege wiederkehrende Standardzeiten fest und nutze Sperren nur noch für Ausnahmen." title="Standardzeiten & Ausnahmen">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <Card className="p-5">
                      <form action={createAvailabilityRuleAction} className="ui-form-stack">
                        <input name="horseId" type="hidden" value={horse.id} />
                        <div className="ui-subpanel">
                          <p className="ui-eyebrow">Standardzeiten</p>
                          <p className="mt-2 ui-inline-meta">Das gewählte Wochenmuster wird für die nächsten 8 Wochen als Verfügbarkeit angelegt.</p>
                        </div>
                        <div>
                          <label htmlFor="availabilityPreset">Wochenmuster</label>
                          <select defaultValue="weekdays" id="availabilityPreset" name="availabilityPreset" required>
                            <option value="daily">Jeden Tag</option>
                            <option value="weekdays">Nur unter der Woche</option>
                            <option value="weekends">Nur am Wochenende</option>
                            <option value="custom">Eigene Wochentage</option>
                          </select>
                        </div>
                        <fieldset className="space-y-3">
                          <legend className="text-sm font-medium text-stone-900">Eigene Wochentage (nur für „Eigene Wochentage“)</legend>
                          <div className="ui-choice-grid">
                            <label className="ui-choice-chip">
                              <input name="weekday" type="checkbox" value="1" />
                              <span>Montag</span>
                            </label>
                            <label className="ui-choice-chip">
                              <input name="weekday" type="checkbox" value="2" />
                              <span>Dienstag</span>
                            </label>
                            <label className="ui-choice-chip">
                              <input name="weekday" type="checkbox" value="3" />
                              <span>Mittwoch</span>
                            </label>
                            <label className="ui-choice-chip">
                              <input name="weekday" type="checkbox" value="4" />
                              <span>Donnerstag</span>
                            </label>
                            <label className="ui-choice-chip">
                              <input name="weekday" type="checkbox" value="5" />
                              <span>Freitag</span>
                            </label>
                            <label className="ui-choice-chip">
                              <input name="weekday" type="checkbox" value="6" />
                              <span>Samstag</span>
                            </label>
                            <label className="ui-choice-chip sm:col-span-2">
                              <input name="weekday" type="checkbox" value="0" />
                              <span>Sonntag</span>
                            </label>
                          </div>
                        </fieldset>
                        <div className="ui-field-grid sm:grid-cols-2">
                          <div>
                            <label htmlFor="availabilityStartTime">Von</label>
                            <input defaultValue="17:00" id="availabilityStartTime" name="startTime" required type="time" />
                          </div>
                          <div>
                            <label htmlFor="availabilityEndTime">Bis</label>
                            <input defaultValue="19:00" id="availabilityEndTime" name="endTime" required type="time" />
                          </div>
                        </div>
                        <SubmitButton idleLabel="Standardzeiten speichern" pendingLabel="Wird gespeichert..." />
                      </form>
                    </Card>
                    <Card className="p-5">
                      <form action={createCalendarBlockAction} className="ui-form-stack">
                        <input name="horseId" type="hidden" value={horse.id} />
                        <div className="ui-subpanel">
                          <p className="ui-eyebrow">Ausnahme sperren</p>
                          <p className="mt-2 ui-inline-meta">Nutze Sperren nur dann, wenn das Pferd trotz Standardzeit kurzfristig nicht verfügbar ist.</p>
                        </div>
                        <div>
                          <label htmlFor="blockStartAt">Beginn</label>
                          <input id="blockStartAt" name="startAt" required type="datetime-local" />
                        </div>
                        <div>
                          <label htmlFor="blockEndAt">Ende</label>
                          <input id="blockEndAt" name="endAt" required type="datetime-local" />
                        </div>
                        <SubmitButton idleLabel="Ausnahme sperren" pendingLabel="Wird gespeichert..." />
                      </form>
                    </Card>
                  </div>
                </SectionCard>

                <SectionCard subtitle="Nimm angefragte Termine an oder lehne sie ab." title="Offene Terminanfragen">
                  <div className="space-y-4">
                    {requestedOwnerBookingItems.length === 0 ? (
                      <EmptyState
                        description="Für dieses Pferd liegen derzeit keine offenen Terminanfragen vor."
                        title="Keine offenen Terminanfragen"
                      />
                    ) : (
                      requestedOwnerBookingItems.map((request) => {
                        const rule = request.availability_rule_id ? ruleMap.get(request.availability_rule_id) ?? null : null;

                        return (
                          <Card className="p-4 sm:p-5" key={request.id}>
                            <div className="space-y-4">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="space-y-1">
                                  <p className="text-sm font-semibold text-stone-900">
                                    {request.requested_start_at && request.requested_end_at
                                      ? formatDateRange(request.requested_start_at, request.requested_end_at)
                                      : "Zeitpunkt wird geprüft"}
                                  </p>
                                  <p className="text-sm text-stone-600">Reiter {request.rider_id.slice(0, 8)}</p>
                                  <p className="text-sm text-stone-600">{rule ? `Fenster: ${ruleLabel(rule)}` : "Kein Zeitfenster mehr vorhanden."}</p>
                                </div>
                                <StatusBadge status={request.status} />
                              </div>
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <form action={acceptBookingRequestAction}>
                                  <input name="requestId" type="hidden" value={request.id} />
                                  <Button className="w-full" type="submit" variant="primary">
                                    Annehmen
                                  </Button>
                                </form>
                                <form action={declineBookingRequestAction}>
                                  <input name="requestId" type="hidden" value={request.id} />
                                  <Button
                                    className="w-full border-rose-300 text-rose-700 hover:border-rose-400 hover:bg-rose-50 hover:text-rose-700"
                                    type="submit"
                                    variant="secondary"
                                  >
                                    Ablehnen
                                  </Button>
                                </form>
                              </div>
                            </div>
                          </Card>
                        );
                      })
                    )}
                  </div>
                </SectionCard>

                <div className="grid gap-5 lg:grid-cols-2">
                  <SectionCard
                    subtitle="Beim Entfernen werden offene Terminanfragen in diesem Fenster automatisch gelöscht."
                    title="Eigene Verfügbarkeitsfenster"
                  >
                    <div className="space-y-3">
                      {rules.length === 0 ? (
                        <EmptyState
                          description="Lege zuerst ein Verfügbarkeitsfenster an, damit Reiter Termine anfragen können."
                          title="Noch keine Verfügbarkeiten"
                        />
                      ) : (
                        rules.map((rule) => (
                          <Card className="p-4" key={rule.id}>
                            <p className="text-sm font-semibold text-stone-900">{ruleLabel(rule)}</p>
                            <form action={deleteAvailabilityRuleAction} className="mt-3">
                              <input name="ruleId" type="hidden" value={rule.id} />
                              <ConfirmSubmitButton
                                className={buttonVariants("secondary", "w-full")}
                                confirmMessage="Möchtest du dieses Verfügbarkeitsfenster wirklich entfernen?"
                                idleLabel="Fenster löschen"
                                pendingLabel="Wird entfernt..."
                              />
                            </form>
                          </Card>
                        ))
                      )}
                    </div>
                  </SectionCard>

                  <SectionCard subtitle="Nur diese selbst gesetzten Sperren kannst du wieder entfernen." title="Eigene Sperren">
                    <div className="space-y-3">
                      {ownerBlocks.length === 0 ? (
                        <EmptyState
                          description="Nutze Sperren für Ausnahmen, wenn das Pferd kurzfristig nicht verfügbar ist."
                          title="Noch keine Sperren"
                        />
                      ) : (
                        ownerBlocks.map((block) => (
                          <Card className="p-4" key={block.id}>
                            <p className="text-sm font-semibold text-stone-900">{formatDateRange(block.start_at, block.end_at)}</p>
                            <form action={deleteCalendarBlockAction} className="mt-3">
                              <input name="blockId" type="hidden" value={block.id} />
                              <ConfirmSubmitButton
                                className={buttonVariants("secondary", "w-full")}
                                confirmMessage="Möchtest du diese Kalender-Sperre wirklich entfernen?"
                                idleLabel="Sperre entfernen"
                                pendingLabel="Wird entfernt..."
                              />
                            </form>
                          </Card>
                        ))
                      )}
                    </div>
                  </SectionCard>
                </div>
              </>
            ) : (
              <SectionCard
                subtitle="Standardzeiten, Terminanfragen und Kalendersteuerung sind Teil des Premium-Tarifs."
                title="Premium für Terminbuchung"
              >
                <div className="space-y-4">
                  <div className="ui-subpanel">
                    <p className="ui-eyebrow">Aktueller Tarif</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge tone="pending">{ownerPlan.label}</Badge>
                      <p className="text-sm font-medium text-stone-900">Kalenderfunktionen noch gesperrt</p>
                    </div>
                    <p className="mt-2 ui-inline-meta">{ownerPlan.summary}</p>
                  </div>
                  <p className="text-sm leading-6 text-stone-600">
                    Sobald Premium aktiv ist, kannst du Standardzeiten hinterlegen, Sperren setzen und Terminanfragen direkt im Kalender annehmen.
                  </p>
                </div>
              </SectionCard>
            )
          ) : null}

          {!profile ? (
            <SectionCard subtitle="Melde dich an, um Verfügbarkeiten, Anfragen und deinen eigenen Status zu sehen." title="Kalender nutzen">
              <Link className={buttonVariants("primary", "w-full sm:w-auto")} href="/login">
                Anmelden, um den Kalender zu nutzen
              </Link>
            </SectionCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}



