import type { Route } from "next";

import type { Profile } from "@/types/database";

export type AppNavItem = {
  badgeCount?: number;
  href: Route;
  label: string;
  match: readonly string[];
  mobileLabel?: string;
};

const riderNav = [
  {
    href: "/dashboard" as Route,
    label: "\u00dcbersicht",
    match: ["/dashboard"],
    mobileLabel: "Start"
  },
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
    href: "/owner/pferde-verwalten" as Route,
    label: "Pferde verwalten",
    match: ["/owner/pferde-verwalten", "/owner/horses"],
    mobileLabel: "Pferde"
  },
  {
    href: "/owner/anfragen" as Route,
    label: "Probetermine",
    match: ["/owner/anfragen"],
    mobileLabel: "Proben"
  },
  {
    href: "/owner/reitbeteiligungen" as Route,
    label: "Reitbeteiligungen",
    match: ["/owner/reitbeteiligungen"],
    mobileLabel: "Reiter"
  },
  {
    href: "/owner/nachrichten" as Route,
    label: "Nachrichten",
    match: ["/owner/nachrichten", "/chat"],
    mobileLabel: "Chat"
  },
  {
    href: "/profil" as Route,
    label: "Profil",
    match: ["/profil"]
  }
] as const satisfies readonly AppNavItem[];

export function getNavItems(profile?: Pick<Profile, "role"> | null, options?: { unreadMessages?: number }) {
  if (!profile) {
    return [] as AppNavItem[];
  }

  if (profile.role !== "owner") {
    return [...riderNav];
  }

  return ownerNav.map((item) => {
    if (item.href === "/owner/nachrichten" && options?.unreadMessages) {
      return {
        ...item,
        badgeCount: options.unreadMessages
      };
    }

    return { ...item };
  });
}

export function isNavItemActive(item: AppNavItem, pathname: string) {
  return item.match.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
