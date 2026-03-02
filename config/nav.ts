import type { Route } from "next";

import type { Profile } from "@/types/database";

// A single nav item definition drives both the desktop top nav and the mobile tab bar.
// `match` contains exact prefixes that should mark the item as active.
export type AppNavItem = {
  href: Route;
  label: string;
  match: readonly string[];
  mobileLabel?: string;
};

const guestNav = [
  {
    href: "/" as Route,
    label: "Start",
    match: ["/"]
  },
  {
    href: "/suchen" as Route,
    label: "Suchen",
    match: ["/suchen", "/pferde"]
  },
  {
    href: "/signup" as Route,
    label: "Konto erstellen",
    match: ["/signup"],
    mobileLabel: "Konto"
  },
  {
    href: "/login" as Route,
    label: "Anmelden",
    match: ["/login", "/passwort-vergessen", "/passwort-zuruecksetzen"]
  }
] as const satisfies readonly AppNavItem[];

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
    match: ["/owner/pferde-verwalten", "/pferde"]
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
    return guestNav;
  }

  return profile.role === "owner" ? ownerNav : riderNav;
}

// Prefix matching keeps active states stable for detail pages like `/pferde/[id]`
// without duplicating ad-hoc pathname checks in multiple components.
export function isNavItemActive(item: AppNavItem, pathname: string) {
  return item.match.some((prefix) => {
    if (prefix === "/") {
      return pathname === "/";
    }

    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
}
