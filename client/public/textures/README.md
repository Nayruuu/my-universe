# Texture sources

## Earth

- source: NASA Visible Earth, “The Blue Marble: Land Surface, Ocean Color and Sea Ice”;
- original file: `land_ocean_ice_cloud_2048.jpg`, 2048×1024;
- credit: NASA Goddard Space Flight Center, image by Reto Stöckli, enhancements by Robert Simmon,
  MODIS and USGS data;
- reference page:
  https://science.nasa.gov/earth/earth-observatory/the-blue-marble-true-color-global-imagery-at-1km-resolution/

The 2048×1024 and 1024×512 surface variants are hosted locally. This cloud-free base preserves the
readability of calculated shadows.

The independent cloud layer comes from NASA Visible Earth, “Blue Marble: Clouds”:

- original file: `cloud_combined_2048.jpg`, 2048×1024;
- data: MODIS visible-light observations completed with thermal infrared imagery over the poles;
- reference page: https://visibleearth.nasa.gov/images/57747/blue-marble-clouds;
- local files: `earth-clouds-1024.jpg` and `earth-clouds-2048.jpg`.

This is a static composite, not live weather. The independent night layer comes from NASA Earth
Observatory's 2012 Black Marble:

- original file: `dnb_land_ocean_ice.2012.3600x1800.jpg`, 3600×1800;
- data: Suomi NPP VIIRS day-night band, composite from April and October 2012;
- reference page: https://earthobservatory.nasa.gov/features/NightLights;
- local files: `earth-night-lights-1024.jpg` and `earth-night-lights-2048.jpg`.

The surface, cloud, and night maps use the same east-positive, prime-meridian-centered sampling.
The runtime reverses their horizontal texture coordinate because Three.js sphere UVs increase in
the opposite body-fixed longitude direction.

## Moon

The lunar surface and relief come from NASA Goddard's CGI Moon Kit:

- color source: the 2025 LRO WAC color mosaic, `lroc_color_2k.jpg`, 2048×1024;
- relief source: the LRO LOLA elevation derivative `ldem_3_8bit.jpg`, 1024×512;
- credit: NASA Scientific Visualization Studio, Ernie Wright, Noah Petro, and the LRO instrument
  teams;
- reference page: https://svs.gsfc.nasa.gov/4720/;
- local color files: `moon-lroc-1024.jpg` and `moon-lroc-2048.jpg`;
- local relief file: `moon-lola-relief-1024.jpg`.

The color mosaic is observation-based but processed for aesthetic rendering, including polar
completion. The bump-map amplitude is visually exaggerated in Universe Map and is not a physical
terrain scale. NASA publishes both maps centered on 0° longitude. Universe Map applies the same
east-positive body-fixed sampling to color and relief so the terrain remains registered to the IAU
prime meridian.

## Mars

- source product: USGS Astrogeology, “Mars Viking Colorized Global Mosaic 232m”, MDIM 2.1;
- browser derivative: the public-domain 1 km/pixel global JPEG, resampled locally from
  21,339×10,670;
- data: approximately 4,600 Viking Orbiter images controlled against MOLA-derived ground points;
- reference page:
  https://astrogeology.usgs.gov/search/map/mars_viking_colorized_global_mosaic_232m;
- local files: `mars-viking-1024.jpg` and `mars-viking-2048.jpg`.

The mapped structures originate in observed Viking imagery. The source product is artistically
colorized and processed to emphasize terrain, so it is not presented as an unmodified true-color
photograph. The source metadata defines a simple cylindrical `−180°…180°`, positive-east grid;
Universe Map converts that grid to the renderer's body-fixed texture direction.

## Venus

- source: NASA/JPL Solar System Simulator global Venus texture;
- original file: `ven0aaa2.jpg`, 1440×720;
- data: stitched Magellan radar imagery with gaps filled from a global texture;
- reference page: https://space.jpl.nasa.gov/tmaps/venus.html;
- local files: `venus-magellan-1024.jpg` and `venus-magellan-2048.jpg`.

The terrain is radar-derived and observed, but the orange color is simulated. It reveals the solid
surface and must not be interpreted as the visible-light appearance through Venus's opaque cloud
deck. The 2048 variant improves GPU sampling consistency but does not add scientific resolution to
the native 1440-pixel source. Its centered global map uses the same body-fixed horizontal conversion
as the other rocky-body textures.

## Jupiter

- source: NASA Goddard Scientific Visualization Studio, “Hubble Maps Jupiter in 4k Ultra HD”;
- original file: `Hubble_Jupiter_color_global_map_2015a.tif`, 3600×1800;
- credit: NASA Goddard Space Flight Center, Space Telescope Science Institute, Amy A. Simon,
  Michael H. Wong and Glenn Orton;
