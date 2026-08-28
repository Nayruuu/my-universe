import type { StellarObservation } from '../../../engine/simulation/stellar-observation';
import {
  createEarthObservationTimeline,
  earthObservationTimelineStartJulianDay,
  earthObservationTwilight,
  horizontalAngularSeparationDegrees,
} from './earth-observation-timeline';
import type { EarthTerrainHorizonProfile } from './earth-terrain-horizon-catalog.types';

describe('earth observation timeline', () => {
  const startTime = { julianDay: 2_460_000 };
  const target = { id: 'sirius', fallbackName: 'Sirius', color: '#b8ccff' };

  it('ancre une fenêtre stable sur le dernier midi solaire local', () => {
    expect(earthObservationTimelineStartJulianDay({ julianDay: 2_460_000.75 }, 0)).toBe(2_460_000);
    expect(earthObservationTimelineStartJulianDay({ julianDay: 2_460_000.75 }, 90)).toBe(
      2_460_000.75,
    );
    expect(earthObservationTimelineStartJulianDay({ julianDay: Number.NaN }, 0)).toBeNull();
    expect(() => earthObservationTimelineStartJulianDay(startTime, 181)).toThrow(/longitude/i);
  });

  it('classe les crépuscules selon les seuils astronomiques usuels', () => {
    expect([0, -1, -6, -7, -12, -13, -18, -19].map(earthObservationTwilight)).toEqual([
      'daylight',
      'civil',
      'civil',
      'nautical',
      'nautical',
      'astronomical',
      'astronomical',
      'night',
    ]);
  });

  it('calcule les séparations angulaires sur la sphère céleste', () => {
    expect(
      horizontalAngularSeparationDegrees(observation(30, 40), observation(30, 40)),
    ).toBeCloseTo(0, 8);
    expect(horizontalAngularSeparationDegrees(observation(0, 0), observation(0, 90))).toBeCloseTo(
      90,
      8,
    );
    expect(horizontalAngularSeparationDegrees(observation(90, 0), observation(-90, 0))).toBeCloseTo(
      180,
      8,
    );
  });

  it('échantillonne 24 h et extrait lever, culmination, coucher et meilleure fenêtre', () => {
    const timeline = createEarthObservationTimeline({
      startTime,
      target,
      terrainHorizon: null,
      sample: sampleNight,
    })!;

    expect(timeline.points).toHaveLength(49);
    expect(timeline.endTime.julianDay - timeline.startTime.julianDay).toBeCloseTo(1, 10);
    expect(hoursAfterStart(timeline.riseTime!)).toBeCloseTo(6, 1);
    expect(hoursAfterStart(timeline.culminationTime)).toBeCloseTo(12, 1);
    expect(timeline.culminationAltitudeDegrees).toBeCloseTo(60, 8);
    expect(hoursAfterStart(timeline.setTime!)).toBeCloseTo(18, 1);
    expect(timeline.bestPoint?.visible).toBe(true);
    expect(timeline.bestPoint?.twilight).toBe('night');
    expect(timeline.bestWindowStart!.julianDay).toBeLessThan(timeline.bestPoint!.time.julianDay);
    expect(timeline.bestWindowEnd!.julianDay).toBeGreaterThan(timeline.bestPoint!.time.julianDay);
    expect(timeline.targetPolyline.split(' ')).toHaveLength(49);
    expect(timeline.terrainPolyline).toContain('91.64');
    expect(timeline.scoreConfidence).toBe('illustrative');
  });

  it('applique le relief au lever et à la courbe sans le présenter comme une prévision', () => {
    const timeline = createEarthObservationTimeline({
      startTime,
      target,
      terrainHorizon: terrainProfile(20),
      sample: sampleNight,
    })!;

    expect(timeline.terrainApplied).toBe(true);
    expect(hoursAfterStart(timeline.riseTime!)).toBeGreaterThan(7);
    expect(hoursAfterStart(timeline.setTime!)).toBeLessThan(17);
    expect(timeline.points[24]?.terrainAltitudeDegrees).toBe(20);
    expect(timeline.points[24]?.clearanceDegrees).toBeCloseTo(40, 8);
  });

  it('dégrade l’indice près d’une Lune éclairée, sauf lorsque la Lune est la cible', () => {
    const withoutMoon = createEarthObservationTimeline({
      startTime,
      target,
      terrainHorizon: null,
      sample: (time) => sampleNight(time, false),
    })!;
    const withMoon = createEarthObservationTimeline({
      startTime,
      target,
      terrainHorizon: null,
      sample: (time) => sampleNight(time, true),
    })!;
    const moonTarget = createEarthObservationTimeline({
      startTime,
      target: { ...target, id: 'moon' },
      terrainHorizon: null,
      sample: (time) => sampleNight(time, true),
    })!;

    expect(withMoon.bestPoint!.quality).toBeLessThan(withoutMoon.bestPoint!.quality);
    expect(moonTarget.bestPoint!.quality).toBeCloseTo(withoutMoon.bestPoint!.quality, 8);
  });

  it('représente proprement une cible toujours masquée et un échantillon indisponible', () => {
    const hidden = createEarthObservationTimeline({
      startTime,
      target,
      terrainHorizon: terrainProfile(80),
      sample: sampleNight,
    })!;

    expect(hidden.riseTime).toBeNull();
    expect(hidden.setTime).toBeNull();
    expect(hidden.bestPoint).toBeNull();
    expect(hidden.bestWindowStart).toBeNull();
    expect(hidden.bestWindowEnd).toBeNull();
    expect(
      createEarthObservationTimeline({
        startTime,
        target,
        terrainHorizon: null,
        sample: () => null,
      }),
    ).toBeNull();
    expect(
      createEarthObservationTimeline({
        startTime: { julianDay: Number.NaN },
        target,
        terrainHorizon: null,
        sample: sampleNight,
      }),
    ).toBeNull();
    expect(() =>
      createEarthObservationTimeline({
        startTime,
        target,
        terrainHorizon: null,
        sample: sampleNight,
        sampleMinutes: 7,
      }),
    ).toThrow(/sample interval/i);
  });

  function sampleNight(time: { readonly julianDay: number }, brightMoon = false) {
    const hours = hoursAfterStart(time);
    const targetAltitude = 60 * Math.sin(((hours - 6) / 12) * Math.PI);
    const sunAltitude = -24 * Math.cos(((hours - 12) / 12) * Math.PI);

    return {
      target: observation(targetAltitude, 180),
      sun: observation(sunAltitude, 270),
      moon: observation(brightMoon ? 50 : -20, brightMoon ? 190 : 0),
      moonIlluminatedFraction: brightMoon ? 1 : 0,
    };
  }

  function hoursAfterStart(time: { readonly julianDay: number }): number {
    return (time.julianDay - startTime.julianDay) * 24;
  }
});

