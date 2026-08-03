# Changelog

All notable changes to Universe Map are documented in this file.

## [Unreleased]

### Added

- Added a single-draw-call overview of all 720 observed Local Volume galaxies directly from the
  static tile index. It fades in at the outer Milky Way boundary, remains behind streamed galaxy
  detail, and fades out before the Cosmicflows map dominates, removing the empty visual gap without
  inventing a decorative star field. Local Group galaxy impostors also receive a larger adaptive
  screen-space floor for readable continuous-scale navigation.
- Added a deterministic large-scale structure scaffold derived from the 37,730 Cosmicflows-4 group
  positions. A 20 Mpc spatial hash connects at most two nearby groups within 52 Mpc, producing 49,939
  illustrative edges in one GPU `LineSegments` batch. Low, medium, and high quality draw 28%, 62%,
  or 100% of a spatially distributed edge order; distance and radiance fades remain independent
  from the calculated group points. A continuously damped camera-distance LOD emphasizes the
  shortest, best-constrained links in the overview and progressively strengthens secondary
  connections while zooming in without adding draw calls. A compact scale-specific legend, debug
  counts, metadata, and the object card explicitly distinguish this visual interpretation from
  observed filaments.
- Added a validated static catalogue of Sagittarius A*, Cygnus X-1, and Gaia BH1 with searchable
  aliases, galactocentric positions, masses, Schwarzschild radii, activity states, scientific
  sources, object cards, direct focus, and shareable URL restoration.
- Added quality- and activity-aware black-hole representations with a true black silhouette, a
  restrained photon-ring cue, optional accretion emission, and jets only for active sources. A
  bounded screen-space pass now hides only the focused object's foreground subtree, captures the
  live background, applies the qualitative thin-lens relation `beta = theta - thetaE² / theta`, and
  then recomposes the opaque horizon, ring, disc, and optional jets in front. This prevents those
  foreground structures from being copied or stretched by their own lens while preserving the
  visual Einstein radius and inverted image. A full-color framebuffer remap deforms diffuse sky and
  bright objects together. Smooth inner and outer masks make the mapping meet the direct scene
  without a circular post-process seam. Its composition decouples the displayed lens radius from
  the bounded 768- or 1024-pixel source capture, keeping the effect stable across DPR 1 and Retina
  DPR 2 while avoiding an opaque square seam. The close foreground silhouette remains below a fixed
  screen-space radius so deeper zoom cannot hide the surrounding distortion. The shader samples
  only the live scene capture and never injects a fixed photographic or procedural sky texture.
  The pass stays disabled in low quality. Every non-observed visual element is explicitly marked
  illustrative, and selected black holes omit the generic reticle so it cannot be mistaken for
  physical structure.
- Kept the `cosmic-web` universe object as a navigation and scientific-data reference only. It no
  longer receives the generic opaque spherical body that overlapped Sagittarius A* at their shared
  origin and hid the inner part of the lens.
- Replaced Sagittarius A*'s former fixed lens-source image with a deterministic 3D nuclear star
  cluster rendered as one quality-aware GPU point batch. The live thin-lens framebuffer capture now
  keeps that world-space cluster while withholding only the black-hole foreground, restoring dense
  Einstein arcs without leaving a screen-space image behind after navigation.
- Added a quality-aware photographic Earth stack using local NASA Blue Marble surface and cloud
  composites, 2012 Black Marble night lights, and a Fresnel atmospheric rim. Cloud and night layers
  remain disabled in low quality.
- Added NASA/ESA Hubble's 2015 global Jupiter map at 1024×512 and 2048×1024, with the illustrative
  polar treatment documented alongside the asset.
- Added quality-aware LRO/LOLA Moon, Viking MDIM 2.1 Mars, and Magellan radar Venus maps, with local
  1024/2048 browser derivatives and explicit visual-confidence metadata in object details.
- Added a scale-aware photographic rendering profile across all seven navigation levels, with
  smoothly damped ACES exposure and quality-aware stellar and galactic radiance.
