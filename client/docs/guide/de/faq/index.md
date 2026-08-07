---
title: Häufige Fragen
description: Antworten zu Maßstab, Genauigkeit, fehlenden Objekten, Finsternissen, Leistung, statischen Daten und Umfang von Universe Map.
---

# Häufige Fragen

## Sind Größen und Entfernungen physikalisch maßstäblich?

Quellwerte behalten wissenschaftliche Einheiten, doch das Rendering passt Radien, Helligkeit und
einige Abstände an. Ein global physikalischer Maßstab würde Planeten und Sterne meist unsichtbar
machen. Die Objektkarte nennt den visuellen Maßstabsmodus.

## Warum ändert sich die Darstellung beim Zoomen?

Detailstufen verwandeln eine ferne Galaxie vom Impostor über eine prozedurale Scheibe in ein
begrenztes Partikelvolumen. Überblendungen erhalten Kontinuität und begrenzen Geometrie und Draw Calls.

## Warum fehlen Namen?

Beschriftungen werden priorisiert und kollisionsverwaltet. Erhöhen Sie die Dichte, gehen Sie näher
heran oder suchen Sie das Objekt. Alle Namen zugleich würden die Karte verdecken.

## Kann ich jeden bekannten Stern oder jede Galaxie finden?

Nein. Die Karte nutzt ausgewählte, räumlich gekachelte Kataloge. Deren Einträge sind durchsuchbar,
aber die Datenbank ist nicht vollständig.

## Sind Exoplanetenoberflächen echt?

Nein. Periode, Radius, Masse, Nachweismethode und Wirtsposition stammen aus dem Katalog; Farbe,
Gelände, Phase, Orientierung und Nahbahn sind illustrativ.

## Kann ich eine Finsternisbeobachtung planen?

Nutzen Sie die Ansicht zum Verständnis der Geometrie, bestätigen Sie aber lokale Umstände und
Augenschutz bei einem autoritativen Astronomiedienst.

## Nutzt das Schwarze Loch echte Allgemeine Relativität?

Nein. Es verzerrt den Hintergrund qualitativ mit einer dünnen Linse und trennt Horizont und Emission.
Es ist kein numerischer relativistischer Raytracer.

## Braucht die Anwendung ein Backend?

Nein. Suche, Zeit, Kataloge, Texturen, Kacheln und URL-Freigabe laufen im Browser oder statisch.

## Kann ich eine genaue Ansicht teilen?

Ja. Die Freigabe bewahrt Ziel, Auswahl, Datum, Zoom, Zeitmodus, Qualität und Hauptoptionen.

## Wie melde ich Fehler oder wirke mit?

Eröffnen Sie ein Issue im [GitHub-Repository](https://github.com/Nayruuu/my-universe/issues). Nennen
Sie für wissenschaftliche Korrekturen Quelle, Bezugssystem, Epoche, Einheit und einen prüfbaren Wert.
