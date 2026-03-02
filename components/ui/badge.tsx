import type { HTMLAttributes, ReactNode } from "react";

import { cx } from "@/lib/cx";
import type { StatusTone } from "@/lib/status-display";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: StatusTone;
  children: ReactNode;
};

const toneClassNames: Record<StatusTone, string> = {
  pending: "border border-amber-200 bg-amber-50 text-amber-800",
  approved: "border border-stone-200 bg-sand text-forest",
  rejected: "border border-rose-200 bg-rose-50 text-rose-700",
  info: "border border-stone-200 bg-stone-100 text-ink",
  neutral: "border border-stone-200 bg-white text-stone-700"
};

export function Badge({ children, className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cx("inline-flex min-h-[28px] items-center rounded-full px-3 py-1 text-xs font-semibold", toneClassNames[tone], className)}
      {...props}
    >
      {children}
    </span>
  );
}