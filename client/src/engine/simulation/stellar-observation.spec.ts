import { ASTRONOMY_ENGINE_MAX_JULIAN_DAY } from './astronomy-engine-time-domain';
import { equatorialJ2000ToGalacticScene } from '../coordinates/galactic-reference-frame';
import {
  calculateEarthObserverReferenceFrame,
  calculateEarthObserverZenithDirection,
  calculateStellarObservation,
  createStellarObservationCalculator,
  equatorialCoordinatesFromCartesian,
} from './stellar-observation';
import { dateToJulianDay } from './time-utils';

const SIRIUS_J2000 = {
  rightAscensionDegrees: 101.287_161_3,
  declinationDegrees: -16.716_122,
};
const PARIS = {
  latitude: 48.8566,
  longitude: 2.3522,
  heightMeters: 35,
};

describe('observation stellaire depuis la Terre', () => {
  it('retrouve les coordonnées équatoriales de Sirius depuis son vecteur HYG J2000', () => {
    const rightAscension = (SIRIUS_J2000.rightAscensionDegrees * Math.PI) / 180;
    const declination = (SIRIUS_J2000.declinationDegrees * Math.PI) / 180;
    const distanceParsec = 2.637;
    const projectedDistance = distanceParsec * Math.cos(declination);

    expect(
      equatorialCoordinatesFromCartesian({
        x: projectedDistance * Math.cos(rightAscension),
        y: projectedDistance * Math.sin(rightAscension),
        z: distanceParsec * Math.sin(declination),
      }),
    ).toEqual({
      rightAscensionDegrees: expect.closeTo(101.287_161_3, 8),
      declinationDegrees: expect.closeTo(-16.716_122, 8),
    });
    expect(equatorialCoordinatesFromCartesian({ x: 0, y: -1, z: 0 })).toEqual({
      rightAscensionDegrees: 270,
      declinationDegrees: 0,
    });
  });

  it('localise Sirius au sud depuis Paris pendant une soirée hivernale', () => {
    const time = { julianDay: dateToJulianDay(new Date('2026-01-15T22:00:00Z')) };
    const observation = calculateStellarObservation(time, SIRIUS_J2000, PARIS);
    const referenceFrame = calculateEarthObserverReferenceFrame(time, PARIS);
    const zenith = calculateEarthObserverZenithDirection(time, PARIS);
    const siriusDirection = equatorialJ2000ToGalacticScene(equatorialUnitVector(SIRIUS_J2000));

    expect(observation).toEqual({
      altitudeDegrees: expect.closeTo(23.290_15, 5),
      geometricAltitudeDegrees: expect.closeTo(23.251_266, 5),
      atmosphericRefractionDegrees: expect.closeTo(0.038_885, 5),
      azimuthDegrees: expect.closeTo(165.5396, 5),
      compassDirection: 'south',
      isAboveHorizon: true,
    });
    expect(zenith).not.toBeNull();
    expect(referenceFrame).not.toBeNull();
    expect(vectorLength(referenceFrame!.northDirection)).toBeCloseTo(1, 9);
    expect(vectorLength(referenceFrame!.zenithDirection)).toBeCloseTo(1, 9);
    expect(dot(referenceFrame!.northDirection, referenceFrame!.zenithDirection)).toBeCloseTo(0, 9);
    expect(referenceFrame!.zenithDirection).toEqual(zenith);
    expect(Math.hypot(zenith!.x, zenith!.y, zenith!.z)).toBeCloseTo(1, 9);
    expect(radiansToDegrees(Math.asin(dot(siriusDirection, zenith!)))).toBeCloseTo(
      observation!.geometricAltitudeDegrees,
      5,
    );
  });

  it('signale Sirius sous l’horizon depuis Paris pendant une nuit estivale', () => {
    const observation = calculateStellarObservation(
      { julianDay: dateToJulianDay(new Date('2026-07-15T22:00:00Z')) },
      SIRIUS_J2000,
      PARIS,
    );

    expect(observation).toMatchObject({
      altitudeDegrees: expect.closeTo(-55.255_609, 5),
      azimuthDegrees: expect.closeTo(333.198_646, 5),
      compassDirection: 'northwest',
      isAboveHorizon: false,
    });
  });

  it('réutilise un seul référentiel horizontal pour projeter un catalogue stellaire', () => {
    const time = { julianDay: dateToJulianDay(new Date('2026-01-15T22:00:00Z')) };
    const calculate = createStellarObservationCalculator(time, PARIS);

    expect(calculate).not.toBeNull();
    expect(calculate?.(SIRIUS_J2000)).toEqual(
      calculateStellarObservation(time, SIRIUS_J2000, PARIS),
    );
    expect(
      calculate?.({ rightAscensionDegrees: 88.792_939, declinationDegrees: 7.407_064 }),
    ).toMatchObject({
      altitudeDegrees: expect.any(Number),
      azimuthDegrees: expect.any(Number),
    });
    expect(() => calculate?.({ rightAscensionDegrees: Number.NaN, declinationDegrees: 0 })).toThrow(
      /ascension droite/i,
    );
  });

  it('précesse le pôle céleste J2000 vers le nord local de la date', () => {
    const observation = calculateStellarObservation(
      { julianDay: dateToJulianDay(new Date('2026-01-15T22:00:00Z')) },
      { rightAscensionDegrees: 0, declinationDegrees: 90 },
      PARIS,
    );

    expect(observation?.geometricAltitudeDegrees).toBeCloseTo(48.847_886, 5);
    expect(observation?.azimuthDegrees).toBeCloseTo(0.221_025, 5);
    expect(observation?.compassDirection).toBe('north');
  });

  it('refuse les coordonnées invalides et les dates hors du domaine scientifique', () => {
    expect(() => equatorialCoordinatesFromCartesian({ x: 0, y: 0, z: 0 })).toThrow(
      /vecteur équatorial/i,
    );
    expect(() => equatorialCoordinatesFromCartesian({ x: Number.NaN, y: 0, z: 0 })).toThrow(
      /vecteur équatorial/i,
    );
    for (const rightAscensionDegrees of [Number.NaN, -1, 360]) {
      expect(() =>
        calculateStellarObservation(
          { julianDay: 2_451_545 },
          { rightAscensionDegrees, declinationDegrees: 0 },
          PARIS,
        ),
      ).toThrow(/ascension droite/i);
    }
    for (const declinationDegrees of [Number.NaN, -91, 91]) {
      expect(() =>
        calculateStellarObservation(
          { julianDay: 2_451_545 },
          { rightAscensionDegrees: 0, declinationDegrees },
          PARIS,
        ),
      ).toThrow(/déclinaison/i);
    }
    for (const latitude of [Number.NaN, -91, 91]) {
      expect(() =>
        calculateStellarObservation({ julianDay: 2_451_545 }, SIRIUS_J2000, { ...PARIS, latitude }),
      ).toThrow(/latitude/i);
    }
    for (const longitude of [Number.NaN, -181, 181]) {
      expect(() =>
        calculateStellarObservation({ julianDay: 2_451_545 }, SIRIUS_J2000, {
          ...PARIS,
          longitude,
        }),
      ).toThrow(/longitude/i);
    }
    expect(() =>
      calculateStellarObservation({ julianDay: 2_451_545 }, SIRIUS_J2000, {
        ...PARIS,
        heightMeters: Number.NaN,
      }),
    ).toThrow(/altitude de l’observateur/i);
    expect(
      calculateStellarObservation(
        { julianDay: 2_451_545 },
        { rightAscensionDegrees: 0, declinationDegrees: -90 },
        { latitude: -90, longitude: -180 },
      ),
    ).not.toBeNull();
    expect(
      calculateStellarObservation(
        { julianDay: 2_451_545 },
        { rightAscensionDegrees: 359.999, declinationDegrees: 90 },
        { latitude: 90, longitude: 180 },
      ),
    ).not.toBeNull();
    expect(
      calculateStellarObservation(
        { julianDay: ASTRONOMY_ENGINE_MAX_JULIAN_DAY + 1 },
        SIRIUS_J2000,
        PARIS,
      ),
    ).toBeNull();
    expect(
      createStellarObservationCalculator({ julianDay: ASTRONOMY_ENGINE_MAX_JULIAN_DAY + 1 }, PARIS),
    ).toBeNull();
    expect(
      calculateEarthObserverZenithDirection(
        { julianDay: ASTRONOMY_ENGINE_MAX_JULIAN_DAY + 1 },
        PARIS,
      ),
    ).toBeNull();
    expect(
      calculateEarthObserverReferenceFrame(
        { julianDay: ASTRONOMY_ENGINE_MAX_JULIAN_DAY + 1 },
        PARIS,
      ),
    ).toBeNull();
  });
});

function equatorialUnitVector(coordinates: typeof SIRIUS_J2000) {
  const rightAscension = (coordinates.rightAscensionDegrees * Math.PI) / 180;
  const declination = (coordinates.declinationDegrees * Math.PI) / 180;
  const projected = Math.cos(declination);

  return {
    x: projected * Math.cos(rightAscension),
    y: projected * Math.sin(rightAscension),
    z: Math.sin(declination),
  };
}

function dot(
  left: { readonly x: number; readonly y: number; readonly z: number },
  right: { readonly x: number; readonly y: number; readonly z: number },
): number {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

function vectorLength(vector: { readonly x: number; readonly y: number; readonly z: number }) {
  return Math.hypot(vector.x, vector.y, vector.z);
}
