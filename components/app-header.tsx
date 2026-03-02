import type { Route } from "next";
import Link from "next/link";

import type { Profile } from "@/types/database";

import { LogoutForm } from "@/components/logout-form";

type AppHeaderProps = {
  email?: string;
  profile?: Profile | null;
};

type NavItem = {
  href: Route;
  label: string;
};

export function AppHeader({ email, profile }: AppHeaderProps) {
  const primaryItems: NavItem[] = profile
    ? [
        { href: "/dashboard", label: "Übersicht" },
        { href: "/suchen", label: "Suchen" },
        {
          href: profile.role === "owner" ? "/owner/horses" : "/suchen",
          label: profile.role === "owner" ? "Inserat" : "Pferdeprofil"
        },
        { href: "/anfragen", label: "Anfragen" },
        { href: "/profil", label: "Profil" }
      ]
    : [
        { href: "/", label: "Start" },
        { href: "/suchen", label: "Suchen" },
        { href: "/signup", label: "Registrieren" },
        { href: "/login", label: "Anmelden" }
      ];

  return (
    <header className="border-b border-stone-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-2xl flex-col gap-3 px-4 py-4 sm:px-5 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <Link className="text-base font-semibold text-forest sm:text-lg" href="/">
            reitbeteiligung.app
          </Link>
          {email ? <span className="max-w-[12rem] truncate text-xs text-stone-500">{email}</span> : null}
        </div>
        <div className="hidden items-center justify-between gap-4 md:flex">
          <nav className="flex flex-wrap items-center gap-4 text-sm text-stone-600">
            {primaryItems.map((item) => (
              <Link className="hover:text-forest" href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
          {email ? <LogoutForm /> : null}
        </div>
      </div>
    </header>
  );
}
