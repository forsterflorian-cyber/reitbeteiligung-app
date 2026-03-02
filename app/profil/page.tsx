import Link from "next/link";

import { LogoutForm } from "@/components/logout-form";
import { requireProfile } from "@/lib/auth";
import type { RiderProfile } from "@/types/database";

export default async function ProfilPage() {
  const { profile, supabase, user } = await requireProfile();
  let riderProfile: RiderProfile | null = null;

  if (profile.role === "rider") {
    const { data } = await supabase
      .from("rider_profiles")
      .select("user_id, experience, weight, notes")
      .eq("user_id", user.id)
      .maybeSingle();

    riderProfile = (data as RiderProfile | null) ?? null;
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-clay">Profil</p>
        <h1 className="text-3xl font-semibold text-forest sm:text-4xl">Mein Profil</h1>
        <p className="text-sm text-stone-600 sm:text-base">Hier findest du deine Rolle, schnelle Links und die sichere Abmeldung auf einen Blick.</p>
      </div>
      <div className="space-y-3">
        <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft">
          <p className="text-sm text-stone-500">Konto</p>
          <p className="mt-2 text-base font-semibold text-ink">{user.email}</p>
        </div>
        <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft">
          <p className="text-sm text-stone-500">Rolle</p>
          <p className="mt-2 text-base font-semibold text-ink">{profile.role === "owner" ? "Pferdehalter" : "Reiter"}</p>
          <p className="mt-2 text-sm text-stone-600">{profile.role === "owner" ? "Verwalte deine Reitbeteiligungen und Freischaltungen." : "Pflege dein Reiterprofil und behalte Probetermine im Blick."}</p>
        </div>
        {profile.role === "owner" ? (
          <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft">
            <p className="text-sm text-stone-500">Freischalten</p>
            <p className="mt-2 text-base font-semibold text-ink">{profile.is_premium ? "Freigeschaltet" : "Nicht freigeschaltet"}</p>
            <Link className="mt-3 inline-flex text-sm font-semibold text-forest hover:text-clay" href="/owner/horses">
              Zur Reitbeteiligung
            </Link>
          </div>
        ) : (
          <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft">
            <p className="text-sm text-stone-500">Reiterprofil</p>
            <p className="mt-2 text-base font-semibold text-ink">{riderProfile ? "Vorhanden" : "Noch unvollstaendig"}</p>
            <Link className="mt-3 inline-flex text-sm font-semibold text-forest hover:text-clay" href="/rider/profile">
              Reiterprofil bearbeiten
            </Link>
          </div>
        )}
      </div>
      <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft">
        <LogoutForm />
      </div>
    </div>
  );
}

