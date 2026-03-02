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

const guestItems = [
  { href: "/" as Route, label: "Start" },
  { href: "/suchen" as Route, label: "Suchen" },
  { href: "/login" as Route, label: "Inserat" },
  { href: "/login" as Route, label: "Anfragen" },
  { href: "/login" as Route, label: "Profil" }
] as const satisfies readonly NavItem[];

const riderItems = [
  { href: "/dashboard" as Route, label: "Start" },
  { href: "/suchen" as Route, label: "Suchen" },
  { href: "/anfragen" as Route, label: "Anfragen" },
  { href: "/profil" as Route, label: "Profil" },
  { href: "/" as Route, label: "Home" }
] as const satisfies readonly NavItem[];

const ownerItems = [
  { href: "/" as Route, label: "Start" },
  { href: "/dashboard" as Route, label: "Übersicht" },
  { href: "/owner/horses" as Route, label: "Pferde" },
  { href: "/owner/anfragen" as Route, label: "Anfragen" },
  { href: "/profil" as Route, label: "Profil" }
] as const satisfies readonly NavItem[];

export function MobileNav({ profile }: MobileNavProps) {
  const pathname = usePathname();

  const items = profile ? (profile.role === "owner" ? ownerItems : riderItems) : guestItems;

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