- Added a two-triangle, scale-aware deep-space background with continuously damped color, haze,
  vignette, and fog transitions. The layer is explicitly illustrative and quality-aware.
- Added a deferred 1024-pixel emissive Milky Way atlas rendered across three offset disc depths and
  one volumetric bulge. Low, medium, and high quality use bounded two-, three-, or four-mesh budgets.
- Added a quality-aware cinematic Milky Way profile with view-dependent atlas parallax, warm-core
  and cool-arm grading, analytical dust absorption, compressed highlights, and restrained glow
  without increasing the existing mesh budget.
- Added a second chromatic nebula layer and analytical dust rifts to the two-triangle cosmic
  background, continuously interpolated by camera distance and reduced by graphics quality.
- Added subtle temperature-colored diffraction to the brightest HYG stars inside the existing GPU
  batch, preserving one draw call for the complete catalogue.
- Added the four Galilean moons, Titan, Pluto, Ceres, Vesta, and Halley's Comet as searchable,
  selectable, URL-addressable Solar System objects with physical facts and orbital views.
- Added jovicentric Astronomy Engine positions for Io, Europa, Ganymede, and Callisto, plus strict
  JPL-backed catalogue tests for satellite and small-body orbital data.
- Added optional visual-distance scaling to Keplerian providers so satellite readability remains
  separate from stored scientific units, with extrapolated confidence labels for simplified
  two-body trajectories.

### Changed

- Replaced the hand-authored directions of the 16 featured stars with catalogue links to their HYG
  v4.1 J2000 entries. Search, cards, labels, picking, URLs, and rendering now share one canonical
  identity and one GPU point per star; the fixed 10,000-entry import also guarantees that faint
  featured neighbors remain bundled.
- Replaced the axisymmetric Milky Way placeholder with a deterministic, single-batch
  galactocentric density field combining a diffuse disc, a barred bulge, and four noisy logarithmic
  arm families based on Reid et al. (2019), while keeping every exact shape parameter explicitly
  illustrative.
- Rotated the heliocentric HYG catalogue into the Galactic J2000 basis, attached it to the Sun at
  `R0 = 8.178 kpc`, and removed exact stars, aggregate cells, constellation lines, and their labels
  from the galactic view so the catalogue boundary no longer resembles a physical stellar sphere.
- Replaced the procedural Moon, Mars, and Venus surfaces with instrument-derived static maps while
  retaining texture-free color fallbacks in low quality.
- Corrected procedural planet colors from linear RGB to sRGB, restored Saturn's golden atmospheric
  bands, and added a subtle illustrative shadow fill to the four giant planets.
- Rebuilt shared galaxy impostors as 256/384/512-pixel quality-aware compositions with cool stellar
  halos, warm cores, diffuse spiral filaments, and carved dust lanes; focused galaxies now remain
  smooth instead of revealing stretched point sprites.
- Softened the shared selection reticle so close astronomical imagery remains readable while the
  selected object is still explicit.
- Replaced the binary Milky Way-to-Local Group swap with a distance-driven crossfade: the detailed
  disc now contracts while the distant galaxy impostor fades in, without a transition gap or an
  auxiliary aura draw call.
- Faded the procedural star backdrop out before galactic scales and limited aggregated HYG cells to
  the Milky Way transition, removing the artificial stellar sphere from the Local Group map.
- Reduced the galactic particle veil so it adds depth and isolated highlights without washing out
  the atlas dust lanes or producing an opaque stellar skirt at oblique camera angles.
- Increased the Playwright test timeout from 35 to 60 seconds so real-Chrome context teardown stays
  reliable on saturated development machines without relaxing any navigation assertion.
- Made orbital line geometries scale-driven: they are created only for Solar System views or an
  explicitly requested orbit, then removed and disposed outside those LODs so additional bodies do
  not increase the galactic renderer budget.
- Deferred nearby-Universe tile synchronization until camera transitions settle, isolated streamed
  galaxies from the permanent Solar System registry, and stopped rebuilding the complete local
  search index when visible tiles change.

- Generalized semantic navigation from the fixed Earth route to every hierarchical object: planets,
  catalogue stars, galaxies, and galaxy clusters now retain their own reversible parent-frame
  journey across all seven scales.
