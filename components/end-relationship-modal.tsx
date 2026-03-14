"use client";

import { useState } from "react";

import { buttonVariants } from "@/components/ui/button";

type EndRelationshipModalProps = {
  action: (formData: FormData) => Promise<void>;
  hiddenFields: Record<string, string>;
  /** Context-specific description shown inside the modal. */
  description: string;
};

export function EndRelationshipModal({ action, description, hiddenFields }: EndRelationshipModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  function close() {
    setIsOpen(false);
  }

  return (
    <>
      <button
        className={buttonVariants("secondary", "w-full border-rose-300 text-rose-700 hover:border-rose-400 hover:bg-rose-50 hover:text-rose-700 sm:w-auto")}
        onClick={() => setIsOpen(true)}
        type="button"
      >
        Reitbeteiligung beenden
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          {/* Backdrop */}
          <div aria-hidden="true" className="fixed inset-0 bg-black/40" onClick={close} />

          {/* Dialog */}
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl">
            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-rose-700">Reitbeteiligung beenden</h2>
                <p className="text-sm text-stone-600">{description}</p>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-800">
                Zukünftige Buchungen müssen vorher storniert werden. Vergangene Buchungen und Chatverläufe bleiben erhalten.
              </div>

              <form action={action} className="space-y-4" onSubmit={close}>
                {Object.entries(hiddenFields).map(([name, value]) => (
                  <input key={name} name={name} type="hidden" value={value} />
                ))}

                <div className="flex gap-3">
                  <button className={buttonVariants("ghost", "flex-1")} onClick={close} type="button">
                    Abbrechen
                  </button>
                  <button
                    className={buttonVariants("secondary", "flex-1 border-rose-300 text-rose-700 hover:border-rose-400 hover:bg-rose-50 hover:text-rose-700")}
                    type="submit"
                  >
                    Verbindlich beenden
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
