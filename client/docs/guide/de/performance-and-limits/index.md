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

## Stand der Messungen auf realer Hardware

Eine wiederholte Messung am 27. August 2026 nutzte ein High-End-MacBook-Pro mit Apple M5 Max,
macOS 26.6, Chrome 151, dem echten Metal-Renderer, Desktop/Hoch und Pixelverhältnis 1. Über drei Läufe
lag der Median der ersten nutzbaren Karte bei 259,3 ms und der des ersten sichtbaren Tempel-Bildes bei
7,1 ms. Drei kalte Reisen blieben bei 9,1–9,2 ms p95, 16,7 ms p99, maximal 66,6–75 ms und
0,24–0,36 % langen Bildern. Nach drei Aufwärmrunden blieben drei Ressourcenzyklen bei
100 Geometrien, 18 Texturen und 44 Draw Calls; der bereinigte Heap sank um 0,77 MiB.

Ein separates Profil des Beobachter-Planetariums forderte Browser-DPR 2 bei 1.440 × 900 CSS-Pixeln
an. Der Renderer in hoher Qualität nutzte seine dokumentierte DPR-Grenze von 1,5 und blieb dort in
allen drei Läufen stabil. Jeder Lauf erfasste 1.452–1.455 Bilder bei 9,1 ms p95, 9,3 ms p99,
maximal 9,4–9,5 ms und ohne lange Bilder; Jupiter erreichte in allen drei Läufen seine aufgelöste
Darstellung.

Eine saubere simulierte Kampagne auf demselben Host, aufgezeichnet am 28. August 2026 aus Revision
`27db0e1`, bestand alle zehn Berichte. Bei mittlerer Qualität und CPU 4× erreichte die erste nutzbare
Karte im Median 1,26 s, Tempels erstes sichtbares Bild 24,2 ms, drei kalte Skalenläufe 9,3 ms p95 mit
einem schlechtesten Bild von 66,5 ms und die Beobachterläufe 9,2 ms p95 im Median mit einem
schlechtesten Bild von 24,9 ms sowie Jupiter 3/3 aufgelöst. Bei niedriger Qualität und CPU 6× waren
die entsprechenden Werte 1,85 s, 33,1 ms, 16,6–16,7 ms p95 mit einem schlechtesten Skalenbild von
83,4 ms sowie 9,4 ms Beobachter-p95 mit einem schlechtesten Bild von 41,7 ms und Jupiter 3/3
aufgelöst. Beide Ressourcenprotokolle hielten Geometrie-, Textur- und Draw-Call-Zahlen über drei
Zyklen unverändert. Die GPU blieb der M5 Max; damit misst dies Regressionsreserve und keine
repräsentative physische Mittel- oder Niedrigklasse-Hardware.

Alle fünf Leistungs-Benchmarks — Start, Tempel, Ressourcen, Maßstabsbilder und
Beobachter-Planetarium — können mit `UNIVERSE_BENCHMARK_REPORT_PATH` denselben versionierten
JSON-Nachweis schreiben. Er enthält Git-Revision und Dirty-Status, Hostmerkmale, Browser und
WebGL-Renderer, Konfiguration, Messwerte und Zusammenfassung.
`UNIVERSE_BENCHMARK_REQUIRE_PHYSICAL=1` weist CPU-Drosselung, Software-Rendering oder eine fehlende
deklarierte `UNIVERSE_BENCHMARK_DEVICE_CLASS` vor dem Schreiben zurück, damit simulierte Werte nicht
unbemerkt in die physische Gerätematrix gelangen.

`npm run benchmark:campaign` führt die fünf Protokolle nacheinander auf einem repräsentativen
physischen Rechner aus. Der Befehl verlangt einen sauberen Git-Checkout sowie deklarierte Klasse und
Bezeichnung, deaktiviert CPU-Drosselung, erzwingt strenge Budgets und mindestens drei Wiederholungen
und wählt standardmäßig die zur Klasse passende Qualität. Er schreibt fünf Berichte außerhalb des
Repositorys und ein Manifest `universe-map/performance-campaign@1`, das sie mit SHA-256-Prüfsummen
verknüpft. Der Befehl bündelt vergleichbare Nachweise; er macht aus einem Rechner keine andere
Geräteklasse.

`npm run benchmark:campaign:simulated` ist eine getrennte Stresskampagne auf demselben Host, wenn
keine repräsentative Hardware verfügbar ist. Chrome-CPU-Drosselung gilt für alle fünf Protokolle:
mittlere Qualität bei 4× mit Beobachter-DPR 1,25, danach niedrige Qualität bei 6× mit DPR 1. Die zehn
Benchmarks laufen weiterhin nacheinander und erzeugen aus einem sauberen Checkout ein Manifest
`universe-map/simulated-performance-campaign@1` mit SHA-256-Prüfsummen und ausdrücklichen Grenzen.
Quell-GPU, Grafikspeicher, Treiber, Speicherbandbreite und thermisches Verhalten werden nicht
emuliert; „mittel“ und „niedrig“ sind Regressions-Proxys, keine physischen Gerätenachweise. Ein
überschrittenes Budget stoppt die folgenden Protokolle nicht mehr: Das vollständige Manifest markiert
jedes Protokoll, Profil und die Kampagne mit `withinBudget`, danach meldet der strenge Modus den
Fehler. `UNIVERSE_BENCHMARK_STRICT=0` dient nur zum bewussten Sammeln einer bereits bekannten
regressiven Basislinie.

Die wiederholte physische Baseline belegt weiterhin nur die High-End-Klasse. Physische Messungen der
mittleren und niedrigen Klasse sind bei fehlender Hardware eine optionale spätere Gegenprüfung und
kein Blocker.

## Debug-Ansicht

Hängen Sie `?debug=true` an die URL, um FPS, Draw Calls, Dreiecke, Geometrien, Texturen, sichtbare
Objekte, Bezugssystem, Kameradistanz, Ziel, Julianischen Tag und Qualität anzuzeigen.

```text
https://super-universe.app/de/?debug=true
```

Erforderlich sind JavaScript, WebGL 2, ausreichender GPU-Speicher und Pointer-Ereignisse. Der Katalog
ist nicht vollständig; Radien und Übergänge sind angepasst; Empfangenes Licht korrigiert unterstützte
Sonnensystemkörper – einschließlich galileischer Monde, vereinfachter Satelliten, Zwergplaneten,
Asteroiden und Kometen – sowie HYG-Sterne um die Lichtlaufzeit; dokumentierte Exoplanetensysteme
teilen eine aus der veröffentlichten Hostdistanz berechnete Verzögerung, während lokale
Planetenphasen illustrativ und Systeme ohne Distanz gleichzeitig bleiben; Galaxien und großräumige
Strukturen verwenden geometrische Kataloglichtzeit beziehungsweise aus Leuchtkraft- oder komovierender
Entfernung abgeleitete ΛCDM-Rückblickzeit; Positionen, Formen und Messwerte bleiben statisch;
kosmologische Surveys haben
unterschiedliche Abdeckungen; ein
fehlender Nachweis beweist kein physisches Void; detaillierte Oberflächen, Live-Wetter und exaktes
relativistisches Raytracing sind nicht enthalten.

Bei langsamer Navigation senken Sie die Qualität, schließen GPU-intensive Tabs und kehren zu einem
bekannten Ziel zurück. Prüfen Sie bei fehlenden statischen Daten die konkrete Datei im Netzwerkpanel.

Weiter: [Entwicklerleitfaden](/de/developers/).
