export type FaqItem = {
  question: string;
  answer: string;
};

export type FaqSection = {
  title: string;
  intro: string;
  items: readonly FaqItem[];
};

// Diese Inhalte gehoeren zur oeffentlichen Release-Oberflaeche.
// Wenn sich der Kernflow aendert, muss diese Datei mitgeprueft werden.
export const FAQ_SECTIONS: readonly FaqSection[] = [
  {
    title: "Fuer Reiter",
    intro: "So funktioniert der Weg vom ersten Interesse bis zur aktiven Reitbeteiligung.",
    items: [
      {
        question: "Wie finde ich Pferde mit Probeterminen?",
        answer: "In der Suche erscheinen nur Pferde, fuer die aktuell echte Probetermine eingestellt sind. So siehst du direkt, wo du sofort anfragen kannst."
      },
      {
        question: "Wie frage ich einen Probetermin an?",
        answer: "Oeffne das Pferdeprofil, waehle einen angebotenen Probetermin aus und sende deine Anfrage. Vor der Freischaltung laeuft die Abstimmung nur ueber den Plattform-Chat."
      },
      {
        question: "Warum sehe ich noch keine Kontaktdaten?",
        answer: "Kontaktdaten werden erst sichtbar, wenn der Pferdehalter dich nach einem durchgefuehrten Probetermin bewusst freischaltet."
      },
      {
        question: "Kann ich eine Probeanfrage wieder zurueckziehen?",
        answer: "Ja. Solange deine Anfrage noch offen oder bereits angenommen ist, kannst du sie unter Proben & Chats wieder zurueckziehen."
      },
      {
        question: "Was passiert nach der Freischaltung?",
        answer: "Aus dem Probetermin wird eine aktive Reitbeteiligung. Danach bleibt die Abstimmung fuer dieses Pferd im gemeinsamen Pferde-Chat gebuendelt."
      }
    ]
  },
  {
    title: "Fuer Pferdehalter",
    intro: "Die wichtigsten Schritte fuer den Start mit einem neuen Pferd und neuen Reitern.",
    items: [
      {
        question: "Wie lege ich ein Pferdeprofil an?",
        answer: "Unter Pferde verwalten kannst du bestehende Pferde ueberblicken und ueber Neues Pferd anlegen ein neues Pferdeprofil erstellen."
      },
      {
        question: "Wie stelle ich Probetermine ein?",
        answer: "Im Kalender des Pferdes pflegst du gezielt Probetermine. Nur diese explizit eingestellten Termine werden Reitern in der Suche und auf dem Pferdeprofil gezeigt."
      },
      {
        question: "Wie nehme ich eine Reitbeteiligung auf?",
        answer: "Nimm eine Probeanfrage an, markiere den Termin nach dem Kennenlernen als durchgefuehrt und schalte den Reiter danach aktiv fuer das Pferd frei."
      },
      {
        question: "Wie laeuft die Kommunikation?",
        answer: "Vor der Freischaltung schreibt ihr im direkten Chat zur Anfrage. Nach der Aufnahme nutzt ihr zusaetzlich den gemeinsamen Pferde-Chat fuer dieses Pferd."
      },
      {
        question: "Wie entferne ich eine Reitbeteiligung?",
        answer: "In der Verwaltung deiner aktiven Reitbeteiligungen kannst du eine Beziehung wieder entfernen. Dadurch wird der aktive Zugriff auf dieses Pferd beendet."
      }
    ]
  },
  {
    title: "Regeln und Transparenz",
    intro: "Diese Grundregeln halten den Ablauf fuer beide Seiten klar und nachvollziehbar.",
    items: [
      {
        question: "Sind alle freien Zeiten automatisch Probetermine?",
        answer: "Nein. Fuer Probetermine zaehlen nur die Termine, die der Pferdehalter explizit als Probetermine eingestellt hat."
      },
      {
        question: "Laeuft alles vor der Freischaltung intern?",
        answer: "Ja. Vor der Freischaltung bleibt die Kommunikation innerhalb der Plattform, damit Anfragen, Antworten und Status nachvollziehbar bleiben."
      },
      {
        question: "Was ist der Unterschied zwischen direktem Chat und Pferde-Chat?",
        answer: "Der direkte Chat gehoert zur Anbahnungsphase zwischen einem Reiter und einem Pferdehalter. Der Pferde-Chat ist der gemeinsame Chat fuer alle aktiven Beteiligten rund um ein konkretes Pferd."
      }
    ]
  }
] as const;
