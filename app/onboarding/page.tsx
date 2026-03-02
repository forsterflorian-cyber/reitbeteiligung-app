import { completeOnboardingAction } from "@/app/actions";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { requireOnboardingUser } from "@/lib/auth";
import { readSearchParam } from "@/lib/search-params";

type OnboardingPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const { user } = await requireOnboardingUser();
  const error = readSearchParam(searchParams, "error");

  return (
    <div className="mx-auto w-full max-w-md space-y-5 rounded-3xl border border-stone-200 bg-white p-5 shadow-soft sm:p-6">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-clay">Onboarding</p>
        <h1 className="text-3xl font-semibold text-forest">Profil vervollstaendigen</h1>
        <p className="text-sm text-stone-600">Du bist als {user.email} angemeldet. Bitte hinterlege jetzt deine Rolle, deinen Namen und optional eine Telefonnummer.</p>
      </div>
      <Notice text={error} tone="error" />
      <form action={completeOnboardingAction} className="space-y-4">
        <div>
          <label htmlFor="displayName">Name</label>
          <input id="displayName" minLength={2} name="displayName" placeholder="Vor- und Nachname" required type="text" />
        </div>
        <div>
          <label htmlFor="phone">Telefon (optional)</label>
          <input id="phone" name="phone" placeholder="0170 1234567" type="tel" />
        </div>
        <div>
          <label htmlFor="role">Rolle</label>
          <select defaultValue="owner" id="role" name="role">
            <option value="owner">Pferdehalter</option>
            <option value="rider">Reiter</option>
          </select>
        </div>
        <SubmitButton idleLabel="Profil anlegen" pendingLabel="Wird gespeichert..." />
      </form>
    </div>
  );
}