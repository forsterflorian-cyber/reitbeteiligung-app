import type { Route } from "next";
import Link from "next/link";

import type { StatusTone } from "@/lib/status-display";

import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type EntityCardProps = {
  title: string;
  subtitle: string;
  description?: string;
  statusLabel: string;
  statusTone?: StatusTone;
  href: Route;
  actionLabel: string;
  imageLabel?: string;
};

export function EntityCard({
  actionLabel,
  description,
  href,
  imageLabel,
  statusLabel,
  statusTone = "neutral",
  subtitle,
  title
}: EntityCardProps) {
  const placeholderLabel = (imageLabel ?? title).slice(0, 2).toUpperCase();

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-stone-100 text-sm font-semibold text-stone-600">
            {placeholderLabel}
          </div>
          <div className="space-y-2">
            <div className="space-y-1">
              <p className="font-semibold text-stone-900">{title}</p>
              <p className="text-sm text-stone-600">{subtitle}</p>
            </div>
            {description ? <p className="max-w-xl text-sm leading-6 text-stone-600">{description}</p> : null}
            <Badge tone={statusTone}>{statusLabel}</Badge>
          </div>
        </div>
        <Link className={buttonVariants("secondary", "w-full sm:w-auto")} href={href}>
          {actionLabel}
        </Link>
      </div>
    </Card>
  );
}
