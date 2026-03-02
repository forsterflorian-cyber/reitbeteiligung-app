import type { Profile } from "@/types/database";

import { getNavItems } from "@/config/nav";
import { NavList } from "@/components/nav/nav-list";

type BottomNavProps = {
  profile?: Profile | null;
};

export function BottomNav({ profile }: BottomNavProps) {
  const items = getNavItems(profile);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-stone-200 bg-white/95 backdrop-blur md:hidden supports-[backdrop-filter]:bg-white/90">
      {/* The mobile tab bar is kept small and fixed, so only role-relevant shortcuts stay here. */}
      <div className="mx-auto grid max-w-md auto-cols-fr grid-flow-col gap-1 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 sm:max-w-lg">
        <NavList items={items} variant="bottom" />
      </div>
    </nav>
  );
}
