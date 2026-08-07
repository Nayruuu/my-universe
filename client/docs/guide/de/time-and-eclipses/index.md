---
title: Zeit und Finsternisse
description: Verstehen Sie UTC-Zeit, Geschwindigkeiten, Planetenephemeriden, Achsrotation und Finsternisdarstellung in Universe Map.
---

# Zeit und Finsternisse

Die Zeitleiste steuert intern einen numerischen Julianischen Tag. Die Oberfläche nimmt ein ziviles
UTC-Datum an und wandelt es vor der Übergabe an die Rendering-Engine um.

## Zeitsteuerung

Sie können UTC-Datum und -Uhrzeit eingeben, abspielen oder pausieren, zur Gegenwart zurückkehren, eine
zum Maßstab passende Geschwindigkeit wählen und dokumentierte vergangene oder zukünftige
Finsternisse aufrufen. Im Pausenmodus bleiben Umlaufpositionen und Achsrotation fest; danach werden
beide wieder aus derselben internen Zeit statt aus der Framezahl berechnet.

## Zeitmodi

**Zustand zum gewählten Datum** zeigt den geschätzten Zustand aller Objekte zu einem gemeinsamen
Zeitpunkt und ist der implementierte Hauptmodus.

**Empfangenes Licht** behandelt das gewählte Datum als Empfangszeitpunkt. Unterstützte Körper des
Sonnensystems werden von der Erde aus betrachtet, HYG-Sterne vom Baryzentrum des Sonnensystems. Jedes
unterstützte Objekt wird für seinen eigenen Emissionszeitpunkt berechnet; auch seine Achsrotation
verwendet diesen Zeitpunkt. Die Objektkarte zeigt berechnete Lichtlaufzeit und Emissionsdatum.

Der Modus umfasst derzeit Sonne, Mond, Planeten, die galileischen Monde, dokumentierte
Zweikörper-Satelliten, Zwergplaneten, Asteroiden, Kometen, HYG-Sterne und Exoplanetensysteme mit
veröffentlichter Hostdistanz. Körper aus Astronomy Engine behalten berechnete Vertrauenswürdigkeit.
Die übrigen Sonnensystemobjekte lösen ihre von der Erde empfangene Verzögerung iterativ mit denselben
dokumentierten mittleren oder oskulierenden JPL-Elementen wie die Karte; das Ergebnis bleibt
ausdrücklich extrapoliert. Visuelle Distanzverstärkung geht nie in die Lichtlaufzeit ein.

Bei einem Exoplanetensystem bestimmt die
[NASA-PSCompPars-Systemdistanz](https://exoplanetarchive.ipac.caltech.edu/docs/API_PS_columns.html)
nach der [IAU-Parsec-Definition](https://www.iau.org/static/resolutions/IAU2015_English.pdf) eine
gemeinsame baryzentrische Verzögerung für Host und Planeten. Die statische Himmelsrichtung des Hosts
bleibt unverändert, weil diese Schicht keine Eigenbewegung rekonstruiert. Lokale Planetenbahnen werden
am gemeinsamen Emissionszeitpunkt ausgewertet, doch Phase, Orientierung und Anzeigemaßstab bleiben
ausdrücklich illustrativ. Systeme ohne veröffentlichte Distanz bleiben gleichzeitig. Galaxien und
großräumige Strukturen behalten ihren gleichzeitigen Modellzustand, bis ein kosmologischer Vertrag
verfügbar ist.

Dies ist ein Modell mit endlicher Lichtgeschwindigkeit, kein vollständiges relativistisches oder
kosmologisches Beobachtungsmodell. Die HYG-Extrapolation gleichförmiger Bewegung ist auf ±10.000
julianische Jahre begrenzt und wird beim Erreichen dieser Grenze gekennzeichnet.

Das Planetarium für Erdbeobachter bleibt eine getrennte topozentrische Projektion. Es verwendet den
gewählten Ort für Höhe, Azimut, Geländeverdeckung und scheinbare Winkelgröße; Empfangenes Licht macht
aus der 3D-Karte nicht dieses Planetarium.

## Positionen und Rotationen

Planeten- und Mondpositionen werden lokal mit Astronomy Engine berechnet. Einige Kleinkörper und
Monde verwenden dokumentierte Bahnelemente oder vereinfachte Provider. Die Objektkarte nennt die
zugehörige Verlässlichkeit.

Unterstützte Körper besitzen eine datumsabhängige Achsorientierung einschließlich rückläufiger
Rotation. Texturausrichtung und sichtbare Größe bleiben Rendering-Anpassungen.

## Finsternis-Browser

Der Browser umfasst Sonnen- und Mondfinsternisse des Erde-Mond-Systems. Er kann die Simulation zu
einem Ereignis versetzen, relevante Körper fokussieren und lokale Umstände für einen vordefinierten
französischen Ort oder manuell eingegebene Koordinaten berechnen. Eigene Koordinaten bleiben im
Browser und verwenden UTC, da kein Geokodierungs- oder Zeitzonendienst aufgerufen wird.

Sonnenansichten unterscheiden partielle, ringförmige und totale Ereignisse, zeigen
Mond-Erde-Sonne-Geometrie, Halbschatten und Zentralpfad. Außerdem erscheinen C1, C2, Maximum, C3 und
C4; Kontakte unter dem Horizont sind gekennzeichnet. C2 und C3 gibt es nur bei lokaler Totalität oder
Ringförmigkeit. Mondansichten zeigen den Eintritt des Mondes in den Erdschatten.

::: warning Interpretation
Die Orbitalszene übertreibt Radien und Abstände zur Lesbarkeit. Oberflächenebenen sind pädagogische
Rekonstruktionen, keine operationellen Vorhersagen. Nutzen Sie zur Beobachtung immer einen
autoritativen Dienst und beachten Sie den Augenschutz.
:::

Lange Extrapolationen, historische Rekonstruktionen und kosmologische Zeiten werden ausdrücklich als
extrapoliert, simuliert oder illustrativ gekennzeichnet.

Weiter: [Wissenschaftliche Verlässlichkeit](/de/scientific-confidence/).
