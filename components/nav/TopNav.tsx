import Link from "next/link";

import type { Profile } from "@/types/database";

import { getNavItems } from "@/config/nav";
import { LogoutForm } from "@/components/logout-form";
import { NavList } from "@/components/nav/nav-list";
import { buttonVariants } from "@/components/ui/button";
import { getProfileDisplayName, getRoleLabel } from "@/lib/profiles";

type TopNavProps = {
  email?: string | null;
  profile?: Profile | null;
};

export function TopNav({ email, profile }: TopNavProps) {
  const items = getNavItems(profile);
  // Guests already get dedicated CTA buttons on the right, so the top nav keeps
  // only the informational links there and avoids duplicate auth actions.
  const topItems = email ? items : items.filter((item) => item.href === "/" || item.href === "/suchen");
  const displayName = profile ? getProfileDisplayName(profile, email) : null;
  const roleLabel = profile ? getRoleLabel(profile.role) : null;

  return (
    <header className="border-b border-stone-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-5 lg:px-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <Link className="text-base font-semibold text-emerald-800 sm:text-lg" href="/">
              reitbeteiligung.app
            </Link>
            {profile ? (
              <div className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
                <span className="inline-flex min-h-[28px] items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-800">
                  {roleLabel}
                </span>
                <span className="truncate">{displayName}</span>
              </div>
            ) : (
              <p className="max-w-2xl text-sm text-stone-600">Probetermine, Freischaltungen und Terminbuchungen fuer Pferdehalter und Reiter an einem Ort.</p>
            )}
          </div>
          {email ? <span className="hidden max-w-[16rem] truncate pt-1 text-sm text-stone-500 lg:block">{email}</span> : null}
        </div>
        <div className="hidden items-center justify-between gap-6 md:flex">
          <nav className="flex flex-wrap items-center gap-1 lg:gap-2">
            <NavList items={topItems} variant="top" />
          </nav>
          {email ? (
            <LogoutForm />
          ) : (
            <div className="flex items-center gap-2">
              <Link className={buttonVariants("ghost")} href="/login">
                Anmelden
              </Link>
              <Link className={buttonVariants("primary")} href="/signup">
                Konto erstellen
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
