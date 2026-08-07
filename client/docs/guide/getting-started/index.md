---
title: Getting started
description: Open Universe Map, understand its interface, choose a graphics profile, and share your first astronomical view.
---

# Getting started

Universe Map runs entirely in a modern browser. It does not require an account and does not call an
application backend. Astronomical catalogues, textures, and models are served as static files and are
loaded progressively as the camera changes scale.

## Open the map

Visit [super-universe.app](https://super-universe.app/). The first view loads the rendering engine and
the compact manifest; larger stellar and galactic datasets are fetched only when needed.

For the best first experience:

1. use a current desktop browser with WebGL 2 enabled;
2. leave graphics quality on **High** when using a recent discrete or integrated GPU;
3. wait for the loading overlay to disappear before navigating;
4. scroll over a visible object or click its name to choose a destination.

The map also supports touch navigation and automatically reduces visual density on smaller devices.

## Interface tour

| Area              | Purpose                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| Top search        | Find planets, moons, stars, exoplanets, galaxies, black holes, supernovas, and large-scale structures. |
| Scale breadcrumb  | Shows the current astronomical hierarchy and provides direct parent navigation.                        |
| Object card       | Displays source facts, aliases, physical properties, confidence, and focus actions.                    |
| Floating controls | Zoom, return to Earth or the Sun, and toggle orbits, constellations, and names.                        |
| Timeline          | Edit UTC time, pause or play, select speed, browse eclipse events, and return to the present.          |
| Map scale         | Shows an adapted screen scale for the current camera context.                                          |

## A first journey

Try this sequence to understand semantic zoom:

1. search for **Earth** and select the result;
2. use the wheel or pinch gesture to move outward through the Solar System;
3. select **Sun**, then keep zooming out to reveal the stellar neighbourhood;
4. choose **Milky Way** from the scale menu;
5. continue to the Local Group, nearby Universe, and cosmic web;
6. use the breadcrumb to return toward the Solar System.

The logical target defines the map hierarchy and distance constraints, the geometric camera pivot
defines the orbit centre, and the selected object defines the information card. Explicit focus often
aligns all three, but pointer zoom and free-space navigation can separate them.

## Observe a star from Earth

Search for a star such as **Sirius**, open its information card, then choose **Locate from Earth**.
Universe Map opens the local sky at the map's current date and observation place. Drag to look around,
use the wheel or a pinch gesture to change the field of view, and select **Recenter** to recover the
target. These are planetarium controls: the wheel does not trigger semantic map-scale traversal or
minimum-distance travel while the horizon view is open. Names and modern constellation figures can
be shown independently. The location picker offers 461 static observer places worldwide, and both
the observer and planetarium view are retained in a shared URL. **Use my location** requests browser
permission only when selected, rounds the resulting coordinates to three decimal degrees (roughly
100 m), and then uses the same shareable observer contract.

The Moon and visible planets reuse the same Three.js objects, materials, lighting, and sourced or
adapted textures as the map view. Their topocentric directions and angular diameters are calculated
for the selected place and time. A bounded minimum display size keeps small planets inspectable and
is explicitly illustrative rather than a claim about their physical angular size.

The horizon follows viewing azimuth and stays fixed to the ground while the sky follows time. Eight
featured cities have hand-composed visual contexts; every catalogue place lazily loads four nearby
landmark records from regional static packs. The 461 catalogue places also load compact obstruction
profiles calculated from the NOAA/NCEI ETOPO 2022 60 arc-second surface-elevation model. This regional
relief can hide stars, the Moon, and planets. Documented names, coordinates, or heights do not make
the rendered city measured: buildings, city lights, skyline layers, generic landmark outlines, and
the plain used for custom coordinates remain explicitly illustrative.

Direction, altitude, azimuth, precession, nutation, atmospheric refraction, and catalogue-location
terrain obstruction are calculated in the browser or in the reproducible static data build. The
ETOPO mask is model-derived regional relief rather than surveyed local geometry; it omits buildings,
vegetation, and micro-relief. The view is not a weather model, a historical city reconstruction, or a
professional observation-planning tool.

## Graphics quality

The settings panel offers three profiles:

- **Low** reduces particles, texture resolution, volumetric samples, and streamed tiles;
- **Medium** balances detail and GPU cost;
- **High** enables the richest bounded representation supported by the current scale.

Changing quality never changes catalogue coordinates or scientific confidence. It only changes the
rendering budget.

## Share a view

Use the share control to copy the current URL. A shared link preserves at least the target, selected
object, time, zoom, temporal mode, graphics quality, name density, orbit visibility, constellation
visibility, and label visibility.

The URL updates after a short delay rather than on every rendered frame.

Next: [Navigation and scale](/navigation/).
