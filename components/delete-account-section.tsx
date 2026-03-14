"use client";

import { useState } from "react";

import { buttonVariants } from "@/components/ui/button";

const CONFIRM_WORD = "LOESCHEN";

type DeleteAccountSectionProps = {
  action: (formData: FormData) => Promise<void>;
  blockerHint: string;
};

export function DeleteAccountSection({ action, blockerHint }: DeleteAccountSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const canSubmit = confirmText === CONFIRM_WORD;

  function close() {
    setIsOpen(false);
    setConfirmText("");
  }

  return (
    <>
      <button
        className={buttonVariants("secondary", "w-full border-rose-300 text-rose-700 hover:border-rose-400 hover:bg-rose-50 hover:text-rose-700 sm:w-auto")}
        onClick={() => setIsOpen(true)}
        type="button"
      >
        Konto loeschen
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          {/* Backdrop */}
          <div
            aria-hidden="true"
            className="fixed inset-0 bg-black/40"
            onClick={close}
          />

          {/* Dialog */}
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl">
            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-rose-700">Konto unwiderruflich loeschen</h2>
                <p className="text-sm text-stone-600">
                  Dein Konto, dein Profil und alle dazugehoerigen Daten werden dauerhaft geloescht.
                  Diese Aktion kann nicht rueckgaengig gemacht werden.
                </p>
              </div>

              {blockerHint ? (
                <div className="rounded-xl border border-stone-200 bg-stone-50/80 px-4 py-3 text-sm text-stone-600">
                  {blockerHint}
                </div>
              ) : null}

              <form action={action} className="space-y-4" onSubmit={close}>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                    Tippe <span className="font-bold text-rose-700">{CONFIRM_WORD}</span> zur Bestaetigung
                  </label>
                  <input
                    autoComplete="off"
                    className="mt-2"
                    onChange={(e) => setConfirmText(e.currentTarget.value)}
                    placeholder={CONFIRM_WORD}
                    type="text"
                    value={confirmText}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    className={buttonVariants("ghost", "flex-1")}
                    onClick={close}
                    type="button"
                  >
                    Abbrechen
                  </button>
                  <button
                    className={buttonVariants("secondary", "flex-1 border-rose-300 text-rose-700 hover:border-rose-400 hover:bg-rose-50 hover:text-rose-700 disabled:pointer-events-none disabled:opacity-40")}
                    disabled={!canSubmit}
                    type="submit"
                  >
                    Konto loeschen
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
