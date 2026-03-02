"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import { Notice } from "@/components/notice";
import { createClient } from "@/lib/supabase/client";

type FormState = "checking" | "ready" | "saving";

export function PasswordResetForm() {
  const [status, setStatus] = useState<FormState>("checking");
  const [canReset, setCanReset] = useState(false);
  const [message, setMessage] = useState<string | null>("Wir pruefen deinen Link...");
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    let active = true;

    async function initializeRecovery() {
      const supabase = createClient();
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get("code");
      const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
      const hashParams = new URLSearchParams(hash);

      try {
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            throw exchangeError;
          }

          window.history.replaceState({}, "", "/passwort-zuruecksetzen");
        } else if (hashParams.get("type") === "recovery") {
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");

          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });

            if (sessionError) {
              throw sessionError;
            }

            window.history.replaceState({}, "", "/passwort-zuruecksetzen");
          }
        }

        const {
          data: { session },
          error: getSessionError
        } = await supabase.auth.getSession();

        if (getSessionError || !session) {
          throw getSessionError ?? new Error("Missing recovery session");
        }

        if (!active) {
          return;
        }

        setCanReset(true);
        setError(null);
        setMessage("Du kannst jetzt ein neues Passwort setzen.");
        setStatus("ready");
      } catch {
        if (!active) {
          return;
        }

        setCanReset(false);
        setError("Der Link ist ungueltig oder abgelaufen. Bitte fordere einen neuen Link an.");
        setMessage(null);
        setStatus("ready");
      }
    }

    initializeRecovery();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canReset) {
      return;
    }

    if (password.length < 8) {
      setError("Bitte verwende mindestens 8 Zeichen.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Die Passwoerter stimmen nicht ueberein.");
      return;
    }

    setStatus("saving");
    setError(null);
    setMessage("Passwort wird aktualisiert...");

    const supabase = createClient();
    const {
      data: { session },
      error: sessionError
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      setCanReset(false);
      setStatus("ready");
      setMessage(null);
      setError("Die Sitzung zum Zuruecksetzen ist nicht mehr gueltig. Bitte fordere einen neuen Link an.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password
    });

    if (updateError) {
      setStatus("ready");
      setMessage(null);
      setError("Das Passwort konnte nicht aktualisiert werden. Bitte versuche es erneut.");
      return;
    }

    await supabase.auth.signOut();
    window.location.replace(`/login?message=${encodeURIComponent("Passwort aktualisiert. Bitte neu anmelden.")}`);
  }

  const isDisabled = status !== "ready" || !canReset;
  const messageTone = status === "checking" ? "neutral" : "success";

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-clay">Passwort zuruecksetzen</p>
        <h1 className="text-3xl font-semibold text-forest">Neues Passwort festlegen</h1>
        <p className="text-sm text-stone-600">Oeffne den Link aus deiner E-Mail auf diesem Geraet und waehle dann ein neues Passwort.</p>
      </div>
      <Notice text={error} tone="error" />
      <Notice text={message} tone={messageTone} />
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="password">Neues Passwort</label>
          <input
            autoComplete="new-password"
            id="password"
            minLength={8}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </div>
        <div>
          <label htmlFor="confirmPassword">Passwort bestaetigen</label>
          <input
            autoComplete="new-password"
            id="confirmPassword"
            minLength={8}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            type="password"
            value={confirmPassword}
          />
        </div>
        <button
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl bg-forest px-5 py-3 text-base font-semibold text-white hover:bg-forest/90 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isDisabled}
          type="submit"
        >
          {status === "saving" ? "Wird aktualisiert..." : "Passwort speichern"}
        </button>
      </form>
      <Link className="inline-flex min-h-[44px] items-center text-sm font-semibold text-forest hover:text-clay" href="/passwort-vergessen">
        Neuen Link anfordern
      </Link>
    </div>
  );
}
