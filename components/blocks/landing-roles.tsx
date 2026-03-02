import { RoleCard } from "@/components/blocks/role-card";
import { PageHeader } from "@/components/ui/page-header";

export function LandingRoles() {
  return (
    <section className="space-y-6 py-2 sm:space-y-8">
      <PageHeader
        className="max-w-3xl"
        subtitle="Beide Rollen arbeiten mit demselben Ablauf, sehen aber nur die Schritte, die fuer sie relevant sind."
        title="Fuer Pferdehalter und Reiter"
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <RoleCard
          ctaLabel="Als Pferdehalter starten"
          href="/signup"
          points={[
            "Verfuegbare Probetermine und spaetere Zeitfenster strukturiert festhalten.",
            "Anfragen und Freischaltungen gesammelt statt in mehreren Chats verwalten.",
            "Kontaktdaten erst nach einer bewussten Freigabe sichtbar machen."
          ]}
          title="Fuer Pferdehalter"
        />
        <RoleCard
          ctaLabel="Als Reiter starten"
          href="/signup"
          points={[
            "Passende Pferdeprofile finden und direkt einen Probetermin anfragen.",
            "Vor der Freischaltung nur intern kommunizieren, ohne private Daten auszutauschen.",
            "Nach der Freigabe Termine innerhalb klarer Verfuegbarkeiten buchen."
          ]}
          title="Fuer Reiter"
        />
      </div>
    </section>
  );
}
