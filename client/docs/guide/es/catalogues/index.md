---
title: Catálogos y fuentes
description: Revisa los principales catálogos astronómicos, datos estáticos, procedencia y preparación utilizados por Universe Map.
---

# Catálogos y fuentes

Todos los datos de ejecución se alojan con la aplicación. Los scripts limpian las fuentes, normalizan
identificadores y unidades, validan referencias, generan catálogos binarios o teselas y actualizan el
manifiesto versionado antes del despliegue.

## Cobertura actual

| Capa                    |                                                 Cobertura | Tratamiento científico                                            |
| ----------------------- | --------------------------------------------------------: | ----------------------------------------------------------------- |
| Sistema Solar           | Sol, ocho planetas, lunas y cuerpos menores seleccionados | Efemérides locales y proveedores orbitales documentados           |
| Exoplanetas confirmados |             6.333 planetas alrededor de 4.747 anfitriones | Datos compuestos NASA; sistemas cercanos ilustrativos             |
| Catálogo estelar        |                                      10.000 estrellas HYG | Coordenadas observadas con movimiento propio                      |
| Constelaciones          |                        88 figuras modernas, 644 segmentos | Convenciones culturales vinculadas a HYG                          |
| Supernovas históricas   |                                    6 eventos y remanentes | Posiciones y fechas documentadas; evolución visual ilustrativa    |
| Grupo Local             |                                               31 galaxias | Posiciones catalogadas con morfología adaptada                    |
| Universo cercano        |                                              720 galaxias | Octree estático del volumen local                                 |
| Cosmicflows-4           |                                             37.730 grupos | Posiciones 3D calculadas de campos publicados                     |
| Grandes estructuras     |                          26.500 detecciones posicionables | Productos separados de cúmulos, supercúmulos, vacíos y filamentos |
| Filamentos Tempel       |                              15.421 ejes y 275.599 puntos | Geometría publicada en binario compacto                           |

## Fuentes principales

- [Astronomy Engine](https://github.com/cosinekitty/astronomy) para cálculos planetarios y lunares;
- [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/) para exoplanetas;
- [HYG Database v4.1](https://github.com/astronexus/HYG-Database) para estrellas;
- [Stellarium](https://github.com/Stellarium/stellarium/tree/master/skycultures/modern) para constelaciones;
- [McConnachie 2012](https://ui.adsabs.harvard.edu/abs/2012AJ....144....4M/abstract) para el Grupo Local;
- [Updated Nearby Galaxy Catalog](https://ui.adsabs.harvard.edu/abs/2013AJ....145..101K/abstract) para el volumen local;
- [Cosmicflows-4](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/944/94) para grupos externos;
- SDSS DR7, BOSS DR12, Planck PSZ2 y [filamentos Tempel](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/MNRAS/438/3465);
- NASA Visible Earth y las fuentes indicadas con cada textura.

Las licencias y transformaciones se documentan junto a los datos. Los recursos de terceros conservan
su licencia original aunque el código de la aplicación sea MIT.

`/data/manifest.json` es la entrada del navegador. Cada conjunto declara identificador, URL, tipo y
formato; los cargadores validan JSON y cabeceras binarias antes de exponerlo al motor.

```bash
cd client
npm run data:stars
npm run data:exoplanets
npm run data:nearby-galaxies
npm run data:cosmic-web
npm run data:cosmic-structures
npm run test:data
```

Los artefactos preparados se versionan y validan; los importadores solo se ejecutan al actualizar
intencionadamente una fuente.

Continúa con [Rendimiento y límites](/es/performance-and-limits/).
