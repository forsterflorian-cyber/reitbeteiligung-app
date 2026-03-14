import type { BookingRequestStatus } from "../types/database";

import { BOOKING_REQUEST_STATUS } from "./statuses.ts";
import { ACTIVE_RELATIONSHIP_CALENDAR_V1 } from "./release-stage.ts";

type SupabaseErrorLike = {
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  message: string;
};

export type BookingFailureReason =
  | "booking_past"
  | "booking_started"
  | "conflict"
  | "inactive_relationship"
  | "invalid_status"
  | "invalid_target_slot"
  | "not_found"
  | "quota_exceeded"
  | "revoked"
  | "slot_not_free"
  | "unauthorized"
  | "unknown";

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
    case "NOT_ALLOWED":
      return "Dieser Buchungstyp ist fuer dieses Pferd nicht zugelassen.";
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

export function getRescheduleBookingErrorReason(error: SupabaseErrorLike): BookingFailureReason {
  switch (error.message) {
    case "INVALID_RANGE":
    case "RULE_INACTIVE":
    case "TRIAL_RULE":
    case "OUTSIDE_RULE":
    case "SAME_SLOT":
      return "invalid_target_slot";
    case "NOT_ALLOWED":
      return "unauthorized";
    case "NOT_FOUND":
      return "not_found";
    case "INVALID_STATUS":
      return "invalid_status";
    case "NOT_APPROVED":
      return "inactive_relationship";
    case "BOOKING_STARTED":
      return "booking_started";
    case "TARGET_IN_PAST":
      return "booking_past";
    case "TIME_UNAVAILABLE":
      return "slot_not_free";
    case "WEEKLY_LIMIT_EXCEEDED":
      return "quota_exceeded";
    default:
      return "unknown";
  }
}

export function getRescheduleBookingErrorMessageForReason(reason: BookingFailureReason) {
  switch (reason) {
    case "unauthorized":
      return "Du darfst diesen Termin nicht umbuchen.";
    case "revoked":
      return "Deine Freischaltung fuer diese Reitbeteiligung wurde entzogen.";
    case "inactive_relationship":
      return "Nur aktive Reitbeteiligungen koennen operative Termine umbuchen.";
    case "booking_started":
      return "Nur noch nicht begonnene Termine koennen umgebucht werden.";
    case "booking_past":
      return "Der neue Termin muss in der Zukunft liegen.";
    case "slot_not_free":
      return "Der gewaehlte Slot ist nicht mehr verfuegbar.";
    case "conflict":
      return "Der gewaehlte Slot kollidiert mit einer Sperre oder einem anderen Termin.";
    case "invalid_target_slot":
      return "Bitte waehle einen anderen gueltigen freien Slot fuer die Umbuchung.";
    case "invalid_status":
      return "Dieser Termin ist nicht mehr aktiv umbuchenbar.";
    case "not_found":
      return "Der Termin konnte nicht gefunden werden.";
    case "quota_exceeded":
      return "In der Zielwoche ist dein Wochenkontingent fuer dieses Pferd bereits ausgeschoepft.";
    default:
      return "Der Termin konnte nicht umgebucht werden.";
  }
}

export function getRescheduleBookingErrorMessage(error: SupabaseErrorLike) {
  if (error.message === "UNSUPPORTED_RECURRENCE") {
    return OPERATIONAL_RECURRENCE_NOT_ENABLED_MESSAGE;
  }

  return getRescheduleBookingErrorMessageForReason(getRescheduleBookingErrorReason(error));
}
