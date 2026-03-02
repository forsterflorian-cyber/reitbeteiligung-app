"use client";

import { useFormStatus } from "react-dom";

import { buttonVariants } from "@/components/ui/button";

type SubmitButtonProps = {
  idleLabel: string;
  pendingLabel?: string;
  className?: string;
};

export function SubmitButton({ idleLabel, pendingLabel, className }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      className={className ?? buttonVariants("primary", "w-full px-5 py-3 text-base")}
      disabled={pending}
      type="submit"
    >
      {pending ? pendingLabel ?? "Wird gespeichert..." : idleLabel}
    </button>
  );
}
