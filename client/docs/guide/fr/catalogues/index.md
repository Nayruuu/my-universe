---
title: Catalogues et sources
description: Consultez les principaux catalogues astronomiques, jeux de données statiques, provenances et traitements d’Universe Map.
---

# Catalogues et sources

Toutes les données d’exécution sont hébergées avec l’application. Des scripts nettoient les sources,
normalisent identifiants et unités, valident les références, génèrent catalogues binaires ou tuiles
spatiales et mettent à jour le manifeste versionné avant le déploiement.

## Couverture actuelle

| Couche                 |                                                Couverture | Traitement scientifique                                          |
| ---------------------- | --------------------------------------------------------: | ---------------------------------------------------------------- |
| Système solaire        | Soleil, huit planètes, lunes et petits corps sélectionnés | Éphémérides locales et fournisseurs orbitaux documentés          |
| Exoplanètes confirmées |                      6 333 planètes autour de 4 747 hôtes | Données NASA composites ; systèmes rapprochés illustratifs       |
| Catalogue stellaire    |                                        10 000 étoiles HYG | Coordonnées observées avec mouvement propre                      |
| Constellations         |                         88 figures modernes, 644 segments | Conventions culturelles associées aux identifiants HYG           |
| Supernovas historiques |                                 6 événements et rémanents | Positions et dates documentées ; évolution visuelle illustrative |
| Groupe local           |                                               31 galaxies | Positions cataloguées, morphologie et taille adaptées            |
| Univers proche         |                                              720 galaxies | Octree statique du volume local                                  |
| Cosmicflows-4          |                                            37 730 groupes | Positions 3D calculées depuis les champs publiés                 |
| Grandes structures     |                          26 500 détections positionnables | Produits séparés d’amas, superamas, vides et filaments           |
| Filaments Tempel       |                             15 421 axes et 275 599 points | Géométrie publiée conservée en binaire compact                   |

## Sources principales

- [Astronomy Engine](https://github.com/cosinekitty/astronomy) pour les calculs planétaires et lunaires ;
- [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/) `PSCompPars` pour les exoplanètes ;
- [HYG Database v4.1](https://github.com/astronexus/HYG-Database) pour les étoiles ;
- [Stellarium](https://github.com/Stellarium/stellarium/tree/master/skycultures/modern) pour les constellations modernes ;
- [McConnachie 2012](https://ui.adsabs.harvard.edu/abs/2012AJ....144....4M/abstract) pour le Groupe local ;
- l’[Updated Nearby Galaxy Catalog](https://ui.adsabs.harvard.edu/abs/2013AJ....145..101K/abstract) ;
- [Cosmicflows-4](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/944/94) pour les groupes externes ;
- SDSS DR7, BOSS DR12, Planck PSZ2 et les [filaments Tempel](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/MNRAS/438/3465) ;
- NASA Visible Earth et les sources indiquées avec chaque texture.

Les licences et transformations sont enregistrées avec les données. Les ressources tierces gardent
leur licence d’origine, même si le code de l’application est sous licence MIT.

## Manifeste et reconstruction

`/data/manifest.json` est le point d’entrée navigateur. Chaque jeu déclare identifiant, URL, type et
format. Les chargeurs valident JSON et en-têtes binaires avant exposition au moteur.

```bash
cd client
npm run data:stars
npm run data:exoplanets
npm run data:nearby-galaxies
npm run data:cosmic-web
npm run data:cosmic-structures
npm run test:data
```

Ces imports ne sont pas exécutés à chaque build : les artefacts préparés et versionnés sont validés,
puis régénérés uniquement lors d’une mise à jour volontaire des sources.

Suite : [Performances et limites](/fr/performance-and-limits/).
