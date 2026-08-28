---
title: Projektplan
description: Erfahren Sie, was Universe Map bereits liefert, welche Verbesserungen jetzt Priorität haben und welche wissenschaftlichen oder technischen Arbeiten bewusst zurückgestellt sind.
---

# Projektplan

_Zuletzt geprüft: 28. August 2026._

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
- Ein lokaler Planer auf Abruf ordnet sichtbaren Mond, Planeten und katalogisierte Satelliten nach
  Höhe und wertet die 48 hellsten Katalogsterne aus, um bis zu acht sichtbare Sterne vorzuschlagen.
  Eine Auswahl öffnet die vorhandenen Objektdetails und zentriert den Himmel neu. Berechneter Horizont
  und Geländeabschattung werden berücksichtigt, sofern verfügbar. Das aktive Ziel erhält nun eine
  berechnete 24-Stunden-Höhenkurve mit Aufgang, Kulmination, Untergang, USNO-Dämmerungsbändern,
  Mondlichtstörung, einem ausdrücklich illustrativen Bestfenster-Index und einer Aktion, die Zeit und
  Kamera gemeinsam verschiebt. Das Kurvenziel kann aus demselben lokalen Katalog ersetzt werden, ohne
  den aktuellen Himmel zu bewegen; erst diese Aktion übernimmt Ziel, gemeinsame Zeit und Kamera.
  Eine kompakte Übersicht wendet dieselbe Berechnung auf sieben aufeinanderfolgende Nächte an. Sie
  hebt automatisch die stärkste Nacht mit einem vergleichbaren illustrativen Index von 100 hervor
  und zeigt Höhe, Dunkelheit, Mondlicht und Geländefreiheit, bevor die direkte Aktion zum lokal auf
  fünf Minuten verfeinerten besten Zeitpunkt wechselt. Live-Wetter, Lichtverschmutzung und lokale
  Hindernisse bleiben außen vor.
- Für jeden festen Katalogort wird ein 360°-Verdeckungsprofil aus dem maßgeblichen
  NOAA/NCEI-Oberflächenrelief ETOPO 2022 v1 mit 60 Bogensekunden berechnet. Die kompakten Profile
  werden verzögert geladen und können Sterne, Mond, Planeten und Satelliten hinter modelliertem Gelände
  verdecken; Gebäude, Vegetation, Mikrorelief und freie Koordinaten bleiben außerhalb des Modells.
  Drei berechnete Entfernungshüllen (0–30, 30–100 und 100–300 km) verleihen der Silhouette Tiefe;
  Farbe und Beleuchtung sind stilisiert.
- Mond, sieben sichtbare Planeten und zwanzig weitere katalogisierte Satelliten verwenden ihre
  vorhandenen Three.js-Objekte, Materialien, Beleuchtung und verzögert geladenen Texturen. Die
  topozentrischen Richtungen und Winkeldurchmesser verwenden physische Bahndistanzen: galileische
  Positionen sind berechnet, die sechzehn Bahnen aus mittleren J2000-Elementen bleiben als extrapoliert
  gekennzeichnet. Satelliten erscheinen ab einem Sichtfeld von 12° oder sofort als Ziel, um Überlagerung
  im Weitwinkel zu vermeiden; die Mindestgröße zur Lesbarkeit bleibt ausdrücklich illustrativ.
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
- Nahe Galaxien verwenden nun die geometrische Lichtlaufzeit ihrer Katalogentfernung. Cosmicflows-4-
  Distanzmodule gelten als Leuchtkraftentfernungen und Kartenentfernungen großräumiger Strukturen als
  komovierende Entfernungen; beide werden im dokumentierten flachen ΛCDM-Modell invertiert. Karten
  zeigen abgeleitete Rotverschiebung und Rückblickzeit, während Positionen und statische Erscheinung
  unverändert bleiben und das Ergebnis als extrapoliert markiert ist.
- Veröffentlichte Wände, probabilistische Becken, Attraktoren und Repeller behalten getrennte
  Herkunft und Symbole und werden nicht in das Tempel-Filamentnetz integriert.
