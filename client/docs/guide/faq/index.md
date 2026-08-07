---
title: Frequently asked questions
description: Answers about scale, accuracy, missing objects, eclipses, performance, offline data, and the scope of Universe Map.
---

# Frequently asked questions

## Are sizes and distances physically to scale?

Source values preserve scientific units, but the rendered map adapts radii, brightness, and some
inter-scale distances. A globally physical scale would make planets and stars invisible during most
of the journey. Object cards identify the visual scale mode.

## Why does the representation change while I zoom?

The map uses levels of detail. A distant galaxy may begin as an impostor, become a procedural disk,
and then reveal a bounded particle volume. Cross-fades preserve continuity while keeping geometry and
draw calls within budget.

## Why are some names missing?

Labels are ranked and collision-managed. Increase name density in settings, move closer, or search for
the object directly. All catalogue records do not become simultaneous labels because that would hide
the map itself.

## Can I find every known star or galaxy?

No. The map uses selected and spatially tiled catalogues to validate the navigation concept. It can
search every record bundled in those catalogues, but it is not an exhaustive astronomical database.

## Are exoplanet surfaces real?

No direct surface image is implied. Catalogue facts such as period, radius, mass, detection method,
and host position remain separate from procedural colour, terrain, phase, orientation, and adapted
orbit display.

## Can I use the eclipse view to plan an observation?

Use it to understand geometry and explore documented events, not as the sole source for observation
planning. Confirm local circumstances and eye-safety instructions with an authoritative astronomy
service.

## Does the black hole use real general relativity?

No. It applies a qualitative thin-lens distortion to the rendered background and keeps the horizon
and emission layers separate. It is designed to communicate lensing visually, not to reproduce a
numerical relativistic ray tracer.

## Does the application need a backend?

No. Search, time calculations, catalogues, textures, tiles, and URL sharing run in the browser or are
served as static files.

## Can I share an exact view?

Yes. The URL retains the target, selected object, date, zoom, temporal mode, quality, and principal
display options. Use the share control rather than copying during an active camera transition.

## How can I report an error or contribute?

Open an issue in the [GitHub repository](https://github.com/Nayruuu/my-universe/issues). For a
scientific correction, include the source, reference frame, epoch, unit, and an independently
checkable value.
