import { PositionProviderDefinition } from '../../data/models/universe.models';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import {
  IllustrativeOrbitProvider,
  KeplerianOrbitProvider,
  LinearProperMotionProvider,
  PositionProviderFactory,
  ProceduralPositionProvider,
  SolarSystemEphemerisProvider,
  StaticPositionProvider,
} from './position-providers';
import { ASTRONOMY_ENGINE_MAX_JULIAN_DAY } from './astronomy-engine-time-domain';
import { dateToJulianDay, JULIAN_DAY_J2000 } from './time-utils';

describe('fournisseurs de position', () => {
  const coordinates = new CoordinateSystem();

  it('anime une orbite exoplanétaire illustrative sans inventer une phase observée', () => {
    const definition: Extract<PositionProviderDefinition, { type: 'illustrative-orbit' }> = {
      type: 'illustrative-orbit',
      semiMajorAxis: 1,
      orbitalPeriodDays: 100,
      epochJulianDay: JULIAN_DAY_J2000,
      visualPhaseAtEpochDegrees: 30,
      visualInclinationDegrees: 60,
      unit: 'astronomical-unit',
      distanceScale: 2,
    };
    const provider = new IllustrativeOrbitProvider(definition, coordinates, 'solar-system');
    const atEpoch = provider.getPositionAt({ julianDay: JULIAN_DAY_J2000 });
    const afterOnePeriod = provider.getPositionAt({ julianDay: JULIAN_DAY_J2000 + 100 });

    expect(atEpoch.x).toBeCloseTo(15 * Math.sqrt(3), 8);
    expect(atEpoch.y).toBeCloseTo((15 * Math.sqrt(3)) / 2, 8);
    expect(atEpoch.z).toBeCloseTo(7.5, 8);
    expect(afterOnePeriod).toEqual(
      expect.objectContaining({
        x: expect.closeTo(atEpoch.x, 8),
        y: expect.closeTo(atEpoch.y, 8),
        z: expect.closeTo(atEpoch.z, 8),
      }),
    );
    const withoutVisualScale = new IllustrativeOrbitProvider(
      { ...definition, distanceScale: undefined },
      coordinates,
      'solar-system',
    );

    expect(withoutVisualScale.getPositionAt({ julianDay: JULIAN_DAY_J2000 }).x).toBeCloseTo(
      atEpoch.x / 2,
      8,
    );
  });

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

  it('oriente une orbite satellite dans son plan équatorial J2000 documenté', () => {
    const definition: Extract<PositionProviderDefinition, { type: 'keplerian' }> = {
      type: 'keplerian',
      semiMajorAxis: 190_929,
      eccentricity: 0,
      inclination: 0,
      longitudeOfAscendingNode: 0,
      argumentOfPeriapsis: 0,
      meanAnomalyAtEpoch: 0,
      epochJulianDay: JULIAN_DAY_J2000,
      orbitalPeriodDays: 2.520379,
      unit: 'kilometer',
      referencePlanePole: {
        rightAscensionDegrees: 257.311,
        declinationDegrees: -15.175,
      },
    };
    const provider = new KeplerianOrbitProvider(definition, coordinates, 'solar-system');
    const expectedPole = equatorialPoleToScene(definition.referencePlanePole!);

    for (const elapsedDays of [
      0,
      definition.orbitalPeriodDays / 4,
      definition.orbitalPeriodDays / 2,
    ]) {
      const position = provider.getPositionAt({ julianDay: JULIAN_DAY_J2000 + elapsedDays });
      const normalizedDot = dot(position, expectedPole) / vectorLength(position);

      expect(Math.abs(normalizedDot)).toBeLessThan(3e-7);
    }
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

  it('retarde les éphémérides planétaires, lunaires et galiléennes prises en charge', () => {
    const time = { julianDay: dateToJulianDay(new Date('2026-01-15T18:00:00.000Z')) };
    const mars = new SolarSystemEphemerisProvider(
      ephemerisDefinition('mars', 'sun', 686.98),
      coordinates,
      'solar-system',
    );
    const moon = new SolarSystemEphemerisProvider(
      ephemerisDefinition('moon', 'earth', 27.321_661),
      coordinates,
      'solar-system',
    );
    const earth = new SolarSystemEphemerisProvider(
      ephemerisDefinition('earth', 'sun', 365.256),
      coordinates,
      'solar-system',
    );
    const io = new SolarSystemEphemerisProvider(
      ephemerisDefinition('io', 'jupiter', 1.769),
      coordinates,
      'solar-system',
    );
    const receivedMars = mars.getReceivedPositionAt(time)!;
    const receivedMoon = moon.getReceivedPositionAt(time)!;
    const receivedEarth = earth.getReceivedPositionAt(time)!;
    const receivedIo = io.getReceivedPositionAt(time)!;

    expect(receivedMars.light.lightTravelDays).toBeCloseTo(0.013_845_575, 7);
    expect(receivedMars.position).not.toEqual(mars.getPositionAt(time));
    expect(receivedMoon.light.lightTravelDays * 86_400).toBeGreaterThan(1);
    expect(receivedMoon.position).not.toEqual(moon.getPositionAt(time));
    expect(receivedEarth.light.lightTravelDays).toBe(0);
    expect(receivedEarth.position).toEqual(earth.getPositionAt(time));
    expect(
      Math.abs(receivedIo.light.lightTravelDays * 86_400 - 2_116.206_545_159_341),
    ).toBeLessThan(0.1);
    expect(receivedIo.position).not.toEqual(io.getPositionAt(time));
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

  it('borne Pluton à la dernière époque documentée au lieu de lancer une intégration géante', () => {
    const provider = new PositionProviderFactory(coordinates).create(
      ephemerisDefinition('pluto', 'sun', 90_560),
      'solar-system',
    );
    const boundary = provider.getPositionAt({ julianDay: ASTRONOMY_ENGINE_MAX_JULIAN_DAY });
    const oneMillionYearsLater = provider.getPositionAt({
      julianDay: ASTRONOMY_ENGINE_MAX_JULIAN_DAY + 365_250_000,
    });

    expect(oneMillionYearsLater).toEqual(
      expect.objectContaining({
        x: expect.closeTo(boundary.x, 10),
        y: expect.closeTo(boundary.y, 10),
        z: expect.closeTo(boundary.z, 10),
      }),
    );
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

function equatorialPoleToScene(pole: {
  rightAscensionDegrees: number;
  declinationDegrees: number;
}): { x: number; y: number; z: number } {
  const rightAscension = (pole.rightAscensionDegrees * Math.PI) / 180;
  const declination = (pole.declinationDegrees * Math.PI) / 180;
  const obliquity = (23.439291111 * Math.PI) / 180;
  const equatorial = {
    x: Math.cos(declination) * Math.cos(rightAscension),
    y: Math.cos(declination) * Math.sin(rightAscension),
    z: Math.sin(declination),
  };
  const eclipticY = Math.cos(obliquity) * equatorial.y + Math.sin(obliquity) * equatorial.z;
  const eclipticZ = -Math.sin(obliquity) * equatorial.y + Math.cos(obliquity) * equatorial.z;

  return { x: equatorial.x, y: eclipticZ, z: -eclipticY };
}

function dot(
  left: { x: number; y: number; z: number },
  right: { x: number; y: number; z: number },
): number {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}
