---
title: Cataloghi e fonti
description: Consulta i principali cataloghi astronomici, dataset statici, provenienze e processi di preparazione usati da Universe Map.
---

# Cataloghi e fonti

Tutti i dati di runtime sono ospitati con l’applicazione. Gli script puliscono le fonti, normalizzano
identificatori e unità, verificano i riferimenti, generano cataloghi binari o tessere spaziali e
aggiornano il manifesto versionato prima della distribuzione.

## Copertura attuale

| Livello               |                                           Copertura | Trattamento scientifico                                        |
| --------------------- | --------------------------------------------------: | -------------------------------------------------------------- |
| Sistema solare        | Sole, otto pianeti, lune e corpi minori selezionati | Effemeridi locali e fornitori orbitali documentati             |
| Esopianeti confermati |                6.333 pianeti attorno a 4.747 ospiti | Dati compositi NASA; sistemi ravvicinati illustrativi          |
| Catalogo stellare     |                                   10.000 stelle HYG | Coordinate osservate con supporto del moto proprio             |
| Costellazioni         |                     88 figure moderne, 644 segmenti | Convenzioni culturali collegate agli identificatori HYG        |
| Supernove storiche    |                                    6 eventi e resti | Posizioni e date documentate; evoluzione visiva illustrativa   |
| Gruppo Locale         |                                         31 galassie | Posizioni catalogate con morfologia adattata                   |
| Universo vicino       |                                        720 galassie | Octree statico del volume locale                               |
| Cosmicflows-4         |                                       37.730 gruppi | Posizioni 3D calcolate dai campi pubblicati                    |
| Grandi strutture      |                    26.500 rilevamenti posizionabili | Prodotti separati per ammassi, superammassi, vuoti e filamenti |
| Filamenti Tempel      |                         15.421 assi e 275.599 punti | Geometria pubblicata conservata in formato binario compatto    |

## Fonti principali

- [Astronomy Engine](https://github.com/cosinekitty/astronomy) per calcoli planetari e lunari;
- [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/) `PSCompPars` per esopianeti e ospiti;
- [HYG Database v4.1](https://github.com/astronexus/HYG-Database) per il campo stellare;
- [Stellarium](https://github.com/Stellarium/stellarium/tree/master/skycultures/modern) per le costellazioni moderne;
- [McConnachie 2012](https://ui.adsabs.harvard.edu/abs/2012AJ....144....4M/abstract) per il Gruppo Locale;
- [Updated Nearby Galaxy Catalog](https://ui.adsabs.harvard.edu/abs/2013AJ....145..101K/abstract) per il volume locale;
- [Cosmicflows-4](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/944/94) per i gruppi esterni;
- SDSS DR7, BOSS DR12, Planck PSZ2 e i [filamenti Tempel](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/MNRAS/438/3465);
- NASA Visible Earth e le fonti indicate con ciascuna texture.

Licenze e trasformazioni sono documentate accanto ai dati. I materiali di terzi mantengono la
licenza originale anche se il codice dell’applicazione è MIT.

## Manifesto e ricostruzione

`/data/manifest.json` è il punto di ingresso del browser. Ogni dataset dichiara identificatore, URL,
tipo e formato. I loader validano JSON e intestazioni binarie prima di esporre i dati al motore.

```bash
cd client
npm run data:stars
npm run data:exoplanets
npm run data:nearby-galaxies
npm run data:cosmic-web
npm run data:cosmic-structures
npm run test:data
```

Gli import non vengono eseguiti a ogni build: gli artefatti preparati sono versionati e validati, poi
rigenerati solo quando si aggiorna intenzionalmente una sorgente.

Continua con [Prestazioni e limiti](/it/performance-and-limits/).
