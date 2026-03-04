export function getAvailabilityAccessError(
  reason: "forbidden_adjust" | "forbidden_edit" | "forbidden_manage" | "forbidden_move" | "missing_horse" | "missing_rule"
) {
  switch (reason) {
    case "missing_horse":
      return "Das Pferdeprofil konnte nicht gefunden werden.";
    case "missing_rule":
      return "Das Zeitfenster konnte nicht gefunden werden.";
    case "forbidden_edit":
      return "Du kannst nur eigene Verf?gbarkeiten bearbeiten.";
    case "forbidden_adjust":
      return "Du kannst nur eigene Verf?gbarkeiten anpassen.";
    case "forbidden_move":
      return "Du kannst nur eigene Verf?gbarkeiten verschieben.";
    default:
      return "Du kannst nur eigene Verf?gbarkeiten verwalten.";
  }
}

export function getAvailabilityTimeError() {
  return "Bitte gib eine g?ltige Uhrzeit an.";
}

export function getAvailabilityInvalidWindowError(kind: "create" | "update") {
  return kind === "create"
    ? "F?r diesen Tag konnte kein g?ltiges Zeitfenster erstellt werden."
    : "F?r dieses Zeitfenster konnte kein g?ltiger Zeitraum erstellt werden.";
}

export function getAvailabilityLoadError() {
  return "Die vorhandenen Verf?gbarkeiten konnten nicht geladen werden.";
}

export function getAvailabilityConflictError(kind: "create" | "update") {
  return kind === "create"
    ? "Dieses Zeitfenster ?berschneidet sich mit einer bestehenden Verf?gbarkeit."
    : "Ein anderes Zeitfenster ?berschneidet sich bereits mit diesem Zeitraum.";
}

export function getAvailabilityPlannerDayError(action: "adjust" | "move") {
  return action === "adjust"
    ? "Im Planer l?sst sich das Zeitfenster nur innerhalb dieses Tages anpassen."
    : "Im Planer l?sst sich das Zeitfenster nur innerhalb dieses Tages verschieben.";
}

export function getAvailabilitySaveError(kind: "create" | "planner_adjust" | "planner_move" | "update") {
  switch (kind) {
    case "create":
      return "Das Tagesfenster konnte nicht gespeichert werden.";
    case "planner_adjust":
      return "Das Zeitfenster konnte nicht im Planer angepasst werden.";
    case "planner_move":
      return "Das Zeitfenster konnte nicht im Planer verschoben werden.";
    default:
      return "Das Zeitfenster konnte nicht aktualisiert werden.";
  }
}

export function getAvailabilitySavedMessage(kind: "create" | "planner_adjust" | "planner_move" | "update") {
  switch (kind) {
    case "create":
      return "Das Tagesfenster wurde gespeichert.";
    case "planner_adjust":
      return "Das Zeitfenster wurde direkt im Planer angepasst.";
    case "planner_move":
      return "Das Zeitfenster wurde direkt im Planer verschoben.";
    default:
      return "Das Zeitfenster wurde aktualisiert.";
  }
}

export function getCalendarBlockAccessError(
  reason:
    | "forbidden_adjust"
    | "forbidden_delete"
    | "forbidden_edit"
    | "forbidden_manage"
    | "forbidden_move"
    | "missing_block"
    | "missing_horse"
) {
  switch (reason) {
    case "missing_horse":
      return "Das Pferdeprofil konnte nicht gefunden werden.";
    case "missing_block":
      return "Die Kalender-Sperre konnte nicht gefunden werden.";
    case "forbidden_edit":
      return "Du kannst nur eigene Kalender-Sperren bearbeiten.";
    case "forbidden_adjust":
      return "Du kannst nur eigene Kalender-Sperren anpassen.";
    case "forbidden_move":
      return "Du kannst nur eigene Kalender-Sperren verschieben.";
    case "forbidden_delete":
      return "Du kannst nur eigene Kalender-Sperren l?schen.";
    default:
      return "Du kannst nur eigene Kalender-Sperren verwalten.";
  }
}

export function getCalendarBlockTimeError() {
  return "Bitte gib einen g?ltigen Zeitraum an.";
}

export function getCalendarBlockQuarterHourError() {
  return "Bitte nutze f?r Sperren ein 15-Minuten-Raster.";
}

export function getCalendarBlockInvalidWindowError() {
  return "F?r diese Sperre konnte kein g?ltiger Zeitraum erstellt werden.";
}

export function getCalendarBlockPlannerDayError(action: "adjust" | "move") {
  return action === "adjust"
    ? "Im Planer l?sst sich die Sperre nur innerhalb dieses Tages anpassen."
    : "Im Planer l?sst sich die Sperre nur innerhalb dieses Tages verschieben.";
}

export function getCalendarBlockSaveError(kind: "create" | "delete" | "planner_adjust" | "planner_move" | "update") {
  switch (kind) {
    case "create":
      return "Der Zeitraum konnte nicht als belegt gespeichert werden.";
    case "delete":
      return "Die Kalender-Sperre konnte nicht gel?scht werden.";
    case "planner_adjust":
      return "Die Kalender-Sperre konnte nicht im Planer angepasst werden.";
    case "planner_move":
      return "Die Kalender-Sperre konnte nicht im Planer verschoben werden.";
    default:
      return "Die Kalender-Sperre konnte nicht aktualisiert werden.";
  }
}

export function getCalendarBlockSavedMessage(kind: "create" | "delete" | "planner_adjust" | "planner_move" | "update") {
  switch (kind) {
    case "create":
      return "Der Zeitraum wurde als belegt gespeichert.";
    case "delete":
      return "Die Kalender-Sperre wurde entfernt.";
    case "planner_adjust":
      return "Die Kalender-Sperre wurde direkt im Planer angepasst.";
    case "planner_move":
      return "Die Kalender-Sperre wurde direkt im Planer verschoben.";
    default:
      return "Die Kalender-Sperre wurde aktualisiert.";
  }
}
