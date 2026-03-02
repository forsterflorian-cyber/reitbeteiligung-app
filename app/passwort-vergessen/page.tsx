import { requestPasswordResetAction } from "@/app/actions";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { readSearchParam } from "@/lib/search-params";

type PasswordForgottenPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function PasswortVergessenPage({ searchParams }: PasswordForgottenPageProps) {
  const error = readSearchParam(searchParams, "error");
  const message = readSearchParam(searchParams, "message");

  return (
    <div className="mx-auto w-full max-w-md space-y-5 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-clay">Passwort vergessen</p>
        <h1 className="text-3xl font-semibold text-forest">Link zum Zuruecksetzen anfordern</h1>
        <p className="text-sm text-stone-600">Gib deine E-Mail-Adresse ein. Wir senden dir einen Link, mit dem du dein Passwort neu setzen kannst.</p>
      </div>
      <Notice text={error} tone="error" />
      <Notice text={message} tone="success" />
      <form action={requestPasswordResetAction} className="space-y-4">
        <div>
          <label htmlFor="email">E-Mail</label>
          <input autoComplete="email" id="email" name="email" required type="email" />
        </div>
        <SubmitButton idleLabel="Link senden" pendingLabel="Wird versendet..." />
      </form>
    </div>
  );
}
