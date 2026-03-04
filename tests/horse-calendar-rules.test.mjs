import assert from "node:assert/strict";
import test from "node:test";

import {
  getHorseCreateLimitError,
  getHorseDeleteError,
  getHorseValidationError
} from "../lib/server-actions/horse.ts";
import {
  getAvailabilityConflictError,
  getAvailabilityPlannerDayError,
  getAvailabilitySaveError,
  getCalendarBlockQuarterHourError,
  getCalendarBlockSavedMessage
} from "../lib/server-actions/calendar.ts";

test("Pferde-Regeln pruefen Validierung, Tarifgrenzen und Loeschschutz direkt", () => {
  assert.equal(
    getHorseValidationError({
      allowedSexes: ["Stute", "Wallach"],
      birthYear: 1979,
      currentYear: 2026,
      heightCm: null,
      plz: "12345",
      sexValue: null,
      title: "Ab"
    }),
    "Das Geburtsjahr muss zwischen 1980 und 2026 liegen."
  );
  assert.equal(
    getHorseCreateLimitError("Kostenlos", 1),
    "Im Tarif Kostenlos sind 1 Pferd enthalten. Für weitere Pferde brauchst du später den bezahlten Tarif."
  );
  assert.equal(
    getHorseDeleteError("active_relationships"),
    "Pferdeprofile mit aktiven Reitbeteiligungen können nicht gelöscht werden."
  );
});

test("Kalender-Regeln pruefen Konflikte, Planergrenzen und Nachrichten direkt", () => {
  assert.equal(
    getAvailabilityConflictError("update"),
    "Ein anderes Zeitfenster überschneidet sich bereits mit diesem Zeitraum."
  );
  assert.equal(
    getAvailabilityPlannerDayError("move"),
    "Im Planer lässt sich das Zeitfenster nur innerhalb dieses Tages verschieben."
  );
  assert.equal(
    getAvailabilitySaveError("planner_adjust"),
    "Das Zeitfenster konnte nicht im Planer angepasst werden."
  );
  assert.equal(getCalendarBlockQuarterHourError(), "Bitte nutze für Sperren ein 15-Minuten-Raster.");
  assert.equal(getCalendarBlockSavedMessage("delete"), "Die Kalender-Sperre wurde entfernt.");
});
