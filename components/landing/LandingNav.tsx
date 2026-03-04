import Image from "next/image";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

// The public landing nav stays deliberately slim: brand on the left,
// auth actions on the right, no app-internal navigation for guests.
export function LandingNav() {
  const brandLink = (
    <Link className="header-left flex min-w-0 items-center" href="/">
      <Image
        alt=""
        aria-hidden
        className="block h-9 w-auto shrink-0 sm:hidden"
        height={36}
        priority
        src="/brand/logo-mark.svg"
        width={29}
      />
      <Image
        alt="reitbeteiligung.app"
        className="hidden h-9 w-auto shrink-0 sm:block"
        height={36}
        priority
        src="/brand/logo.svg"
        width={162}
      />
    </Link>
  );


  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-stone-50/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-stone-50/90">
      <div className="mx-auto flex min-h-[72px] max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5 lg:px-8">
        {brandLink}
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