function observation(altitudeDegrees: number, azimuthDegrees: number): StellarObservation {
  return {
    altitudeDegrees,
    geometricAltitudeDegrees: altitudeDegrees,
    atmosphericRefractionDegrees: 0,
    azimuthDegrees,
    compassDirection: 'south',
    isAboveHorizon: altitudeDegrees >= 0,
  };
}

function terrainProfile(obstructionDegrees: number): EarthTerrainHorizonProfile {
  return {
    locationId: 'fixture',
    latitude: 0,
    longitude: 0,
    observerElevationMeters: 0,
    azimuthStepDegrees: 1,
    obstructionAnglesCentidegrees: new Int16Array(360).fill(obstructionDegrees * 100),
    distanceLayers: [],
    source: {
      id: 'fixture',
      title: 'Fixture',
      productUrl: 'https://example.com',
      dataUrl: 'fixture.tif',
      doi: 'https://doi.org/10.0/fixture',
      horizontalDatum: 'WGS 84',
      verticalDatum: 'EGM2008',
      resolutionArcSeconds: 60,
    },
    calculation: {
      model: 'spherical-geometric-line-of-sight',
      earthRadiusMeters: 6_371_008.8,
      observerEyeHeightMeters: 2,
      maximumDistanceMeters: 300_000,
      azimuthStepDegrees: 1,
      sampleStepMeters: 1_000,
      distanceBands: [],
      atmosphericRefraction: 'excluded',
      terrainInterpolation: 'bilinear',
      locationAnchor: 'catalogued-city-center',
    },
  };
}
