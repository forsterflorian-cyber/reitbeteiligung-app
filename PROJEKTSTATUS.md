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
- Probetermin-Flow mit klarer Trennung: Probeterminphase bis zur Entscheidung, danach aktive Reitbeteiligung
- Aktive Reitbeteiligungen erscheinen getrennt unter `Meine Reitbeteiligungen` bzw. `Aktive Reitbeteiligungen`
- Owner-Hauptnavigation jetzt klar getrennt in `Pferde verwalten`, `Probetermine`, `Reitbeteiligungen`, `Nachrichten`, `Profil`
- `Pferde verwalten` ist die Hauptsicht; `Neues Pferd anlegen` bleibt als eigener Unterweg erreichbar
- `Probetermine` enthält nur noch die Probephase, `Reitbeteiligungen` nur noch das operative Tagesgeschäft
- Eigene Nachrichten-Seite für Pferdehalter mit Ungelesen-Indikator in der Navigation
- Rider-Übersicht zeigt jetzt zuerst aktive Probetermine oder die nächste Buchung
- Interner Chat vor der Freischaltung
- Kalender mit Verfügbarkeiten, Sperren und Terminanfragen
- Direkte Kalenderauswahl im Raster für Tagesfenster plus Fokus-Sprünge in die Direktbearbeitung
- Bestehende Zeitfenster und Sperren lassen sich direkt aus dem Raster im Tageseditor fokussieren und anpassen
- Markierte Balken lassen sich direkt im Planer stundenweise verlängern, verkürzen und verschieben
- Pferdehalter können pro freigeschalteter Reitbeteiligung ein Wochenkontingent hinterlegen
- FCFS-Probetermin-Slots mit Fallback auf generische Anfragen, wenn kein expliziter Probetermin gepflegt ist
- Reiter buchen operative Termine jetzt ?ber ein 15-Minuten-Raster innerhalb offener Zeitfenster
- Verf?gbarkeiten verhindern jetzt ?berlappende Zeitfenster serverseitig
- Kalender-Sperren unterst?tzen einen optionalen Titel
- Gemeinsamer UI-Layer mit mobile-first Layout
- Tarifinfos im Dashboard und in `Pferde verwalten` bewusst weiter nach unten gezogen
- Brand-Backdrops ziehen sich stärker durch den Innenbereich, inklusive Übersicht, Verwaltung und Anfragen

## Tarifmodell

- `Kostenlos`: 1 Pferd, 1 Reitbeteiligung
- `Testphase`: 1 Pferd, bis zu 2 Reitbeteiligungen für 14 Tage
- `Bezahlt`: mehrere Pferde und mehrere Reitbeteiligungen

Die Limits werden serverseitig beim Anlegen neuer Pferdeprofile und beim Freischalten weiterer Reitbeteiligungen geprüft.

## Technischer Stand

- Next.js 14 App Router + TypeScript
- Supabase für Auth, Postgres und Storage
- Rollenbasierte Navigation mit optionalen Ungelesen-Badges
- Zentrale Planlogik in `lib/plans.ts`
- Owner-Arbeitsdaten gebündelt in `lib/owner-workspace.ts`
- UI-Bausteine unter `components/ui` und `components/blocks`

## Offene Schwerpunkte

- Bezahlten Tarif später an echte Abrechnung anbinden
- Kalender weiter in Richtung direkter Planung und echtes freies Drag/Resize ausbauen
- Laufende Reitbeteiligungen noch stärker als eigenes Tagesgeschäft mit Buchungsverbrauch abbilden
- Bilddarstellung später auf `next/image` umziehen

## Nächste sinnvolle Schritte

1. Kalender-Einträge als Nächstes frei im Raster per Drag verschieben und in der Länge ziehen.
2. Offene Zeitfenster und Buchungsverbrauch pro aktiver Reitbeteiligung noch sichtbarer machen.
3. Upgrade-Fluss für den bezahlten Tarif finalisieren.
