# Projektstatus

Stand: 2026-03-03

## Produktziel

`reitbeteiligung.app` organisiert den Ablauf zwischen Pferdehaltern und Reitern:

- Probetermin anfragen
- Freischaltung durch den Pferdehalter
- Terminbuchung nach Freischaltung

## Aktuell umgesetzt

- Supabase Auth mit E-Mail und Passwort
- Rollenmodell fuer `Pferdehalter` und `Reiter`
- Pferdeprofile mit Bildern, Galerie und erweiterten Stammdaten
- Probetermin-Flow mit Freischaltung
- Interner Chat vor der Freischaltung
- Kalender mit Verfuegbarkeiten, Sperren und Terminanfragen
- Direkte Kalenderauswahl im Raster fuer Tagesfenster plus Fokus-Spruenge in die Direktbearbeitung
- FCFS-Probetermin-Slots auf Basis freier Verfuegbarkeiten
- Gemeinsamer UI-Layer mit mobile-first Layout
- Owner-Tarifstatus mit sichtbaren Start-Trial- und Upgrade-CTAs

## Tarifmodell

- `Kostenlos`: 1 Pferd, 1 Reitbeteiligung
- `Testphase`: 1 Pferd, bis zu 2 Reitbeteiligungen fuer 14 Tage
- `Bezahlt`: mehrere Pferde und mehrere Reitbeteiligungen

Die Limits werden serverseitig beim Anlegen neuer Pferdeprofile und beim Freischalten weiterer Reitbeteiligungen geprueft.

## Technischer Stand

- Next.js 14 App Router + TypeScript
- Supabase fuer Auth, Postgres und Storage
- Rollenbasierte Navigation
- Zentrale Planlogik in `lib/plans.ts`
- UI-Bausteine unter `components/ui` und `components/blocks`

## Offene Schwerpunkte

- Bezahlten Tarif spaeter an echte Abrechnung anbinden
- Kalender weiter in Richtung direkter Planung und Drag/Resize ausbauen
- Owner-Verwaltung weiter als Desktop-Cockpit schaerfen
- Bilddarstellung spaeter auf `next/image` umziehen

## Naechste sinnvolle Schritte

1. Kalender-Interaktion als naechstes mit echtem Resize und spaeter direkt verschiebbaren Eintraegen ausbauen.
2. Verwaltungsansichten fuer Pferdehalter weiter als Desktop-Cockpit verdichten.
3. Upgrade-Fluss fuer den bezahlten Tarif finalisieren.
