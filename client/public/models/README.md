# Observed shape-model sources

## Phobos

- local asset: `phobos-nasa-jpl.glb`;
- source: NASA Science, “Phobos Mars Moon 3D Model”;
- credit: NASA/JPL-Caltech;
- reference: https://science.nasa.gov/resource/phobos-mars-moon-3d-model/;
- content: 16,449 vertices, 32,040 triangular faces, and an embedded 2,048 × 2,048 surface map;
- scientific label: observed shape and observed surface, displayed at an adaptive visual scale.

## Deimos

- local asset: `deimos-nasa-jpl.glb`;
- source: NASA Science, “Deimos Mars Moon 3D Model”;
- credit: NASA/JPL-Caltech;
- reference: https://science.nasa.gov/resource/deimos-mars-moon-3d-model/;
- content: 16,649 vertices, 32,512 triangular faces, and an embedded 1,024 × 1,024 surface map;
- scientific label: observed shape and observed surface, displayed at an adaptive visual scale.

The Phobos and Deimos models combine polygonal geometry and Viking-derived cartography published by
NASA/JPL-Caltech. Universe Map preserves their authored geometry and embedded maps, then applies the
documented body-fixed orientation and adaptive map scale at runtime.

## Ceres

- local asset: `ceres-nasa-vtad.glb`;
- source: NASA Science, “Ceres 3D Model”;
- credit: NASA Visualization Technology Applications and Development (VTAD);
- reference: https://science.nasa.gov/resource/ceres-3d-model/;
- content: 10,603 vertices, 20,508 triangular faces, an embedded 4,096 × 2,048 diffuse map, and an
  embedded 2,048 × 1,024 normal map;
- scientific label: observed shape and observed surface, displayed at an adaptive visual scale.

## Vesta

- local asset: `vesta-nasa-vtad.glb`;
- source: NASA Science, “Vesta 3D Model”;
- credit: NASA Visualization Technology Applications and Development (VTAD);
- reference: https://science.nasa.gov/resource/vesta-3d-model/;
- content: 17,558 vertices, 34,560 triangular faces, and embedded 2,048 × 1,024 diffuse and normal
  maps;
- scientific label: observed shape and observed surface, displayed at an adaptive visual scale.

The two browser assets are unchanged copies of the NASA GLB downloads. Their close-up relief is
consistent with the Dawn-derived shape products catalogued by NASA PDS and USGS Astrogeology. A
restrained illustrative shadow fill keeps the observed maps readable from the night side; it does
not reconstruct surface illumination at the selected date.

## Pallas

- local asset: `pallas-damit-4395.obj`;
- source: DAMIT model 4395, Marsset et al. (2020);
- credit: Database of Asteroid Models from Inversion Techniques, Astronomical Institute of Charles
  University, and the model authors;
- reference: https://damit.cuni.cz/projects/damit/asteroid_models/view/4395;
- content: 1,602 vertices and 3,200 triangular faces, calibrated in kilometres;
- scientific label: calculated non-convex shape reconstructed from VLT/SPHERE observations,
  illustrative neutral surface, displayed at an adaptive visual scale.

## Hygiea

- local asset: `hygiea-damit-4392.obj`;
- source: DAMIT model 4392, Vernazza et al. (2020);
- credit: Database of Asteroid Models from Inversion Techniques, Astronomical Institute of Charles
  University, and the model authors;
- reference: https://damit.cuni.cz/projects/damit/asteroid_models/view/4392;
- content: 1,602 vertices and 3,200 triangular faces, calibrated in kilometres;
- scientific label: calculated non-convex shape reconstructed from VLT/SPHERE observations,
  illustrative dark surface, displayed at an adaptive visual scale.

DAMIT rates both reconstructions at quality level 4: disk-resolved observations resolve the pole
ambiguity and constrain a shape expected to correspond well to the real body, but the mesh is still
a calculated inversion rather than a spacecraft scan. DAMIT content is distributed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The runtime converts the source Z-up IAU
frame to the renderer's Y-up body frame before applying the published IAUspin solution.

## Bennu

- local asset: `bennu-nasa-vtad.glb`;
- source: NASA Science, “Bennu 3D Model”;
- credit: NASA Visualization Technology Applications and Development (VTAD);
- reference: https://science.nasa.gov/resource/bennu-3d-model/;
- content: a polygonal shape with an embedded surface texture;
- scientific label: observed shape and observed surface, displayed at an adaptive visual scale.

The model is distributed through NASA's public 3D Resources collection. Use follows NASA's image
and media usage guidelines and does not imply NASA endorsement.

## Comet 67P/Churyumov–Gerasimenko

- local asset: `67p-osiris-esa.obj`;
- source: the October 2014 OSIRIS shape-model download in ESA's 67P shape-model catalogue;
- full credit: ESA/Rosetta/MPS for OSIRIS Team
  MPS/UPD/LAM/IAA/SSO/INTA/UPM/DASP/IDA;
- reference: https://sci.esa.int/science-e/www/object/index.cfm?fobjectid=54289;
- content: 31,456 vertices and 62,908 triangular faces, without a photographic texture;
- scientific label: observed shape, illustrative neutral surface color, no simulated jets.

Universe Map uses the asset for educational and informational presentation with the full source
credit required by ESA's media terms. It is not presented as an ESA endorsement. The OBJ geometry
is preserved; only its scale, center, browser material, and orientation inside the adaptive map are
changed for rendering.

## Runtime policy

All eight models are loaded only when their detailed LOD becomes visible. Until then, or if an asset
cannot be decoded, a lightweight procedural sphere remains available. Loaded geometry, materials,
and embedded textures are released when the registry is disposed, including when a download
finishes after navigation has already destroyed the scene.
