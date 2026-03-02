import type { Route } from "next";

import type { Profile } from "@/types/database";

export type AppNavItem = {
  href: Route;
  label: string;
  match: readonly string[];
  mobileLabel?: string;
};

const riderNav = [
  {
    href: "/dashboard" as Route,
    label: "Uebersicht",
    match: ["/dashboard"]
  },
  {
    href: "/suchen" as Route,
    label: "Suchen",
    match: ["/suchen", "/pferde"]
  },
  {
    href: "/anfragen" as Route,
    label: "Anfragen",
    match: ["/anfragen", "/chat"]
  },
  {
    href: "/profil" as Route,
    label: "Profil",
    match: ["/profil", "/rider/profile"]
  }
] as const satisfies readonly AppNavItem[];

const ownerNav = [
  {
    href: "/dashboard" as Route,
    label: "Uebersicht",
    match: ["/dashboard"]
  },
  {
    href: "/owner/horses" as Route,
    label: "Neues Pferd",
    match: ["/owner/horses"],
    mobileLabel: "Neu"
  },
  {
    href: "/owner/pferde-verwalten" as Route,
    label: "Pferde",
    match: ["/owner/pferde-verwalten"]
  },
  {
    href: "/owner/anfragen" as Route,
    label: "Anfragen",
    match: ["/owner/anfragen", "/chat"]
  },
  {
    href: "/profil" as Route,
    label: "Profil",
    match: ["/profil"]
  }
] as const satisfies readonly AppNavItem[];

export function getNavItems(profile?: Pick<Profile, "role"> | null) {
  if (!profile) {
    return [] as const;
  }

  return profile.role === "owner" ? ownerNav : riderNav;
}

// Prefix matching keeps active states stable for detail pages without scattering
// custom pathname checks across the nav components.
export function isNavItemActive(item: AppNavItem, pathname: string) {
  return item.match.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
