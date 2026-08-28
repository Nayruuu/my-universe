---
title: Catálogos y fuentes
description: Revisa los principales catálogos astronómicos, datos estáticos, procedencia y preparación utilizados por Universe Map.
---

# Catálogos y fuentes

Todos los datos de ejecución se alojan con la aplicación. Los scripts limpian las fuentes, normalizan
identificadores y unidades, validan referencias, generan catálogos binarios o teselas y actualizan el
manifiesto versionado antes del despliegue.

## Cobertura actual

| Capa                    |                                                 Cobertura | Tratamiento científico                                                                                    |
| ----------------------- | --------------------------------------------------------: | --------------------------------------------------------------------------------------------------------- |
| Sistema Solar           | Sol, ocho planetas, lunas y cuerpos menores seleccionados | Efemérides locales y proveedores orbitales documentados                                                   |
| Exoplanetas confirmados |             6.333 planetas alrededor de 4.747 anfitriones | Datos compuestos NASA; sistemas cercanos ilustrativos                                                     |
| Catálogo estelar        |                                      10.000 estrellas HYG | Posiciones y velocidades J2000 observadas; propagación lineal acotada a ±10.000 años julianos             |
| Jerarquía Gaia          |              2.923.790 entradas; 133.526 muestras medidas | Agregados calculados de 512 pc; muestras J2016.0 medidas; fondo incompleto                                |
| Constelaciones          |                        88 figuras modernas, 644 segmentos | Convenciones culturales vinculadas a HYG                                                                  |
| Supernovas históricas   |                                    6 eventos y remanentes | Posiciones y fechas documentadas; evolución visual ilustrativa                                            |
| Grupo Local             |                                               31 galaxias | Posiciones catalogadas con morfología adaptada                                                            |
| Universo cercano        |                                              720 galaxias | Octree estático del volumen local                                                                         |
| Cosmicflows-4           |                                             37.730 grupos | Posiciones 3D calculadas de campos publicados                                                             |
| Grandes estructuras     |                          26.520 detecciones posicionables | Productos separados de cúmulos, supercúmulos, muros, cuencas, atractores, repulsores, vacíos y filamentos |
| Filamentos Tempel       |                              15.421 ejes y 275.599 puntos | Geometría publicada en binario compacto                                                                   |

El binario Tempel se descarga y valida en un Web Worker dedicado al alcanzar la escala de la red
cósmica. Sus seis búferes tipados decodificados se transfieren sin copia; los navegadores sin Worker
utilizan el mismo cargador validado en el hilo principal.

## Fuentes principales

- [Astronomy Engine](https://github.com/cosinekitty/astronomy) para cálculos planetarios y lunares;
- [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/) para exoplanetas;
- [HYG Database v4.1](https://github.com/astronexus/HYG-Database) para estrellas;
- [Gaia Data Release 3](https://www.cosmos.esa.int/web/gaia/data-release-3)
  `gaia_source_lite` para el fondo estelar híbrido y filtrado por calidad;
- [Stellarium](https://github.com/Stellarium/stellarium/tree/master/skycultures/modern) para constelaciones;
- [McConnachie 2012](https://ui.adsabs.harvard.edu/abs/2012AJ....144....4M/abstract) para el Grupo Local;
- [Updated Nearby Galaxy Catalog](https://ui.adsabs.harvard.edu/abs/2013AJ....145..101K/abstract) para el volumen local;
- [Cosmicflows-4](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/944/94) para grupos externos;
- SDSS DR7, BOSS DR12, Planck PSZ2 y [filamentos Tempel](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/MNRAS/438/3465);
- NASA Visible Earth y las fuentes indicadas con cada textura.

Mosaicos adicionales de sondas de NASA/JPL y USGS aportan 23 superficies basadas en observaciones.
La ficha identifica huecos rellenados, color procesado y cobertura incompleta. Fobos y Deimos usan
modelos texturizados observados de NASA/JPL-Caltech que solo se cargan en el LOD cercano. Ceres y
Vesta usan modelos texturizados observados de NASA VTAD basados en productos Dawn. Bennu utiliza un
modelo 3D texturizado de NASA; 67P utiliza la forma observada por ESA/OSIRIS con una
superficie neutra explícitamente ilustrativa. Fuentes: [mapas JPL](https://space.jpl.nasa.gov/tmaps/),
[USGS Astrogeology](https://astrogeology.usgs.gov/),
[Fobos de NASA](https://science.nasa.gov/resource/phobos-mars-moon-3d-model/),
[Deimos de NASA](https://science.nasa.gov/resource/deimos-mars-moon-3d-model/),
[Ceres de NASA](https://science.nasa.gov/resource/ceres-3d-model/),
[Vesta de NASA](https://science.nasa.gov/resource/vesta-3d-model/),
[Bennu de NASA](https://science.nasa.gov/resource/bennu-3d-model/) y
[67P de ESA](https://sci.esa.int/science-e/www/object/index.cfm?fobjectid=54289).

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
