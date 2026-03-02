import Link from "next/link";
import { redirect } from "next/navigation";

import { loginAction } from "@/app/actions";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { getPostAuthDestination } from "@/lib/auth";
import { readSearchParam } from "@/lib/search-params";

type LoginPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const destination = await getPostAuthDestination();

  if (destination) {
    redirect(destination);
  }

  const error = readSearchParam(searchParams, "error");
  const message = readSearchParam(searchParams, "message");

  return (
    <div className="mx-auto w-full max-w-md space-y-5 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-clay">Anmelden</p>
        <h1 className="text-3xl font-semibold text-forest">Willkommen zurück</h1>
        <p className="text-sm text-stone-600">Melde dich mit deiner E-Mail-Adresse an und springe direkt in deine Übersicht.</p>
      </div>
      <Notice text={error} tone="error" />
      <Notice text={message} tone="success" />
      <form action={loginAction} className="space-y-4">
        <div>
          <label htmlFor="email">E-Mail</label>
          <input autoComplete="email" id="email" name="email" required type="email" />
        </div>
        <div>
          <label htmlFor="password">Passwort</label>
          <input autoComplete="current-password" id="password" name="password" required type="password" />
        </div>
        <Link className="inline-flex min-h-[44px] items-center text-sm font-semibold text-forest hover:text-clay" href="/passwort-vergessen">
          Passwort vergessen?
        </Link>
        <SubmitButton idleLabel="Anmelden" pendingLabel="Anmeldung läuft..." />
      </form>
      <p className="text-sm text-stone-600">
        Noch kein Konto?{" "}
        <Link className="font-semibold text-forest hover:text-clay" href="/signup">
          Jetzt registrieren
        </Link>
      </p>
    </div>
  );
}
