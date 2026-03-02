import { logoutAction } from "@/app/actions";

import { SubmitButton } from "@/components/submit-button";

export function LogoutForm() {
  return (
    <form action={logoutAction}>
      <SubmitButton
        className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold text-ink hover:border-forest hover:text-forest md:w-auto"
        idleLabel="Abmelden"
        pendingLabel="Wird abgemeldet..."
      />
    </form>
  );
}
