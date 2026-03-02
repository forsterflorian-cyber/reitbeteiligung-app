import type { HTMLAttributes, ReactNode } from "react";

import { cx } from "@/lib/cx";
import type { StatusTone } from "@/lib/status-display";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: StatusTone;
  children: ReactNode;
};

const toneClassNames: Record<StatusTone, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
  info: "bg-sky-100 text-sky-700",
  neutral: "bg-stone-100 text-stone-700"
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
