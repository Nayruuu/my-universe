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

## Saturn

`saturn-rings.svg` is an illustrative representation created for Universe Map from procedural radial
bands. Saturn's atmospheric bands and storm details are also representative rather than a dated
observational map.

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
additional post-processing pass. The older procedural particle disk is visible only while the atlas
is unavailable.

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
