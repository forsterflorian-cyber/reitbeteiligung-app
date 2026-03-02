import { completeOnboardingAction } from "@/app/actions";
import { AuthPanel } from "@/components/blocks/auth-panel";
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
    <AuthPanel
      eyebrow="Onboarding"
      subtitle={`Du bist als ${user.email} angemeldet. Bitte hinterlege jetzt deine Rolle, deinen Namen und optional eine Telefonnummer.`}
      title="Profil vervollständigen"
    >
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
    </AuthPanel>
  );
}