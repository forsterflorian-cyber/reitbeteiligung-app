import { saveRiderProfileAction } from "@/app/actions";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
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
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        subtitle="Pflege hier deine Angaben für Reitbeteiligung und Probetermin in einer kompakten mobilen und klaren Desktop-Ansicht."
        title="Reiterprofil"
      />
      <Notice text={error} tone="error" />
      <Notice text={message} tone="success" />
      <SectionCard subtitle="Je vollständiger dein Profil ist, desto besser können Pferdehalter deine Anfragen einschätzen." title="Deine Angaben">
        <form action={saveRiderProfileAction} className="space-y-4">
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
      </SectionCard>
    </div>
  );
}