import Link from "next/link";
import { redirect } from "next/navigation";

import { signupAction } from "@/app/actions";
import { AuthPanel } from "@/components/blocks/auth-panel";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { getPostAuthDestination } from "@/lib/auth";
import { readSearchParam } from "@/lib/search-params";

type SignupPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const destination = await getPostAuthDestination();

  if (destination) {
    redirect(destination);
  }

  const error = readSearchParam(searchParams, "error");

  return (
    <AuthPanel
      eyebrow="Registrieren"
      subtitle="Danach wählst du im Onboarding, ob du als Pferdehalter oder Reiter startest."
      title="Dein Konto anlegen"
      footer={
        <p className="text-sm text-stone-600">
          Bereits registriert?{" "}
          <Link className="font-semibold text-forest hover:text-clay" href="/login">
            Zur Anmeldung
          </Link>
        </p>
      }
    >
      <Notice text={error} tone="error" />
      <form action={signupAction} className="space-y-4">
        <div>
          <label htmlFor="email">E-Mail</label>
          <input autoComplete="email" id="email" name="email" required type="email" />
        </div>
        <div>
          <label htmlFor="password">Passwort</label>
          <input autoComplete="new-password" id="password" name="password" required type="password" />
        </div>
        <SubmitButton idleLabel="Konto erstellen" pendingLabel="Registrierung läuft..." />
      </form>
    </AuthPanel>
  );
}