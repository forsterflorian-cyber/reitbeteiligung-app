import type { ReactNode } from "react";

import { cx } from "@/lib/cx";

import { Card } from "@/components/ui/card";

type SectionCardProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

export function SectionCard({ action, bodyClassName, children, className, subtitle, title }: SectionCardProps) {
  return (
    <Card className={className}>
      <div className="flex flex-col gap-3 border-b border-stone-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h2 className="text-xl font-semibold text-stone-900">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-stone-600">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={cx("px-5 py-5 sm:px-6", bodyClassName)}>{children}</div>
    </Card>
  );
}
