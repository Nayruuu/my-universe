---
title: Kataloge und Quellen
description: Sehen Sie die wichtigsten astronomischen Kataloge, statischen Datensätze, Herkünfte und Aufbereitungen von Universe Map ein.
---

# Kataloge und Quellen

Alle Laufzeitdaten werden mit der Anwendung gehostet. Skripte bereinigen Quellen, normalisieren
Bezeichner und Einheiten, prüfen Referenzen, erzeugen Binärkataloge oder Raumkacheln und aktualisieren
vor der Veröffentlichung das versionierte Manifest.

## Aktuelle Abdeckung

| Ebene                  |                                               Abdeckung | Wissenschaftliche Behandlung                                                                               |
| ---------------------- | ------------------------------------------------------: | ---------------------------------------------------------------------------------------------------------- |
| Sonnensystem           | Sonne, acht Planeten, ausgewählte Monde und Kleinkörper | Lokale Ephemeriden und dokumentierte Bahnprovider                                                          |
| Bestätigte Exoplaneten |                           6.333 Planeten um 4.747 Wirte | NASA-Verbunddaten; illustrative Nahsysteme                                                                 |
| Sternkatalog           |                                       10.000 HYG-Sterne | Beobachtete J2000-Positionen und -Geschwindigkeiten; lineare Fortschreibung über ±10.000 julianische Jahre |
| Sternbilder            |                        88 moderne Figuren, 644 Segmente | Kulturelle Konventionen mit HYG-Bezeichnern                                                                |
| Historische Supernovae |                              6 Ereignisse und Überreste | Dokumentierte Positionen und Daten; illustrative Entwicklung                                               |
| Lokale Gruppe          |                                             31 Galaxien | Katalogpositionen mit angepasster Morphologie                                                              |
| Nahes Universum        |                                            720 Galaxien | Statischer Octree des lokalen Volumens                                                                     |
| Cosmicflows-4          |                                          37.730 Gruppen | Aus veröffentlichten Feldern berechnete 3D-Positionen                                                      |
| Großstrukturen         |                        26.520 positionierbare Nachweise | Getrennte Haufen-, Superhaufen-, Wand-, Becken-, Attraktor-, Repeller-, Void- und Filamentprodukte         |
| Tempel-Filamente       |                        15.421 Achsen und 275.599 Punkte | Veröffentlichte Geometrie in kompaktem Binärformat                                                         |

Die Tempel-Binärdatei wird auf der Skala des kosmischen Netzes in einem eigenen Web Worker geladen
und validiert. Die sechs dekodierten Typed-Array-Puffer werden ohne Kopie übertragen; Browser ohne
Worker-Unterstützung verwenden denselben validierten Loader im Hauptthread.

## Hauptquellen

- [Astronomy Engine](https://github.com/cosinekitty/astronomy) für Planeten und Mond;
- [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/) für Exoplaneten;
- [HYG Database v4.1](https://github.com/astronexus/HYG-Database) für Sterne;
- [Stellarium](https://github.com/Stellarium/stellarium/tree/master/skycultures/modern) für Sternbilder;
- [McConnachie 2012](https://ui.adsabs.harvard.edu/abs/2012AJ....144....4M/abstract) für die Lokale Gruppe;
- [Updated Nearby Galaxy Catalog](https://ui.adsabs.harvard.edu/abs/2013AJ....145..101K/abstract) für das lokale Volumen;
- [Cosmicflows-4](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/944/94) für äußere Gruppen;
- SDSS DR7, BOSS DR12, Planck PSZ2 und [Tempel-Filamente](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/MNRAS/438/3465);
- NASA Visible Earth und bei den Texturen genannte Quellen.

Zusätzliche NASA/JPL- und USGS-Sondenmosaike liefern 23 beobachtungsbasierte Oberflächen. Gefüllte
Lücken, bearbeitete Farben und unvollständige Abdeckung werden in der Objektkarte kenntlich gemacht.
Phobos und Deimos verwenden beobachtete texturierte NASA/JPL-Caltech-Modelle, die erst im Nah-LOD
geladen werden. Ceres und Vesta verwenden beobachtete texturierte NASA-VTAD-Modelle nach
Dawn-Produkten. Der Bennu-Körper verwendet ein texturiertes NASA-3D-Modell; 67P verwendet die
beobachtete ESA/OSIRIS-Form mit einer ausdrücklich illustrativen neutralen Oberfläche. Quellen:
[JPL-Karten](https://space.jpl.nasa.gov/tmaps/), [USGS Astrogeology](https://astrogeology.usgs.gov/),
[NASA Phobos](https://science.nasa.gov/resource/phobos-mars-moon-3d-model/),
[NASA Deimos](https://science.nasa.gov/resource/deimos-mars-moon-3d-model/),
[NASA Ceres](https://science.nasa.gov/resource/ceres-3d-model/),
[NASA Vesta](https://science.nasa.gov/resource/vesta-3d-model/),
[NASA Bennu](https://science.nasa.gov/resource/bennu-3d-model/) und
[ESA 67P](https://sci.esa.int/science-e/www/object/index.cfm?fobjectid=54289).

Lizenzen und Transformationen stehen bei den Daten. Drittmaterial behält seine ursprüngliche Lizenz,
auch wenn der Anwendungscode MIT-lizenziert ist.

`/data/manifest.json` ist der Browser-Einstieg. Jeder Datensatz nennt ID, URL, Typ und Format; Loader
prüfen JSON und Binärheader vor der Übergabe an die Engine.

```bash
cd client
npm run data:stars
npm run data:exoplanets
npm run data:nearby-galaxies
npm run data:cosmic-web
npm run data:cosmic-structures
npm run test:data
```

Vorbereitete Artefakte werden versioniert und validiert. Importe laufen nur bei einer bewussten
Aktualisierung der Quelle.

Weiter: [Leistung und Grenzen](/de/performance-and-limits/).
