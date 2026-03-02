"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Profile } from "@/types/database";

type MobileNavProps = {
  profile?: Profile | null;
};

type NavItem = {
  href: Route;
  label: string;
};

export function MobileNav({ profile }: MobileNavProps) {
  const pathname = usePathname();

  const items: NavItem[] = profile
    ? [
        { href: "/dashboard", label: "Start" },
        { href: "/suchen", label: "Suchen" },
        {
          href: profile.role === "owner" ? "/owner/horses" : "/suchen",
          label: profile.role === "owner" ? "Inserat" : "Pferdeprofil"
        },
        { href: profile.role === "owner" ? "/owner/anfragen" : "/anfragen", label: "Anfragen" },
        { href: "/profil", label: "Profil" }
      ]
    : [
        { href: "/", label: "Start" },
        { href: "/suchen", label: "Suchen" },
        { href: "/login", label: "Inserat" },
        { href: "/login", label: "Anfragen" },
        { href: "/login", label: "Profil" }
      ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-stone-200 bg-white/95 shadow-[0_-10px_30px_rgba(31,41,55,0.08)] md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1 px-2 pb-[calc(env(safe-area-inset-bottom)+0.4rem)] pt-2 sm:max-w-lg">
        {items.map((item, index) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          const key = `${item.href}-${index}`;

          return (
            <Link
              className={`inline-flex min-h-[52px] items-center justify-center rounded-2xl px-2 text-center text-[11px] font-semibold leading-tight ${
                active ? "bg-forest text-white" : "bg-sand text-stone-600"
              }`}
              href={item.href}
              key={key}
            >
              <span className="block max-w-[4.1rem] whitespace-normal break-words">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
