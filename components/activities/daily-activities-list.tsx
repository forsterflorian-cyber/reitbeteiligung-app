import { correctHorseActivityAction } from "@/app/actions";
import { getActivityTypeLabel } from "@/components/activities/activity-type-label";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import type { DailyActivityWithActorName } from "@/types/database";

type DailyActivitiesListProps = {
  activities: DailyActivityWithActorName[];
  /** The user_id of the currently authenticated viewer, used to show the correction action. */
  viewerUserId: string | null;
  /** When true, each entry shows its activity_date. Use for multi-day lists. */
  showDate?: boolean;
};

function formatActivityTime(time: string | null) {
  if (!time) {
    return null;
  }

  // time is stored as HH:MM(:SS) — display HH:MM
  return time.slice(0, 5);
}

function formatActivityDate(date: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(date));
}

function sortActivities(activities: DailyActivityWithActorName[]): DailyActivityWithActorName[] {
  return [...activities].sort((a, b) => {
    if (a.activity_date !== b.activity_date) {
      return b.activity_date.localeCompare(a.activity_date);
    }
    if (a.activity_time !== b.activity_time) {
      if (!a.activity_time) return 1;
      if (!b.activity_time) return -1;
      return a.activity_time.localeCompare(b.activity_time);
    }
    return b.created_at.localeCompare(a.created_at);
  });
}

export function DailyActivitiesList({ activities, viewerUserId, showDate = false }: DailyActivitiesListProps) {
  const activeActivities = sortActivities(activities.filter((a) => a.status === "active"));

  if (activeActivities.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {activeActivities.map((activity) => {
        const label = getActivityTypeLabel(activity.activity_type);
        const time = formatActivityTime(activity.activity_time);
        const actorName = activity.actorName ?? "Unbekannt";
        const isOwn = viewerUserId !== null && activity.user_id === viewerUserId;

        return (
          <div
            className="flex items-start justify-between gap-3 rounded-2xl border border-stone-100 bg-stone-50/70 px-3 py-2"
            key={activity.id}
          >
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-medium text-stone-800">
                {label}
                {time ? <span className="ml-1.5 font-normal text-stone-500">{time} Uhr</span> : null}
                <span className="ml-1.5 font-normal text-stone-500">({actorName})</span>
              </p>
              {showDate ? (
                <p className="text-xs text-stone-400">{formatActivityDate(activity.activity_date)}</p>
              ) : null}
              {activity.comment ? (
                <p className="truncate text-xs text-stone-500">{activity.comment}</p>
              ) : null}
            </div>

            {isOwn ? (
              <form action={correctHorseActivityAction} className="shrink-0">
                <input name="activity_id" type="hidden" value={activity.id} />
                <ConfirmSubmitButton
                  className="inline-flex min-h-[28px] items-center rounded-full border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-500 hover:border-rose-200 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-70"
                  confirmMessage="Aktivität als korrigiert markieren?"
                  idleLabel="Korrigieren"
                  pendingLabel="..."
                />
              </form>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
