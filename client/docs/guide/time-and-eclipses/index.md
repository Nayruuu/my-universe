---
title: Time and eclipses
description: Understand UTC time, playback speed, planetary ephemerides, axial rotation, and eclipse visualisation in Universe Map.
---

# Time and eclipses

The timeline controls a numerical Julian Day internally. The interface accepts a civil UTC date and
converts it before sending time to the rendering engine.

## Timeline controls

You can:

- enter a UTC date and time;
- play or pause the simulation;
- return to the current date;
- choose a time multiplier appropriate to the current map scale;
- browse documented past and future eclipse events.

When playback is paused, orbital positions and axial rotation remain fixed. When it resumes, both are
derived from the same internal time rather than from the render frame count.

## Temporal modes

**State at selected date** displays the estimated state of mapped objects at one common instant. This
is the implemented primary mode.

**Observable view** is reserved for a light-travel-time representation from an observer position. The
architecture distinguishes the mode, but the prototype does not yet provide a complete relativistic
observation model across all scales.

## Planetary positions and rotation

Planet and Moon positions are calculated locally with Astronomy Engine. Selected minor bodies and
moons may use documented orbital elements or simplified providers. The object card identifies the
corresponding confidence level.

Supported bodies use date-dependent axial orientation data. Rotation changes with simulation time,
including retrograde rotation where applicable. Texture alignment and visible size remain rendering
adaptations rather than surface-navigation products.

## Eclipse browser

The event browser covers solar and lunar eclipse families relevant to the Earth–Moon system. It can
move the simulation to an event, focus the relevant bodies, and calculate local circumstances for
either a predefined French observing location or latitude and longitude entered manually. Custom
coordinates stay in the browser and use UTC because no geocoding or time-zone service is called.

Solar views can show:

- partial, annular, and total event classification;
- the Moon–Earth–Sun geometry in orbital view;
- the shadow at the selected instant;
- an optional whole-event map whose blue envelope combines partial visibility over time and whose
  coral or amber band bounds the totality or annularity corridor;
- local contacts C1 (partial begins), C2 (central phase begins), maximum, C3 (central phase ends),
  and C4 (partial ends), with below-horizon contacts identified explicitly. C2 and C3 only exist for
  total or annular circumstances at that location.

Lunar views represent the Moon entering the Earth's shadow and distinguish eclipse families in the
event list.

::: warning Interpretation
The orbital scene exaggerates radii and some separation for readability. Surface overlays are
educational reconstructions, not operational visibility forecasts. Always use an authoritative local
eclipse service for observation planning and eye-safety guidance.
:::

Contact meanings follow the conventional local-circumstances definitions described by
[IMCCE](https://promenade.imcce.fr/fr/pages3/387.html). The 12 August 2026 calculation is also
checked against [NASA GSFC local circumstances](https://eclipse.gsfc.nasa.gov/SEcirc/SEcircEU/ParisFRA1%2B21.html)
for Paris.

## Dates outside the documented range

Accuracy depends on the provider and time interval. Long extrapolations, historical reconstructions,
and cosmological times are explicitly marked as extrapolated, simulated, or illustrative rather than
presented as exact observations.

Next: [Scientific confidence](/scientific-confidence/).
