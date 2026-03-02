import type { Route } from "next";
import Link from "next/link";

import type { Profile } from "@/types/database";

import { LogoutForm } from "@/components/logout-form";
import { getProfileDisplayName, getRoleLabel } from "@/lib/profiles";

type AppHeaderProps = {
  email?: string;
  profile?: Profile | null;
};

type NavItem = {
  href: Route;
  label: string;
};

const guestItems = [
  { href: "/" as Route, label: "Start" },
  { href: "/suchen" as Route, label: "Suchen" },
  { href: "/signup" as Route, label: "Registrieren" },
  { href: "/login" as Route, label: "Anmelden" }
] as const satisfies readonly NavItem[];

const riderItems = [
  { href: "/dashboard" as Route, label: "Übersicht" },
  { href: "/suchen" as Route, label: "Suchen" },
  { href: "/anfragen" as Route, label: "Anfragen" },
  { href: "/profil" as Route, label: "Profil" }
] as const satisfies readonly NavItem[];

const ownerItems = [
  { href: "/dashboard" as Route, label: "Übersicht" },
  { href: "/owner/horses" as Route, label: "Pferde verwalten" },
  { href: "/owner/anfragen" as Route, label: "Anfragen" },
  { href: "/profil" as Route, label: "Profil" }
] as const satisfies readonly NavItem[];

export function AppHeader({ email, profile }: AppHeaderProps) {
  const primaryItems = profile ? (profile.role === "owner" ? ownerItems : riderItems) : guestItems;
  const roleLabel = profile ? getRoleLabel(profile.role) : null;
  const displayName = profile ? getProfileDisplayName(profile, email) : null;

  return (
    <header className="border-b border-stone-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-2xl flex-col gap-3 px-4 py-4 sm:px-5 md:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <Link className="text-base font-semibold text-forest sm:text-lg" href="/">
              reitbeteiligung.app
            </Link>
            {profile ? <p className="text-xs font-semibold uppercase tracking-[0.14em] text-clay">{roleLabel}</p> : null}
            {profile ? <p className="text-sm text-stone-600">{displayName}</p> : null}
          </div>
          {email ? <span className="max-w-[12rem] truncate pt-1 text-xs text-stone-500">{email}</span> : null}
        </div>
        <div className="hidden items-center justify-between gap-4 md:flex">
          <nav className="flex flex-wrap items-center gap-4 text-sm text-stone-600">
            {primaryItems.map((item) => (
              <Link className="hover:text-forest" href={item.href} key={`${item.href}-${item.label}`}>
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