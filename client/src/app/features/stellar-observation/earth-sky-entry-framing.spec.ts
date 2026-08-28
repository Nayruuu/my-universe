import type { SpaceObject } from '../../../data/models/universe.models';
import { DEFAULT_EARTH_OBSERVER_LOCATION } from '../../../engine/simulation/earth-observer-location';
import {
  EARTH_SKY_MAXIMUM_ALTITUDE_DEGREES,
  EARTH_SKY_MINIMUM_ALTITUDE_DEGREES,
  earthSkyEntryFraming,
  earthSkyEntryPitchOffset,
  earthSkyFramingForHorizon,
} from './earth-sky-entry-framing';

describe('earthSkyEntryPitchOffset', () => {
  it('relève le regard lorsque la cible se trouve sous l’horizon', () => {
    const offset = earthSkyEntryPitchOffset(
      sirius(),
      { julianDay: 2_461_269.122_916_667 },
      DEFAULT_EARTH_OBSERVER_LOCATION,
    );

    expect(offset).toBeGreaterThan(25);
    expect(offset).toBeLessThan(35);
  });

  it('exprime les limites verticales dans le repère de la cible observée', () => {
    const framing = earthSkyEntryFraming(
      sirius(),
      { julianDay: 2_461_269.122_916_667 },
      DEFAULT_EARTH_OBSERVER_LOCATION,
    );
    const targetAltitude = 18 - framing.initialPitchOffsetDegrees;

    expect(framing.pitchLimits.minimumPitchOffsetDegrees + targetAltitude).toBeCloseTo(
      EARTH_SKY_MINIMUM_ALTITUDE_DEGREES,
      10,
    );
    expect(framing.pitchLimits.maximumPitchOffsetDegrees + targetAltitude).toBeCloseTo(
      EARTH_SKY_MAXIMUM_ALTITUDE_DEGREES,
      10,
    );
    expect(framing.initialCenterAltitudeDegrees).toBeCloseTo(18, 10);
    expect(Math.hypot(...Object.values(framing.targetDirection!))).toBeCloseTo(1, 12);
    expect(framing.northDirection).toBeDefined();
    expect(framing.zenithDirection).toBeDefined();
    expect(framing.resolveReferenceFrame?.({ julianDay: 2_461_269.2 })).not.toBeNull();
    expect(framing.resolveReferenceFrame?.({ julianDay: Number.MAX_SAFE_INTEGER })).toBeNull();
  });

  it('conserve le cadrage d’une cible déjà suffisamment haute', () => {
    expect(
      earthSkyEntryPitchOffset(
        sirius(),
        { julianDay: 2_461_055.416_666_7 },
        DEFAULT_EARTH_OBSERVER_LOCATION,
      ),
    ).toBe(0);
  });

  it('cadre un satellite avec sa direction physique plutôt que sa distance de rendu', () => {
    const framing = earthSkyEntryFraming(
      titan(),
      { julianDay: 2_461_056.416_666_7 },
      DEFAULT_EARTH_OBSERVER_LOCATION,
    );

    expect(framing.targetDirection).toMatchObject({
      x: expect.any(Number),
      y: expect.any(Number),
      z: expect.any(Number),
    });
    expect(Math.hypot(...Object.values(framing.targetDirection!))).toBeCloseTo(1, 12);
  });

  it('garde la cible et l’horizon visibles lorsqu’une étoile est presque au zénith', () => {
    const framing = earthSkyEntryFraming(
      capella(),
      { julianDay: 2_461_055.416_666_7 },
      DEFAULT_EARTH_OBSERVER_LOCATION,
    );
    const fieldOfView = framing.verticalFieldOfViewDegrees ?? 82;
    const centerAltitude = framing.initialCenterAltitudeDegrees ?? 0;
    const targetAltitude = centerAltitude - framing.initialPitchOffsetDegrees;
    const horizonPercentage = 50 + (centerAltitude / fieldOfView) * 100;
    const targetPercentage = 50 - ((targetAltitude - centerAltitude) / fieldOfView) * 100;

    expect(fieldOfView).toBeGreaterThan(82);
    expect(horizonPercentage).toBeGreaterThan(85);
    expect(horizonPercentage).toBeLessThan(100);
    expect(targetPercentage).toBeGreaterThan(0);
  });

  it('retombe sur le cadrage neutre sans coordonnées ou hors domaine temporel', () => {
    expect(
      earthSkyEntryPitchOffset(
        { ...sirius(), metadata: undefined },
        { julianDay: 2_461_269.122_916_667 },
        DEFAULT_EARTH_OBSERVER_LOCATION,
      ),
    ).toBe(0);
    expect(
      earthSkyEntryPitchOffset(
        sirius(),
        { julianDay: Number.MAX_SAFE_INTEGER },
        DEFAULT_EARTH_OBSERVER_LOCATION,
      ),
    ).toBe(0);
  });

  it('conserve la hauteur visible de l’horizon lorsque la cible change d’altitude', () => {
    const framing = earthSkyFramingForHorizon(
      {
        initialPitchOffsetDegrees: 0,
        pitchLimits: {
          minimumPitchOffsetDegrees: -30,
          maximumPitchOffsetDegrees: 60,
        },
      },
      -10,
      75,
    );
    const resultingHorizonPercentage = 50 + ((-10 + framing.initialPitchOffsetDegrees) / 82) * 100;

    expect(resultingHorizonPercentage).toBeCloseTo(75, 10);
    expect(framing.initialCenterAltitudeDegrees).toBeCloseTo(20.5, 10);
  });

  it('respecte les limites verticales du point d’observation', () => {
    const framing = {
      initialPitchOffsetDegrees: 0,
      pitchLimits: {
        minimumPitchOffsetDegrees: -12,
        maximumPitchOffsetDegrees: 18,
      },
    };

    expect(earthSkyFramingForHorizon(framing, -80, 120).initialPitchOffsetDegrees).toBe(18);
    expect(earthSkyFramingForHorizon(framing, 80, 0, 64).initialPitchOffsetDegrees).toBe(-12);
  });
});

