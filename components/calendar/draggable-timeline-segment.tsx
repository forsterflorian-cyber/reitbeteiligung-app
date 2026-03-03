"use client";

import type { Route } from "next";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";

type DragMode = "move" | "resize-start" | "resize-end";
type SegmentAction = (formData: FormData) => void | Promise<void>;

type TimeRange = {
  end: number;
  start: number;
};

type DragState = {
  didDrag: boolean;
  initialRange: TimeRange;
  laneWidth: number;
  mode: DragMode;
  originX: number;
  pointerId: number;
};

type DraggableTimelineSegmentProps = {
  dayKey: string;
  editHref: string;
  endAt: string;
  fieldName: "ruleId" | "blockId";
  id: string;
  isActive?: boolean;
  label: string;
  startAt: string;
  submitAction: SegmentAction;
  timelineEndHour: number;
  timelineStartHour: number;
  title?: string;
  toneClassName: string;
};

const DRAG_THRESHOLD_PX = 4;
const STEP_MINUTES = 15;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function toLocalMinutes(isoValue: string) {
  const value = new Date(isoValue);
  return value.getHours() * 60 + value.getMinutes();
}

function formatClockTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function rangesEqual(left: TimeRange, right: TimeRange) {
  return left.start === right.start && left.end === right.end;
}