- reference page: https://svs.gsfc.nasa.gov/12021/;
- local files: `jupiter-hubble-1024.jpg` and `jupiter-hubble-2048.jpg`.

The black unobserved margins of the source map were cropped before resampling. The resulting polar
stretch is illustrative; atmospheric features away from the poles remain based on the Hubble map.
The image is a dated atmospheric snapshot: differential cloud rotation is not reconstructed, so
feature alignment to the IAU prime meridian at arbitrary simulation dates remains illustrative.

## Representative giant-planet atmospheres

Saturn, Uranus, and Neptune use lightweight browser derivatives of the texture atlases embedded in
NASA Visualization Technology Applications and Development 3D models:

| Local asset                  | Body    | Runtime grid | NASA reference                                      |
| ---------------------------- | ------- | ------------ | --------------------------------------------------- |
| `saturn-nasa-vtad-2048.jpg`  | Saturn  | 2048×1024    | https://science.nasa.gov/resource/saturn-3d-model/  |
| `uranus-nasa-vtad-1024.jpg`  | Uranus  | 1024×512     | https://science.nasa.gov/resource/uranus-3d-model/  |
| `neptune-nasa-vtad-1024.jpg` | Neptune | 1024×512     | https://science.nasa.gov/resource/neptune-3d-model/ |

The Saturn source is a 4×3 cubemap cross. Universe Map extracts its six faces, converts them to an
equirectangular grid with Lanczos interpolation, and applies a restrained contrast and color grade.
The Uranus and Neptune atlases are already equirectangular and are converted to compact JPEGs
without changing their dimensions. These images describe a representative visual state of dynamic
atmospheres; they are therefore marked `illustrative`, not as body-fixed observations valid at the
selected simulation date. They remain deferred until the close planetary LOD is requested, including
on low-quality devices.

## Additional observed Solar System surfaces

The following lightweight equirectangular mosaics come from NASA/JPL's Solar System Simulator.
They are 1440×720 browser assets assembled from spacecraft imagery by JPL, Caltech, and USGS.
JPL explicitly warns that its maps may contain filled gaps, aesthetic enhancement, and incomplete
coverage, so Universe Map identifies the mapped structures as `observed` while keeping color and
body-fixed alignment tied to the source cartographic grid rather than claiming a current
true-color photograph.

| Local asset                                                                                                                                                                              | Body or bodies        | Mission data                        | Reference                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ----------------------------------- | --------------------------------------------- |
| `phobos-jpl-viking-1440.jpg`, `deimos-jpl-viking-1440.jpg`                                                                                                                               | Phobos, Deimos        | Viking                              | https://space.jpl.nasa.gov/tmaps/mars.html    |
| `io-jpl-voyager-galileo-1440.jpg`, `europa-jpl-voyager-1440.jpg`, `ganymede-jpl-voyager-1440.jpg`, `callisto-jpl-voyager-1440.jpg`                                                       | Galilean moons        | Voyager and Galileo where available | https://space.jpl.nasa.gov/tmaps/jupiter.html |
| `mimas-jpl-voyager-1440.jpg`, `enceladus-jpl-voyager-1440.jpg`, `tethys-jpl-voyager-1440.jpg`, `dione-jpl-voyager-1440.jpg`, `rhea-jpl-voyager-1440.jpg`, `iapetus-jpl-voyager-1440.jpg` | Major Saturnian moons | Voyager                             | https://space.jpl.nasa.gov/tmaps/saturn.html  |
| `ariel-jpl-voyager-1440.jpg`, `umbriel-jpl-voyager-1440.jpg`, `titania-jpl-voyager-1440.jpg`, `oberon-jpl-voyager-1440.jpg`, `miranda-jpl-voyager-1440.jpg`                              | Major Uranian moons   | Voyager                             | https://space.jpl.nasa.gov/tmaps/uranus.html  |
| `triton-jpl-voyager-1440.jpg`                                                                                                                                                            | Triton                | Voyager                             | https://space.jpl.nasa.gov/tmaps/neptune.html |

Six 1024×512 browse derivatives come from controlled products published by USGS Astrogeology:

- `mercury-messenger-usgs-1024.jpg`: MESSENGER MDIS global monochrome mosaic with 100% surface
  coverage at 250 m/pixel in the source product;
  https://astrogeology.usgs.gov/search/map/mercury_messenger_mdis_global_mosaic_250m
- `titan-cassini-1024.jpg`: Cassini ISS global mosaic at 938 nm, 4005 m/pixel source;
  https://astrogeology.usgs.gov/search/map/titan_cassini_iss_global_mosaic_4005m
