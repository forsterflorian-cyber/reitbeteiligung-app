import type { ReactNode } from "react";

import { cx } from "@/lib/cx";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ actions, className, subtitle, title }: PageHeaderProps) {
  return (
    <div className={cx("space-y-4", className)}>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">{title}</h1>
        {subtitle ? <p className="max-w-3xl text-sm leading-6 text-stone-600 sm:text-base">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">{actions}</div> : null}
    </div>
  );
}
