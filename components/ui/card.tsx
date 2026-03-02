import type { HTMLAttributes } from "react";

import { cx } from "@/lib/cx";

// Card is the core surface primitive for the warm, premium layout language.
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("surface-panel", className)} {...props} />;
}