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

The active target defines the camera pivot. The selected object defines the information card. They are
usually the same after a search or label click, but free-space navigation can temporarily separate
them.

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
