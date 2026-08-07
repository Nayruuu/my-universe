---
title: Erste Schritte
description: Öffnen Sie Universe Map, lernen Sie die Oberfläche kennen, wählen Sie ein Grafikprofil und teilen Sie Ihre erste astronomische Ansicht.
---

# Erste Schritte

Universe Map läuft vollständig in einem modernen Browser. Ein Konto oder Anwendungs-Backend ist nicht
nötig. Kataloge, Texturen und Modelle werden als statische Dateien bereitgestellt und beim Wechsel des
Kameramaßstabs schrittweise geladen.

## Karte öffnen

Besuchen Sie [super-universe.app](https://super-universe.app/de/). Die erste Ansicht lädt die
Rendering-Engine und ein kompaktes Manifest; größere Stern- und Galaxiendaten werden erst bei Bedarf
abgerufen.

Für einen guten Einstieg:

1. verwenden Sie einen aktuellen Desktop-Browser mit WebGL 2;
2. lassen Sie die Qualität mit einer modernen GPU auf **Hoch**;
3. warten Sie, bis die Ladeanzeige verschwindet;
4. scrollen Sie über einem sichtbaren Objekt oder klicken Sie dessen Namen an.

Touch-Navigation wird ebenfalls unterstützt; auf kleinen Geräten sinkt die visuelle Dichte
automatisch.

## Oberfläche

| Bereich              | Zweck                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| Suche oben           | Planeten, Monde, Sterne, Exoplaneten, Galaxien, Schwarze Löcher, Supernovae und Großstrukturen finden. |
| Maßstabsleiste       | Astronomische Hierarchie anzeigen und direkt zu übergeordneten Ebenen springen.                        |
| Objektkarte          | Quellen, Aliasse, Eigenschaften, Verlässlichkeit und Fokusaktionen anzeigen.                           |
| Schwebende Steuerung | Zoomen, zu Erde oder Sonne zurückkehren und Bahnen, Sternbilder oder Namen schalten.                   |
| Zeitleiste           | UTC bearbeiten, pausieren, Geschwindigkeit wählen und Finsternisse durchsuchen.                        |
| Kartenmaßstab        | Einen an den Kamerakontext angepassten Bildschirmmaßstab anzeigen.                                     |

## Eine erste Reise

1. suchen Sie nach **Erde** und wählen Sie das Ergebnis;
2. zoomen Sie mit Mausrad oder Pinch aus dem Sonnensystem heraus;
3. wählen Sie **Sonne** und reisen Sie weiter in die stellare Nachbarschaft;
4. wählen Sie **Milchstraße** im Maßstabsmenü;
5. erkunden Sie Lokale Gruppe, nahes Universum und kosmisches Netz;
6. kehren Sie über die Hierarchieleiste zum Sonnensystem zurück.

Das Ziel bestimmt den Kameradrehpunkt, die Auswahl die Informationskarte. Nach Suche oder
Beschriftungsklick stimmen beide meist überein, können sich bei freier Navigation aber trennen.

## Grafikqualität und Teilen

- **Niedrig** reduziert Partikel, Texturen, Volumen und Kacheln;
- **Mittel** gleicht Detail und GPU-Aufwand aus;
- **Hoch** aktiviert die reichste begrenzte Darstellung des aktuellen Maßstabs.

Die Qualität ändert keine wissenschaftlichen Koordinaten. Der Teilen-Link bewahrt Ziel, Auswahl,
Datum, Zoom, Zeitmodus, Qualität, Namensdichte, Bahnen, Sternbilder und Beschriftungen. Die URL wird
verzögert statt in jedem Frame aktualisiert.

Weiter: [Navigation und Maßstäbe](/de/navigation/).