export function DraggableTimelineSegment({
  dayKey,
  editHref,
  endAt,
  fieldName,
  id,
  isActive = false,
  label,
  startAt,
  submitAction,
  timelineEndHour,
  timelineStartHour,
  title,
  toneClassName
}: DraggableTimelineSegmentProps) {
  const router = useRouter();
  const segmentRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const startInputRef = useRef<HTMLInputElement>(null);
  const endInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const initialStartMinutes = toLocalMinutes(startAt);
  const initialEndMinutes = toLocalMinutes(endAt);
  const initialRange = {
    end: initialEndMinutes,
    start: initialStartMinutes
  } satisfies TimeRange;

  const [draftRange, setDraftRange] = useState<TimeRange>(initialRange);
  const draftRangeRef = useRef<TimeRange>(initialRange);

  const timelineStartMinutes = timelineStartHour * 60;
  const timelineEndMinutes = timelineEndHour * 60;
  const totalTimelineMinutes = timelineEndMinutes - timelineStartMinutes;

  useEffect(() => {
    const nextRange = {
      end: initialEndMinutes,
      start: initialStartMinutes
    } satisfies TimeRange;

    draftRangeRef.current = nextRange;
    setDraftRange(nextRange);
  }, [id, initialEndMinutes, initialStartMinutes]);

  function updateDraftRange(nextRange: TimeRange) {
    draftRangeRef.current = nextRange;
    setDraftRange(nextRange);
  }

  // Every planner gesture stays on the same 15-minute grid as the booking flow.
  function applyDragDelta(deltaMinutes: number, dragState: DragState) {
    if (deltaMinutes === 0) {
      return dragState.initialRange;
    }

    const initialDuration = dragState.initialRange.end - dragState.initialRange.start;

    if (dragState.mode === "move") {
      const nextStart = clamp(dragState.initialRange.start + deltaMinutes, timelineStartMinutes, timelineEndMinutes - initialDuration);
      return {
        end: nextStart + initialDuration,
        start: nextStart
      } satisfies TimeRange;
    }

    if (dragState.mode === "resize-start") {
      return {
        end: dragState.initialRange.end,
        start: clamp(dragState.initialRange.start + deltaMinutes, timelineStartMinutes, dragState.initialRange.end - STEP_MINUTES)
      } satisfies TimeRange;
    }

    return {
      end: clamp(dragState.initialRange.end + deltaMinutes, dragState.initialRange.start + STEP_MINUTES, timelineEndMinutes),
      start: dragState.initialRange.start
    } satisfies TimeRange;
  }

  function beginDrag(event: ReactPointerEvent<HTMLDivElement>, mode: DragMode) {
    const laneElement = segmentRef.current?.parentElement;

    if (!laneElement || !segmentRef.current) {
      return;
    }

    const laneWidth = laneElement.getBoundingClientRect().width;

    if (!laneWidth) {
      return;
    }

    dragRef.current = {
      didDrag: false,
      initialRange: draftRangeRef.current,
      laneWidth,
      mode,
      originX: event.clientX,
      pointerId: event.pointerId
    };

    segmentRef.current.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const dragState = dragRef.current;

    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    const deltaPixels = event.clientX - dragState.originX;
    const rawDeltaMinutes = (deltaPixels / dragState.laneWidth) * totalTimelineMinutes;
    const snappedDeltaMinutes = Math.round(rawDeltaMinutes / STEP_MINUTES) * STEP_MINUTES;

    if (Math.abs(deltaPixels) >= DRAG_THRESHOLD_PX) {
      dragState.didDrag = true;
    }

    updateDraftRange(applyDragDelta(snappedDeltaMinutes, dragState));
  }

  function resetDragState(pointerId: number) {
    if (segmentRef.current?.hasPointerCapture(pointerId)) {
      segmentRef.current.releasePointerCapture(pointerId);
    }

    dragRef.current = null;
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    const dragState = dragRef.current;

    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    const finalRange = draftRangeRef.current;
    const rangeChanged = !rangesEqual(finalRange, dragState.initialRange);

    resetDragState(event.pointerId);

    if (!dragState.didDrag) {
      router.push(editHref as Route, { scroll: false });
      return;
    }

    if (!rangeChanged) {
      updateDraftRange(dragState.initialRange);
      return;
    }

    // We reuse the existing server actions by posting the adjusted range through a hidden form.
    if (startInputRef.current) {
      startInputRef.current.value = formatClockTime(finalRange.start);
    }

    if (endInputRef.current) {
      endInputRef.current.value = formatClockTime(finalRange.end);
    }

    formRef.current?.requestSubmit();
  }

  function handlePointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    const dragState = dragRef.current;

    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    updateDraftRange(dragState.initialRange);
    resetDragState(event.pointerId);
  }

  const previewLeft = ((draftRange.start - timelineStartMinutes) / totalTimelineMinutes) * 100;
  const previewWidth = ((draftRange.end - draftRange.start) / totalTimelineMinutes) * 100;
  const segmentClassName = `absolute top-1/2 z-20 h-11 -translate-y-1/2 overflow-hidden rounded-xl border text-xs font-semibold shadow-sm ${toneClassName} ${isActive ? "ring-2 ring-forest/20" : ""}`;

  return (
    <div
      className={segmentClassName}
      onPointerCancel={handlePointerCancel}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      ref={segmentRef}
      style={{ left: `${previewLeft}%`, width: `${previewWidth}%` }}
      title={title ?? label}
    >
      <form action={submitAction} className="hidden" ref={formRef}>
        <input name={fieldName} type="hidden" value={id} />
        <input name="selectedDate" type="hidden" value={dayKey} />
        <input defaultValue={formatClockTime(initialRange.start)} name="startTime" ref={startInputRef} type="hidden" />
        <input defaultValue={formatClockTime(initialRange.end)} name="endTime" ref={endInputRef} type="hidden" />
      </form>
      <div
        className="absolute inset-y-0 left-0 z-30 w-3 cursor-ew-resize"
        onPointerDown={(event) => beginDrag(event, "resize-start")}
      />
      <div
        className="absolute inset-y-0 left-3 right-3 z-20 cursor-grab active:cursor-grabbing"
        onPointerDown={(event) => beginDrag(event, "move")}
      />
      <div
        className="absolute inset-y-0 right-0 z-30 w-3 cursor-ew-resize"
        onPointerDown={(event) => beginDrag(event, "resize-end")}
      />
      <div className="pointer-events-none flex h-full w-full items-center px-3">
        <span className="truncate">{label}</span>
      </div>
    </div>
  );
}
