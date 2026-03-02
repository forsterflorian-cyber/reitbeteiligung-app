import Link from "next/link";
import { redirect } from "next/navigation";

import { signupAction } from "@/app/actions";
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
    <div className="mx-auto w-full max-w-md space-y-5 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-clay">Registrieren</p>
        <h1 className="text-3xl font-semibold text-forest">Dein Konto anlegen</h1>
        <p className="text-sm text-stone-600">Danach wählst du im Onboarding, ob du als Pferdehalter oder Reiter startest.</p>
      </div>
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
      <p className="text-sm text-stone-600">
        Bereits registriert?{" "}
        <Link className="font-semibold text-forest hover:text-clay" href="/login">
          Zur Anmeldung
        </Link>
      </p>
    </div>
  );
}
