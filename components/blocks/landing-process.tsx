import { StepList } from "@/components/blocks/step-list";
import { PageHeader } from "@/components/ui/page-header";

const steps = [
  {
    number: "01",
    title: "Probetermin anfragen",
    description: "Reiter senden zuerst eine strukturierte Anfrage statt lose Nachrichten zu schreiben."
  },
  {
    number: "02",
    title: "Freischaltung durch Pferdehalter",
    description: "Der Pferdehalter entscheidet nach dem Kennenlernen, ob die Reitbeteiligung freigeschaltet wird."
  },
  {
    number: "03",
    title: "Termine buchen & verwalten",
    description: "Nach der Freischaltung laufen weitere Termine nachvollziehbar ueber feste Zeitfenster."
  }
] as const;

export function LandingProcess() {
  return (
    <section className="space-y-6 py-2 sm:space-y-8">
      <PageHeader
        className="max-w-3xl"
        subtitle="Der Ablauf bleibt fuer beide Seiten klar: erst Kennenlernen, dann Freigabe, danach verbindliche Termine."
        title="So laeuft es auf der Plattform"
      />
      <StepList items={steps} />
    </section>
  );
}
