---
title: Navigation und Maßstäbe
description: Lernen Sie Kamerasteuerung, semantischen Zoom, Bezugssysteme, Zielauswahl und Maßstabswechsel in Universe Map kennen.
---

# Navigation und Maßstäbe

Universe Map verhält sich wie eine räumliche Karte und nicht wie ein festes Bahndiagramm.
Kamerageschwindigkeit, Mindestabstand, Beschriftungen, Darstellungen und Hintergründe passen sich dem
astronomischen Kontext an.

## Steuerung

| Aktion                      | Desktop                     | Touch                           |
| --------------------------- | --------------------------- | ------------------------------- |
| Um das Ziel drehen          | Linksklick und ziehen       | Mit einem Finger ziehen         |
| Verschieben                 | Rechtsklick und ziehen      | Mit zwei Fingern ziehen         |
| Zum Zeiger zoomen           | Mausrad                     | Pinch-Geste                     |
| Auswählen                   | Objekt oder Namen anklicken | Objekt oder Namen antippen      |
| Fokussieren                 | Doppelklick, Name oder `F`  | Doppeltippen oder Name antippen |
| Zeit starten oder pausieren | `Leertaste`                 | Schaltfläche der Zeitleiste     |
| Zeitgeschwindigkeit ändern  | `+` oder `-`                | Auswahl der Zeitleiste          |
| Objektkarte schließen       | `Escape`                    | Schließen-Schaltfläche          |

Der Zoom folgt dem Zeiger. Ohne Ziel bewegt sich die Kamera weiterhin zum Punkt unter dem Cursor.
Nahe an einem Körper verhindern Grenzen das unbeabsichtigte Durchqueren seiner sichtbaren Oberfläche.

## Sieben Kartenmaßstäbe

| Maßstab                | Typischer Inhalt                          | Hauptdarstellung                                  |
| ---------------------- | ----------------------------------------- | ------------------------------------------------- |
| Planetar               | Oberfläche, Atmosphäre, Ringe, Monde      | Detaillierte Meshes und Texturen                  |
| Sonnensystem           | Sonne, Planeten, Kleinkörper, Bahnen      | Adaptive Meshes, Namen und Bahnkurven             |
| Stellare Nachbarschaft | HYG-Sterne, Exoplanetenwirte, Sternbilder | GPU-Punktstapel und Auswahldetails                |
| Milchstraße            | Scheibe, Bulge, Arme und lokale Position  | Geschichtetes Emissionsvolumen und Katalogkontext |
| Lokale Gruppe          | Milchstraße, Andromeda und Satelliten     | Galaxie-Impostoren und begrenzte Volumen          |
| Nahes Universum        | Galaxien und Gruppen des lokalen Volumens | Raumkacheln und Übersichtsstapel                  |
| Kosmisches Netz        | Gruppen, Haufen, Voids und Filamente      | Punkte, Linien und simuliertes Dichtevolumen      |

Der Übergang ist kontinuierlich, doch jede Ebene nutzt ein eigenes Bezugssystem. Der Renderer
zentriert Koordinaten bei Bedarf um die Kamera, um numerische Präzision zu erhalten.

## Ziel, Auswahl und Beschriftungen

Das **Ziel** ist der Kameradrehpunkt, die **Auswahl** erscheint in der Informationskarte, und eine
**Beschriftung** ist eine kollisionsverwaltete Bildschirmanmerkung. Ein Klick wählt und fokussiert das
Objekt. Die Dichte kann minimal, ausgewogen oder dicht sein. Ziel, Auswahl und wichtige Bezugspunkte
haben Vorrang. Die Sonne bleibt lokal sichtbar, anschließend übernimmt die Milchstraße.

Das Maßstabsmenü erlaubt direkte Sprünge mit derselben Interpolation wie die Suche. Wirkt eine Ansicht
leer, prüfen Sie den Maßstab, aktivieren Sie Namen, erhöhen Sie die Dichte, wählen Sie Sonne oder
Milchstraße oder senken Sie bei langsamer Hardware die Qualität.

Weiter: [Zeit und Finsternisse](/de/time-and-eclipses/).
