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
    <div className={cx("relative isolate overflow-hidden rounded-[2rem] border border-stone-200/80 bg-white/35 p-3 shadow-sm backdrop-blur-[1px] sm:p-4", className)}>
      <Backdrop variant="section" />
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-forest/25 to-transparent" />
      <div className={cx("relative z-10 space-y-6 sm:space-y-8", contentClassName)}>{children}</div>
    </div>
  );
}
