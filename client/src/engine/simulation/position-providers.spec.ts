import { PositionProviderDefinition } from '../../data/models/universe.models';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import {
  KeplerianOrbitProvider,
  LinearProperMotionProvider,
  PositionProviderFactory,
  ProceduralPositionProvider,
  SolarSystemEphemerisProvider,
  StaticPositionProvider,
} from './position-providers';
import { dateToJulianDay, JULIAN_DAY_J2000 } from './time-utils';

describe('fournisseurs de position', () => {
  const coordinates = new CoordinateSystem();

  it('place une orbite circulaire sur son demi-grand axe à l’époque', () => {
    const definition: Extract<PositionProviderDefinition, { type: 'keplerian' }> = {
      type: 'keplerian',
      semiMajorAxis: 1,
      eccentricity: 0,
      inclination: 0,
      longitudeOfAscendingNode: 0,
      argumentOfPeriapsis: 0,
      meanAnomalyAtEpoch: 0,
      epochJulianDay: JULIAN_DAY_J2000,
      orbitalPeriodDays: 100,
      unit: 'astronomical-unit',
    };
    const provider = new KeplerianOrbitProvider(definition, coordinates, 'solar-system');

    expect(provider.getPositionAt({ julianDay: JULIAN_DAY_J2000 })).toEqual({
      x: 15,
      y: 0,
      z: 0,
    });
  });

  it('parcourt un quart d’orbite en un quart de période', () => {
    const definition: Extract<PositionProviderDefinition, { type: 'keplerian' }> = {
      type: 'keplerian',
      semiMajorAxis: 2,
      eccentricity: 0,
      inclination: 0,
      longitudeOfAscendingNode: 0,
      argumentOfPeriapsis: 0,
      meanAnomalyAtEpoch: 0,
      epochJulianDay: JULIAN_DAY_J2000,
      orbitalPeriodDays: 100,
      unit: 'astronomical-unit',
    };
    const provider = new KeplerianOrbitProvider(definition, coordinates, 'solar-system');
    const position = provider.getPositionAt({ julianDay: JULIAN_DAY_J2000 + 25 });

    expect(position.x).toBeCloseTo(0, 8);
    expect(position.z).toBeCloseTo(30, 8);
  });

  it('résout une orbite très excentrique sans sortir de ses apsides', () => {
    const definition: Extract<PositionProviderDefinition, { type: 'keplerian' }> = {
      type: 'keplerian',
      semiMajorAxis: 1,
      eccentricity: 0.9,
      inclination: 37,
      longitudeOfAscendingNode: 62,
      argumentOfPeriapsis: 15,
      meanAnomalyAtEpoch: 30,
      epochJulianDay: JULIAN_DAY_J2000,
      orbitalPeriodDays: 433,
      unit: 'astronomical-unit',
    };
    const provider = new KeplerianOrbitProvider(definition, coordinates, 'solar-system');
    const position = provider.getPositionAt({ julianDay: JULIAN_DAY_J2000 });
    const radius = vectorLength(position);

    expect(Number.isFinite(radius)).toBe(true);
    expect(radius).toBeGreaterThanOrEqual(15 * (1 - definition.eccentricity));
    expect(radius).toBeLessThanOrEqual(15 * (1 + definition.eccentricity));
  });

  it('interpole un mouvement linéaire depuis son époque', () => {
    const definition: Extract<PositionProviderDefinition, { type: 'linear-motion' }> = {
      type: 'linear-motion',
      positionAtEpoch: [1, 0, 0],
      velocityPerDay: [0.01, 0, 0],
      epochJulianDay: JULIAN_DAY_J2000,
      unit: 'astronomical-unit',
    };
    const provider = new LinearProperMotionProvider(definition, coordinates, 'solar-system');

    expect(provider.getPositionAt({ julianDay: JULIAN_DAY_J2000 + 10 }).x).toBeCloseTo(16.5, 8);
  });

  it.each([
    {
      label: 'totale du 3 mars 2026',
      instant: '2026-03-03T11:34:52.000Z',
      nasaGamma: 0.3765,
    },
    {
      label: 'partielle du 28 août 2026',
      instant: '2026-08-28T04:14:04.000Z',
      nasaGamma: 0.4964,
    },
  ])('reproduit l’alignement de l’éclipse lunaire $label', ({ instant, nasaGamma }) => {
    const earth = new SolarSystemEphemerisProvider(
      ephemerisDefinition('earth', 'sun', 365.256),
      coordinates,
      'solar-system',
    );
    const moon = new SolarSystemEphemerisProvider(
      ephemerisDefinition('moon', 'earth', 27.321_661),
      coordinates,
      'solar-system',
    );
    const time = { julianDay: dateToJulianDay(new Date(instant)) };
    const earthPosition = earth.getPositionAt(time);
    const moonPosition = moon.getPositionAt(time);
    const shadowAxisDistance = distanceToAxis(moonPosition, earthPosition);
    const earthRadius = coordinates.toSceneDistance(6_378.137, 'kilometer', 'solar-system');

    // Gamma NASA : distance à l’axe de l’ombre terrestre, en rayons équatoriaux terrestres.
    expect(shadowAxisDistance / earthRadius).toBeCloseTo(nasaGamma, 2);
  });

  it('sépare la précision scientifique de l’exagération visuelle Terre–Lune', () => {
    const scientific = new SolarSystemEphemerisProvider(
      ephemerisDefinition('moon', 'earth', 27.321_661),
      coordinates,
      'solar-system',
    );
    const visual = new SolarSystemEphemerisProvider(
      {
        ...ephemerisDefinition('moon', 'earth', 27.321_661),
        distanceScale: 31.2175,
      },
      coordinates,
      'solar-system',
    );
    const time = { julianDay: dateToJulianDay(new Date('2026-08-28T04:14:04.000Z')) };

    expect(
      vectorLength(visual.getPositionAt(time)) / vectorLength(scientific.getPositionAt(time)),
    ).toBeCloseTo(31.2175, 6);
  });

  it('calcule les quatre lunes galiléennes dans le référentiel de Jupiter', () => {
    const factory = new PositionProviderFactory(coordinates);
    const time = { julianDay: JULIAN_DAY_J2000 };

    for (const [body, meanDistanceKm] of [
      ['io', 421_800],
      ['europa', 671_100],
      ['ganymede', 1_070_400],
      ['callisto', 1_882_700],
    ] as const) {
      const scientific = factory.create(ephemerisDefinition(body, 'jupiter', 1), 'solar-system');
      const visual = factory.create(
        { ...ephemerisDefinition(body, 'jupiter', 1), distanceScale: 40 },
        'solar-system',
      );
      const physicalDistanceKm =
        (vectorLength(scientific.getPositionAt(time)) / 15) * 149_597_870.7;

      expect(Math.abs(physicalDistanceKm - meanDistanceKm) / meanDistanceKm).toBeLessThan(0.02);
      expect(
        vectorLength(visual.getPositionAt(time)) / vectorLength(scientific.getPositionAt(time)),
      ).toBeCloseTo(40, 8);
    }
  });

  it('utilise l’éphéméride héliocentrique de Pluton', () => {
    const provider = new PositionProviderFactory(coordinates).create(
      ephemerisDefinition('pluto', 'sun', 90_560),
      'solar-system',
    );
    const distanceAu = vectorLength(provider.getPositionAt({ julianDay: JULIAN_DAY_J2000 })) / 15;

    expect(distanceAu).toBeGreaterThan(29);
    expect(distanceAu).toBeLessThan(50);
  });

  it('applique une exagération visuelle optionnelle aux orbites képlériennes satellites', () => {
    const definition: Extract<PositionProviderDefinition, { type: 'keplerian' }> = {
      type: 'keplerian',
      semiMajorAxis: 1_221_900,
      eccentricity: 0,
      inclination: 0,
      longitudeOfAscendingNode: 0,
      argumentOfPeriapsis: 0,
      meanAnomalyAtEpoch: 0,
      epochJulianDay: JULIAN_DAY_J2000,
      orbitalPeriodDays: 15.945448,
      unit: 'kilometer',
      distanceScale: 40,
    };
    const provider = new KeplerianOrbitProvider(definition, coordinates, 'solar-system');
    const distance = vectorLength(provider.getPositionAt({ julianDay: JULIAN_DAY_J2000 }));
    const physicalDistance = coordinates.toSceneDistance(
      definition.semiMajorAxis,
      'kilometer',
      'solar-system',
    );

    expect(distance / physicalDistance).toBeCloseTo(40, 10);
  });

  it('rejette une origine incompatible et crée le fournisseur via la factory', () => {
    expect(
      () =>
        new SolarSystemEphemerisProvider(
          ephemerisDefinition('earth', 'sun', 365.256),
          coordinates,
          'stellar',
        ),
    ).toThrow(/référentiel solar-system/);
    expect(
      () =>
        new SolarSystemEphemerisProvider(
          ephemerisDefinition('moon', 'sun', 27.321_661),
          coordinates,
          'solar-system',
        ),
    ).toThrow(/incohérente/);

    const provider = new PositionProviderFactory(coordinates).create(
      ephemerisDefinition('mars', 'sun', 686.98),
      'solar-system',
    );

    expect(vectorLength(provider.getPositionAt({ julianDay: JULIAN_DAY_J2000 }))).toBeGreaterThan(
      20,
    );
  });

  it('construit toutes les familles de fournisseurs depuis leurs définitions', () => {
    const factory = new PositionProviderFactory(coordinates);
    const staticProvider = factory.create(
      {
        type: 'static',
        position: [1, 2, 3],
        unit: 'astronomical-unit',
      },
      'solar-system',
    );
    const keplerianProvider = factory.create(
      {
        type: 'keplerian',
        semiMajorAxis: 1,
        eccentricity: 0,
        inclination: 0,
        longitudeOfAscendingNode: 0,
        argumentOfPeriapsis: 0,
        meanAnomalyAtEpoch: 0,
        epochJulianDay: JULIAN_DAY_J2000,
        orbitalPeriodDays: 365,
        unit: 'astronomical-unit',
      },
      'solar-system',
    );
    const linearProvider = factory.create(
      {
        type: 'linear-motion',
        positionAtEpoch: [1, 0, 0],
        velocityPerDay: [0, 0.01, 0],
        epochJulianDay: JULIAN_DAY_J2000,
        unit: 'light-year',
      },
      'stellar',
    );
    const proceduralProvider = factory.create(
      {
        type: 'procedural',
        generatorId: 'test',
        seed: 42,
      },
      'galactic',
    );

    expect(staticProvider).toBeInstanceOf(StaticPositionProvider);
    expect(keplerianProvider).toBeInstanceOf(KeplerianOrbitProvider);
    expect(linearProvider).toBeInstanceOf(LinearProperMotionProvider);
    expect(proceduralProvider).toBeInstanceOf(ProceduralPositionProvider);

    const firstStaticPosition = staticProvider.getPositionAt({ julianDay: JULIAN_DAY_J2000 });

    firstStaticPosition.x = 0;
    expect(staticProvider.getPositionAt({ julianDay: JULIAN_DAY_J2000 })).toEqual({
      x: 15,
      y: 30,
      z: 45,
    });
    const firstProceduralPosition = proceduralProvider.getPositionAt({
      julianDay: JULIAN_DAY_J2000,
    });
    const laterProceduralPosition = proceduralProvider.getPositionAt({
      julianDay: JULIAN_DAY_J2000 + 1_000,
    });

    expect(Math.hypot(firstProceduralPosition.x, firstProceduralPosition.z)).toBeCloseTo(2_442, 8);
    expect(laterProceduralPosition).not.toEqual(firstProceduralPosition);
  });

  it('refuse explicitement un lien de catalogue non résolu par le registre stellaire', () => {
    expect(() =>
      new PositionProviderFactory(coordinates).create(
        {
          type: 'catalog',
          catalogId: 'hyg-v41-bright-stars',
          identifier: 'HIP 32349',
        },
        'stellar',
      ),
    ).toThrow(/catalogue.*résolu/iu);
  });
});

function ephemerisDefinition(
  body: Extract<PositionProviderDefinition, { type: 'ephemeris' }>['body'],
  origin: Extract<PositionProviderDefinition, { type: 'ephemeris' }>['origin'],
  orbitalPeriodDays: number,
): Extract<PositionProviderDefinition, { type: 'ephemeris' }> {
  return {
    type: 'ephemeris',
    body,
    origin,
    orbitalPeriodDays,
    orbitEpochJulianDay: 2_461_249,
  };
}

function distanceToAxis(
  point: { x: number; y: number; z: number },
  axis: { x: number; y: number; z: number },
): number {
  const axisLength = vectorLength(axis);
  const axisX = axis.x / axisLength;
  const axisY = axis.y / axisLength;
  const axisZ = axis.z / axisLength;
  const crossX = point.y * axisZ - point.z * axisY;
  const crossY = point.z * axisX - point.x * axisZ;
  const crossZ = point.x * axisY - point.y * axisX;

  return Math.hypot(crossX, crossY, crossZ);
}

function vectorLength(vector: { x: number; y: number; z: number }): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}
