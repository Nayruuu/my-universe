---
title: Navigation and scale
description: Learn Universe Map camera controls, semantic zoom, reference frames, target selection, and scale transitions.
---

# Navigation and scale

Universe Map behaves like a spatial map rather than a fixed orbital diagram. Camera speed, minimum
distance, labels, object representations, and background layers adapt to the current astronomical
context.

## Controls

| Action                  | Desktop                                  | Touch                     |
| ----------------------- | ---------------------------------------- | ------------------------- |
| Orbit around the target | Left-click and drag                      | One-finger drag           |
| Pan                     | Right-click and drag                     | Two-finger drag           |
| Zoom toward the pointer | Mouse wheel                              | Pinch                     |
| Select                  | Click an object or its name              | Tap an object or its name |
| Focus                   | Double-click, click a name, or press `F` | Double-tap or tap a name  |
| Play or pause time      | `Space`                                  | Timeline button           |
| Change time speed       | `+` or `-`                               | Timeline selector         |
| Close the object card   | `Escape`                                 | Close button              |

Wheel zoom is pointer-directed. When no object is targeted, the camera still advances toward the
point under the cursor. Near a selected body, collision limits prevent the camera from crossing the
visible surface unintentionally.

## The seven map scales

| Scale                 | Typical content                             | Main representation                                          |
| --------------------- | ------------------------------------------- | ------------------------------------------------------------ |
| Planetary             | Surface, atmosphere, rings, moons           | Detailed meshes and textures                                 |
| Solar System          | Sun, planets, selected minor bodies, orbits | Adaptive meshes, labels, and orbital paths                   |
| Stellar neighbourhood | HYG stars, exoplanet hosts, constellations  | GPU point batches and selected-object detail                 |
| Milky Way             | Galactic disk, bulge, arms, local position  | Layered emissive volume and catalogue context                |
| Local Group           | Milky Way, Andromeda, satellites            | Galaxy impostors and bounded particle volumes                |
| Nearby Universe       | Local-volume galaxies and groups            | Static spatial tiles and overview batches                    |
| Cosmic web            | Groups, clusters, voids, and filaments      | Catalogue points, line batches, and simulated density volume |

The transition is continuous, but each scale uses a different internal reference frame. The renderer
recentres coordinates around the camera when necessary to preserve numerical precision.

## Target, selection, and labels

- The **target** is the point around which the camera orbits.
- The **selection** is the object shown in the information card.
- A **label** is a collision-managed screen annotation connected to a mapped object.

Clicking a label selects and focuses its object. Label density can be set to Minimal, Balanced, or
Dense. The system prioritises the current target, the selected object, major Solar System bodies, and
important contextual landmarks before adding lower-ranked catalogue names.

The Sun remains a contextual landmark through local stellar scales. Beyond it, the Milky Way becomes
the persistent parent landmark. These labels do not render above nearer opaque geometry.

## Direct scale navigation

The breadcrumb shows the current hierarchy. Its scale menu can jump directly to any map level without
requiring repeated wheel gestures. Direct navigation uses the same focus and interpolation system as
search results, so the destination remains shareable through the URL.

## If a view appears empty

1. check the current scale in the breadcrumb;
2. enable labels and use Balanced or Dense name density;
3. select the Sun or Milky Way landmark to restore a known parent frame;
4. choose a scale directly from the scale menu;
5. reduce graphics quality if movement is delayed on the device.

Next: [Time and eclipses](/time-and-eclipses/).
