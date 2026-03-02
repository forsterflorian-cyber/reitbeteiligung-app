import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

const trustPoints = [
  {
    title: "Kontaktdaten erst nach Freischaltung",
    description: "E-Mail und Telefonnummer bleiben bis zur bewussten Freigabe verborgen."
  },
  {
    title: "Kommunikation vor Freischaltung nur intern",
    description: "Vor dem Approval laeuft der Austausch ausschliesslich ueber den internen Chat."
  },
  {
    title: "Vertraege ausserhalb der Plattform",
    description: "Die Plattform strukturiert den Ablauf, individuelle Vereinbarungen bleiben bei euch."
  }
] as const;

export function LandingTrust() {
  return (
    <section className="space-y-6 py-2 sm:space-y-8">
      <PageHeader
        className="max-w-3xl"
        subtitle="Die wichtigsten Regeln sind bewusst sichtbar, damit beide Seiten von Anfang an wissen, wie der Ablauf gedacht ist."
        title="Vertrauen durch klare Leitplanken"
      />
      <div className="grid gap-4 md:grid-cols-3">
        {trustPoints.map((point) => (
          <Card className="p-5 sm:p-6" key={point.title}>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-stone-900">{point.title}</h3>
              <p className="text-sm leading-6 text-stone-600">{point.description}</p>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
