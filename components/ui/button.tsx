import type { ButtonHTMLAttributes } from "react";

import { cx } from "@/lib/cx";

export type ButtonVariant = "primary" | "secondary" | "ghost";

const baseClassName =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/20 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

const variantClassNames: Record<ButtonVariant, string> = {
  primary: "bg-emerald-700 text-white shadow-sm hover:bg-emerald-800",
  secondary: "border border-stone-300 bg-white text-stone-900 shadow-sm hover:border-emerald-700 hover:text-emerald-800",
  ghost: "bg-transparent text-stone-700 hover:bg-stone-100 hover:text-stone-900"
};

// Button styles live here so links, submit buttons and nav actions all share
// the same visual language instead of re-declaring class strings in pages.
export function buttonVariants(variant: ButtonVariant = "primary", className?: string) {
  return cx(baseClassName, variantClassNames[variant], className);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function Button({ className, type = "button", variant = "primary", ...props }: ButtonProps) {
  return <button className={buttonVariants(variant, className)} type={type} {...props} />;
}
