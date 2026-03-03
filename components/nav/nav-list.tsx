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

export function NavList({ items, variant }: NavListProps) {
  const pathname = usePathname();

  return (
    <>
      {items.map((item) => {
        const active = isNavItemActive(item, pathname);
        const label = variant === "bottom" ? item.mobileLabel ?? item.label : item.label;
        const badgeText = item.badgeCount ? (item.badgeCount > 9 ? "9+" : String(item.badgeCount)) : null;

        if (variant === "bottom") {
          return (
            <Link
              className={cx(
                "relative inline-flex min-h-[56px] items-center justify-center rounded-xl px-2 text-center text-[11px] font-semibold leading-tight",
                active ? "bg-forest text-white shadow-sm" : "text-stone-500"
              )}
              href={item.href}
              key={`${item.href}-${label}`}
            >
              <span className="block max-w-[4.5rem] whitespace-normal break-words">{label}</span>
              {badgeText ? (
                <span className="absolute right-1.5 top-1.5 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-clay px-1 text-[10px] font-bold leading-none text-white">
                  {badgeText}
                </span>
              ) : null}
            </Link>
          );
        }

        return (
          <Link
            className={cx(
              "inline-flex min-h-[44px] items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition",
              active ? "bg-sand text-forest" : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
            )}
            href={item.href}
            key={`${item.href}-${label}`}
          >
            <span>{label}</span>
            {badgeText ? (
              <span className="inline-flex min-w-[1.35rem] items-center justify-center rounded-full bg-clay px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                {badgeText}
              </span>
            ) : null}
          </Link>
        );
      })}
    </>
  );
}
