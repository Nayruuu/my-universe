import exoplanetCatalogSource from '../../../public/data/exoplanets/featured-systems.json';
import { SpaceObject } from '../models/universe.models';
import { parseUniverseDataset } from './dataset-validator';

const EQUATORIAL_TO_GALACTIC = [
  [-0.054_875_560_4, -0.873_437_090_2, -0.483_835_015_5],
  [0.494_109_427_9, -0.444_829_63, 0.746_982_244_5],
  [-0.867_666_149, -0.198_076_373_4, 0.455_983_776_2],
] as const;
const NASA_ARCHIVE_URL = 'https://exoplanetarchive.ipac.caltech.edu/';

describe('catalogue des systèmes exoplanétaires remarquables', () => {
  const objects = parseUniverseDataset(exoplanetCatalogSource, 'featured-exoplanets').objects;
  const hosts = objects.filter(({ type }) => type === 'star');
  const planets = objects.filter(({ type }) => type === 'exoplanet');

  it('embarque dix planètes confirmées dans quatre systèmes documentés', () => {
    expect(hosts).toHaveLength(4);
    expect(planets).toHaveLength(10);
    expect(planets.map(({ id }) => id)).toEqual(
      expect.arrayContaining(['kepler-452-b', 'kepler-186-f', 'kepler-22-b', 'trappist-1-e']),
    );
    expect(
      planets.every(
        ({ parentId, scientificConfidence, metadata }) =>
          hosts.some(({ id }) => id === parentId) &&
          scientificConfidence === 'observed' &&
          metadata?.['confirmationStatus'] === 'Confirmed Planet',
      ),
    ).toBe(true);
  });

  it('conserve la provenance NASA et sépare les données mesurées de la phase visuelle', () => {
    for (const object of objects) {
      expect(String(object.metadata?.['sourceUrl'])).toContain(NASA_ARCHIVE_URL);
      expect(object.metadata?.['catalogSnapshotDate']).toBe('2026-08-05');
    }
    for (const planet of planets) {
      expect(planet.positionProvider.type).toBe('illustrative-orbit');
      expect(planet.metadata).toMatchObject({
        orbitRepresentationConfidence: 'illustrative',
        sourceTable: 'PSCompPars',
      });
      expect(planet.metadata?.['semiMajorAxisAu']).toBe(
        planet.positionProvider.type === 'illustrative-orbit'
          ? planet.positionProvider.semiMajorAxis
          : undefined,
      );
    }
  });

  it('reproduit les positions héliocentriques depuis les coordonnées ICRS publiées', () => {
    for (const host of hosts) {
      const expected = equatorialToGalacticScene(
        requiredMetadataNumber(host, 'rightAscensionDegrees'),
        requiredMetadataNumber(host, 'declinationDegrees'),
        requiredMetadataNumber(host, 'distancePc'),
      );
      const actual = requiredStaticPosition(host);

      expect(actual[0]).toBeCloseTo(expected[0], 6);
      expect(actual[1]).toBeCloseTo(expected[1], 6);
      expect(actual[2]).toBeCloseTo(expected[2], 6);
    }
  });

  it('conserve les paramètres composites NASA des destinations principales', () => {
    expect(requiredPlanet('kepler-452-b')).toMatchObject({
      physical: { radiusKm: 10_384.73 },
      metadata: {
        orbitalPeriodDays: 384.843,
        semiMajorAxisAu: 1.046,
        equilibriumTemperatureK: 265,
        discoveryYear: 2015,
      },
    });
    expect(requiredPlanet('kepler-186-f')).toMatchObject({
      metadata: { orbitalPeriodDays: 129.9441, semiMajorAxisAu: 0.432 },
    });
    expect(requiredPlanet('trappist-1-e')).toMatchObject({
      metadata: { orbitalPeriodDays: 6.101013, semiMajorAxisAu: 0.02925 },
    });
  });

  function requiredPlanet(id: string): SpaceObject {
    const planet = planets.find((candidate) => candidate.id === id);

    if (!planet) {
      throw new Error(`Exoplanète manquante : ${id}.`);
    }

    return planet;
  }
});

function requiredMetadataNumber(object: SpaceObject, key: string): number {
  const value = object.metadata?.[key];

  if (typeof value !== 'number') {
    throw new Error(`Métadonnée ${key} manquante pour ${object.id}.`);
  }

  return value;
}

function requiredStaticPosition(object: SpaceObject): [number, number, number] {
  const provider = object.positionProvider;

  if (provider.type !== 'static' || provider.unit !== 'parsec') {
    throw new Error(`Position stellaire manquante pour ${object.id}.`);
  }

  return provider.position;
}

function equatorialToGalacticScene(
  rightAscensionDegrees: number,
  declinationDegrees: number,
  distanceParsec: number,
): [number, number, number] {
  const rightAscension = (rightAscensionDegrees * Math.PI) / 180;
  const declination = (declinationDegrees * Math.PI) / 180;
  const equatorial = [
    distanceParsec * Math.cos(declination) * Math.cos(rightAscension),
    distanceParsec * Math.cos(declination) * Math.sin(rightAscension),
    distanceParsec * Math.sin(declination),
  ] as const;
  const galactic = EQUATORIAL_TO_GALACTIC.map((row) =>
    row.reduce((sum, coefficient, index) => sum + coefficient * equatorial[index]!, 0),
  );

  return [-galactic[0]!, galactic[2]!, galactic[1]!];
}
