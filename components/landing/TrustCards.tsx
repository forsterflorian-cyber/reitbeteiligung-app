import { Card } from "@/components/ui/card";

const items = [
  {
    description: "E-Mail und Telefonnummer bleiben verborgen, bis der Pferdehalter bewusst freischaltet.",
    title: "Kontaktdaten erst nach Freischaltung"
  },
  {
    description: "Vor der Freigabe laeuft die Abstimmung ausschliesslich ueber den internen Chat der Plattform.",
    title: "Kommunikation vor Freischaltung intern"
  },
  {
    description: "Die Plattform strukturiert den Ablauf. Individuelle Absprachen und Vertraege regelt ihr ausserhalb davon.",
    title: "Vertraege ausserhalb der Plattform"
  }
] as const;

export function TrustCards() {
  return (
    <section className="space-y-6 py-2 sm:space-y-8 sm:py-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Vertrauen</p>
        <h2 className="font-serif text-3xl text-stone-900 sm:text-4xl">Klare Regeln statt Unsicherheit</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {items.map((item) => (
          <Card className="p-6" key={item.title}>
            <div className="space-y-3">
              <h3 className="font-serif text-2xl text-stone-900">{item.title}</h3>
              <p className="text-sm leading-7 text-stone-600">{item.description}</p>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

