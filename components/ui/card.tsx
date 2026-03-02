import type { HTMLAttributes } from "react";

import { cx } from "@/lib/cx";

// Card is the core surface primitive for the warm, premium layout language.
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("rounded-2xl border border-stone-200 bg-white shadow-sm", className)} {...props} />;
}
