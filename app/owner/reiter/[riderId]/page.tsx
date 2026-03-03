import Link from "next/link";
import { notFound } from "next/navigation";

import { AppPageShell } from "@/components/ui/app-page-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { requireProfile } from "@/lib/auth";
import type { Profile, RiderProfile } from "@/types/database";

type RiderDetailPageProps = {
  params: { riderId: string };
};

export default async function OwnerRiderDetailPage({ params }: RiderDetailPageProps) {
  const { supabase } = await requireProfile("owner");
  const riderId = params.riderId;

  const [{ data: profileData }, { data: riderProfileData }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, role, is_premium, display_name, phone, created_at")
      .eq("id", riderId)
      .eq("role", "rider")
      .maybeSingle(),
    supabase
      .from("rider_profiles")
      .select("user_id, experience, weight, preferred_days, goals, notes")
      .eq("user_id", riderId)
      .maybeSingle()
  ]);

  const riderMeta = (profileData as Profile | null) ?? null;
  const riderProfile = (riderProfileData as RiderProfile | null) ?? null;

  if (!riderMeta && !riderProfile) {
    notFound();
  }

  const title = riderMeta?.display_name?.trim() || "Reiterprofil";

  return (
    <AppPageShell>
      <PageHeader
        actions={
          <Link className={buttonVariants("secondary", "w-full sm:w-auto")} href="/owner/anfragen">
            Zurueck zu den Anfragen
          </Link>
        }
        backdropVariant="hero"
        subtitle="Hier siehst du die Angaben, die dieser Reiter fuer Probetermine und spaetere Terminabsprachen hinterlegt hat."
        surface
        title={title}
      />

      <SectionCard subtitle="Grunddaten und Kontakt, soweit vorhanden." title="Uebersicht">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">Reiter</Badge>
            {riderMeta?.phone ? <Badge tone="info">Telefon hinterlegt</Badge> : null}
          </div>
          {riderMeta?.phone ? <p className="text-sm text-stone-600">Telefon: {riderMeta.phone}</p> : null}
          {!riderMeta?.phone ? (
            <EmptyState description="Der Reiter hat aktuell keine direkten Kontaktdaten im Profil hinterlegt." title="Keine Kontaktdaten" />
          ) : null}
        </div>
      </SectionCard>

      <SectionCard subtitle="Diese Angaben helfen dir bei der Einschaetzung vor dem Probetermin." title="Reiterprofil">
        <div className="space-y-3 text-sm leading-6 text-stone-600">
          {riderProfile?.experience ? <p><span className="font-semibold text-stone-900">Erfahrung:</span> {riderProfile.experience}</p> : null}
          {typeof riderProfile?.weight === "number" ? <p><span className="font-semibold text-stone-900">Gewicht:</span> {riderProfile.weight} kg</p> : null}
          {riderProfile?.preferred_days ? <p><span className="font-semibold text-stone-900">Typische Verfuegbarkeit:</span> {riderProfile.preferred_days}</p> : null}
          {riderProfile?.goals ? <p><span className="font-semibold text-stone-900">Ziele:</span> {riderProfile.goals}</p> : null}
          {riderProfile?.notes ? <p><span className="font-semibold text-stone-900">Hinweise:</span> {riderProfile.notes}</p> : null}
          {!riderProfile?.experience && typeof riderProfile?.weight !== "number" && !riderProfile?.preferred_days && !riderProfile?.goals && !riderProfile?.notes ? (
            <EmptyState description="Der Reiter hat noch keine weiteren Details hinterlegt." title="Noch wenig Profilinhalt" />
          ) : null}
        </div>
      </SectionCard>
    </AppPageShell>
  );
}