- Für Kaltstart, Tempel-Übergang sowie Ressourcen- und Bildstabilität existieren reproduzierbare
  Browser-Benchmarks.
- Eine wiederholte physische High-End-Baseline dokumentiert nun je drei Läufe für Start, Tempel und
  kalte Bilder sowie drei Ressourcenzyklen nach dem Aufwärmen auf einem Apple M5 Max mit echtem
  Metal-Renderer. Sie ist kein Nachweis für eine andere Geräteklasse.
- Ein eigener Benchmark für das Beobachter-Planetarium deckt nun echtes Schwenken, Zentrieren, den
  auf Jupiter verankerten Übergang zum gemeinsam genutzten aufgelösten Planeten und das Herauszoomen
  ab. Drei physische High-End-Retina-Läufe bestanden an der DPR-Grenze 1,5 der hohen Qualität ohne
  lange Bilder. Eine getrennte, ausdrücklich simulierte CPU-4×/6×-Stressmatrix besteht ebenfalls und
  misst nur die Regressionsreserve.
- Alle fünf manuellen Leistungsprotokolle verwenden nun denselben versionierten JSON-Nachweis für
  Quellzustand, Host, Renderer, Konfiguration, Messwerte und Zusammenfassung. Eine Nur-Physisch-Sperre
  weist simulierte, per Software gerenderte oder nicht klassifizierte Messungen vor dem Schreiben
  zurück. Ein Kampagnenbefehl mit sauberem Checkout führt sie nacheinander aus und bindet die fünf
  Dateien in ein per SHA-256 prüfbares Manifest.
- Ein separater Befehl mit sauberem Checkout führt nun die mittlere und niedrige Regressionskampagne
  auf demselben Host über alle fünf Protokolle aus: mittlere Qualität bei CPU 4×, danach niedrige
  Qualität bei CPU 6×. Das getrennte Simulationsmanifest bindet zehn Berichte und hält fest, dass GPU,
  Speicher, Treiber, Bandbreite und thermisches Verhalten zum Quellhost gehören.
- Die vier ergänzenden Kataloge werden nun in einem eigenen Modul-Worker geladen und dekodiert; ihre
  typisierten Puffer werden ohne Kopie übertragen. Die Worker-Vorbereitung erzeugt keine
  Szenenressource. Danach benötigt die Installation von Registern, Suche, Geometrie und GPU auf dem
  Hauptthread ein neues 1,2-Sekunden-Fenster mit stabiler Kamera. Transitionen starten die Frist neu,
  der Beobachtungsmodus sperrt die Hintergrundinstallation vollständig, und ein ausdrücklich
  angefordertes Ziel lädt weiterhin sofort. Die saubere Kampagne der Revision besteht nun alle zehn
  Berichte. Skalenläufe mit mittel/CPU 4× bleiben bei 9,3 ms p95 mit einem schlechtesten Bild von
  66,5 ms; niedrig/CPU 6× bleibt bei 16,6–16,7 ms p95 mit einem schlechtesten Bild von 83,4 ms. Die
  Beobachterläufe lösen Jupiter in beiden Profilen 3/3 auf, und die Ressourcenzahlen driften nicht.

## Aktuelle Prioritäten

- Das saubere simulierte 10/10-Manifest als Regressionsbaseline beibehalten und die Kampagne nach
  wesentlichen Änderungen an Rendering oder Katalogen wiederholen. Die aktuellen Nachweise
  rechtfertigen weder einen aufwendigeren Shader-Vorkompilierungspfad noch einen detailärmeren
  Fallback; eine physische Mittel-/Niedrig-Validierung bleibt optional, falls geeignete Hardware
  verfügbar wird. Simulierte Profile bleiben Regressionswächter, keine Geräteaussagen.

Das Planetarium bleibt eine getrennte topozentrische Projektion des gewählten Beobachtungsorts. Die
zeitliche Karte Empfangenes Licht verwendet für unterstützte Körper des Sonnensystems die Erde und
für HYG-Sterne sowie dokumentierte Exoplanetensysteme das Baryzentrum des Sonnensystems.

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
