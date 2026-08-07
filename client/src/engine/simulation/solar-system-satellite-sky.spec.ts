import extendedSolarSystemSource from '../../../public/data/solar-system/extended.json';
import solarSystemSource from '../../../public/data/solar-system/system.json';
import { parseUniverseDataset } from '../../data/validation/dataset-validator';
import { ASTRONOMY_ENGINE_MAX_JULIAN_DAY } from './astronomy-engine-time-domain';
import {
  calculateSolarSystemSatelliteSky,
  calculateSolarSystemSatelliteSkyObservation,
  isSolarSystemSatelliteSkyTarget,
} from './solar-system-satellite-sky';
import { calculateSolarSystemSky } from './solar-system-sky';
import { dateToJulianDay } from './time-utils';

const PARIS = {
  latitude: 48.8566,
  longitude: 2.3522,
  heightMeters: 35,
};
const TIME = { julianDay: dateToJulianDay(new Date('2026-01-15T22:00:00Z')) };
const OBJECTS = [
  ...parseUniverseDataset(solarSystemSource, 'solar-system-satellite-sky').objects,
  ...parseUniverseDataset(extendedSolarSystemSource, 'extended-satellite-sky').objects,
];

describe('satellites du ciel local terrestre', () => {
  it('calcule les vingt satellites catalogués au-delà de la Lune', () => {
    const observations = calculateSolarSystemSatelliteSky(TIME, PARIS, OBJECTS);

    expect(observations).toHaveLength(20);
    expect(observations.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        'io',
        'europa',
        'ganymede',
        'callisto',
        'titan',
        'phobos',
        'deimos',
        'mimas',
        'enceladus',
        'tethys',
        'dione',
        'rhea',
        'iapetus',
        'miranda',
        'ariel',
        'umbriel',
        'titania',
        'oberon',
        'triton',
        'charon',
      ]),
    );
    expect(
      observations.filter(({ positionConfidence }) => positionConfidence === 'calculated'),
    ).toHaveLength(4);
    expect(
      observations.filter(({ positionConfidence }) => positionConfidence === 'extrapolated'),
    ).toHaveLength(16);
    expect(observations.every(({ skyObjectKind }) => skyObjectKind === 'satellite')).toBe(true);
  });

  it('exprime les positions topocentriques dans le repère unitaire de la caméra', () => {
    const observations = calculateSolarSystemSatelliteSky(TIME, PARIS, OBJECTS);

    for (const body of observations) {
      expect(Math.hypot(body.direction.x, body.direction.y, body.direction.z)).toBeCloseTo(1, 12);
      expect(body.angularDiameterDegrees).toBeGreaterThan(0);
      expect(body.observation.azimuthDegrees).toBeGreaterThanOrEqual(0);
      expect(body.observation.azimuthDegrees).toBeLessThan(360);
    }
  });

  it('conserve les satellites près de leur planète sans employer les distances de rendu', () => {
    const titan = requiredObject('titan');
    const scaledTitan = {
      ...titan,
      positionProvider: { ...titan.positionProvider, distanceScale: 4_000 },
    };
    const physical = calculateSolarSystemSatelliteSkyObservation(TIME, PARIS, titan)!;
    const visuallyRescaled = calculateSolarSystemSatelliteSkyObservation(TIME, PARIS, scaledTitan)!;
    const saturn = calculateSolarSystemSky(TIME, PARIS).find(({ id }) => id === 'saturn')!;

    expect(angularSeparationDegrees(physical.direction, visuallyRescaled.direction)).toBeCloseTo(
      0,
      12,
    );
    // Independent order-of-magnitude reference: Titan's 1,221,900 km orbit viewed from roughly
    // 1.2–1.7 billion km remains below 0.06° at maximum elongation.
    expect(angularSeparationDegrees(physical.direction, saturn.direction)).toBeLessThan(0.06);
  });

  it('n’accepte que les lunes dont le modèle physique est explicite', () => {
    expect(isSolarSystemSatelliteSkyTarget(requiredObject('io'))).toBe(true);
    expect(isSolarSystemSatelliteSkyTarget(requiredObject('charon'))).toBe(true);
    expect(isSolarSystemSatelliteSkyTarget(requiredObject('moon'))).toBe(false);
    expect(
      isSolarSystemSatelliteSkyTarget({ ...requiredObject('titan'), physical: undefined }),
    ).toBe(false);
    expect(
      calculateSolarSystemSatelliteSky(
        { julianDay: ASTRONOMY_ENGINE_MAX_JULIAN_DAY + 1 },
        PARIS,
        OBJECTS,
      ),
    ).toEqual([]);
    expect(
      calculateSolarSystemSatelliteSkyObservation(
        { julianDay: ASTRONOMY_ENGINE_MAX_JULIAN_DAY + 1 },
        PARIS,
        requiredObject('titan'),
      ),
    ).toBeNull();
  });
});

function requiredObject(id: string) {
  return OBJECTS.find((object) => object.id === id)!;
}

function angularSeparationDegrees(
  first: { readonly x: number; readonly y: number; readonly z: number },
  second: { readonly x: number; readonly y: number; readonly z: number },
): number {
  const dot = first.x * second.x + first.y * second.y + first.z * second.z;

  return (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;
}
