import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { cx } from "@/lib/cx";

type AuthPanelProps = {
  children: ReactNode;
  eyebrow: string;
  title: string;
  subtitle: string;
  footer?: ReactNode;
  bodyClassName?: string;
  className?: string;
};

// Shared auth shell keeps all entry flows on the same surface treatment
// instead of repeating page-specific card wrappers and header spacing.
export function AuthPanel({ bodyClassName, children, className, eyebrow, footer, subtitle, title }: AuthPanelProps) {
  return (
    <div className={cx("mx-auto w-full max-w-xl", className)}>
      <Card className="p-5 sm:p-6">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-clay">{eyebrow}</p>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">{title}</h1>
          <p className="text-sm leading-6 text-stone-600 sm:text-base">{subtitle}</p>
        </div>
        <div className={cx("mt-5 space-y-5", bodyClassName)}>{children}</div>
        {footer ? <div className="mt-5 border-t border-stone-200 pt-4">{footer}</div> : null}
      </Card>
    </div>
  );
}