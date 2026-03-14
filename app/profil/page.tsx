import Link from "next/link";

import { deleteOwnerAccountAction, deleteRiderAccountAction, saveProfileDetailsAction, startOwnerTrialAction } from "@/app/actions";
import { DeleteAccountSection } from "@/components/delete-account-section";
import { LogoutForm } from "@/components/logout-form";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { AppPageShell } from "@/components/ui/app-page-shell";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { requireProfile } from "@/lib/auth";
import { OWNER_PLAN_LIMITS_ENABLED, PAID_PLAN_CONTACT_EMAIL, canStartOwnerTrial, getOwnerPlan, getOwnerPlanUsage, getOwnerPlanUsageSummary } from "@/lib/plans";
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
  const ownerPlanUsage = profile.role === "owner" ? await getOwnerPlanUsage(supabase, user.id) : null;
  const ownerPlan = profile.role === "owner" ? getOwnerPlan(profile, ownerPlanUsage ?? undefined) : null;
  const ownerPlanUsageSummary = ownerPlan && ownerPlanUsage ? getOwnerPlanUsageSummary(ownerPlan, ownerPlanUsage) : null;
  const showStartTrial = profile.role === "owner" ? canStartOwnerTrial(profile) : false;
  const upgradeHref = `mailto:${PAID_PLAN_CONTACT_EMAIL}?subject=${encodeURIComponent("Bezahlten Tarif anfragen")}`;

  return (
    <AppPageShell>
      <PageHeader
        backdropVariant="hero"
        subtitle={`Hallo ${displayName}. Hier pflegst du deine Kontaktdaten und deine Rolle.`}
        surface
        title="Mein Profil"
      />
      <Notice text={error} tone="error" />
      <Notice text={message} tone="success" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
        <div className="space-y-5">
          <SectionCard subtitle="Deine sichtbaren Kontaktdaten verwenden wir in Chats, Anfragen und nach einer Freischaltung." title="Sichtbare Angaben">
            <form action={saveProfileDetailsAction} className="space-y-4">
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
          </SectionCard>
          <SectionCard subtitle="Das ist dein aktueller Zugang in der Plattform." title="Konto & Rolle">
            <div className="space-y-4 text-sm leading-6 text-stone-600">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">Konto</p>
                <p className="mt-1 text-base font-semibold text-ink">{user.email}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">Rolle</p>
                <p className="mt-1 text-base font-semibold text-ink">{roleLabel}</p>
                <p className="mt-2">{profile.role === "owner" ? "Du verwaltest Pferdeprofile, Freischaltungen und Termine." : "Du pflegst dein Reiterprofil und beh\u00e4ltst Probetermine im Blick."}</p>
              </div>
            </div>
          </SectionCard>
        </div>
        <div className="space-y-5">
          {profile.role === "owner" ? (
            OWNER_PLAN_LIMITS_ENABLED ? (
              <SectionCard subtitle="Alle Kernfunktionen sind aktuell direkt verfügbar." title="Aktueller Status">
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={ownerPlan?.key === "paid" ? "approved" : ownerPlan?.key === "trial" ? "pending" : "neutral"}>{ownerPlan?.label}</Badge>
                  </div>
                  <p className="text-sm leading-6 text-stone-600">{ownerPlan?.summary}</p>
                  {ownerPlan?.key !== "paid" && ownerPlanUsageSummary ? <p className="text-sm leading-6 text-stone-600">{ownerPlanUsageSummary}</p> : null}
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Link className={buttonVariants("secondary", "w-full sm:w-auto")} href="/owner/pferde-verwalten">
                      Zu den Pferdeprofilen
                    </Link>
                    {showStartTrial ? (
                      <form action={startOwnerTrialAction}>
                        <input name="redirectTo" type="hidden" value="/profil" />
                        <Button className="w-full sm:w-auto" type="submit" variant="secondary">
                          Start Trial
                        </Button>
                      </form>
                    ) : null}
                    {ownerPlan?.key !== "paid" ? (
                      <a className={buttonVariants(showStartTrial ? "ghost" : "secondary", "w-full sm:w-auto")} href={upgradeHref}>
                        Bezahlten Tarif anfragen
                      </a>
                    ) : null}
                  </div>
                </div>
              </SectionCard>
            ) : null
          ) : (
            <SectionCard subtitle={"Damit Pferdehalter dich besser einsch\u00e4tzen k\u00f6nnen, sollte dein Reiterprofil vollst\u00e4ndig sein."} title="Reiterprofil">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge tone={riderProfile ? "approved" : "pending"}>{riderProfile ? "Bereit" : "Noch unvollst\u00e4ndig"}</Badge>
                </div>
                <Link className={buttonVariants("secondary", "w-full sm:w-auto")} href="/rider/profile">
                  Reiterprofil bearbeiten
                </Link>
              </div>
            </SectionCard>
          )}
          <SectionCard title="Abmelden">
            <LogoutForm />
          </SectionCard>
          <SectionCard
            subtitle={
              profile.role === "rider"
                ? "Nur moeglich, wenn keine aktiven Reitbeteiligungen, bevorstehenden Buchungen oder offenen Anfragen bestehen."
                : "Nur moeglich, wenn alle Pferde deaktiviert sind und keine aktiven Reitbeteiligungen oder bevorstehenden Buchungen bestehen."
            }
            title="Konto loeschen"
          >
            <div className="space-y-4">
              <p className="text-sm text-stone-600">
                {profile.role === "rider"
                  ? "Loescht dein Konto, dein Reiterprofil und alle deine Daten dauerhaft. Diese Aktion kann nicht rueckgaengig gemacht werden."
                  : "Loescht dein Konto, alle Pferdeprofile und alle dazugehoerigen Daten dauerhaft. Diese Aktion kann nicht rueckgaengig gemacht werden."}
              </p>
              <DeleteAccountSection
                action={profile.role === "rider" ? deleteRiderAccountAction : deleteOwnerAccountAction}
                blockerHint={
                  profile.role === "rider"
                    ? "Vorher beenden: aktive Reitbeteiligungen, bevorstehende Buchungen, offene Probeterminanfragen."
                    : "Vorher beenden: Pferdeprofile deaktivieren, Reitbeteiligungen entziehen, offene Buchungen klaeren."
                }
              />
            </div>
          </SectionCard>
        </div>
      </div>
    </AppPageShell>
  );
}
