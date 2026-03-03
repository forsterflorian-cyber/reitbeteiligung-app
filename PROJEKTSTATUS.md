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
- Owner-Hauptnavigation jetzt klar getrennt in `Pferde verwalten`, `Probetermine`, `Reitbeteiligungen`, `Nachrichten`, `Profil`
- `Pferde verwalten` ist die Hauptsicht; `Neues Pferd anlegen` bleibt als eigener Unterweg erreichbar
- `Probetermine` enth?lt nur noch die Probephase, `Reitbeteiligungen` nur noch das operative Tagesgesch?ft
- Eigene Nachrichten-Seite f?r Pferdehalter mit Ungelesen-Indikator in der Navigation
- Rider-?bersicht zeigt jetzt zuerst aktive Probetermine oder die n?chste Buchung
- Interner Chat vor der Freischaltung
- Kalender mit Verf?gbarkeiten, Sperren und Terminanfragen
- Direkte Kalenderauswahl im Raster f?r Tagesfenster plus Fokus-Spr?nge in die Direktbearbeitung
- Bestehende Zeitfenster und Sperren lassen sich direkt aus dem Raster im Tageseditor fokussieren und anpassen
- Markierte Balken lassen sich im Planer direkt per Drag verschieben und an den R?ndern im 15-Minuten-Raster ziehen
- Pferdehalter k?nnen pro freigeschalteter Reitbeteiligung ein Wochenkontingent hinterlegen
- FCFS-Probetermin-Slots mit Fallback auf generische Anfragen, wenn kein expliziter Probetermin gepflegt ist
- Reiter buchen operative Termine ?ber ein 15-Minuten-Raster innerhalb offener Zeitfenster
- Verf?gbarkeiten verhindern ?berlappende Zeitfenster serverseitig
- Kalender-Sperren unterst?tzen einen optionalen Titel
- Gemeinsamer UI-Layer mit mobile-first Layout
- Tarifinfos im Dashboard und in `Pferde verwalten` bewusst weiter nach unten gezogen
- Brand-Backdrops ziehen sich st?rker durch den Innenbereich, inklusive ?bersicht, Verwaltung und Anfragen

## Tarifmodell

- `Kostenlos`: 1 Pferd, 1 Reitbeteiligung
- `Testphase`: 1 Pferd, bis zu 2 Reitbeteiligungen f?r 14 Tage
- `Bezahlt`: mehrere Pferde und mehrere Reitbeteiligungen

Die Limits werden serverseitig beim Anlegen neuer Pferdeprofile und beim Freischalten weiterer Reitbeteiligungen gepr?ft.

## Technischer Stand

- Next.js 14 App Router + TypeScript
- Supabase f?r Auth, Postgres und Storage
- Rollenbasierte Navigation mit optionalen Ungelesen-Badges
- Zentrale Planlogik in `lib/plans.ts`
- Owner-Arbeitsdaten geb?ndelt in `lib/owner-workspace.ts`
- UI-Bausteine unter `components/ui`, `components/blocks` und `components/calendar`

## Offene Schwerpunkte

- Bezahlten Tarif sp?ter an echte Abrechnung anbinden
- Kalender weiter in Richtung freies, vollst?ndig direktes Planen im Raster ausbauen
- Laufende Reitbeteiligungen noch st?rker als eigenes Tagesgesch?ft mit Buchungsverbrauch abbilden
- Bilddarstellung sp?ter auf `next/image` umziehen

## N?chste sinnvolle Schritte

1. Kalender-Balken vollst?ndig frei per Drag verschieben und in der L?nge ziehen, ohne den unteren Editor bem?hen zu m?ssen.
2. Offene Zeitfenster und Buchungsverbrauch pro aktiver Reitbeteiligung noch sichtbarer machen.
3. Upgrade-Fluss f?r den bezahlten Tarif finalisieren.