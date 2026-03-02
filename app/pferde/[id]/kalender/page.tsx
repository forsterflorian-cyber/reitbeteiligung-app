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

function formatDateRange(startAt: string, endAt: string) {
  return `${formatDateTime(startAt)} bis ${formatDateTime(endAt)}`;
}

function occupancyLabel(source: string) {
  return source === "booking" ? "Gebuchter Termin" : "Vom Pferdehalter blockiert";
}

function ruleLabel(rule: AvailabilityRule) {
  return formatDateRange(rule.start_at, rule.end_at);
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
          .select("id, slot_id, availability_rule_id, horse_id, rider_id, status, requested_start_at, requested_end_at, created_at")
          .eq("horse_id", horse.id)
          .order("created_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] as BookingRequest[] | null }),
    isRider && user
      ? supabase
          .from("booking_requests")
          .select("id, slot_id, availability_rule_id, horse_id, rider_id, status, requested_start_at, requested_end_at, created_at")
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

  return (
    <div className="space-y-5">
      <Link className="inline-flex min-h-[44px] items-center text-sm font-semibold text-forest hover:text-clay" href={detailHref}>
        Zurueck zum Pferdeprofil
      </Link>
      <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft sm:p-6">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-clay">Kalender</p>
          <h1 className="text-3xl font-semibold text-forest sm:text-4xl">{horse.title}</h1>
          <p className="text-sm text-stone-600 sm:text-base">Hier siehst du gebuchte Zeiten, blockierte Zeitraeume und verfuegbare Zeitfenster.</p>
          {isOwner ? <p className="text-sm text-stone-600">Als Pferdehalter legst du Verfuegbarkeitsfenster fest und bearbeitest Terminanfragen.</p> : null}
          {isRider && !riderApproved ? <p className="text-sm text-stone-600">Terminanfragen sind erst nach deiner Freischaltung moeglich.</p> : null}
        </div>
      </section>
      <Notice text={error} tone="error" />
      <Notice text={message} tone="success" />
      {occupancyError ? <Notice text="Der Kalender konnte nicht geladen werden." tone="error" /> : null}
      <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft sm:p-6">
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-ink">Belegte Zeitraeume</h2>
            <p className="mt-2 text-sm text-stone-600">Gebuchte Termine und Sperren werden hier gesammelt als belegt dargestellt.</p>
          </div>
          {occupancy.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-sand p-4 text-sm text-stone-600">
              Aktuell sind keine belegten Zeitraeume eingetragen.
            </div>
          ) : (
            <div className="space-y-3">
              {occupancy.map((entry, index) => (
                <div className="rounded-2xl border border-stone-200 p-4" key={`${entry.source}-${entry.start_at}-${entry.end_at}-${index}`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-ink">{formatDateRange(entry.start_at, entry.end_at)}</p>
                      <p className="text-sm text-stone-600">{occupancyLabel(entry.source)}</p>
                    </div>
                    <span className="inline-flex min-h-[44px] items-center rounded-full bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-700">
                      Belegt
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft sm:p-6">
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-ink">Verfuegbare Zeitfenster</h2>
            <p className="mt-2 text-sm text-stone-600">Innerhalb dieser Zeitfenster koennen freigeschaltete Reiter einen einzelnen Termin anfragen.</p>
          </div>
          {rules.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-sand p-4 text-sm text-stone-600">
              Noch keine Verfuegbarkeitsfenster vorhanden.
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <div className="rounded-2xl border border-stone-200 p-4" key={rule.id}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-ink">{ruleLabel(rule)}</p>
                      <p className="text-sm text-stone-600">Freies Zeitfenster fuer Terminanfragen</p>
                    </div>
                    <span className="inline-flex min-h-[44px] items-center rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-700">
                      Verfuegbar
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      {isRider ? (
        <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft sm:p-6">
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-ink">Termin anfragen</h2>
              <p className="mt-2 text-sm text-stone-600">Waehle ein verfuegbares Zeitfenster und fordere einen konkreten Termin an.</p>
            </div>
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
                  <SubmitButton idleLabel="Termin anfragen" pendingLabel="Wird gesendet..." />
                </form>
              ) : (
                <div className="rounded-2xl border border-dashed border-stone-300 bg-sand p-4 text-sm text-stone-600">
                  Aktuell gibt es keine offenen Verfuegbarkeitsfenster fuer dieses Pferd.
                </div>
              )
            ) : (
              <div className="rounded-2xl border border-dashed border-stone-300 bg-sand p-4 text-sm text-stone-600">
                Erst nach deiner Freischaltung kannst du einen Termin anfragen.
              </div>
            )}
            <div className="space-y-3 border-t border-stone-200 pt-4">
              <h3 className="text-base font-semibold text-ink">Meine Terminanfragen fuer dieses Pferd</h3>
              {riderBookingRequests.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-stone-300 bg-sand p-4 text-sm text-stone-600">
                  Du hast fuer dieses Pferd noch keine Terminanfrage gestellt.
                </div>
              ) : (
                riderBookingRequests.map((request) => {
                  const rule = request.availability_rule_id ? ruleMap.get(request.availability_rule_id) ?? null : null;

                  return (
                    <div className="rounded-2xl border border-stone-200 p-4" key={request.id}>
                      <div className="space-y-2">
                        <StatusBadge status={request.status} />
                        <p className="text-sm font-semibold text-ink">
                          {request.requested_start_at && request.requested_end_at
                            ? formatDateRange(request.requested_start_at, request.requested_end_at)
                            : "Zeitpunkt wird geprueft"}
                        </p>
                        <p className="text-sm text-stone-600">{rule ? `Fenster: ${ruleLabel(rule)}` : "Kein Zeitfenster mehr vorhanden."}</p>
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
          <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft sm:p-6">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-ink">Verfuegbarkeitsfenster anlegen</h2>
              <p className="text-sm text-stone-600">Diese Fenster werden freigeschalteten Reitern fuer Terminanfragen angezeigt.</p>
            </div>
            <form action={createAvailabilityRuleAction} className="mt-4 space-y-4">
              <input name="horseId" type="hidden" value={horse.id} />
              <div>
                <label htmlFor="availabilityStartAt">Beginn</label>
                <input id="availabilityStartAt" name="startAt" required type="datetime-local" />
              </div>
              <div>
                <label htmlFor="availabilityEndAt">Ende</label>
                <input id="availabilityEndAt" name="endAt" required type="datetime-local" />
              </div>
              <SubmitButton idleLabel="Verfuegbarkeitsfenster speichern" pendingLabel="Wird gespeichert..." />
            </form>
          </section>
          <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft sm:p-6">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-ink">Eigene Verfuegbarkeitsfenster</h2>
              <p className="text-sm text-stone-600">Beim Entfernen werden offene Terminanfragen in diesem Fenster automatisch mit entfernt.</p>
            </div>
            {rules.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-stone-300 bg-sand p-4 text-sm text-stone-600">
                Noch keine Verfuegbarkeitsfenster vorhanden.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {rules.map((rule) => (
                  <div className="rounded-2xl border border-stone-200 p-4" key={rule.id}>
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-ink">{ruleLabel(rule)}</p>
                      <p className="text-sm text-stone-600">Freies Zeitfenster fuer Terminanfragen</p>
                    </div>
                    <form action={deleteAvailabilityRuleAction} className="mt-3">
                      <input name="ruleId" type="hidden" value={rule.id} />
                      <ConfirmSubmitButton
                        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-ink hover:border-forest hover:text-forest disabled:cursor-not-allowed disabled:opacity-70"
                        confirmMessage="Moechtest du dieses Verfuegbarkeitsfenster wirklich entfernen?"
                        idleLabel="Verfuegbarkeitsfenster loeschen"
                        pendingLabel="Wird entfernt..."
                      />
                    </form>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft sm:p-6">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-ink">Zeitraum blockieren</h2>
              <p className="text-sm text-stone-600">Blockierte Zeitraeume erscheinen sofort als belegt.</p>
            </div>
            <form action={createCalendarBlockAction} className="mt-4 space-y-4">
              <input name="horseId" type="hidden" value={horse.id} />
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
          </section>
          <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft sm:p-6">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-ink">Eigene Sperren</h2>
              <p className="text-sm text-stone-600">Nur diese Eintraege kannst du wieder entfernen.</p>
            </div>
            {ownerBlocks.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-stone-300 bg-sand p-4 text-sm text-stone-600">
                Noch keine eigenen Sperren vorhanden.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {ownerBlocks.map((block) => (
                  <div className="rounded-2xl border border-stone-200 p-4" key={block.id}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-ink">{formatDateRange(block.start_at, block.end_at)}</p>
                        <p className="text-sm text-stone-600">Vom Pferdehalter blockiert</p>
                      </div>
                      <span className="inline-flex min-h-[44px] items-center rounded-full bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-700">
                        Belegt
                      </span>
                    </div>
                    <form action={deleteCalendarBlockAction} className="mt-3">
                      <input name="blockId" type="hidden" value={block.id} />
                      <ConfirmSubmitButton
                        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-ink hover:border-forest hover:text-forest disabled:cursor-not-allowed disabled:opacity-70"
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
          <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft sm:p-6">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-ink">Offene Terminanfragen</h2>
              <p className="text-sm text-stone-600">Nimm einen angefragten Termin an oder lehne ihn ab.</p>
            </div>
            {ownerBookingRequests.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-stone-300 bg-sand p-4 text-sm text-stone-600">
                Fuer dieses Pferd liegen noch keine Terminanfragen vor.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {ownerBookingRequests.map((request) => {
                  const rule = request.availability_rule_id ? ruleMap.get(request.availability_rule_id) ?? null : null;

                  return (
                    <div className="rounded-2xl border border-stone-200 p-4" key={request.id}>
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge status={request.status} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-ink">
                            {request.requested_start_at && request.requested_end_at
                              ? formatDateRange(request.requested_start_at, request.requested_end_at)
                              : "Zeitpunkt wird geprueft"}
                          </p>
                          <p className="text-sm text-stone-600">Reiter {request.rider_id.slice(0, 8)}</p>
                          <p className="text-sm text-stone-600">{rule ? `Fenster: ${ruleLabel(rule)}` : "Kein Zeitfenster mehr vorhanden."}</p>
                        </div>
                        {request.status === "requested" ? (
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <form action={acceptBookingRequestAction}>
                              <input name="requestId" type="hidden" value={request.id} />
                              <button className="inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-700" type="submit">
                                Annehmen
                              </button>
                            </form>
                            <form action={declineBookingRequestAction}>
                              <input name="requestId" type="hidden" value={request.id} />
                              <button className="inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-700" type="submit">
                                Ablehnen
                              </button>
                            </form>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      ) : null}
      {!profile ? (
        <Link className="inline-flex min-h-[44px] items-center text-sm font-semibold text-forest hover:text-clay" href="/login">
          Anmelden, um den Kalender zu nutzen
        </Link>
      ) : null}
    </div>
  );
}