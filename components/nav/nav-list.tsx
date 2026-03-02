"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { AppNavItem } from "@/config/nav";
import { isNavItemActive } from "@/config/nav";
import { cx } from "@/lib/cx";

type NavListProps = {
  items: readonly AppNavItem[];
  variant: "top" | "bottom";
};

// The client component owns the active-state calculation so both nav variants
// stay in sync and pages do not need custom pathname logic.
export function NavList({ items, variant }: NavListProps) {
  const pathname = usePathname();

  return (
    <>
      {items.map((item) => {
        const active = isNavItemActive(item, pathname);
        const label = variant === "bottom" ? item.mobileLabel ?? item.label : item.label;

        if (variant === "bottom") {
          return (
            <Link
              className={cx(
                "inline-flex min-h-[56px] items-center justify-center rounded-xl px-2 text-center text-[11px] font-semibold leading-tight",
                active ? "bg-emerald-700 text-white shadow-sm" : "text-stone-500"
              )}
              href={item.href}
              key={`${item.href}-${label}`}
            >
              <span className="block max-w-[4.5rem] whitespace-normal break-words">{label}</span>
            </Link>
          );
        }

        return (
          <Link
            className={cx(
              "inline-flex min-h-[44px] items-center rounded-xl px-3 py-2 text-sm font-semibold transition",
              active ? "bg-emerald-50 text-emerald-800" : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
            )}
            href={item.href}
            key={`${item.href}-${label}`}
          >
            {label}
          </Link>
        );
      })}
    </>
  );
}
