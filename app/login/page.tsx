import Link from "next/link";
import { redirect } from "next/navigation";

import { loginAction } from "@/app/actions";
import { AuthPanel } from "@/components/blocks/auth-panel";
import { SubmitButton } from "@/components/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { getPostAuthDestination } from "@/lib/auth";

export default async function LoginPage() {
  const destination = await getPostAuthDestination();

  if (destination) {
    redirect(destination);
  }

  return (
    <AuthPanel
      eyebrow="Anmelden"
      subtitle="Melde dich mit deiner E-Mail-Adresse an und springe direkt in deine Übersicht."
      title="Willkommen zurück"
      footer={
        <p className="text-sm text-stone-600">
          Noch kein Konto?{" "}
          <Link className="font-semibold text-forest hover:text-clay" href="/signup">
            Jetzt registrieren
          </Link>
        </p>
      }
    >
      <form action={loginAction} className="space-y-4">
        <div>
          <label htmlFor="email">E-Mail</label>
          <input autoComplete="email" id="email" name="email" required type="email" />
        </div>
        <div>
          <label htmlFor="password">Passwort</label>
          <input autoComplete="current-password" id="password" name="password" required type="password" />
        </div>
        <Link
          className={buttonVariants(
            "ghost",
            "min-h-0 justify-start px-0 py-0 text-sm font-semibold text-forest hover:bg-transparent hover:text-clay"
          )}
          href="/passwort-vergessen"
        >
          Passwort vergessen?
        </Link>
        <SubmitButton idleLabel="Anmelden" pendingLabel="Anmeldung läuft..." />
      </form>
    </AuthPanel>
  );
}
