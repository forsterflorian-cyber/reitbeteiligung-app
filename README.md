# reitbeteiligung.app

Next.js 14 App Router + TypeScript + Supabase fuer die Produktflaechen von `reitbeteiligung.app`.

## Projektfokus

Die fachliche Referenz fuer den aktuellen Produktstand liegt in `docs/kernworkflows.md`.
Dort sind Release-Scope, Statusvertrag, Historisierung und Sichtbarkeitsregeln verbindlich beschrieben.

## Was die App aktuell abdeckt

- Auth, Rollen und Onboarding
- Owner- und Rider-Dashboards
- Pferdeprofile und Suche
- Probephase mit Slots, Anfragen und 1:1-Chat
- Aufnahme, Nichtaufnahme und Entfernen von Reitbeteiligungen
- Gruppenchat fuer aktive Reitbeteiligungen
- Aktive-Reitbeteiligung-Kalender V1 mit Wochenansicht, Einzelbuchungen, Anfragen, Storno und Umbuchung

## Wichtige Dokumente

- `docs/kernworkflows.md`: verbindlicher fachlicher Contract
- `docs/status-modelle.md`: abgeleitete Kurzuebersicht der Status
- `PROJEKTSTATUS.md`: knapper Lieferstand

## Environment

Lege `.env.local` mit folgenden Variablen an:

```bash
NEXT_PUBLIC_SUPABASE_URL="https://your-project-ref.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
```

## Entwicklung

```bash
npm install
npm run test:unit
node node_modules\\typescript\\bin\\tsc --noEmit
node node_modules\\next\\dist\\bin\\next build
```

## Hinweise

- Die Repo-Skripte enthalten Unit-Tests, DB-Pruefflows und den Produktionsbuild.
- In diesem Workspace kann `npm run build` unter Windows an der `next.cmd`-Pfadauflosung scheitern; der direkte Next-Build ueber `node node_modules\\next\\dist\\bin\\next build` ist die verlaessliche Verifikation.
