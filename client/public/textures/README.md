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
terrain scale.

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
photograph.

## Venus

- source: NASA/JPL Solar System Simulator global Venus texture;
- original file: `ven0aaa2.jpg`, 1440×720;
- data: stitched Magellan radar imagery with gaps filled from a global texture;
- reference page: https://space.jpl.nasa.gov/tmaps/venus.html;
- local files: `venus-magellan-1024.jpg` and `venus-magellan-2048.jpg`.

The terrain is radar-derived and observed, but the orange color is simulated. It reveals the solid
surface and must not be interpreted as the visible-light appearance through Venus's opaque cloud
deck. The 2048 variant improves GPU sampling consistency but does not add scientific resolution to
the native 1440-pixel source.

## Jupiter

- source: NASA Goddard Scientific Visualization Studio, “Hubble Maps Jupiter in 4k Ultra HD”;
- original file: `Hubble_Jupiter_color_global_map_2015a.tif`, 3600×1800;
- credit: NASA Goddard Space Flight Center, Space Telescope Science Institute, Amy A. Simon,
  Michael H. Wong and Glenn Orton;
- reference page: https://svs.gsfc.nasa.gov/12021/;
- local files: `jupiter-hubble-1024.jpg` and `jupiter-hubble-2048.jpg`.

The black unobserved margins of the source map were cropped before resampling. The resulting polar
stretch is illustrative; atmospheric features away from the poles remain based on the Hubble map.

## Saturn

`saturn-rings.svg` is an illustrative representation created for Universe Map from procedural radial
bands. Saturn's atmospheric bands and storm details are also representative rather than a dated
observational map.

## Milky Way

`milky-way-emissive-1024.jpg` is an original illustrative asset generated for Universe Map on
2026-08-03 with OpenAI's built-in image-generation workflow. A user-supplied galaxy illustration was
used only as a mood and material reference, not copied as the atlas composition. The generated
1254×1254 PNG was resampled locally to a quality-88 1024×1024 JPEG for deferred browser loading.

The production prompt requested one complete, centered, exactly face-on barred spiral galaxy on a
uniform black background, with a warm textured bulge, four restrained blue-white logarithmic arm
families, stellar knots, pale hydrogen-region hints, charcoal dust lanes, soft outer falloff, and no
surrounding objects, text, watermark, lens flare, planets, or perspective tilt.

This texture contains no observational Milky Way pixels and carries `illustrative` confidence. Its
purpose is to provide emission and dust detail for the layered 3D renderer; it must not be interpreted
as a photograph of the Galaxy from outside.

The runtime shader treats the atlas as source material rather than a flat photograph. Three shallow
view-dependent samples reveal parallax at oblique angles, luminance contrast drives illustrative
dust absorption, and quality-aware cool-arm/warm-core grading plus compressed analytical glow
preserve detail without an additional post-processing pass.
