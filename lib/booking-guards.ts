import { ACTIVE_RELATIONSHIP_CALENDAR_V1 } from "./release-stage.ts";

type SupabaseErrorLike = {
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  message: string;
};

export const OPERATIONAL_RECURRENCE_NOT_ENABLED_MESSAGE =
  "Wiederholende operative Buchungen sind in dieser Version noch nicht freigeschaltet.";

export function shouldDirectBookOperationalSlot(recurrenceRrule: string | null) {
  return ACTIVE_RELATIONSHIP_CALENDAR_V1 && !recurrenceRrule;
}

export function isBookingWriteConflictError(error: SupabaseErrorLike) {
  return error.code === "23P01" || error.code === "23505" || error.message === "TIME_UNAVAILABLE";
}

export function getBookingConflictMessage(recurrenceRrule: string | null) {
  return recurrenceRrule
    ? "Mindestens ein Wiederholungstermin kollidiert mit einer bestehenden Buchung oder Sperre."
    : "Der angefragte Termin ist nicht mehr verfuegbar.";
}

export function getDirectBookingErrorMessage(error: SupabaseErrorLike) {
  switch (error.message) {
    case "INVALID_RANGE":
      return "Die Terminanfrage enthaelt einen ungueltigen Zeitraum.";
    case "NOT_APPROVED":
      return "Nur freigeschaltete Reiter koennen einen Termin buchen.";
    case "OUTSIDE_RULE":
      return "Der Termin muss komplett im Verfuegbarkeitsfenster liegen.";
    case "RULE_INACTIVE":
      return "Dieses Verfuegbarkeitsfenster ist nicht mehr verfuegbar.";
    case "TRIAL_RULE":
      return "Dieser Slot gehoert zur Probephase und kann nicht direkt operativ gebucht werden.";
    case "TIME_UNAVAILABLE":
      return "Der angefragte Termin ist nicht mehr verfuegbar.";
    default:
      return "Der Termin konnte nicht direkt gebucht werden.";
  }
}

export function getAcceptBookingErrorMessage(error: SupabaseErrorLike) {
  switch (error.message) {
    case "NOT_ALLOWED":
    case "NOT_FOUND":
      return "Die Buchungsanfrage konnte nicht gefunden werden.";
    case "INVALID_RANGE":
      return "Die Buchungsanfrage enthaelt einen ungueltigen Zeitraum.";
    case "INVALID_STATUS":
      return "Diese Buchungsanfrage wurde bereits bearbeitet.";
    case "NOT_APPROVED":
      return "Nur freigeschaltete Reiter koennen gebucht werden.";
    case "OUTSIDE_RULE":
      return "Der erste Termin liegt nicht im Verfuegbarkeitsfenster.";
    case "RULE_INACTIVE":
      return "Dieses Verfuegbarkeitsfenster ist nicht mehr aktiv.";
    case "ALREADY_BOOKED":
    case "TIME_UNAVAILABLE":
      return getBookingConflictMessage(null);
    default:
      return "Die Buchungsanfrage konnte nicht angenommen werden.";
  }
}
