# Projektstatus

Stand: 2026-03-03

## Produktziel

`reitbeteiligung.app` organisiert den Ablauf zwischen Pferdehaltern und Reitern:

- Probetermin anfragen
- Freischaltung durch den Pferdehalter
- Terminbuchung nach Freischaltung

## Aktuell umgesetzt

- Supabase Auth mit E-Mail und Passwort
- Rollenmodell f?r `Pferdehalter` und `Reiter`
- Pferdeprofile mit Bildern, Galerie und erweiterten Stammdaten
- Probetermin-Flow mit klarer Trennung: Probeterminphase bis zur Entscheidung, danach aktive Reitbeteiligung
- Aktive Reitbeteiligungen erscheinen getrennt unter `Meine Reitbeteiligungen` bzw. `Aktive Reitbeteiligungen`
- Interner Chat vor der Freischaltung
- Kalender mit Verf?gbarkeiten, Sperren und Terminanfragen
- Direkte Kalenderauswahl im Raster f?r Tagesfenster plus Fokus-Spr?nge in die Direktbearbeitung
- Bestehende Zeitfenster und Sperren lassen sich direkt aus dem Raster im Tageseditor fokussieren und anpassen
- Markierte Balken lassen sich direkt im Planer stundenweise verl?ngern, verk?rzen und verschieben
- Pferdehalter k?nnen pro freigeschalteter Reitbeteiligung ein Wochenkontingent hinterlegen
- FCFS-Probetermin-Slots mit Fallback auf generische Anfragen, wenn kein expliziter Probetermin gepflegt ist
- Gemeinsamer UI-Layer mit mobile-first Layout
- Owner-Tarifstatus mit sichtbaren Start-Trial- und Upgrade-CTAs
- Anfragen-Seiten mit kompakten Kennzahlen f?r schnellen ?berblick
- Brand-Backdrops ziehen sich st?rker durch den Innenbereich, inklusive ?bersicht, Verwaltung und Anfragen

## Tarifmodell

- `Kostenlos`: 1 Pferd, 1 Reitbeteiligung
- `Testphase`: 1 Pferd, bis zu 2 Reitbeteiligungen f?r 14 Tage
- `Bezahlt`: mehrere Pferde und mehrere Reitbeteiligungen

Die Limits werden serverseitig beim Anlegen neuer Pferdeprofile und beim Freischalten weiterer Reitbeteiligungen gepr?ft.

## Technischer Stand

- Next.js 14 App Router + TypeScript
- Supabase f?r Auth, Postgres und Storage
- Rollenbasierte Navigation
- Zentrale Planlogik in `lib/plans.ts`
- UI-Bausteine unter `components/ui` und `components/blocks`

## Offene Schwerpunkte

- Bezahlten Tarif sp?ter an echte Abrechnung anbinden
- Kalender weiter in Richtung direkter Planung und echtes Drag/Resize ausbauen
- Owner-Verwaltung weiter als Desktop-Cockpit sch?rfen
- Bilddarstellung sp?ter auf `next/image` umziehen

## N?chste sinnvolle Schritte

1. Kalender-Eintr?ge als N?chstes direkt per Drag im Raster verschieben und in der L?nge ?ndern.
2. Verwaltungsansichten f?r Pferdehalter weiter als Desktop-Cockpit verdichten.
3. Upgrade-Fluss f?r den bezahlten Tarif finalisieren.
