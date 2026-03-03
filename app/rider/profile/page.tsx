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
    .select("user_id, experience, weight, preferred_days, goals, notes")
    .eq("user_id", user.id)
    .maybeSingle();

  const profile = (data as RiderProfile | null) ?? null;

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        subtitle="Pflege hier deine Angaben fuer Probetermine, spaetere Terminbuchungen und den ersten Eindruck fuer Pferdehalter."
        title="Reiterprofil"
      />
      <Notice text={error} tone="error" />
      <Notice text={message} tone="success" />
      <SectionCard subtitle="Je klarer dein Profil ist, desto einfacher lassen sich passende Pferde und realistische Zeitfenster abstimmen." title="Deine Angaben">
        <form action={saveRiderProfileAction} className="space-y-4">
          <div>
            <label htmlFor="experience">Erfahrung</label>
            <input defaultValue={profile?.experience ?? ""} id="experience" name="experience" placeholder="8 Jahre, Dressur, Ausritte und Bodenarbeit" type="text" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="weight">Gewicht (kg)</label>
              <input defaultValue={profile?.weight ?? ""} id="weight" min={1} name="weight" placeholder="65" type="number" />
            </div>
            <div>
              <label htmlFor="preferredDays">Typische Verfuegbarkeit</label>
              <input
                defaultValue={profile?.preferred_days ?? ""}
                id="preferredDays"
                name="preferredDays"
                placeholder="z. B. Dienstag abends, Freitag flexibel"
                type="text"
              />
            </div>
          </div>
          <div>
            <label htmlFor="goals">Ziele / Reitstil</label>
            <textarea
              defaultValue={profile?.goals ?? ""}
              id="goals"
              name="goals"
              placeholder="Was suchst du: entspannte Ausritte, Dressurarbeit, langfristige Reitbeteiligung, feste Routinen ..."
              rows={4}
            />
          </div>
          <div>
            <label htmlFor="notes">Hinweise fuer Pferdehalter</label>
            <textarea
              defaultValue={profile?.notes ?? ""}
              id="notes"
              name="notes"
              placeholder="Zum Beispiel Fahrzeit, Stallarbeit, besondere Wuensche fuer den Probetermin oder wichtige Rueckfragen."
              rows={5}
            />
          </div>
          <SubmitButton idleLabel="Reiterprofil speichern" pendingLabel="Wird gespeichert..." />
        </form>
      </SectionCard>
    </div>
  );
}
