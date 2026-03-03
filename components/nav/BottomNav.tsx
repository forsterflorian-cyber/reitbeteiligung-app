import type { Profile } from "@/types/database";

import { NavList } from "@/components/nav/nav-list";
import { getNavItems } from "@/config/nav";

type BottomNavProps = {
  profile?: Profile | null;
  unreadMessages?: number;
};

export function BottomNav({ profile, unreadMessages = 0 }: BottomNavProps) {
  if (!profile) {
    return null;
  }

  const items = getNavItems(profile, { unreadMessages });

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-stone-200 bg-white/95 backdrop-blur md:hidden supports-[backdrop-filter]:bg-white/90">
      <div className="mx-auto grid max-w-md auto-cols-fr grid-flow-col gap-1 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 sm:max-w-lg">
        <NavList items={items} variant="bottom" />
      </div>
    </nav>
  );
}
