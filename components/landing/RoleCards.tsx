import Link from "next/link";

import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

function RoleCard({
  bullets,
  ctaLabel,
  title
}: {
  bullets: readonly string[];
  ctaLabel: string;
  title: string;
}) {
  return (
    <Card className="p-6">
      <div className="space-y-5">
        <h3 className="font-serif text-3xl text-stone-900">{title}</h3>
        <ul className="space-y-3 text-sm leading-7 text-stone-600">
          {bullets.map((bullet) => (
            <li className="flex gap-3" key={bullet}>
              <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-emerald-800" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
        <Link className={buttonVariants("secondary", "w-full sm:w-auto")} href="/signup">
          {ctaLabel}
        </Link>
      </div>
    </Card>
  );
}

export function RoleCards() {
  return (
    <section className="space-y-6 py-2 sm:space-y-8 sm:py-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Rollen</p>
        <h2 className="font-serif text-3xl text-stone-900 sm:text-4xl">Fuer Pferdehalter und Reiter</h2>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <RoleCard
          bullets={[
            "Pferdeprofile verwalten",
            "Anfragen pruefen und freischalten",
            "Verfuegbarkeiten und Termine im Blick"
          ]}
          ctaLabel="Als Pferdehalter starten"
          title="Fuer Pferdehalter"
        />
        <RoleCard
          bullets={[
            "Passende Pferde finden",
            "Probetermine anfragen",
            "Nach Freischaltung Termine buchen"
          ]}
          ctaLabel="Als Reiter starten"
          title="Fuer Reiter"
        />
      </div>
    </section>
  );
}

