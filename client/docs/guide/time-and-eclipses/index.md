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

**Received light** treats the selected date as a reception date. Supported Solar System bodies use
an Earth observer and HYG stars use the Solar System barycentre. Each supported object is evaluated
at its own emission epoch; a body's axial rotation is evaluated at that same epoch. Object details
show the calculated light-travel time and emission date.

The mode currently covers the Sun, Moon, planets, Galilean moons, documented two-body satellites,
dwarf planets, asteroids, comets, HYG stars, and exoplanet systems with a published host distance.
Astronomy Engine bodies retain a calculated confidence. The remaining Solar System objects
iteratively solve their Earth-received delay with the same documented JPL mean or osculating
elements used by the map, so that result remains explicitly extrapolated. Visual distance
amplification never enters the light-time calculation.

For an exoplanet system, the
[NASA PSCompPars system distance](https://exoplanetarchive.ipac.caltech.edu/docs/API_PS_columns.html)
sets one barycentric delay shared by the host and all its planets, using the
[IAU parsec definition](https://www.iau.org/static/resolutions/IAU2015_English.pdf). The host remains
at its static catalogue direction because this layer reconstructs no host proper motion. Each local
planet orbit is evaluated at the shared emission epoch, but its phase, orientation, and display scale
remain explicitly illustrative rather than an observed ephemeris. Systems without a published
distance stay simultaneous.

Nearby galaxies with a catalogue distance now use its geometric light time while their 3D position
stays static. Cosmicflows-4 distance moduli are interpreted as luminosity distances; large-scale
structure display distances are interpreted as comoving distances. Each is inverted in the same
documented flat ΛCDM model (H0=70 km/s/Mpc, Ωm=0.3, ΩΛ=0.7), then the
[cosmological lookback time](https://arxiv.org/abs/astro-ph/9905116) is applied. The object card shows
the inferred model redshift and identifies which distance type was used. This changes the emission
epoch, not the catalogue position or an object's static appearance.

This is a finite-speed-of-light model with a bounded cosmological approximation, not a complete
relativistic observation or galaxy-evolution model.
HYG uniform-motion extrapolation is bounded to ±10,000 Julian years and is identified when that
boundary is reached.

The Earth-observer planetarium remains a separate topocentric projection. It uses the selected
observing location for altitude, azimuth, terrain obstruction, and apparent angular size; selecting
Received light does not turn the 3D map into that planetarium.

## Planetary positions and rotation

Planet, Moon, and Galilean-moon positions are calculated locally with Astronomy Engine. Selected
minor bodies and other moons use documented [JPL SBDB](https://ssd-api.jpl.nasa.gov/doc/sbdb.html)
or [JPL mean satellite elements](https://ssd.jpl.nasa.gov/sats/elem/) in a simplified two-body
provider. The object card identifies the corresponding confidence level.

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