- `ceres-dawn-1024.jpg`: Dawn Framing Camera global controlled mosaic, 400 m/pixel source;
  https://astrogeology.usgs.gov/search/map/ceres_dawn_fc_global_mosaic_400m
- `vesta-dawn-1024.jpg`: Dawn Framing Camera HAMO global mosaic, 60 m/pixel source;
  https://astrogeology.usgs.gov/search/map/vesta_dawn_fc_hamo_global_mosaic_60m
- `pluto-new-horizons-1024.jpg`: New Horizons LORRI/MVIC global mosaic, 300 m/pixel source;
  https://astrogeology.usgs.gov/search/map/pluto_new_horizons_lorri_mvic_global_mosaic_300m
- `charon-new-horizons-1024.jpg`: New Horizons LORRI/MVIC global mosaic, 300 m/pixel source;
  https://astrogeology.usgs.gov/search/map/charon_new_horizons_lorri_mvic_global_mosaic_300m

Credit for the Titan product: NASA/JPL-Caltech/Space Science Institute/Cornell University and USGS
Astrogeology Science Center. Credit for the Dawn products: NASA/JPL-Caltech/UCLA/MPS/DLR/IDA and
USGS Astrogeology Science Center. Credit for the Pluto and Charon products: New Horizons Team;
NASA, Johns Hopkins University Applied Physics Laboratory, Southwest Research Institute, Lunar and
Planetary Institute; and USGS Astrogeology Science Center. The USGS product pages request citation
of the authors.

No static visible-surface mosaic is presented for bodies whose appearance is atmospheric,
insufficiently resolved, or not globally mapped in an appropriate source. Eris, Haumea, Makemake,
Pallas, Hygiea, and cometary activity therefore do not receive a misleading photographic skin.
Pallas and Hygiea use calculated DAMIT shape meshes with explicitly illustrative neutral materials;
the other unresolved surfaces remain procedural.

## Saturn

`saturn-rings.svg` is an illustrative representation created for Universe Map from procedural radial
bands. Saturn's atmospheric atlas is derived from NASA's VTAD model as documented above, while its
body-fixed alignment and time evolution remain illustrative.

## Milky Way

`milky-way-emissive-1254-v2.jpg` is an original illustrative asset generated for Universe Map with
OpenAI's built-in image-generation workflow. The first project-owned atlas was used as an edit
target on 2026-08-06; its material and centered face-on composition were retained while its many
regular lanes were rebuilt as two dominant open arms and two shorter fragmented arm families. The
1254×1254 result is stored as a quality-90 JPEG for deferred browser loading.

The production prompt requested one complete, centered, exactly face-on barred spiral galaxy on a
uniform black background, with a warm textured bar, an underlying old-star disk, irregular
blue-white arms, stellar knots, pale hydrogen-region hints, offset charcoal dust lanes, soft outer
falloff, and no surrounding objects, text, watermark, lens flare, planets, or perspective tilt. It
explicitly prohibited concentric rings and evenly spaced circular lanes.

This texture contains no observational Milky Way pixels and carries `illustrative` confidence. Its
purpose is to provide emission and dust detail for the layered 3D renderer; it must not be interpreted
as a photograph of the Galaxy from outside.

The runtime shader treats the atlas as source material rather than a flat photograph. Three shallow
view-dependent samples reveal parallax at oblique angles, a bounded angular domain warp breaks
remaining regularity, luminance and an offset spiral field drive illustrative dust absorption, and
quality-aware cool-arm/warm-core grading plus compressed analytical glow preserve detail without an
additional post-processing pass. Grazing-angle mip bias suppresses magnified source texels, while a
single low-opacity procedural point batch restores crisp, scale-stable stellar detail and remains
available as the atlas fallback.

`milky-way-eso-band-8k-v3.webp` is an 8192×1024 runtime crop derived from ESO/S. Brunier's
[full-sky Milky Way panorama](https://www.eso.org/public/images/eso0932a/) (`eso0932a`, 6000×3000).
Credit: ESO/S. Brunier.

The runtime asset retains the central 60 degrees of source latitude, applies a restrained cinematic
grade, and resamples it with a high-quality Lanczos filter before quality-95 WebP encoding. The
sphere shader presents those pixels across a 32-degree angular band, feathers its edges, and keeps
the Galactic Center fixed to local scene direction `[-1, 0, 0]`. The sphere is pitched and rolled so
the band crosses the default Solar System map diagonally; that orientation is a disclosed
illustrative composition, not an astrometric sky projection. Mipmaps are disabled because the sky is
direction sampled at a stable apparent distance, avoiding additional GPU memory and upload work.
The source pixels are observational, while the crop, grade, opacity, angular scale, and presentation
remain `illustrative`.
