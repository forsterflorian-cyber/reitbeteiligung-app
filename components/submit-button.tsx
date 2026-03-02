"use client";

import { useFormStatus } from "react-dom";

type SubmitButtonProps = {
  idleLabel: string;
  pendingLabel?: string;
  className?: string;
};

export function SubmitButton({ idleLabel, pendingLabel, className }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      className={
        className ??
        "inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl bg-forest px-5 py-3 text-base font-semibold text-white hover:bg-forest/90 disabled:cursor-not-allowed disabled:opacity-70"
      }
      disabled={pending}
      type="submit"
    >
      {pending ? pendingLabel ?? "Wird gespeichert..." : idleLabel}
    </button>
  );
}
