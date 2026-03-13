import { logHorseActivityAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { ACTIVITY_TYPE_LABELS } from "@/components/activities/activity-type-label";
import type { HorseDailyActivityType } from "@/types/database";

type LogActivityFormProps = {
  horseId: string;
  defaultDate: string;
};

const ACTIVITY_TYPE_OPTIONS: HorseDailyActivityType[] = [
  "ride",
  "groundwork",
  "hack",
  "lunge",
  "free_movement",
  "care",
  "other"
];

export function LogActivityForm({ horseId, defaultDate }: LogActivityFormProps) {
  return (
    <form action={logHorseActivityAction} className="space-y-4">
      <input name="horse_id" type="hidden" value={horseId} />

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-stone-700" htmlFor="activity_type">
          Aktivität
        </label>
        <select
          className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-forest/30"
          id="activity_type"
          name="activity_type"
          required
        >
          <option disabled selected value="">
            Bitte wählen
          </option>
          {ACTIVITY_TYPE_OPTIONS.map((type) => (
            <option key={type} value={type}>
              {ACTIVITY_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-stone-700" htmlFor="activity_date">
            Datum
          </label>
          <input
            className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-forest/30"
            defaultValue={defaultDate}
            id="activity_date"
            name="activity_date"
            required
            type="date"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-stone-700" htmlFor="activity_time">
            Uhrzeit{" "}
            <span className="font-normal text-stone-500">(optional)</span>
          </label>
          <input
            className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-forest/30"
            id="activity_time"
            name="activity_time"
            type="time"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-stone-700" htmlFor="comment">
          Kommentar{" "}
          <span className="font-normal text-stone-500">(optional)</span>
        </label>
        <textarea
          className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-forest/30"
          id="comment"
          name="comment"
          rows={2}
        />
      </div>

      <SubmitButton
        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-stone-200 bg-white px-5 py-2.5 text-sm font-semibold text-stone-900 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-70"
        idleLabel="Aktivität eintragen"
        pendingLabel="Wird gespeichert..."
      />
    </form>
  );
}
