export const MIN_WEEKLY_HOURS_LIMIT = 1;
export const MAX_WEEKLY_HOURS_LIMIT = 40;

export type RiderWeeklyBookingQuota = {
  booked_minutes: number;
  horse_id: string;
  remaining_minutes: number | null;
  rider_id: string;
  week_end: string;
  week_start: string;
  weekly_hours_limit: number | null;
};

export function formatWeeklyHoursLimit(hours: number) {
  return `${hours} ${hours === 1 ? "Stunde" : "Stunden"} pro Woche`;
}

export function formatBookingQuotaMinutes(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return "0 Std.";
  }

  if (minutes < 60) {
    return `${minutes} Min.`;
  }

  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(minutes / 60)} Std.`;
}
