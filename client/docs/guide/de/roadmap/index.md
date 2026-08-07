---
title: Projektplan
description: Erfahren Sie, was Universe Map bereits liefert, welche Verbesserungen jetzt Priorität haben und welche wissenschaftlichen oder technischen Arbeiten bewusst zurückgestellt sind.
---

# Projektplan

_Zuletzt geprüft: 27. August 2026._

Diese Seite ist der verbindliche öffentliche Projektplan von Universe Map. Sie beschreibt Ergebnisse
und Prüfkriterien statt fester Veröffentlichungstermine. Wissenschaftliche Genauigkeit, verständliche
Navigation, stabile Bildzeiten und eine vollständig statische Browserarchitektur gelten für jeden
Schritt.

## Bedeutung der Zustände

| Zustand        | Bedeutung                                                                 |
| -------------- | ------------------------------------------------------------------------- |
| Ausgeliefert   | In der aktuellen Anwendung verfügbar und automatisiert getestet           |
| Aktuell        | Nächste Verbesserungen der bestehenden Erfahrung                          |
| Danach         | Benötigt zuerst einen wissenschaftlichen Vertrag oder physische Messungen |
| Zurückgestellt | Erst mit neuen Quellen, Daten oder einem dichteren Katalog sinnvoll       |

## Ausgeliefert

- Das **Planetarium für Erdbeobachter** bietet einen frei schwenkbaren HYG-Himmel mit 10.000 Sternen,
  moderne Sternbilder, Höhe und Azimut, ein zeigergebundenes Sichtfeld von 102° bis 2°, 461 per URL
  wiederherstellbare Orte, zustimmungsbasierte Browser-Geolokalisierung auf drei Dezimalstellen und
  illustrative lokale Szenenkontexte.
- Für jeden festen Katalogort wird ein 360°-Verdeckungsprofil aus dem maßgeblichen
  NOAA/NCEI-Oberflächenrelief ETOPO 2022 v1 mit 60 Bogensekunden berechnet. Die kompakten Profile
  werden verzögert geladen und können Sterne, Mond und Planeten hinter modelliertem Gelände
  verdecken; Gebäude, Vegetation, Mikrorelief und freie Koordinaten bleiben außerhalb des Modells.
  Drei berechnete Entfernungshüllen (0–30, 30–100 und 100–300 km) verleihen der Silhouette Tiefe;
  Farbe und Beleuchtung sind stilisiert.
- Mond und sieben sichtbare Planeten verwenden ihre vorhandenen Three.js-Objekte, Materialien,
  Beleuchtung und verzögert geladenen Texturen. Topozentrische Richtung und Winkeldurchmesser werden
  berechnet; die begrenzte Mindestgröße zur Lesbarkeit bleibt ausdrücklich illustrativ.
- Sterne und Milchstraße gewinnen beim Zoomen kontinuierlich Details. Die Navigation entfernt zudem
  Ziele und Auswahlen, sobald ihr visueller Kontext verschwindet.
- Die kartesischen J2000-Geschwindigkeiten von HYG schreiben nun den gemeinsamen Sternkatalog, den
  Beobachterhimmel und die Sternbildfiguren fort, mit explizit extrapolierter Verlässlichkeit und
  einer Grenze von ±10.000 julianischen Jahren.
- Der zeitliche Modus **Empfangenes Licht** behandelt das gewählte Datum nun als Empfangszeitpunkt. Er
  datiert Sonne, Mond und Planeten mit Astronomy Engine von der Erde aus zurück und löst für jeden
  HYG-Stern einen eigenen verzögerten Zeitpunkt vom Baryzentrum des Sonnensystems. Unterstützte
  Achsrotationen verwenden diesen Emissionszeitpunkt, Objektkarten zeigen Verzögerung und
  Emissionsdatum, und das HYG-Modell behält seine Grenze von ±10.000 julianischen Jahren.
- Die galileischen Monde verwenden Astronomy Engine an ihrem von der Erde empfangenen Zeitpunkt.
  Andere dokumentierte Satelliten, Zwergplaneten, Asteroiden und Kometen lösen die geometrische
  Lichtlaufzeit iterativ mit ihren vorhandenen JPL-Zweikörperelementen; ihre Vertrauenswürdigkeit
  bleibt extrapoliert und die visuelle Distanzverstärkung bleibt außerhalb der wissenschaftlichen
  Berechnung.
- Dokumentierte Exoplanetensysteme teilen nun eine baryzentrische Verzögerung aus der von NASA
  veröffentlichten Hostdistanz. Die statische Hostrichtung bleibt gleich, lokale Planetenbahnen
  werden am Emissionszeitpunkt ausgewertet, ihre Phase bleibt jedoch ausdrücklich illustrativ;
  Systeme ohne veröffentlichte Distanz bleiben gleichzeitig.
- Veröffentlichte Wände, probabilistische Becken, Attraktoren und Repeller behalten getrennte
  Herkunft und Symbole und werden nicht in das Tempel-Filamentnetz integriert.
- Für Kaltstart, Tempel-Übergang sowie Ressourcen- und Bildstabilität existieren reproduzierbare
  Browser-Benchmarks.

## Aktuelle Prioritäten

- Quellengeeignete Verträge für empfangenes Licht für Galaxien und großräumige Strukturen definieren.
  Sie benötigen kosmologische Rückblickzeit- und Rotverschiebungssemantik statt einer naiven
  Entfernung geteilt durch Lichttempo.

Das Planetarium bleibt eine getrennte topozentrische Projektion des gewählten Beobachtungsorts. Die
zeitliche Karte Empfangenes Licht verwendet für unterstützte Körper des Sonnensystems die Erde und
für HYG-Sterne sowie dokumentierte Exoplanetensysteme das Baryzentrum des Sonnensystems.

## Nächste messungsgebundene Investitionen

- Tempel-, Start-, Speicher- und Bildraten-Benchmarks auf repräsentativen physischen Geräten der
  unteren, mittleren und oberen Leistungsklasse ausführen. Shader-Vorkompilierung oder teurere
  Fallbacks folgen nur, wenn Messwerte ihren Aufwand rechtfertigen.

## Bewusst zurückgestellt

- Die vorbereitete aggregierte Sternhierarchie bleibt inaktiv, bis ein dichterer Quellkatalog eine
  sichtbare Darstellung über Skalen benötigt. Eine Aktivierung muss die Vorbereitung in einen Web
  Worker verlagern und unsichtbare Netzwerk- oder GPU-Arbeit vermeiden.
- Weitere Silhouetten oder Polygonmodelle unregelmäßiger Körper werden nur mit einem maßgeblichen
  Formmodell ergänzt, das Download, Dekodierung, Quellenangabe und Renderkosten rechtfertigt.

## Produktgrenze

Der Projektplan verspricht kein vollständiges Universum, Live-Wetter, Bodenerkundung, vollständige
Gravitationssimulation oder relativistisches Raytracing. Siehe
[Wissenschaftliche Verlässlichkeit](/de/scientific-confidence/) und
[Leistung und Grenzen](/de/performance-and-limits/) für den aktuellen Vertrag.

Weiter: [Über das Projekt](/de/about/).
