"use client";

import { useFormStatus } from "react-dom";
import type { MouseEvent } from "react";

type ConfirmSubmitButtonProps = {
  idleLabel: string;
  confirmMessage: string;
  pendingLabel?: string;
  className?: string;
};

export function ConfirmSubmitButton({
  idleLabel,
  confirmMessage,
  pendingLabel,
  className
}: ConfirmSubmitButtonProps) {
  const { pending } = useFormStatus();

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (pending) {
      return;
    }

    if (!window.confirm(confirmMessage)) {
      event.preventDefault();
    }
  };

  return (
    <button
      className={
        className ??
        "inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-rose-300 bg-white px-5 py-3 text-base font-semibold text-rose-700 hover:border-rose-400 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-70"
      }
      disabled={pending}
      onClick={handleClick}
      type="submit"
    >
      {pending ? pendingLabel ?? "Wird gelöscht..." : idleLabel}
    </button>
  );
}
