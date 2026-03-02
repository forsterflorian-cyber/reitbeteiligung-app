import { saveRiderProfileAction } from "@/app/actions";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { requireProfile } from "@/lib/auth";
import { readSearchParam } from "@/lib/search-params";
import type { RiderProfile } from "@/types/database";

type RiderProfilePageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function RiderProfilePage({ searchParams }: RiderProfilePageProps) {
  const { supabase, user } = await requireProfile("rider");
  const error = readSearchParam(searchParams, "error");
  const message = readSearchParam(searchParams, "message");
  const { data } = await supabase
    .from("rider_profiles")
    .select("user_id, experience, weight, notes")
    .eq("user_id", user.id)
    .maybeSingle();

  const profile = (data as RiderProfile | null) ?? null;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-clay">Profil</p>
        <h1 className="text-3xl font-semibold text-forest sm:text-4xl">Reiterprofil</h1>
        <p className="text-sm text-stone-600 sm:text-base">Pflege hier deine Angaben für Reitbeteiligung und Probetermin in einer kompakten mobilen Ansicht.</p>
      </div>
      <Notice text={error} tone="error" />
      <Notice text={message} tone="success" />
      <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
        <h2 className="text-xl font-semibold text-ink">Deine Angaben</h2>
        <form action={saveRiderProfileAction} className="mt-4 space-y-4">
          <div>
            <label htmlFor="experience">Erfahrung</label>
            <input defaultValue={profile?.experience ?? ""} id="experience" name="experience" placeholder="8 Jahre, Dressur und Ausritte" type="text" />
          </div>
          <div>
            <label htmlFor="weight">Gewicht (kg)</label>
            <input defaultValue={profile?.weight ?? ""} id="weight" min={1} name="weight" placeholder="65" type="number" />
          </div>
          <div>
            <label htmlFor="notes">Notizen</label>
            <textarea defaultValue={profile?.notes ?? ""} id="notes" name="notes" placeholder="Verfügbarkeit, Ziele und Hinweise für den Probetermin." rows={5} />
          </div>
          <SubmitButton idleLabel="Reiterprofil speichern" pendingLabel="Wird gespeichert..." />
        </form>
      </section>
    </div>
  );
}
