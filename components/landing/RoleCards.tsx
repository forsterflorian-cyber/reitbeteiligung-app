import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

type RoleCardProps = {
  bullets: readonly string[];
  ctaLabel: string;
  previewMeta: string;
  previewStatus: string;
  previewTone: "pending" | "approved" | "info" | "neutral";
  subtitle: string;
  title: string;
};

function RoleCard({ bullets, ctaLabel, previewMeta, previewStatus, previewTone, subtitle, title }: RoleCardProps) {
  return (
    <Card className="p-6">
      <div className="space-y-5">
        <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">Im Alltag</p>
              <p className="mt-1 text-sm font-semibold text-stone-900">{previewMeta}</p>
            </div>
            <Badge tone={previewTone}>{previewStatus}</Badge>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="font-serif text-3xl text-stone-900">{title}</h3>
          <p className="text-sm leading-7 text-stone-600">{subtitle}</p>
        </div>

        <ul className="space-y-3 text-sm leading-7 text-stone-600">
          {bullets.map((bullet) => (
            <li className="flex gap-3" key={bullet}>
              <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-clay" />
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

// Each role card shows a small operational preview so the landing feels closer to the real app.
export function RoleCards() {
  return (
    <section className="space-y-6 py-2 sm:space-y-8 sm:py-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Rollen</p>
        <h2 className="font-serif text-3xl text-stone-900 sm:text-4xl">FÃ¼r Pferdehalter und Reiter</h2>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <RoleCard
          bullets={[
            "Pferdeprofile verwalten",
            "Anfragen prÃ¼fen und freischalten",
            "VerfÃ¼gbarkeiten und Termine im Blick"
          ]}
          ctaLabel="Als Pferdehalter starten"
          previewMeta="Neue Probeanfrage fÃ¼r Apollo"
          previewStatus="Ausstehend"
          previewTone="pending"
          subtitle="Alle Schritte von der ersten Anfrage bis zur Freigabe bleiben geordnet an einem Ort."
          title="FÃ¼r Pferdehalter"
        />
        <RoleCard
          bullets={[
            "Passende Pferde finden",
            "Probetermine anfragen",
            "Nach Freischaltung Termine buchen"
          ]}
          ctaLabel="Als Reiter starten"
          previewMeta="NÃ¤chster Termin: Mittwoch, 18:00"
          previewStatus="BestÃ¤tigt"
          previewTone="info"
          subtitle="Du siehst sofort, was offen ist, was bestÃ¤tigt wurde und wann der nÃ¤chste Termin ansteht."
          title="FÃ¼r Reiter"
        />
      </div>
    </section>
  );
}