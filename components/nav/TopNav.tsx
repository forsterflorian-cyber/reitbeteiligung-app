import Link from "next/link";

import type { Profile } from "@/types/database";

import { LandingNav } from "@/components/landing/LandingNav";
import { LogoutForm } from "@/components/logout-form";
import { NavList } from "@/components/nav/nav-list";
import { Badge } from "@/components/ui/badge";
import { BrandMark } from "@/components/ui/brand-mark";
import { getNavItems } from "@/config/nav";
import { getProfileDisplayName, getRoleLabel } from "@/lib/profiles";

type TopNavProps = {
  email?: string | null;
  profile?: Profile | null;
  unreadMessages?: number;
  unreadNotifications?: number;
};

export function TopNav({ email, profile, unreadMessages = 0, unreadNotifications = 0 }: TopNavProps) {
  if (!profile) {
    return <LandingNav />;
  }

  const items = getNavItems(profile, { unreadMessages });
  const displayName = getProfileDisplayName(profile, email);
  const roleLabel = getRoleLabel(profile.role);
  const unreadLabel = unreadMessages === 1 ? "1 neue Nachricht" : `${unreadMessages} neue Nachrichten`;
  const notifLabel = unreadNotifications === 1 ? "1 Benachrichtigung" : `${unreadNotifications} Benachrichtigungen`;

  return (
    <header className="relative border-b border-stone-200/80 bg-white/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/90">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-forest/35 to-transparent" />
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-5 lg:px-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <Link className="inline-flex" href="/">
              <BrandMark compact />
            </Link>
            <div className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
              <Badge className="uppercase tracking-[0.14em]" tone="approved">
                {roleLabel}
              </Badge>
              {unreadMessages > 0 ? <Badge tone="info">{unreadLabel}</Badge> : null}
              {unreadNotifications > 0 ? (
                <Link href="/benachrichtigungen">
                  <Badge tone="pending">🔔 {notifLabel}</Badge>
                </Link>
              ) : null}
              <span className="truncate font-medium text-stone-700">{displayName}</span>
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
