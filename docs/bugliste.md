# Bugliste

Stand: 2026-03-03

## Offen

### HP2: Kalender speichert, springt aber nicht sichtbar zur Erfolgsmeldung

- Bereich: Pferdehalter -> Pferd -> Kalender
- Reproduktion: Im Kalender ein Tagesfenster oder eine Sperre speichern
- Erwartet: Die Seite springt nach dem Speichern direkt zur sichtbaren Erfolgsmeldung oben
- Tats?chlich: Die Erfolgsmeldung ist vorhanden, aber der sichtbare Sprung zum Feedback-Bereich funktioniert im Browser weiterhin nicht zuverl?ssig
- Status: Zur?ckgestellt, blockiert den Kernflow aktuell nicht
- N?chster sinnvoller Fix: Beim n?chsten Kalender-UX-Pass den Save-Flow mit einem robusten Zielpunkt ohne Hash-Sprung neu aufbauen
