import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// The public landing nav is intentionally minimal: brand on the left,
// authentication CTAs on the right, no app-internal navigation noise.
export function LandingNav() {
  return (
    <header className="border-b border-stone-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-8">
        <div className="flex items-center gap-3">
          <Link className="text-base font-semibold text-emerald-800 sm:text-lg" href="/">
            reitbeteiligung.app
          </Link>
          <Badge className="uppercase tracking-[0.12em]" tone="info">
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
