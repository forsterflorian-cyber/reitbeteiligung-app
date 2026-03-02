import Link from "next/link";
import { redirect } from "next/navigation";

import { getPostAuthDestination } from "@/lib/auth";

export default async function HomePage() {
  const postAuthDestination = await getPostAuthDestination();

  if (postAuthDestination) {
    redirect(postAuthDestination);
  }

  return (
    <section className="space-y-5">
      <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-clay">Reitbeteiligung.app</p>
          <h1 className="text-3xl font-semibold text-forest sm:text-4xl">Reitbeteiligungen einfach organisieren</h1>
          <p className="text-base text-stone-600">
            Registriere dich als Pferdehalter oder Reiter und verwalte Probetermine, Freischaltungen und Anfragen in einer klaren Uebersicht.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-forest px-5 py-3 text-base font-semibold text-white hover:bg-forest/90 sm:w-auto" href="/signup">
            Konto erstellen
          </Link>
          <Link className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-stone-300 px-5 py-3 text-base font-semibold text-ink hover:border-forest hover:text-forest sm:w-auto" href="/login">
            Anmelden
          </Link>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-ink">Fuer Pferdehalter</h2>
          <p className="mt-2 text-sm text-stone-600">Lege Pferdeprofile an, bearbeite Anfragen und halte deine Termine im Blick.</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-ink">Fuer Reiter</h2>
          <p className="mt-2 text-sm text-stone-600">Finde passende Pferde, frage Probetermine an und bleibe mit Pferdehaltern im Austausch.</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-ink">Auf Desktop und Mobil</h2>
          <p className="mt-2 text-sm text-stone-600">Die Oberflaeche bleibt mobil bedienbar, bietet aber auch auf groesseren Bildschirmen mehr Platz fuer Verwaltung und Listen.</p>
        </div>
      </div>
    </section>
  );
}