- Separated focus, mouse, semantic-wheel, and native-pinch settlement events so labels always frame
  the object that was clicked and canonical routes advance only on real LOD-crossing zoom gestures.
- Applied the same automatic context changes after native touch pinch gestures, and prevented a
  second touch from releasing the active target.
- Added smooth reference-frame pivot transitions that preserve camera distance and direction and
  complete safely before rapid follow-up wheel, pointer, or touch input.
- Expanded debug mode with the active scientific frame, navigation origin, and physical camera
  target.
- Replaced the monolithic stellar LOD files with a camera-driven loose octree: 26 root cells, 85
  child cells, 34 shared static packs, frustum and screen-size selection, quality-aware refinement,
  bounded LRU caching, parent-to-child cross-fades, and one merged GPU batch per active resolution.
- Capped rapid stellar cross-fades to one active and one retiring GPU batch to prevent transient draw
  calls and resources from accumulating during long camera journeys.
- Added end-to-end hierarchy validation, active/cache diagnostics, failure-safe streaming that keeps
  the previous field visible, and a reversible browser journey across exact and aggregated views.
- Replaced upright decorative planet spinning with date-dependent IAU 2015 pole and prime-meridian
  orientations for the Sun, Moon, and all eight planets.
- Attached planetary rings and the active rotation guide to each body's physical equatorial frame.
- Preserved the active camera target when zooming over empty space so mouse orbit and pan controls
  remain available after zooming.
- Removed the inherited free-navigation zoom floor so repeated wheel input continues toward the
  pointer after the current target is released.
- Added restrained type-aware label colors for stars, planets, moons, small bodies, galaxies, and
  constellations while preserving one consistent interactive highlight.
- Added one persistent, clickable navigation landmark at every scale: the Sun for planetary through
  stellar views, then the Milky Way for galactic through cosmic-web views. Off-screen landmarks
  remain as restrained edge labels without arrow clutter, relocate around ordinary labels, and do
  not alter the visual LOD of their astronomical object.
- Added LOD-scaled HYG catalogue points and a reusable halo-to-volume representation for the active
  star without creating an individual Three.js object for every catalogue entry.
- Prevented the outer semantic boundary from consuming wheel input without moving the camera.
- Kept pointer-selected objects as zoom targets during active scale journeys and exposed the last
  wheel anchor, requested distance, applied distance, bounds, and clamp status through debug mode.
- Stabilized outward wheel zoom around the current camera pivot, and rebased the physical pivot
  whenever the semantic reference target changes.
- Added an off-axis HYG-star regression journey that traverses the Milky Way, Local Group, nearby
  Universe, and cosmic web before restoring the original catalogue-star context.
- Bounded the procedural Milky Way to screen-space particles, preventing near-camera points from
  expanding into large additive rectangles.
- Matched the reusable HYG close-range volume to its navigation radius, allowing useful close zoom
  without flooding the viewport.
- Prevented unlabelled points from the dense HYG batch from silently capturing mouse-wheel
  navigation while preserving explicit label, click, and search targeting.
- Restricted the procedural Milky Way and its galaxy impostor to their intended LODs so neither
  remains over stellar, Solar System, or planetary views, even while the galaxy stays selected.
- Expanded the brightness-ranked HYG label pool from 240 to 3,000 entries and raised adaptive
  desktop density to as many as 96 non-overlapping, directly interactive names.
- Added user-selectable minimal, balanced, and dense name profiles, scaling collision-free label
  budgets from 14 to 144 and persisting the preference in shareable URLs.
- Added screen-space body occlusion for astronomical labels, keeping background star names outside
  nearby planetary silhouettes while preserving the selected object and the body's own label.
- Expanded the Local Group map to 31 catalogue-backed galaxies around the procedural Milky Way,
  including Milky Way satellites, Andromeda satellites, and isolated dwarf galaxies.
- Added load-time validation of catalogue-derived galactic coordinates, hierarchical host-relative
  positions, explicit kiloparsec units, and a dedicated 100% scientific coverage gate.
