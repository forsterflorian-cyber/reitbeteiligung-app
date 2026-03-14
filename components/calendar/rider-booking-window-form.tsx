"use client";

import { useEffect, useMemo, useState } from "react";

import { cx } from "@/lib/cx";

type RuleOption = {
  endAt: string;
  id: string;
  label: string;
  startAt: string;
};

type QuarterSlot = {
  label: string;
  value: string;
};

type RiderBookingWindowFormProps = {
  defaultRuleId?: string;
  endName?: string;
  recurrenceName?: string;
  ruleName?: string;
  rules: RuleOption[];
  showRecurrence?: boolean;
  startName?: string;
};

const QUARTER_MINUTES = 15;
const QUARTER_MS = QUARTER_MINUTES * 60 * 1000;

function formatDateTimeLabel(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    timeZone: "UTC"
  }).format(new Date(value));
}

function buildQuarterSlots(startAt: string, endAt: string) {
  const start = new Date(startAt);
  const end = new Date(endAt);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return [] as QuarterSlot[];
  }

  const slots: QuarterSlot[] = [];

  for (let currentMs = start.getTime(); currentMs <= end.getTime(); currentMs += QUARTER_MS) {
    const currentIso = new Date(currentMs).toISOString();
    slots.push({
      label: formatDateTimeLabel(currentIso),
      value: currentIso
    });
  }

  return slots;
}

export function RiderBookingWindowForm({
  defaultRuleId,
  endName = "endAt",
  recurrenceName = "recurrenceRrule",
  ruleName = "ruleId",
  rules,
  showRecurrence = false,
  startName = "startAt"
}: RiderBookingWindowFormProps) {
  const initialRuleId = defaultRuleId && rules.some((r) => r.id === defaultRuleId)
    ? defaultRuleId
    : rules[0]?.id ?? "";
  const [selectedRuleId, setSelectedRuleId] = useState(initialRuleId);
  const selectedRule = useMemo(() => rules.find((rule) => rule.id === selectedRuleId) ?? rules[0] ?? null, [rules, selectedRuleId]);
  const quarterSlots = useMemo(
    () => (selectedRule ? buildQuarterSlots(selectedRule.startAt, selectedRule.endAt) : []),
    [selectedRule]
  );
  const [selectedStartAt, setSelectedStartAt] = useState(quarterSlots[0]?.value ?? "");
  const endOptions = useMemo(() => {
    if (!selectedStartAt) {
      return quarterSlots.slice(1);
    }

    const startIndex = quarterSlots.findIndex((slot) => slot.value === selectedStartAt);
    return startIndex >= 0 ? quarterSlots.slice(startIndex + 1) : quarterSlots.slice(1);
  }, [quarterSlots, selectedStartAt]);
  const [selectedEndAt, setSelectedEndAt] = useState(endOptions[0]?.value ?? "");

  useEffect(() => {
    if (!selectedRule) {
      setSelectedStartAt("");
      setSelectedEndAt("");
      return;
    }

    const nextSlots = buildQuarterSlots(selectedRule.startAt, selectedRule.endAt);
    const nextStart = nextSlots[0]?.value ?? "";
    const nextEnd = nextSlots[1]?.value ?? nextSlots[0]?.value ?? "";
    setSelectedStartAt(nextStart);
    setSelectedEndAt(nextEnd);
  }, [selectedRule]);

  useEffect(() => {
    if (!selectedStartAt) {
      setSelectedEndAt("");
      return;
    }

    const nextEnd = endOptions[0]?.value ?? "";

    if (!endOptions.some((slot) => slot.value === selectedEndAt)) {
      setSelectedEndAt(nextEnd);
    }
  }, [endOptions, selectedEndAt, selectedStartAt]);

  return (
    <div className="space-y-4">
      <input name={startName} type="hidden" value={selectedStartAt} />
      <input name={endName} type="hidden" value={selectedEndAt} />

      <div>
        <label htmlFor="riderRuleId">Offenes Zeitfenster</label>
        <select id="riderRuleId" name={ruleName} onChange={(event) => setSelectedRuleId(event.currentTarget.value)} required value={selectedRule?.id ?? ""}>
          {rules.map((rule) => (
            <option key={rule.id} value={rule.id}>
              {rule.label}
            </option>
          ))}
        </select>
      </div>

      <div className="ui-field-grid sm:grid-cols-2">
        <div>
          <label htmlFor="riderStartAt">Beginn (15 Minuten)</label>
          <select id="riderStartAt" onChange={(event) => setSelectedStartAt(event.currentTarget.value)} required value={selectedStartAt}>
            {quarterSlots.slice(0, Math.max(quarterSlots.length - 1, 0)).map((slot) => (
              <option key={slot.value} value={slot.value}>
                {slot.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="riderEndAt">Ende (15 Minuten)</label>
          <select id="riderEndAt" onChange={(event) => setSelectedEndAt(event.currentTarget.value)} required value={selectedEndAt}>
            {endOptions.map((slot) => (
              <option key={slot.value} value={slot.value}>
                {slot.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4 text-sm text-stone-600">
        {selectedRule ? (
          <div className="space-y-2">
            <p className="font-semibold text-stone-900">Fenster: {selectedRule.label}</p>
            <p>Du buchst in 15-Minuten-Schritten und immer vollständig innerhalb des gewählten offenen Fensters.</p>
          </div>
        ) : (
          <p>Bitte wähle zuerst ein offenes Zeitfenster aus.</p>
        )}
      </div>

      {showRecurrence ? (
        <div>
          <label htmlFor="riderRecurrenceRrule">Wiederholung (optional)</label>
          <input id="riderRecurrenceRrule" name={recurrenceName} placeholder="FREQ=WEEKLY;INTERVAL=1;COUNT=6" type="text" />
          <p className="mt-2 text-sm text-stone-600">Beispiel: jede Woche fuer sechs Termine.</p>
        </div>
      ) : (
        <input name={recurrenceName} type="hidden" value="" />
      )}

      <div className="flex flex-wrap gap-2 text-xs text-stone-500">
        <span
          className={cx(
            "rounded-full border px-3 py-1.5",
            selectedRule ? "border-stone-300 bg-white text-stone-700" : "border-stone-200 bg-stone-100 text-stone-400"
          )}
        >
          15-Minuten-Raster
        </span>
        <span className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-stone-700">Innerhalb des Fensters</span>
      </div>
    </div>
  );
}
