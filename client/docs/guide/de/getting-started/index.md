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

Das logische Ziel bestimmt Kartenhierarchie und Distanzgrenzen, der geometrische Drehpunkt das
Umlaufzentrum der Kamera und die Auswahl die Informationskarte. Ein ausdrücklicher Fokus richtet alle
drei meist aus; Zeiger-Zoom und freie Navigation können sie jedoch trennen.

## Einen Stern vom Erdhorizont beobachten

Suchen Sie einen Stern wie **Sirius**, öffnen Sie seine Karte und wählen Sie **Von der Erde aus
orten**. Die lokale Himmelsansicht verwendet Datum und Beobachtungsort der Karte. Ziehen Sie zum
Umschauen, ändern Sie das Sichtfeld mit Mausrad oder Pinch und nutzen Sie **Neu zentrieren**, um das
Ziel wiederzufinden. Dies sind Planetariumssteuerungen: Solange die Horizontansicht geöffnet ist,
löst das Mausrad weder einen semantischen Kartenmaßstabswechsel noch eine Bewegung am Mindestabstand
aus. Der Ortswähler bietet 461 statische Beobachtungsorte weltweit; Beobachter und
Planetariumsansicht bleiben in einem geteilten Link erhalten. **Meinen Standort verwenden** fragt
erst nach der Auswahl nach der Browserfreigabe, rundet die Koordinaten auf drei Dezimalstellen
(ungefähr 100 m) und verwendet dann denselben teilbaren Beobachtervertrag.

Mond und sichtbare Planeten verwenden dieselben Three.js-Objekte, Materialien, Beleuchtung sowie
belegten oder angepassten Texturen wie die Kartenansicht. Topozentrische Richtungen und
Winkeldurchmesser werden für Ort und Zeitpunkt berechnet. Eine begrenzte Mindestgröße hält kleine
Planeten erkennbar und ist ausdrücklich illustrativ, nicht ihr tatsächlicher Winkeldurchmesser.

Der Horizont folgt dem Blickazimut und bleibt mit dem Boden verbunden, während der Himmel der Zeit
folgt. Acht ausgewählte Städte besitzen handgestaltete visuelle Kontexte; jeder Katalogort lädt bei
Bedarf vier nahe Landmarken aus regionalen statischen Paketen. Dokumentierte Namen, Koordinaten oder
Höhen machen die Darstellung nicht zu einer Vermessung: Gelände, Stadtlichter, Skyline-Ebenen und
generische Umrisse sind ausdrücklich illustrativ. Die Ansicht ersetzt weder ein vermessenes
Geländehindernismodell noch Wetterdaten, eine historische Stadtrekonstruktion oder professionelle
Beobachtungsplanung.

## Grafikqualität und Teilen

- **Niedrig** reduziert Partikel, Texturen, Volumen und Kacheln;
- **Mittel** gleicht Detail und GPU-Aufwand aus;
- **Hoch** aktiviert die reichste begrenzte Darstellung des aktuellen Maßstabs.

Die Qualität ändert keine wissenschaftlichen Koordinaten. Der Teilen-Link bewahrt Ziel, Auswahl,
Datum, Zoom, Zeitmodus, Qualität, Namensdichte, Bahnen, Sternbilder und Beschriftungen. Die URL wird
verzögert statt in jedem Frame aktualisiert.

Weiter: [Navigation und Maßstäbe](/de/navigation/).
