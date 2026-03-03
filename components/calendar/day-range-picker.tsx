"use client";

import { useState } from "react";

import { cx } from "@/lib/cx";

type DayRangePickerProps = {
  dayLabel: string;
  endHour?: number;
  endName?: string;
  initialEndHour?: number;
  initialStartHour?: number;
  startHour?: number;
  startName?: string;
};

type HourRange = {
  endIndexExclusive: number;
  startIndex: number;
};

function toTimeLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function DayRangePicker({
  dayLabel,
  endHour = 22,
  endName = "endTime",
  initialEndHour,
  initialStartHour,
  startHour = 8,
  startName = "startTime"
}: DayRangePickerProps) {
  const hourCount = endHour - startHour;
  const hours = Array.from({ length: hourCount }, (_, index) => startHour + index);
  const resolvedStartHour =
    typeof initialStartHour === "number" && initialStartHour >= startHour && initialStartHour < endHour ? initialStartHour : 17;
  const resolvedEndHour =
    typeof initialEndHour === "number" && initialEndHour > resolvedStartHour && initialEndHour <= endHour ? initialEndHour : 19;
  const defaultRange = {
    endIndexExclusive: Math.min(hourCount, Math.max(1, resolvedEndHour - startHour)),
    startIndex: Math.max(0, resolvedStartHour - startHour)
  } satisfies HourRange;
  const [dragStartIndex, setDragStartIndex] = useState<number | null>(null);
  const [range, setRange] = useState<HourRange>(defaultRange);

  function applyRange(anchorIndex: number, nextIndex: number) {
    const startIndex = Math.max(0, Math.min(anchorIndex, nextIndex));
    const endIndexExclusive = Math.min(hourCount, Math.max(anchorIndex, nextIndex) + 1);

    setRange({
      endIndexExclusive,
      startIndex
    });
  }

  function handlePointerStart(index: number) {
    setDragStartIndex(index);
    applyRange(index, index);
  }

  function handlePointerEnter(index: number) {
    if (dragStartIndex === null) {
      return;
    }

    applyRange(dragStartIndex, index);
  }

  function handlePointerEnd(index?: number) {
    if (dragStartIndex !== null && typeof index === "number") {
      applyRange(dragStartIndex, index);
    }

    setDragStartIndex(null);
  }

  const startValue = toTimeLabel(startHour + range.startIndex);
  const endValue = toTimeLabel(startHour + range.endIndexExclusive);

  return (
    <div className="space-y-3">
      <input name={startName} type="hidden" value={startValue} />
      <input name={endName} type="hidden" value={endValue} />

      <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-stone-900">Ausgewählter Zeitraum für {dayLabel}</p>
            <p className="text-sm text-stone-600">Ziehen oder tippen, um den Bereich zu setzen.</p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-900">
            {startValue} - {endValue}
          </div>
        </div>
      </div>

      <div
        className="grid gap-2"
        onPointerLeave={() => handlePointerEnd()}
        style={{ gridTemplateColumns: `repeat(${hours.length}, minmax(0, 1fr))` }}
      >
        {hours.map((hour, index) => {
          const isSelected = index >= range.startIndex && index < range.endIndexExclusive;

          return (
            <button
              className={cx(
                "min-h-[52px] rounded-xl border px-2 py-3 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-emerald-700/30",
                isSelected
                  ? "border-forest bg-sand text-stone-900"
                  : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50"
              )}
              key={hour}
              onClick={() => handlePointerEnd(index)}
              onPointerDown={(event) => {
                event.preventDefault();
                handlePointerStart(index);
              }}
              onPointerEnter={() => handlePointerEnter(index)}
              onPointerUp={() => handlePointerEnd(index)}
              type="button"
            >
              {toTimeLabel(hour)}
            </button>
          );
        })}
      </div>
    </div>
  );
}