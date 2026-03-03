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
    <div className={cx("relative isolate overflow-hidden rounded-3xl", className)}>
      <Backdrop variant="section" />
      <div className={cx("relative z-10 space-y-6 sm:space-y-8", contentClassName)}>{children}</div>
    </div>
  );
}