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
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Notice } from "@/components/notice";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { isApproved } from "@/lib/approvals";
import { getViewerContext } from "@/lib/auth";
import { HORSE_SELECT_FIELDS } from "@/lib/horses";
import { readSearchParam } from "@/lib/search-params";
import type { AvailabilityRule, BookingRequest, CalendarBlock, Horse } from "@/types/database";

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
    <div className="space-y-5">
      <Link className="inline-flex min-h-[44px] items-center text-sm font-semibold text-blue-800 hover:text-blue-700" href={detailHref}>
        Zurueck zum Pferdeprofil
      </Link>
      <section className="overflow-hidden rounded-2xl border border-blue-800 bg-gradient-to-br from-blue-800 via-blue-700 to-blue-600 text-white">
        <div className="space-y-4 px-5 py-6 sm:px-6">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-100">Kalender</p>
          <h1 className="text-3xl font-semibold sm:text-4xl">{horse.title}</h1>
          <p className="max-w-3xl text-sm text-blue-50 sm:text-base">
            Belegte Zeiten, freie Fenster und Terminanfragen in einer kompakten Kalenderansicht. So wirkt die Verwaltung bereits deutlich naeher an einem echten Terminplaner.
          </p>
        </div>
      </section>
      <Notice text={error} tone="error" />
      <Notice text={message} tone="success" />
      {occupancyError ? <Notice text="Der Kalender konnte nicht geladen werden." tone="error" /> : null}
      <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-3 border-b border-stone-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-stone-900">Naechste 14 Tage</h2>
            <p className="mt-1 text-sm text-stone-600">Schneller Ueberblick ueber freie Zeiten, belegte Bereiche und offene Terminanfragen.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">Freie Fenster</span>
            <span className="inline-flex rounded-full bg-rose-100 px-3 py-1 text-rose-700">Belegt</span>
            {isOwner ? <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-amber-700">Anfrage wartet</span> : null}
          </div>
        </div>
        <div className="mt-4 grid gap-3 grid-cols-2 md:grid-cols-4 xl:grid-cols-7">
          {dayOverview.map((day) => (
            <div className={`rounded-xl border p-3 ${day.isToday ? "border-blue-700 bg-blue-50" : "border-stone-200 bg-white"}`} key={toDayKey(day.date)}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">{day.date.toLocaleDateString("de-DE", { weekday: "short" })}</p>
                  <p className="mt-1 text-lg font-semibold text-stone-900">{formatDate(day.date.toISOString())}</p>
                </div>
                {day.isToday ? <span className="rounded-full bg-blue-700 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">Heute</span> : null}
              </div>
              <div className="mt-3 space-y-2 text-xs font-semibold">
                <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-2 py-1 text-emerald-700">
                  <span>Freie Fenster</span>
                  <span>{day.availableCount}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-rose-50 px-2 py-1 text-rose-700">
                  <span>Belegt</span>
                  <span>{day.occupiedCount}</span>
                </div>
                {isOwner ? (
                  <div className="flex items-center justify-between rounded-lg bg-amber-50 px-2 py-1 text-amber-700">
                    <span>Anfragen</span>
                    <span>{day.requestCount}</span>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
        <section className="space-y-5">
          <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
            <div>
              <h2 className="text-xl font-semibold text-stone-900">Belegte Zeitraeume</h2>
              <p className="mt-2 text-sm text-stone-600">Gebuchte Termine und Sperren werden hier gesammelt als belegt dargestellt.</p>
            </div>
            {occupancy.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-600">Aktuell sind keine belegten Zeitraeume eingetragen.</div>
            ) : (
              <div className="mt-4 space-y-3">
                {occupancy.map((entry, index) => (
                  <div className="rounded-xl border border-stone-200 p-4" key={`${entry.source}-${entry.start_at}-${entry.end_at}-${index}`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-stone-900">{formatDateRange(entry.start_at, entry.end_at)}</p>
                        <p className="text-sm text-stone-600">{occupancyLabel(entry.source)}</p>
                      </div>
                      <span className="inline-flex min-h-[44px] items-center rounded-full bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-700">Belegt</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
            <div>
              <h2 className="text-xl font-semibold text-stone-900">Verfuegbare Zeitfenster</h2>
              <p className="mt-2 text-sm text-stone-600">Innerhalb dieser Zeitfenster koennen freigeschaltete Reiter einen einzelnen Termin anfragen.</p>
            </div>
            {rules.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-600">Noch keine Verfuegbarkeitsfenster vorhanden.</div>
            ) : (
              <div className="mt-4 space-y-3">
                {rules.map((rule) => (
                  <div className="rounded-xl border border-stone-200 p-4" key={rule.id}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-stone-900">{ruleLabel(rule)}</p>
                        <p className="text-sm text-stone-600">Freies Zeitfenster fuer Terminanfragen</p>
                      </div>
                      <span className="inline-flex min-h-[44px] items-center rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-700">Verfuegbar</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </section>
        <section className="space-y-5">
          {isRider ? (
            <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
              <div className="bg-gradient-to-r from-blue-800 to-blue-700 px-5 py-4 text-white sm:px-6">
                <h2 className="text-2xl font-semibold">Termin anfragen</h2>
                <p className="mt-2 text-sm text-blue-50">Waehle ein verfuegbares Zeitfenster und fordere einen konkreten Termin an.</p>
              </div>
              <div className="space-y-4 px-5 py-5 sm:px-6">
                {riderApproved ? (
                  rules.length > 0 ? (
                    <form action={requestBookingAction} className="space-y-4">
                      <input name="horseId" type="hidden" value={horse.id} />
                      <div>
                        <label htmlFor="ruleId">Verfuegbarkeitsfenster</label>
                        <select defaultValue="" id="ruleId" name="ruleId" required>
                          <option value="">Bitte waehlen</option>
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
                        <p className="mt-2 text-sm text-stone-600">Beispiel: jede Woche fuer sechs Termine.</p>
                      </div>
                      <SubmitButton idleLabel="Termin anfragen" pendingLabel="Wird gesendet..." />
                    </form>
                  ) : (
                    <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-600">Aktuell gibt es keine offenen Verfuegbarkeitsfenster fuer dieses Pferd.</div>
                  )
                ) : (
                  <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-600">Erst nach deiner Freischaltung kannst du einen Termin anfragen.</div>
                )}
                <div className="space-y-3 border-t border-stone-200 pt-4">
                  <h3 className="text-base font-semibold text-stone-900">Meine Terminanfragen fuer dieses Pferd</h3>
                  {riderBookingRequests.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-600">Du hast fuer dieses Pferd noch keine Terminanfrage gestellt.</div>
                  ) : (
                    riderBookingRequests.map((request) => {
                      const rule = request.availability_rule_id ? ruleMap.get(request.availability_rule_id) ?? null : null;

                      return (
                        <div className="rounded-xl border border-stone-200 p-4" key={request.id}>
                          <div className="space-y-2">
                            <StatusBadge status={request.status} />
                            <p className="text-sm font-semibold text-stone-900">
                              {request.requested_start_at && request.requested_end_at
                                ? formatDateRange(request.requested_start_at, request.requested_end_at)
                                : "Zeitpunkt wird geprueft"}
                            </p>
                            <p className="text-sm text-stone-600">{rule ? `Fenster: ${ruleLabel(rule)}` : "Kein Zeitfenster mehr vorhanden."}</p>
                            {request.recurrence_rrule ? <p className="text-sm text-stone-600">Wiederholung: {request.recurrence_rrule}</p> : null}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </section>
          ) : null}
          {isOwner ? (
            <>
              <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
                <div className="flex flex-col gap-3 border-b border-stone-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-stone-900">Kalender pflegen</h2>
                    <p className="mt-1 text-sm text-stone-600">Lege freie Fenster und blockierte Zeiten direkt nebeneinander an.</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <form action={createAvailabilityRuleAction} className="rounded-xl border border-stone-200 p-4 space-y-4">
                    <input name="horseId" type="hidden" value={horse.id} />
                    <div>
                      <h3 className="text-base font-semibold text-stone-900">Verfuegbarkeitsfenster</h3>
                      <p className="mt-1 text-sm text-stone-600">Dieses Fenster sehen freigeschaltete Reiter.</p>
                    </div>
                    <div>
                      <label htmlFor="availabilityStartAt">Beginn</label>
                      <input id="availabilityStartAt" name="startAt" required type="datetime-local" />
                    </div>
                    <div>
                      <label htmlFor="availabilityEndAt">Ende</label>
                      <input id="availabilityEndAt" name="endAt" required type="datetime-local" />
                    </div>
                    <SubmitButton idleLabel="Fenster speichern" pendingLabel="Wird gespeichert..." />
                  </form>
                  <form action={createCalendarBlockAction} className="rounded-xl border border-stone-200 p-4 space-y-4">
                    <input name="horseId" type="hidden" value={horse.id} />
                    <div>
                      <h3 className="text-base font-semibold text-stone-900">Zeitraum blockieren</h3>
                      <p className="mt-1 text-sm text-stone-600">Blockierte Zeiten erscheinen sofort als belegt.</p>
                    </div>
                    <div>
                      <label htmlFor="blockStartAt">Beginn</label>
                      <input id="blockStartAt" name="startAt" required type="datetime-local" />
                    </div>
                    <div>
                      <label htmlFor="blockEndAt">Ende</label>
                      <input id="blockEndAt" name="endAt" required type="datetime-local" />
                    </div>
                    <SubmitButton idleLabel="Zeitraum blockieren" pendingLabel="Wird gespeichert..." />
                  </form>
                </div>
              </section>
              <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold text-stone-900">Offene Terminanfragen</h2>
                  <p className="text-sm text-stone-600">Nimm angefragte Termine an oder lehne sie ab.</p>
                </div>
                {requestedOwnerBookingItems.length === 0 ? (
                  <div className="mt-4 rounded-xl border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-600">Fuer dieses Pferd liegen noch keine offenen Terminanfragen vor.</div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {requestedOwnerBookingItems.map((request) => {
                      const rule = request.availability_rule_id ? ruleMap.get(request.availability_rule_id) ?? null : null;

                      return (
                        <div className="rounded-xl border border-stone-200 p-4" key={request.id}>
                          <div className="space-y-3">
                            <StatusBadge status={request.status} />
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-stone-900">
                                {request.requested_start_at && request.requested_end_at
                                  ? formatDateRange(request.requested_start_at, request.requested_end_at)
                                  : "Zeitpunkt wird geprueft"}
                              </p>
                              <p className="text-sm text-stone-600">Reiter {request.rider_id.slice(0, 8)}</p>
                              <p className="text-sm text-stone-600">{rule ? `Fenster: ${ruleLabel(rule)}` : "Kein Zeitfenster mehr vorhanden."}</p>
                            </div>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <form action={acceptBookingRequestAction}>
                                <input name="requestId" type="hidden" value={request.id} />
                                <button className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800" type="submit">
                                  Annehmen
                                </button>
                              </form>
                              <form action={declineBookingRequestAction}>
                                <input name="requestId" type="hidden" value={request.id} />
                                <button className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-rose-300 bg-white px-4 py-3 text-sm font-semibold text-rose-700 hover:border-rose-400 hover:bg-rose-50" type="submit">
                                  Ablehnen
                                </button>
                              </form>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
              <div className="grid gap-5 lg:grid-cols-2">
                <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
                  <div className="space-y-2">
                    <h2 className="text-xl font-semibold text-stone-900">Eigene Verfuegbarkeitsfenster</h2>
                    <p className="text-sm text-stone-600">Beim Entfernen werden offene Terminanfragen in diesem Fenster automatisch geloescht.</p>
                  </div>
                  {rules.length === 0 ? (
                    <div className="mt-4 rounded-xl border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-600">Noch keine Verfuegbarkeitsfenster vorhanden.</div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {rules.map((rule) => (
                        <div className="rounded-xl border border-stone-200 p-4" key={rule.id}>
                          <p className="text-sm font-semibold text-stone-900">{ruleLabel(rule)}</p>
                          <form action={deleteAvailabilityRuleAction} className="mt-3">
                            <input name="ruleId" type="hidden" value={rule.id} />
                            <ConfirmSubmitButton
                              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-stone-900 hover:border-blue-700 hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-70"
                              confirmMessage="Moechtest du dieses Verfuegbarkeitsfenster wirklich entfernen?"
                              idleLabel="Fenster loeschen"
                              pendingLabel="Wird entfernt..."
                            />
                          </form>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
                <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
                  <div className="space-y-2">
                    <h2 className="text-xl font-semibold text-stone-900">Eigene Sperren</h2>
                    <p className="text-sm text-stone-600">Nur diese Eintraege kannst du wieder entfernen.</p>
                  </div>
                  {ownerBlocks.length === 0 ? (
                    <div className="mt-4 rounded-xl border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-600">Noch keine eigenen Sperren vorhanden.</div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {ownerBlocks.map((block) => (
                        <div className="rounded-xl border border-stone-200 p-4" key={block.id}>
                          <p className="text-sm font-semibold text-stone-900">{formatDateRange(block.start_at, block.end_at)}</p>
                          <form action={deleteCalendarBlockAction} className="mt-3">
                            <input name="blockId" type="hidden" value={block.id} />
                            <ConfirmSubmitButton
                              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-stone-900 hover:border-blue-700 hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-70"
                              confirmMessage="Moechtest du diese Kalender-Sperre wirklich entfernen?"
                              idleLabel="Sperre entfernen"
                              pendingLabel="Wird entfernt..."
                            />
                          </form>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </>
          ) : null}
          {!profile ? (
            <div className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
              <Link className="inline-flex min-h-[44px] items-center rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800" href="/login">
                Anmelden, um den Kalender zu nutzen
              </Link>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}