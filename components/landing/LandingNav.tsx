"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { BrandMark } from "@/components/ui/brand-mark";

// The public landing nav stays deliberately slim: brand on the left,
// auth actions on the right, no app-internal navigation for guests.
export function LandingNav() {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  if (isLogin) {
    return (
      <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-stone-50/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-stone-50/90">
        <div className="mx-auto flex min-h-[72px] max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5 lg:px-8">
          <Link className="flex min-w-0 items-center gap-3" href="/">
            <Image alt="" aria-hidden className="h-9 w-9 shrink-0" height={36} priority src="/brand/logo-mark.svg" width={36} />
            <div className="min-w-0">
              <p className="truncate text-xl font-semibold tracking-[-0.01em] text-stone-900">
                <span className="sm:hidden">reitbeteiligung</span>
                <span className="hidden sm:inline">reitbeteiligung.app</span>
              </p>
              <p className="hidden text-xs uppercase tracking-[0.08em] text-stone-900/70 sm:block">
                Organisation für Reitbeteiligungen
              </p>
            </div>
          </Link>
          <div className="flex flex-wrap justify-end gap-2 sm:items-center sm:gap-3">
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
