---
title: Leistung und Grenzen
description: Verstehen Sie Grafikprofile, Streaming, GPU-Batching, Browseranforderungen, Debug-Metriken und Grenzen von Universe Map.
---

# Leistung und Grenzen

Universe Map zielt auf 60 Bilder pro Sekunde auf modernen Desktops und 30 auf Mobilgeräten. Eine
stabile Framezeit ist wichtiger als die gleichzeitige Anzeige aller Punkte.

## Begrenztes Rendering

- Sterne, Exoplanetenwirte, Gruppen und Großstrukturen verwenden GPU-Punkt- oder Linienstapel;
- es entsteht kein einzelnes Three.js-Objekt pro großem Katalogeintrag;
- räumliche Indizes laden nur für die Kamera relevante Kacheln;
- detaillierte Texturen und Materialien werden erst nahe ihrer Detailstufe geladen;
- Bahnberechnungen laufen seltener und werden interpoliert;
- Beschriftungen beachten Maßstabs-, Qualitäts- und Kollisionsbudgets;
- volumetrische Effekte passen Abtastung und Pixelbudget an;
- die Render-Schleife läuft außerhalb der Angular-Änderungserkennung.

## Grafikprofile

| Profil  | Einsatz                                 | Typische Reduktionen                                                 |
| ------- | --------------------------------------- | -------------------------------------------------------------------- |
| Niedrig | Telefone, ältere Laptops, Akkuschonung  | Weniger Punkte, kleinere Texturen, kurze Volumen und weniger Kacheln |
| Mittel  | Integrierte GPUs und allgemeine Nutzung | Ausgewogene Dichte und Nachbearbeitung                               |
| Hoch    | Aktuelle Desktop-Hardware               | Reichere Kataloge, Texturen, Volumen und Details                     |

Das Profil verändert nie wissenschaftliche Koordinaten.

## Debug-Ansicht

Hängen Sie `?debug=true` an die URL, um FPS, Draw Calls, Dreiecke, Geometrien, Texturen, sichtbare
Objekte, Bezugssystem, Kameradistanz, Ziel, Julianischen Tag und Qualität anzuzeigen.

```text
https://super-universe.app/de/?debug=true
```

Erforderlich sind JavaScript, WebGL 2, ausreichender GPU-Speicher und Pointer-Ereignisse. Der Katalog
ist nicht vollständig; Radien und Übergänge sind angepasst; der beobachtbare Modus simuliert die
Lichtlaufzeit noch nicht vollständig; kosmologische Surveys haben unterschiedliche Abdeckungen; ein
fehlender Nachweis beweist kein physisches Void; detaillierte Oberflächen, Live-Wetter und exaktes
relativistisches Raytracing sind nicht enthalten.

Bei langsamer Navigation senken Sie die Qualität, schließen GPU-intensive Tabs und kehren zu einem
bekannten Ziel zurück. Prüfen Sie bei fehlenden statischen Daten die konkrete Datei im Netzwerkpanel.

Weiter: [Entwicklerleitfaden](/de/developers/).