- Added quality-aware galaxy label ranks and contextual host/satellite visibility so the global map
  remains readable while focused subgroup views retain useful neighboring targets and identify the
  active galaxy in the scale selector.
- Enriched galaxy cards with subgroup, absolute magnitude, and half-light radius data while
  preserving search, click focus, and shareable URL state for every mapped galaxy.
- Added a sixth semantic scale for the nearby Universe and extended the reversible wheel journey to
  120,000 rendering units.
- Added a static five-tile index containing 22 observed galaxies beyond the Local Group, with lazy
  search-target loading, lower-LOD unloading, and in-memory reuse.
- Expanded that layer to 720 unique observed galaxies: 698 records from the 1.5–11 Mpc Updated
  Nearby Galaxy Catalog plus the 22 curated entries, exposed through a validated 110-node adaptive
  octree while preserving the five editorial regions.
- Added a reproducible fixed-width catalogue importer, normalized Messier/NGC duplicate removal,
  brightness-ranked overview records, 24-object leaf bounds, `space-tiles-v2` hierarchy validation,
  and static completeness tests across every generated tile.
- Made the external-galaxy layer camera-driven: frustum selection runs at a bounded 4 Hz, graphics
  quality limits the active view to 2, 3, or 5 tiles, and selected or navigation-target tiles remain
  pinned even outside the current field of view.
- Merged generated Local Volume galaxies into the shared distant-object GPU point batch while
  retaining shaped impostors for the focused entry, indexed point picking, and curated galaxy
  visuals; debug mode now reports the active batched-galaxy count.
- Added J2000 equatorial-to-Cartesian validation in megaparsecs for the Updated Nearby Galaxy
  Catalog and ACS Virgo Cluster Survey data.
- Hid the compressed HYG field at the outermost LOD, enlarged the distant procedural backdrop, and
  strengthened galaxy impostors so the new overview remains legible.
- Exposed active, indexed, and cached galaxy-tile counts in debug mode and added browser journeys
  for quality-aware overview streaming, direct search, and shareable URL restoration.
- Added a seventh semantic scale backed by 37,730 Cosmicflows-4 galaxy groups between 11.1 and 772.7
  Mpc, with a reproducible fixed-width importer, compact typed-array binary format, and strict source
  checksum and Cartesian-position validation.
- Rendered the complete cosmic catalogue in one uncertainty-aware GPU point batch, with bounded PGC
  labels, direct search and selection, reusable highlighting, calculated-confidence cards, debug
  counts, shareable URLs, and reversible desktop and mobile navigation through the new outer scale.
- Added all 88 modern Stellarium constellation figures as one optional 644-segment HYG-backed
  `LineSegments` layer, with strict reference validation, LOD fading, CC BY-SA attribution, and
  shareable URL state.
- Added ranked, collision-free constellation names with reusable hover highlighting, click-to-frame
  navigation, local search, shareable targets, and illustrative information cards.
- Made the shared constellation line batch directly hoverable and selectable through indexed
  segment metadata and a screen-scaled raycast threshold.

## [0.1.0] - 2026-07-29

### Added

- Browser-only Angular and Three.js application with strict TypeScript.
- Hierarchical astronomical object model, scientific units, and floating-origin support.
- The Sun, eight planets, the Moon, orbital paths, axial rotation, atmospheres, and rings.
- Editable astronomical time, local ephemeris calculations, and multiple playback speeds.
- Solar and lunar eclipse visualization with selected local circumstances.
- Search, interactive labels, object information, confidence levels, and shareable URL state.
- 10,000 observed HYG stars rendered in a single GPU batch.
- Procedural Milky Way and a selectable Local Group of nearby galaxies.
- Reversible semantic zoom across five astronomical scales.
- Adaptive graphics profiles, touch controls, and renderer diagnostics.
- Automated formatting, linting, strict type checks, 100% production coverage, production build, and
  desktop/mobile Playwright verification.

[Unreleased]: https://github.com/Nayruuu/my-universe/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Nayruuu/my-universe/releases/tag/v0.1.0
