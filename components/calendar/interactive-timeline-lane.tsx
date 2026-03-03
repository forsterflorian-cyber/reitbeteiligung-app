"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

type InteractiveTimelineLaneProps = {
  dayKey: string;
  horseId: string;
  hourCount: number;
  hours: number[];
};

type HourRange = {
  endIndexExclusive: number;
  startIndex: number;
};

function toSlotLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function InteractiveTimelineLane({ dayKey, horseId, hourCount, hours }: InteractiveTimelineLaneProps) {
  const router = useRouter();
  const [previewRange, setPreviewRange] = useState<HourRange | null>(null);
  const anchorIndexRef = useRef<number | null>(null);
  const selectionRef = useRef<HourRange | null>(null);

  const columnStyle = useMemo(
    () => ({
      gridTemplateColumns: `repeat(${hourCount}, minmax(0, 1fr))`
    }),
    [hourCount]
  );

  function applyPreview(anchorIndex: number, nextIndex: number) {
    const startIndex = Math.max(0, Math.min(anchorIndex, nextIndex));
    const endIndexExclusive = Math.min(hourCount, Math.max(anchorIndex, nextIndex) + 1);
    const nextRange = { endIndexExclusive, startIndex } satisfies HourRange;

    selectionRef.current = nextRange;
    setPreviewRange(nextRange);
  }

  function commitSelection(range: HourRange | null) {
    if (!range) {
      return;
    }

    const startHour = hours[range.startIndex] ?? hours[0] ?? 8;
    const endHour = hours[range.endIndexExclusive] ?? startHour + (range.endIndexExclusive - range.startIndex);
    const slotStart = toSlotLabel(startHour);
    const slotEnd = toSlotLabel(endHour);

    setPreviewRange(null);
    router.push(`/pferde/${horseId}/kalender?day=${encodeURIComponent(dayKey)}&slotStart=${encodeURIComponent(slotStart)}&slotEnd=${encodeURIComponent(slotEnd)}#tagesfenster`);
  }

  function clearDragState() {
    anchorIndexRef.current = null;
    selectionRef.current = null;
    setPreviewRange(null);
  }

  return (
    <>
      <div className="absolute inset-0 z-10 grid" onPointerLeave={() => {
        if (anchorIndexRef.current !== null) {
          commitSelection(selectionRef.current);
          clearDragState();
        }
      }} style={columnStyle}>
        {hours.map((hour, index) => (
          <button
            aria-label={`${toSlotLabel(hour)} bis ${toSlotLabel(hour + 1)} ausw\u00e4hlen`}
            className="block h-11 border-r border-transparent transition hover:bg-emerald-50/80 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 last:border-r-0"
            key={`${dayKey}-${hour}`}
            onClick={() => commitSelection({ endIndexExclusive: index + 1, startIndex: index })}
            onPointerDown={(event) => {
              event.preventDefault();
              anchorIndexRef.current = index;
              applyPreview(index, index);
            }}
            onPointerEnter={() => {
              if (anchorIndexRef.current === null) {
                return;
              }

              applyPreview(anchorIndexRef.current, index);
            }}
            onPointerUp={() => {
              if (anchorIndexRef.current === null) {
                return;
              }

              applyPreview(anchorIndexRef.current, index);
              commitSelection(selectionRef.current);
              clearDragState();
            }}
            type="button"
          />
        ))}
      </div>
      {previewRange ? (
        <div className="pointer-events-none absolute inset-0 z-10">
          <div
            className="absolute top-1/2 h-11 -translate-y-1/2 rounded-xl border border-emerald-300 bg-emerald-100/80 shadow-sm"
            style={{
              left: `${(previewRange.startIndex / hourCount) * 100}%`,
              width: `${((previewRange.endIndexExclusive - previewRange.startIndex) / hourCount) * 100}%`
            }}
          />
        </div>
      ) : null}
    </>
  );
}
