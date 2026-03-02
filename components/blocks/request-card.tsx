import type { Route } from "next";
import Link from "next/link";

import { cx } from "@/lib/cx";
import type { DisplayableStatus } from "@/lib/status-display";

import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type RequestCardProps = {
  title: string;
  description: string;
  status: DisplayableStatus;
  meta?: string;
  eyebrow?: string;
  href?: Route;
  ctaLabel?: string;
  timeline?: boolean;
};

export function RequestCard({ ctaLabel, description, eyebrow, href, meta, status, timeline = false, title }: RequestCardProps) {
  return (
    <Card className={cx("p-4 sm:p-5", timeline ? "border-l-4 border-l-emerald-200" : undefined)}>
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">{eyebrow}</p> : null}
            <p className="font-semibold text-stone-900">{title}</p>
            {meta ? <p className="text-sm text-stone-500">{meta}</p> : null}
          </div>
          <StatusBadge status={status} />
        </div>
        <p className="text-sm leading-6 text-stone-600">{description}</p>
        {href && ctaLabel ? (
          <div>
            <Link className={buttonVariants("ghost", "justify-start px-0 py-0 text-sm font-semibold text-emerald-800 hover:bg-transparent")} href={href}>
              {ctaLabel}
            </Link>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
