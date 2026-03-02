import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export function LandingHero() {
  return (
    <section className="grid gap-8 py-2 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] lg:items-center lg:gap-10 lg:py-4">
      <div className="space-y-6">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">Reitbeteiligung.app</p>
        <div className="space-y-4">
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
            Reitbeteiligungen strukturiert organisieren.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-stone-600 sm:text-lg">
            Probetermine, Freischaltungen und Terminbuchung - klarer Ablauf statt Nachrichten-Chaos.
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
          <Badge tone="neutral">Kontaktdaten erst nach Freischaltung</Badge>
          <Badge tone="neutral">Chat vor Approval intern</Badge>
          <Badge tone="neutral">Mobil optimiert</Badge>
        </div>
      </div>
      <Card className="overflow-hidden">
        <div className="border-b border-stone-200 bg-stone-50 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-stone-900">Apollo</p>
              <p className="text-xs text-stone-500">Pferdeprofil mit klaren Schritten</p>
            </div>
            <Badge tone="approved">Freigegeben</Badge>
          </div>
        </div>
        <div className="space-y-4 p-5 sm:p-6">
          <div className="rounded-2xl bg-stone-100 p-4">
            <p className="text-sm font-semibold text-stone-900">Naechster Probetermin</p>
            <p className="mt-2 text-sm text-stone-600">Mittwoch, 18:00 bis 19:00 Uhr</p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-2xl border border-stone-200 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-stone-900">01 Probetermin</p>
                <p className="text-xs text-stone-500">Anfrage mit kurzer Nachricht</p>
              </div>
              <Badge tone="pending">Ausstehend</Badge>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-stone-200 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-stone-900">02 Freischaltung</p>
                <p className="text-xs text-stone-500">Kontaktdaten erst danach</p>
              </div>
              <Badge tone="approved">Freigeschaltet</Badge>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-stone-200 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-stone-900">03 Terminbuchung</p>
                <p className="text-xs text-stone-500">Verfuegbarkeiten direkt im Blick</p>
              </div>
              <Badge tone="info">Planbar</Badge>
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}
