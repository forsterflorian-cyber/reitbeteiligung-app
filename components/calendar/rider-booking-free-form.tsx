"use client";

import { useState } from "react";

type RiderBookingFreeFormProps = {
  defaultDate?: string;
  defaultEndTime?: string;
  defaultStartTime?: string;
  endName?: string;
  startName?: string;
};

function getTodayLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function combineToIso(dateStr: string, timeStr: string): string {
  if (!dateStr || !timeStr) {
    return "";
  }

  const dt = new Date(`${dateStr}T${timeStr}:00`);
  return Number.isNaN(dt.getTime()) ? "" : dt.toISOString();
}

export function RiderBookingFreeForm({
  defaultDate,
  defaultEndTime = "10:00",
  defaultStartTime = "09:00",
  endName = "endAt",
  startName = "startAt"
}: RiderBookingFreeFormProps) {
  const today = getTodayLocalDate();
  const [selectedDate, setSelectedDate] = useState(defaultDate ?? today);
  const [startTime, setStartTime] = useState(defaultStartTime);
  const [endTime, setEndTime] = useState(defaultEndTime);

  const startIso = combineToIso(selectedDate, startTime);
  const endIso = combineToIso(selectedDate, endTime);

  return (
    <div className="space-y-4">
      <input name={startName} type="hidden" value={startIso} />
      <input name={endName} type="hidden" value={endIso} />

      <div>
        <label htmlFor="freeBookingDate">Datum</label>
        <input
          id="freeBookingDate"
          min={today}
          onChange={(e) => setSelectedDate(e.currentTarget.value)}
          required
          type="date"
          value={selectedDate}
        />
      </div>

      <div className="ui-field-grid sm:grid-cols-2">
        <div>
          <label htmlFor="freeBookingStart">Von</label>
          <input
            id="freeBookingStart"
            onChange={(e) => setStartTime(e.currentTarget.value)}
            required
            step={900}
            type="time"
            value={startTime}
          />
        </div>
        <div>
          <label htmlFor="freeBookingEnd">Bis</label>
          <input
            id="freeBookingEnd"
            onChange={(e) => setEndTime(e.currentTarget.value)}
            required
            step={900}
            type="time"
            value={endTime}
          />
        </div>
      </div>
    </div>
  );
}
