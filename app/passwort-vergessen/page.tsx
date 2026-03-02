import { requestPasswordResetAction } from "@/app/actions";
import { AuthPanel } from "@/components/blocks/auth-panel";
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
    <AuthPanel
      eyebrow="Passwort vergessen"
      subtitle="Gib deine E-Mail-Adresse ein. Wir senden dir einen Link, mit dem du dein Passwort neu setzen kannst."
      title="Link zum Zurücksetzen anfordern"
    >
      <Notice text={error} tone="error" />
      <Notice text={message} tone="success" />
      <form action={requestPasswordResetAction} className="space-y-4">
        <div>
          <label htmlFor="email">E-Mail</label>
          <input autoComplete="email" id="email" name="email" required type="email" />
        </div>
        <SubmitButton idleLabel="Link senden" pendingLabel="Wird versendet..." />
      </form>
    </AuthPanel>
  );
}