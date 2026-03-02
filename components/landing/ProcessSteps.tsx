import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type Step = {
  number: string;
  title: string;
  description: string;
  status: string;
  tone: "pending" | "approved" | "info";
  meta: string;
};

const steps: readonly Step[] = [
  {
    description: "Reiter senden eine strukturierte Anfrage mit Wunschtermin statt lose Nachrichten zu verteilen.",
    meta: "Wunschtermin und Nachricht werden direkt mitgeschickt.",
    number: "01",
    status: "Ausstehend",
    title: "Probetermin anfragen",
    tone: "pending"
  },
  {
    description: "Der Pferdehalter entscheidet nach dem Kennenlernen bewusst über die Freischaltung.",
    meta: "Kontaktdaten bleiben bis dahin geschützt.",
    number: "02",
    status: "Freigeschaltet",
    title: "Freischaltung durch Halter",
    tone: "approved"
  },
  {
    description: "Nach der Freigabe laufen weitere Termine geordnet über Verfügbarkeiten und Buchungen.",
    meta: "Bestätigte Termine bleiben sauber im Überblick.",
    number: "03",
    status: "Bestätigt",
    title: "Termine buchen",
    tone: "info"
  }
];

function StepCard({ step }: { step: Step }) {
  return (
    <Card className="relative p-6">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100 font-serif text-3xl text-stone-800">
              {step.number}
            </div>
            <div>
              <h3 className="font-serif text-2xl text-stone-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-7 text-stone-600">{step.description}</p>
            </div>
          </div>
          <Badge tone={step.tone}>{step.status}</Badge>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">Im Ablauf sichtbar</p>
          <p className="mt-2 text-sm leading-6 text-stone-700">{step.meta}</p>
        </div>
      </div>
    </Card>
  );
}

// The step cards intentionally read like tiny product states, not generic marketing boxes.
export function ProcessSteps() {
  return (
    <section className="space-y-6 py-2 sm:space-y-8 sm:py-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Ablauf</p>
        <h2 className="font-serif text-3xl text-stone-900 sm:text-4xl">So läuft&apos;s</h2>
      </div>
      <div className="relative grid gap-4 lg:grid-cols-3">
        <div className="pointer-events-none absolute left-[16.666%] right-[16.666%] top-10 hidden h-px bg-stone-200 lg:block" />
        {steps.map((step) => (
          <StepCard key={step.number} step={step} />
        ))}
      </div>
    </section>
  );
}