import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

// The public landing nav stays deliberately slim: brand on the left,
// auth actions on the right, no app-internal navigation for guests.
export function LandingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-stone-50/95 backdrop-blur supports-[backdrop-filter]:bg-stone-50/90">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-8">
        <div className="flex items-center gap-3">
          <Link className="text-base font-semibold text-stone-900 sm:text-lg" href="/">
            reitbeteiligung.app
          </Link>
          <Badge className="uppercase tracking-[0.12em]" tone="neutral">
            beta
          </Badge>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link className={buttonVariants("ghost")} href="/login">
            Anmelden
          </Link>
          <Link className={buttonVariants("primary")} href="/signup">
            Konto erstellen
          </Link>
        </div>
      </div>
    </header>
  );
}

