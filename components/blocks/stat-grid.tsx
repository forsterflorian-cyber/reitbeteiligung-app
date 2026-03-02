import type { ReactNode } from "react";

import { cx } from "@/lib/cx";

import { Card } from "@/components/ui/card";

export type StatItem = {
  label: string;
  value: ReactNode;
  helper?: string;
  valueClassName?: string;
};

type StatGridProps = {
  items: readonly StatItem[];
  className?: string;
};

// StatGrid keeps KPI cards visually identical while pages only pass data.
export function StatGrid({ className, items }: StatGridProps) {
  return (
    <div className={cx("grid gap-4 md:grid-cols-2 xl:grid-cols-4", className)}>
      {items.map((item) => (
        <Card className="p-5 sm:p-6" key={item.label}>
          <p className="text-sm font-semibold text-stone-500">{item.label}</p>
          <div className={cx("mt-3 text-3xl font-semibold tracking-tight text-stone-900", item.valueClassName)}>{item.value}</div>
          {item.helper ? <p className="mt-2 text-sm leading-6 text-stone-600">{item.helper}</p> : null}
        </Card>
      ))}
    </div>
  );
}
