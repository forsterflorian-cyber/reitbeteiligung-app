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
 * Returns true when an approved rider may create a free booking (i.e. pick
 * arbitrary start/end times within an availability window) under the current
 * effective booking mode.
 *
 * Free booking is only permitted when the effective mode is "free".
 */
export function canCreateFreeBooking(args: BookingModeArgs): boolean {
  return getEffectiveBookingMode(args) === "free";
}

/**
 * Returns true when an approved rider may book a pre-defined operational slot.
 *
 * Slot booking is always permitted regardless of the effective mode, so this
 * function exists primarily to make call-sites self-documenting and to keep
 * the door open for future restrictions.
 */
export function canBookSlot(_args: BookingModeArgs): boolean {
  return true;
}
