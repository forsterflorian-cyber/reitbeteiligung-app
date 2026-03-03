# Projektstatus

Stand: 2026-03-03

## Produktziel

`reitbeteiligung.app` organisiert den Ablauf zwischen Pferdehaltern und Reitern:

- Probetermin anfragen
- Freischaltung durch den Pferdehalter
- Terminbuchung nach Freischaltung

## Aktuell umgesetzt

- Supabase Auth mit E-Mail und Passwort
- Rollenmodell für `Pferdehalter` und `Reiter`
- Pferdeprofile mit Bildern, Galerie und erweiterten Stammdaten
- Probetermin-Flow mit Freischaltung
- Interner Chat vor der Freischaltung
- Kalender mit Verfügbarkeiten, Sperren und Terminanfragen
- Direkte Kalenderauswahl im Raster für Tagesfenster plus Fokus-Sprünge in die Direktbearbeitung
- Bestehende Zeitfenster und Sperren lassen sich direkt aus dem Raster im Tageseditor fokussieren und anpassen
- Markierte Balken lassen sich direkt im Planer stundenweise verlängern, verkürzen und jetzt auch verschieben
- Pferdehalter können pro freigeschalteter Reitbeteiligung ein Wochenkontingent hinterlegen
- FCFS-Probetermin-Slots auf Basis freier Verfügbarkeiten
- Gemeinsamer UI-Layer mit mobile-first Layout
- Owner-Tarifstatus mit sichtbaren Start-Trial- und Upgrade-CTAs
- Anfragen-Seiten mit kompakten Kennzahlen für schnellen Überblick
- Brand-Backdrops ziehen sich stärker durch den Innenbereich, inklusive Übersicht, Verwaltung und Anfragen

## Tarifmodell

- `Kostenlos`: 1 Pferd, 1 Reitbeteiligung
- `Testphase`: 1 Pferd, bis zu 2 Reitbeteiligungen für 14 Tage
- `Bezahlt`: mehrere Pferde und mehrere Reitbeteiligungen

Die Limits werden serverseitig beim Anlegen neuer Pferdeprofile und beim Freischalten weiterer Reitbeteiligungen geprüft.

## Technischer Stand

- Next.js 14 App Router + TypeScript
- Supabase für Auth, Postgres und Storage
- Rollenbasierte Navigation
- Zentrale Planlogik in `lib/plans.ts`
- UI-Bausteine unter `components/ui` und `components/blocks`

## Offene Schwerpunkte

- Bezahlten Tarif später an echte Abrechnung anbinden
- Kalender weiter in Richtung direkter Planung und Drag/Resize ausbauen
- Owner-Verwaltung weiter als Desktop-Cockpit schärfen
- Bilddarstellung später auf `next/image` umziehen

## Nächste sinnvolle Schritte

1. Kalender-Einträge als Nächstes noch direkter per Drag innerhalb des Rasters verschieben und in der Länge ändern.
2. Verwaltungsansichten für Pferdehalter weiter als Desktop-Cockpit verdichten.
3. Upgrade-Fluss für den bezahlten Tarif finalisieren.
