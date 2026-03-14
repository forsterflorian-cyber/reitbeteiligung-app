import type { Approval, HorseBookingMode } from "../types/database";

type BookingModeArgs = {
  horse: { booking_mode: HorseBookingMode };
  /**
   * The rider's current approval record.
   * Accepted here so a future per-rider override can be introduced at this
   * single call-site without changing any existing callers:
   *
   *   return approval?.booking_mode_override ?? horse.booking_mode;
   */
  approval?: Pick<Approval, "horse_id" | "rider_id" | "status"> | null;
};

type BookingPolicyArgs = BookingModeArgs & {
  /** The availability rule the booking is being made against. */
  rule: { end_at: string; start_at: string };
  /** Requested booking end time. */
  endAt: Date;
  /** Requested booking start time. */
  startAt: Date;
};

/**
 * Returns the effective booking mode for a horse/rider combination.
 *
 * Currently the horse-level default is always authoritative. The `approval`
 * parameter is structurally accepted so that adding a rider-specific override
 * later requires changing only this function.
 */
export function getEffectiveBookingMode(args: BookingModeArgs): HorseBookingMode {
  return args.horse.booking_mode;
}

/**
 * Central policy gate: returns true when the requested time range is
 * permitted under the horse's effective booking mode.
 *
 *   slots  — start/end must exactly match the rule boundaries.
 *   window — start/end must fall within the rule boundaries.
 *   free   — always permitted (outer conflict/block checks still run).
 *
 * This is the single place where booking-mode enforcement lives. Do NOT add
 * mode-specific checks anywhere else in the codebase.
 */
export function canCreateBooking(args: BookingPolicyArgs): boolean {
  const mode = getEffectiveBookingMode(args);
  const ruleStart = new Date(args.rule.start_at);
  const ruleEnd = new Date(args.rule.end_at);

  if (mode === "slots") {
    return (
      args.startAt.getTime() === ruleStart.getTime() &&
      args.endAt.getTime() === ruleEnd.getTime()
    );
  }

  if (mode === "window") {
    return (
      args.startAt.getTime() >= ruleStart.getTime() &&
      args.endAt.getTime() <= ruleEnd.getTime()
    );
  }

  // "free": permitted anywhere — outer conflict + block rules still apply
  return true;
}
