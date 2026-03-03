import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { BrandMark } from "@/components/ui/brand-mark";

// The public landing nav stays deliberately slim: brand on the left,
// auth actions on the right, no app-internal navigation for guests.
export function LandingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-stone-50/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-stone-50/90">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-8">
        <Link className="block" href="/">
          <BrandMark showBeta />
        </Link>
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
