import Link from "next/link";

import { saveProfileDetailsAction } from "@/app/actions";
import { LogoutForm } from "@/components/logout-form";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { requireProfile } from "@/lib/auth";
import { getProfileDisplayName, getRoleLabel } from "@/lib/profiles";
import { readSearchParam } from "@/lib/search-params";
import type { RiderProfile } from "@/types/database";

export default async function ProfilPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { profile, supabase, user } = await requireProfile();
  const error = readSearchParam(searchParams, "error");
  const message = readSearchParam(searchParams, "message");
  let riderProfile: RiderProfile | null = null;

  if (profile.role === "rider") {
    const { data } = await supabase
      .from("rider_profiles")
      .select("user_id, experience, weight, notes")
      .eq("user_id", user.id)
      .maybeSingle();

    riderProfile = (data as RiderProfile | null) ?? null;
  }

  const displayName = getProfileDisplayName(profile, user.email);
  const roleLabel = getRoleLabel(profile.role);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-clay">Profil</p>
        <h1 className="text-3xl font-semibold text-forest sm:text-4xl">Mein Profil</h1>
        <p className="text-sm text-stone-600 sm:text-base">Hier pflegst du deinen sichtbaren Namen, deine Kontaktdaten und deine Rolle auf einen Blick.</p>
      </div>
      <Notice text={error} tone="error" />
      <Notice text={message} tone="success" />
      <div className="space-y-3">
        <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft">
          <p className="text-sm text-stone-500">Konto</p>
          <p className="mt-2 text-base font-semibold text-ink">{user.email}</p>
        </div>
        <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft">
          <p className="text-sm text-stone-500">Rolle</p>
          <p className="mt-2 text-base font-semibold text-ink">{roleLabel}</p>
          <p className="mt-2 text-sm text-stone-600">{profile.role === "owner" ? "Verwalte deine Pferdeprofile, Chats und Freischaltungen." : "Pflege dein Reiterprofil und behalte Probetermine im Blick."}</p>
        </div>
      </div>
      <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft sm:p-6">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-ink">Sichtbare Angaben</h2>
          <p className="text-sm text-stone-600">Diese Angaben verwenden wir in Chats, Anfragen und freigeschalteten Kontaktdaten.</p>
        </div>
        <form action={saveProfileDetailsAction} className="mt-4 space-y-4">
          <div>
            <label htmlFor="displayName">Name</label>
            <input defaultValue={displayName} id="displayName" minLength={2} name="displayName" required type="text" />
          </div>
          <div>
            <label htmlFor="phone">Telefon</label>
            <input defaultValue={profile.phone ?? ""} id="phone" name="phone" placeholder="0170 1234567" type="tel" />
          </div>
          <SubmitButton idleLabel="Profil speichern" pendingLabel="Wird gespeichert..." />
        </form>
      </section>
      {profile.role === "owner" ? (
        <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft">
          <p className="text-sm text-stone-500">Freischalten</p>
          <p className="mt-2 text-base font-semibold text-ink">{profile.is_premium ? "Freigeschaltet" : "Nicht freigeschaltet"}</p>
          <Link className="mt-3 inline-flex text-sm font-semibold text-forest hover:text-clay" href="/owner/horses">
            Zu den Pferdeprofilen
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
      <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft">
        <LogoutForm />
      </div>
    </div>
  );
}