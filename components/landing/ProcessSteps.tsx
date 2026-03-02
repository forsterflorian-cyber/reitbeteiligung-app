import { Card } from "@/components/ui/card";

const steps = [
  {
    description: "Reiter senden eine strukturierte Anfrage statt lose Nachrichten zu verteilen.",
    number: "01",
    title: "Probetermin anfragen"
  },
  {
    description: "Der Pferdehalter entscheidet nach dem Kennenlernen bewusst ueber die Freischaltung.",
    number: "02",
    title: "Freischaltung durch Halter"
  },
  {
    description: "Nach der Freigabe laufen weitere Termine geordnet ueber Verfuegbarkeiten und Buchungen.",
    number: "03",
    title: "Termine buchen"
  }
] as const;

export function ProcessSteps() {
  return (
    <section className="space-y-6 py-2 sm:space-y-8 sm:py-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Ablauf</p>
        <h2 className="font-serif text-3xl text-stone-900 sm:text-4xl">So laeuft&apos;s</h2>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {steps.map((step) => (
          <Card className="p-6" key={step.number}>
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-stone-100 font-serif text-3xl text-stone-800">
                {step.number}
              </div>
              <div className="space-y-2">
                <h3 className="font-serif text-2xl text-stone-900">{step.title}</h3>
                <p className="text-sm leading-7 text-stone-600">{step.description}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

