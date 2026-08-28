---
title: Catalogues et sources
description: Consultez les principaux catalogues astronomiques, jeux de données statiques, provenances et traitements d’Universe Map.
---

# Catalogues et sources

Toutes les données d’exécution sont hébergées avec l’application. Des scripts nettoient les sources,
normalisent identifiants et unités, valident les références, génèrent catalogues binaires ou tuiles
spatiales et mettent à jour le manifeste versionné avant le déploiement.

## Couverture actuelle

| Couche                 |                                                                     Couverture | Traitement scientifique                                                                        |
| ---------------------- | -----------------------------------------------------------------------------: | ---------------------------------------------------------------------------------------------- |
| Système solaire        | 41 objets : Soleil, planètes, 21 lunes, planètes naines, astéroïdes et comètes | Éphémérides locales et fournisseurs orbitaux JPL documentés                                    |
| Exoplanètes confirmées |                                           6 333 planètes autour de 4 747 hôtes | Données NASA composites ; systèmes rapprochés illustratifs                                     |
| Catalogue stellaire    |                                                             10 000 étoiles HYG | Positions et vitesses J2000 observées ; propagation linéaire bornée à ±10 000 années juliennes |
| Hiérarchie Gaia        |                               2 923 790 entrées ; 133 526 échantillons mesurés | Agrégats calculés de 512 pc ; échantillons J2016.0 mesurés ; fond incomplet                    |
| Constellations         |                                              88 figures modernes, 644 segments | Conventions culturelles associées aux identifiants HYG                                         |
| Supernovas historiques |                                                      6 événements et rémanents | Positions et dates documentées ; évolution visuelle illustrative                               |
| Groupe local           |                                                                    31 galaxies | Positions cataloguées, morphologie et taille adaptées                                          |
| Univers proche         |                                                                   720 galaxies | Octree statique du volume local                                                                |
| Cosmicflows-4          |                                                                 37 730 groupes | Positions 3D calculées depuis les champs publiés                                               |
| Grandes structures     |                                               26 520 détections positionnables | Produits séparés d’amas, superamas, murs, bassins, attracteurs, répulseurs, vides et filaments |
| Filaments Tempel       |                                                  15 421 axes et 275 599 points | Géométrie publiée conservée en binaire compact                                                 |

Le binaire Tempel est téléchargé et validé dans un Web Worker dédié à l’échelle du réseau cosmique.
Ses six buffers typés décodés sont transférés sans copie ; les navigateurs sans Worker utilisent le
même chargeur validé sur le thread principal.

Les 20 grands repères de flux ne sont pas fusionnés avec le réseau Tempel : deux murs conservent
leurs étendues représentatives publiées, 15 bassins probabilistes reprennent les centres et
probabilités du tableau 2, et les symboles d’attracteur ou de répulseur marquent des extrema du champ
de vitesses reconstruit. Le rayon d’un bassin est un rayon visuel équivalent dérivé du volume publié,
pas une frontière sphérique observée.

## Sources principales

- [Astronomy Engine](https://github.com/cosinekitty/astronomy) pour les calculs planétaires et lunaires ;
- les [éléments moyens des satellites NASA/JPL](https://ssd.jpl.nasa.gov/sats/elem/) et leurs
  [paramètres physiques](https://ssd.jpl.nasa.gov/sats/phys_par/) pour les lunes principales ;
- la [NASA/JPL Small-Body Database](https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html) pour les
  planètes naines, astéroïdes et comètes intégrés ;
- les [cartes du Solar System Simulator NASA/JPL](https://space.jpl.nasa.gov/tmaps/) et
  [USGS Astrogeology](https://astrogeology.usgs.gov/) pour les mosaïques de surface embarquées ;
- les [modèles planétaires NASA VTAD](https://science.nasa.gov/3d-resources/) pour les atlas
  atmosphériques représentatifs de Saturne, Uranus et Neptune ;
- les modèles NASA/JPL-Caltech de
  [Phobos](https://science.nasa.gov/resource/phobos-mars-moon-3d-model/) et
  [Déimos](https://science.nasa.gov/resource/deimos-mars-moon-3d-model/), le
  [modèle de Cérès](https://science.nasa.gov/resource/ceres-3d-model/) et celui de
  [Vesta](https://science.nasa.gov/resource/vesta-3d-model/) publiés par NASA VTAD, le
  [modèle 3D NASA de Bénou](https://science.nasa.gov/resource/bennu-3d-model/) et le
  [catalogue de forme OSIRIS de 67P](https://sci.esa.int/science-e/www/object/index.cfm?fobjectid=54289)
  publié par l’ESA pour les formes observées chargées à la demande ;
- [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/) `PSCompPars` pour les exoplanètes ;
- [HYG Database v4.1](https://github.com/astronexus/HYG-Database) pour les étoiles ;
- [Gaia Data Release 3](https://www.cosmos.esa.int/web/gaia/data-release-3)
  `gaia_source_lite` pour le fond stellaire hybride et filtré par qualité ;
- [Stellarium](https://github.com/Stellarium/stellarium/tree/master/skycultures/modern) pour les constellations modernes ;
- [McConnachie 2012](https://ui.adsabs.harvard.edu/abs/2012AJ....144....4M/abstract) pour le Groupe local ;
- l’[Updated Nearby Galaxy Catalog](https://ui.adsabs.harvard.edu/abs/2013AJ....145..101K/abstract) ;
- [Cosmicflows-4](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/944/94) pour les groupes externes ;
- SDSS DR7, BOSS DR12, Planck PSZ2 et les [filaments Tempel](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/MNRAS/438/3465) ;
- NASA Visible Earth et les sources indiquées avec chaque texture.

Une mosaïque observée n’est utilisée que lorsqu’un produit global approprié existe. Les zones
complétées, couleurs traitées et couvertures incomplètes restent propres à la cartographie publiée
et sont signalées dans la fiche. Titan utilise une mosaïque Cassini ISS en proche infrarouge ;
Saturne, Uranus et Neptune utilisent des atlas représentatifs de modèles NASA explicitement marqués
`illustrative`. Phobos, Déimos, Cérès, Vesta et Bénou disposent de formes texturées observées ; 67P
d’une forme observée avec une surface neutre illustrative. Leurs modèles polygonaux ne sont chargés
qu’au LOD proche et conservent un fallback léger pendant le chargement ou en cas d’échec. Les autres
corps insuffisamment résolus gardent un matériau explicitement procédural plutôt qu’une fausse peau
photographique.

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
