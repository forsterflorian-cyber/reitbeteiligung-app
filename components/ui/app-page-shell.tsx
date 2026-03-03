import type { ReactNode } from "react";

import { cx } from "@/lib/cx";

import { Backdrop } from "@/components/ui/backdrop";

type AppPageShellProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function AppPageShell({ children, className, contentClassName }: AppPageShellProps) {
  return (
    <div className={cx("relative isolate overflow-hidden rounded-[2rem] border border-stone-200/80 bg-white/55 p-3 shadow-sm backdrop-blur-[1px] sm:p-4", className)}>
      <Backdrop variant="section" />
      <Backdrop className="!inset-x-0 !top-0 !bottom-auto !h-44 sm:!h-56 lg:!h-64" variant="hero" />
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-forest/30 to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 rounded-full bg-forest/6 blur-3xl" />
      <div className={cx("relative z-10 space-y-6 sm:space-y-8", contentClassName)}>{children}</div>
    </div>
  );
}
