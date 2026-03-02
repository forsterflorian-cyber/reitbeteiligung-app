import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { createCalendarBlockAction, deleteCalendarBlockAction } from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { getViewerContext } from "@/lib/auth";
import { HORSE_SELECT_FIELDS } from "@/lib/horses";
import { readSearchParam } from "@/lib/search-params";
import type { CalendarBlock, Horse } from "@/types/database";

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
  const { data: occupancyData, error: occupancyError } = await supabase.rpc("get_horse_calendar_occupancy", {
    p_horse_id: horse.id
  });

  const occupancy = ((occupancyData as CalendarOccupancyRow[] | null) ?? []).sort(
    (left, right) => new Date(left.start_at).getTime() - new Date(right.start_at).getTime()
  );

  let blocks: CalendarBlock[] = [];

  if (isOwner) {
    const { data: blockData } = await supabase
      .from("calendar_blocks")
      .select("id, horse_id, start_at, end_at, created_at")
      .eq("horse_id", horse.id)
      .order("start_at", { ascending: true });

    blocks = (blockData as CalendarBlock[] | null) ?? [];
  }

  return (
    <div className="space-y-5">
      <Link className="inline-flex min-h-[44px] items-center text-sm font-semibold text-forest hover:text-clay" href={detailHref}>
        Zurueck zum Pferdeprofil
      </Link>
      <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft sm:p-6">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-clay">Kalender</p>
          <h1 className="text-3xl font-semibold text-forest sm:text-4xl">{horse.title}</h1>
          <p className="text-sm text-stone-600 sm:text-base">Hier siehst du alle bereits belegten Zeitraeume durch Buchungen und Sperren.</p>
          {isOwner ? <p className="text-sm text-stone-600">Als Pferdehalter kannst du eigene Zeitraeume direkt blockieren oder wieder freigeben.</p> : null}
        </div>
      </section>
      <Notice text={error} tone="error" />
      <Notice text={message} tone="success" />
      {occupancyError ? <Notice text="Der Kalender konnte nicht geladen werden." tone="error" /> : null}
      <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft sm:p-6">
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-ink">Belegte Zeitraeume</h2>
            <p className="mt-2 text-sm text-stone-600">Alle sichtbaren Eintraege werden im Kalender als belegt behandelt.</p>
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
      {isOwner ? (
        <>
          <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft sm:p-6">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-ink">Zeitraum blockieren</h2>
              <p className="text-sm text-stone-600">Blockierte Zeitraeume erscheinen sofort als belegt.</p>
            </div>
            <form action={createCalendarBlockAction} className="mt-4 space-y-4">
              <input name="horseId" type="hidden" value={horse.id} />
              <div>
                <label htmlFor="startAt">Beginn</label>
                <input id="startAt" name="startAt" required type="datetime-local" />
              </div>
              <div>
                <label htmlFor="endAt">Ende</label>
                <input id="endAt" name="endAt" required type="datetime-local" />
              </div>
              <SubmitButton idleLabel="Zeitraum blockieren" pendingLabel="Wird gespeichert..." />
            </form>
          </section>
          <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft sm:p-6">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-ink">Eigene Sperren</h2>
              <p className="text-sm text-stone-600">Nur diese Eintraege kannst du wieder entfernen.</p>
            </div>
            {blocks.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-stone-300 bg-sand p-4 text-sm text-stone-600">
                Noch keine eigenen Sperren vorhanden.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {blocks.map((block) => (
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
        </>
      ) : null}
    </div>
  );
}