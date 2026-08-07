---
title: Scientific confidence
description: Learn how Universe Map distinguishes observed, calculated, extrapolated, simulated, procedural, and illustrative content.
---

# Scientific confidence

Universe Map never treats every visible element as equally factual. Each mapped object or
representation carries one of six confidence labels.

## Confidence levels

| Label          | Meaning                                              | Typical example                               |
| -------------- | ---------------------------------------------------- | --------------------------------------------- |
| `observed`     | Based on a measurement or published catalogue        | A catalogue star direction or galaxy distance |
| `calculated`   | Derived from an astronomical calculation             | A planetary position at the selected date     |
| `extrapolated` | Extended from a measured motion or simplified orbit  | Proper motion outside the reference epoch     |
| `simulated`    | Produced by a scientific or continuity model         | The optional cosmic density envelope          |
| `procedural`   | Generated to complete a visual representation        | Particle placement inside an adapted galaxy   |
| `illustrative` | Designed for readability and not physically to scale | Object radii, glow, or a constellation line   |

The label appears in the object card together with source-specific notes. A view can combine several
levels: an observed catalogue position, a calculated orientation, and an illustrative apparent size
may all describe the same visible object.

## Scientific coordinates versus visual coordinates

Source data retain explicit units such as kilometres, astronomical units, light-years, parsecs,
kiloparsecs, and megaparsecs. The engine converts them within hierarchical reference frames.

Visual radii and some inter-scale distances are adapted independently because a globally physical
scale would make almost every body smaller than one pixel and leave most journeys visually empty.
The map scale and object cards identify this adapted cartography.

## Reference epochs and frames

Catalogue positions belong to a documented reference frame and epoch. Examples include J2000 stellar
coordinates, heliocentric planetary ephemerides, galactocentric models, and redshift-derived
large-scale-structure positions. Universe Map does not merge incompatible survey products into a
single claim of exact geometry.

## Visual realism is not measurement

Textures, bloom, atmospheres, accretion emission, galaxy morphology, supernova colour, and black-hole
lensing can make the map easier to understand. They do not become observed data simply because they
look photographic.

In particular:

- the black-hole lens is a qualitative achromatic thin-lens effect, not a general-relativistic ray
  tracer;
- constellation lines are cultural conventions, not physical links between stars;
- unresolved cosmic-web continuity is simulated and remains separate from catalogue detections;
- galaxy particle placement and orientation may be illustrative even when the galaxy position is
  observed.

## Appropriate use

Universe Map is suitable for exploration, education, visual comparison, and product research. It is
not suitable for spacecraft navigation, professional astrometry, observation safety decisions, or
precision eclipse prediction.

Next: [Catalogues and sources](/catalogues/).
