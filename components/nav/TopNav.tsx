import Link from "next/link";

import type { Profile } from "@/types/database";

import { LandingNav } from "@/components/blocks/landing-nav";
import { LogoutForm } from "@/components/logout-form";
import { NavList } from "@/components/nav/nav-list";
import { getNavItems } from "@/config/nav";
import { getProfileDisplayName, getRoleLabel } from "@/lib/profiles";

type TopNavProps = {
  email?: string | null;
  profile?: Profile | null;
};

export function TopNav({ email, profile }: TopNavProps) {
  if (!profile) {
    return <LandingNav />;
  }

  const items = getNavItems(profile);
  const displayName = getProfileDisplayName(profile, email);
  const roleLabel = getRoleLabel(profile.role);

  return (
    <header className="border-b border-stone-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-5 lg:px-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <Link className="text-base font-semibold text-emerald-800 sm:text-lg" href="/">
              reitbeteiligung.app
            </Link>
            <div className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
              <span className="inline-flex min-h-[28px] items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-800">
                {roleLabel}
              </span>
              <span className="truncate">{displayName}</span>
            </div>
          </div>
          {email ? <span className="hidden max-w-[16rem] truncate pt-1 text-sm text-stone-500 lg:block">{email}</span> : null}
        </div>
        <div className="hidden items-center justify-between gap-6 md:flex">
          <nav className="flex flex-wrap items-center gap-1 lg:gap-2">
            <NavList items={items} variant="top" />
          </nav>
          <LogoutForm />
        </div>
      </div>
    </header>
  );
}
