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
    href: "/suchen" as Route,
    label: "Pferde finden",
    match: ["/suchen", "/pferde"],
    mobileLabel: "Finden"
  },
  {
    href: "/anfragen" as Route,
    label: "Proben & Planung",
    match: ["/anfragen", "/chat"],
    mobileLabel: "Planen"
  },
  {
    href: "/profil" as Route,
    label: "Profil",
    match: ["/profil", "/rider/profile"]
  }
] as const satisfies readonly AppNavItem[];

const ownerNav = [
  {
    href: "/owner/horses" as Route,
    label: "Pferde anlegen",
    match: ["/owner/horses"],
    mobileLabel: "Neu"
  },
  {
    href: "/owner/anfragen" as Route,
    label: "Probetermine",
    match: ["/owner/anfragen", "/chat"],
    mobileLabel: "Proben"
  },
  {
    href: "/owner/pferde-verwalten" as Route,
    label: "Reitbeteiligungen",
    match: ["/owner/pferde-verwalten"],
    mobileLabel: "Verwalten"
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
