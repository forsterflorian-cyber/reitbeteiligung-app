import type { BookingRequestStatus } from "../types/database";

import { BOOKING_REQUEST_STATUS } from "./statuses.ts";
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

export function isFutureOperationalStartAt(args: {
  now?: Date;
  startAt: string;
}) {
  const startAt = new Date(args.startAt);

  if (Number.isNaN(startAt.getTime())) {
    return false;
  }

  return startAt.getTime() > (args.now ?? new Date()).getTime();
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
      return "Nur freigeschaltete Reiter koennen einen Termin anfragen.";
    case "OUTSIDE_RULE":
      return "Der Termin muss komplett im Verfuegbarkeitsfenster liegen.";
    case "RULE_INACTIVE":
      return "Dieses Verfuegbarkeitsfenster ist nicht mehr verfuegbar.";
    case "TRIAL_RULE":
      return "Dieser Slot gehoert zur Probephase und kann nicht direkt operativ gebucht werden.";
    case "BOOKING_STARTED":
      return "Nur zukuenftige Termine koennen direkt gebucht werden.";
    case "TIME_UNAVAILABLE":
      return "Der angefragte Termin ist nicht mehr verfuegbar.";
    case "WEEKLY_LIMIT_EXCEEDED":
      return "Dein Wochenkontingent fuer dieses Pferd ist in dieser Woche bereits ausgeschoepft.";
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
    case "BOOKING_STARTED":
      return "Nur zukuenftige Termine koennen angenommen werden.";
    case "ALREADY_BOOKED":
    case "TIME_UNAVAILABLE":
      return getBookingConflictMessage(null);
    case "WEEKLY_LIMIT_EXCEEDED":
      return "Das Wochenkontingent dieses Reiters ist in dieser Woche bereits ausgeschoepft.";
    default:
      return "Die Buchungsanfrage konnte nicht angenommen werden.";
  }
}

export function canCancelOperationalBooking(args: {
  now?: Date;
  startAt: string;
  status: BookingRequestStatus | null | undefined;
}) {
  if (args.status !== BOOKING_REQUEST_STATUS.accepted) {
    return false;
  }

  return isFutureOperationalStartAt(args);
}

export function canRescheduleOperationalBooking(args: {
  now?: Date;
  startAt: string;
  status: BookingRequestStatus | null | undefined;
}) {
  return canCancelOperationalBooking(args);
}

export function getCancelBookingErrorMessage(error: SupabaseErrorLike) {
  switch (error.message) {
    case "NOT_ALLOWED":
      return "Du darfst diesen Termin nicht stornieren.";
    case "NOT_FOUND":
      return "Der Termin konnte nicht gefunden werden.";
    case "INVALID_STATUS":
      return "Dieser Termin ist nicht mehr aktiv.";
    case "NOT_APPROVED":
      return "Nur aktive Reitbeteiligungen koennen eigene Termine stornieren.";
    case "BOOKING_STARTED":
      return "Nur noch nicht begonnene Termine koennen storniert werden.";
    case "UNSUPPORTED_RECURRENCE":
      return OPERATIONAL_RECURRENCE_NOT_ENABLED_MESSAGE;
    default:
      return "Der Termin konnte nicht storniert werden.";
  }
}

export function getRescheduleBookingErrorMessage(error: SupabaseErrorLike) {
  switch (error.message) {
    case "INVALID_RANGE":
      return "Die Umbuchung enthaelt einen ungueltigen Zeitraum.";
    case "NOT_ALLOWED":
      return "Du darfst diesen Termin nicht umbuchen.";
    case "NOT_FOUND":
      return "Der Termin konnte nicht gefunden werden.";
    case "INVALID_STATUS":
      return "Dieser Termin ist nicht mehr aktiv umbuchenbar.";
    case "NOT_APPROVED":
      return "Nur aktive Reitbeteiligungen koennen operative Termine umbuchen.";
    case "BOOKING_STARTED":
      return "Nur noch nicht begonnene Termine koennen umgebucht werden.";
    case "TARGET_IN_PAST":
      return "Der neue Termin muss in der Zukunft liegen.";
    case "RULE_INACTIVE":
      return "Dieses Verfuegbarkeitsfenster ist nicht mehr verfuegbar.";
    case "TRIAL_RULE":
      return "Dieser Slot gehoert zur Probephase und kann nicht operativ genutzt werden.";
    case "OUTSIDE_RULE":
      return "Der neue Termin muss komplett im Verfuegbarkeitsfenster liegen.";
    case "SAME_SLOT":
      return "Bitte waehle einen anderen freien Slot fuer die Umbuchung.";
    case "TIME_UNAVAILABLE":
      return "Der gewaehlte Slot ist nicht mehr verfuegbar.";
    case "WEEKLY_LIMIT_EXCEEDED":
      return "In der Zielwoche ist dein Wochenkontingent fuer dieses Pferd bereits ausgeschoepft.";
    case "UNSUPPORTED_RECURRENCE":
      return OPERATIONAL_RECURRENCE_NOT_ENABLED_MESSAGE;
    default:
      return "Der Termin konnte nicht umgebucht werden.";
  }
}