function sirius(): SpaceObject {
  return {
    id: 'sirius',
    name: 'Sirius',
    type: 'star',
    referenceFrame: 'stellar',
    scientificConfidence: 'observed',
    visual: { visualRadius: 1, scaleMode: 'adaptive' },
    positionProvider: { type: 'static', position: [1, 2, 3], unit: 'parsec' },
    metadata: {
      rightAscensionDegrees: 101.287_155,
      declinationDegrees: -16.716_116,
      skyCoordinateEpoch: 'J2000',
    },
  };
}

function capella(): SpaceObject {
  return {
    ...sirius(),
    id: 'capella',
    name: 'Capella',
    metadata: {
      rightAscensionDegrees: 79.172_328,
      declinationDegrees: 45.997_991,
      skyCoordinateEpoch: 'J2000',
    },
  };
}

function titan(): SpaceObject {
  return {
    id: 'titan',
    name: 'Titan',
    type: 'moon',
    parentId: 'saturn',
    referenceFrame: 'solar-system',
    scientificConfidence: 'extrapolated',
    physical: { radiusKm: 2_574.76 },
    visual: { visualRadius: 1, scaleMode: 'adaptive' },
    positionProvider: {
      type: 'keplerian',
      semiMajorAxis: 1_221_900,
      eccentricity: 0.029,
      inclination: 0.3,
      longitudeOfAscendingNode: 78.6,
      argumentOfPeriapsis: 78.3,
      meanAnomalyAtEpoch: 11.7,
      epochJulianDay: 2_451_545,
      orbitalPeriodDays: 15.945448,
      unit: 'kilometer',
      distanceScale: 40,
      referencePlanePole: { rightAscensionDegrees: 40.6, declinationDegrees: 83.5 },
    },
  };
}
