import type { Route } from "next";
import Link from "next/link";

import { Notice } from "@/components/notice";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";

type HorseCalendarRestrictedStateProps = {
  detailHref: Route;
  error?: string | null;
  isAuthenticated: boolean;
  message?: string | null;
  showLoadError: boolean;
  subtitle: string;
  title: string;
};

export function HorseCalendarRestrictedState({
  detailHref,
  error,
  isAuthenticated,
  message,
  showLoadError,
  subtitle,
  title
}: HorseCalendarRestrictedStateProps) {
  return (
    <div className="space-y-6 sm:space-y-8">
      <Link
        className={buttonVariants(
          "ghost",
          "min-h-0 justify-start px-0 py-0 text-sm font-semibold text-forest hover:bg-transparent hover:text-clay"
        )}
        href={detailHref}
      >
        {"Zur\u00fcck zum Pferdeprofil"}
      </Link>

      <PageHeader
        subtitle={"Kalender, Verf\u00fcgbarkeiten und Terminanfragen auf einen Blick."}
        title={title}
      />

      <div className="space-y-3" id="kalender-feedback">
        <Notice text={error} tone="error" />
        <Notice text={message} tone="success" />
        {showLoadError ? <Notice text="Der Kalender konnte nicht geladen werden." tone="error" /> : null}
      </div>

      <SectionCard subtitle={subtitle} title={isAuthenticated ? "Kalender erst nach Freischaltung" : "Kalender nutzen"}>
        {isAuthenticated ? (
          <Link className={buttonVariants("secondary", "w-full sm:w-auto")} href={detailHref}>
            {"Zur\u00fcck zum Pferdeprofil"}
          </Link>
        ) : (
          <Link className={buttonVariants("primary", "w-full sm:w-auto")} href="/login">
            Anmelden, um den Kalender zu nutzen
          </Link>
        )}
      </SectionCard>
    </div>
  );
}
