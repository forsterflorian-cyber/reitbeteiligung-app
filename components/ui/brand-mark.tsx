import type { HTMLAttributes } from "react";

import { Badge } from "@/components/ui/badge";
import { cx } from "@/lib/cx";

type BrandMarkProps = HTMLAttributes<HTMLDivElement> & {
  compact?: boolean;
  showBeta?: boolean;
  subtitle?: string;
};

// Central brand lockup so landing, nav and headers all carry the same visual identity.
export function BrandMark({
  className,
  compact = false,
  showBeta = false,
  subtitle = "Organisation für Reitbeteiligungen",
  ...props
}: BrandMarkProps) {
  return (
    <div className={cx("flex min-w-0 items-center gap-3", className)} {...props}>
      <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-stone-300/90 bg-gradient-to-br from-sand via-white to-stone-100 text-sm font-semibold uppercase tracking-[0.18em] text-forest shadow-sm">
        <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(120,113,108,0.18),transparent_48%)]" />
        <span className="relative z-10">rb</span>
      </span>
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="truncate text-base font-semibold tracking-[-0.01em] text-stone-900 sm:text-lg">reitbeteiligung.app</span>
          {showBeta ? (
            <Badge className="uppercase tracking-[0.12em]" tone="neutral">
              beta
            </Badge>
          ) : null}
        </div>
        {!compact ? <p className="truncate text-[11px] uppercase tracking-[0.18em] text-stone-500">{subtitle}</p> : null}
      </div>
    </div>
  );
}
