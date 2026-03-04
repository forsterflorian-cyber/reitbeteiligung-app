import Link from "next/link";

import { HeroVisual } from "@/components/landing/HeroVisual";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

function TrustChip({ label }: { label: string }) {
  return (
    <div className="inline-flex min-h-[44px] items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100">
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-clay" />
      </span>
      <span className="text-sm font-medium text-stone-700">{label}</span>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden py-4 sm:py-6">
      <div className="pointer-events-none absolute inset-x-0 top-6 h-56 bg-[radial-gradient(circle_at_20%_20%,rgba(214,211,209,0.42),transparent_55%),radial-gradient(circle_at_85%_30%,rgba(16,185,129,0.08),transparent_45%)]" />
      <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] lg:items-center">
        <div className="space-y-6">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">Reitbeteiligung.app</p>
            <h1 className="max-w-3xl font-serif text-4xl leading-tight text-stone-900 sm:text-5xl lg:text-6xl">
              Reitbeteiligungen strukturiert organisieren.
            </h1>
            <p className="max-w-2xl text-base leading-8 text-stone-600 sm:text-lg">
              Probetermine, Freischaltungen und Plattform-Chats - klarer Ablauf statt Nachrichten-Chaos.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link className={buttonVariants("primary", "w-full sm:w-auto")} href="/signup">
              Konto erstellen
            </Link>
            <Link className={buttonVariants("secondary", "w-full sm:w-auto")} href="/login">
              Anmelden
            </Link>
          </div>

          <div className="flex flex-wrap gap-2">
            <TrustChip label="Kontaktdaten erst nach Freischaltung" />
            <TrustChip label="Chat vor Freischaltung nur intern" />
            <TrustChip label="Mobil optimiert" />
          </div>

          <div className="flex flex-wrap gap-2 text-sm text-stone-600">
            <Badge tone="neutral">Für Pferdehalter</Badge>
            <Badge tone="neutral">Für Reiter</Badge>
          </div>
        </div>
        <HeroVisual />
      </div>
    </section>
  );
}