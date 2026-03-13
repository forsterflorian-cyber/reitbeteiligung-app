import type { HorseDailyActivityType } from "@/types/database";

export const ACTIVITY_TYPE_LABELS: Record<HorseDailyActivityType, string> = {
  ride: "Reiten",
  groundwork: "Bodenarbeit",
  hack: "Ausritt",
  lunge: "Longieren",
  free_movement: "Freilauf",
  care: "Pflege",
  other: "Sonstiges"
};

export function getActivityTypeLabel(type: HorseDailyActivityType): string {
  return ACTIVITY_TYPE_LABELS[type];
}
