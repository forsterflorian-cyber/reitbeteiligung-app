export const MIN_WEEKLY_HOURS_LIMIT = 1;
export const MAX_WEEKLY_HOURS_LIMIT = 40;

export function formatWeeklyHoursLimit(hours: number) {
  return `${hours} ${hours === 1 ? "Stunde" : "Stunden"} pro Woche`;
}
