import type { Route } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionCard } from "@/components/ui/section-card";
import type { OperationalWeekDay, OperationalWeekEntry, OperationalWeekEntryKind } from "@/lib/operational-week";

type OperationalWeekOverviewProps = {
  days: OperationalWeekDay[];
  nextWeekHref: Route;
  previousWeekHref: Route;
  subtitle: string;
  title: string;
  todayHref: Route;
};

function parseDayKey(dayKey: string) {
  const [year, month, day] = dayKey.split("-").map((value) => Number.parseInt(value, 10));
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function formatWeekRange(days: OperationalWeekDay[]) {
  if (days.length === 0) {
    return null;
  }

  const formatter = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "short" });
  const firstDate = parseDayKey(days[0].dayKey);
  const lastDate = parseDayKey(days[days.length - 1].dayKey);
  return `${formatter.format(firstDate)} - ${formatter.format(lastDate)}`;
}

function formatDayLabel(dayKey: string) {
  return new Intl.DateTimeFormat("de-DE", { weekday: "long" }).format(parseDayKey(dayKey));
}

function formatDayMeta(dayKey: string) {
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "long" }).format(parseDayKey(dayKey));
}

function formatEntryRange(entry: OperationalWeekEntry) {
  const start = new Date(entry.startAt);
  const end = new Date(entry.endAt);
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  if (sameDay) {
    return `${new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(start)} - ${new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(end)}`;
  }

  return `${new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(start)} - ${new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(end)}`;
}

function entryBadgeTone(kind: OperationalWeekEntryKind) {
  if (kind === "available") {
    return "approved" as const;
  }

  if (kind === "block") {
    return "rejected" as const;
  }

  return "info" as const;
}

function entryLabel(kind: OperationalWeekEntryKind) {
  if (kind === "available") {
    return "Frei";
  }

  if (kind === "block") {
    return "Blockiert";
  }

  return "Gebucht";
}

function entryDescription(kind: OperationalWeekEntryKind) {
  if (kind === "available") {
    return "Freier operativer Slot";
  }

  if (kind === "block") {
    return "Kalendersperre";
  }

  return "Aktiv wirksame Buchung";
}

export function OperationalWeekOverview({
  days,
  nextWeekHref,
  previousWeekHref,
  subtitle,
  title,
  todayHref
}: OperationalWeekOverviewProps) {
  const rangeLabel = formatWeekRange(days);

  return (
    <SectionCard
      action={
        <div className="flex flex-wrap justify-end gap-2">
          <Link className={buttonVariants("secondary", "min-h-[40px] px-4 py-2 text-sm")} href={previousWeekHref}>
            Vorherige Woche
          </Link>
          <Link className={buttonVariants("secondary", "min-h-[40px] px-4 py-2 text-sm")} href={nextWeekHref}>
            Naechste Woche
          </Link>
          <Link className={buttonVariants("ghost", "min-h-[40px] px-4 py-2 text-sm")} href={todayHref}>
            Heute
          </Link>
        </div>
      }
      id="wochenansicht"
      subtitle={subtitle}
      title={title}
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <p className="ui-eyebrow">Kalenderwoche</p>
            <p className="text-sm text-stone-600">{rangeLabel ?? "Aktuelle Woche"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="approved">Frei</Badge>
            <Badge tone="info">Gebucht</Badge>
            <Badge tone="rejected">Blockiert</Badge>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          {days.map((day) => (
            <Card className="border-stone-200 bg-white/90 p-4" key={day.dayKey}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold capitalize text-stone-900">{formatDayLabel(day.dayKey)}</p>
                    {day.isToday ? <Badge tone="neutral">Heute</Badge> : null}
                  </div>
                  <p className="text-xs text-stone-500">{formatDayMeta(day.dayKey)}</p>
                </div>

                {day.entries.length === 0 ? (
                  <p className="text-sm leading-6 text-stone-500">Keine freien oder belegten Zeiten.</p>
                ) : (
                  <div className="space-y-2">
                    {day.entries.map((entry) => (
                      <div className="rounded-2xl border border-stone-200 bg-stone-50/80 px-3 py-3" key={entry.key}>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={entryBadgeTone(entry.kind)}>{entryLabel(entry.kind)}</Badge>
                          <p className="text-sm font-semibold text-stone-900">{formatEntryRange(entry)}</p>
                        </div>
                        <p className="mt-2 text-xs text-stone-500">{entryDescription(entry.kind)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}
