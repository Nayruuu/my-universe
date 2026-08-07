import blackHoleSource from '../../../public/data/black-holes/catalog.json';
import manifestSource from '../../../public/data/manifest.json';
import { SpaceObject } from '../models/universe.models';
import { CoordinateSystem } from '../../engine/coordinates/coordinate-system';
import { convertDistance } from '../../engine/coordinates/unit-conversion';
import { parseUniverseDataset } from './dataset-validator';

const EQUATORIAL_TO_GALACTIC = [
  [-0.054_875_560_4, -0.873_437_090_2, -0.483_835_015_5],
  [0.494_109_427_9, -0.444_829_63, 0.746_982_244_5],
  [-0.867_666_149, -0.198_076_373_4, 0.455_983_776_2],
] as const;

describe('catalogue des trous noirs', () => {
  const dataset = parseUniverseDataset(blackHoleSource, 'black-holes');
  const byId = new Map(dataset.objects.map((object) => [object.id, object] as const));

  it('fournit trois objets documentés et recherchables', () => {
    expect(dataset.objects.map(({ id }) => id)).toEqual([
      'sagittarius-a-star',
      'cygnus-x-1',
      'gaia-bh1',
    ]);
    expect(dataset.objects.every(({ type }) => type === 'black-hole')).toBe(true);
    expect(dataset.objects.every(({ parentId }) => parentId === 'milky-way')).toBe(true);
    expect(
      dataset.objects.every(({ metadata }) =>
        String(metadata?.['sourceUrl']).startsWith('https://'),
      ),
    ).toBe(true);
  });

  it('versionne son URL statique pour invalider le cache de production', () => {
    const manifestEntry = manifestSource.datasets.find(({ id }) => id === 'black-holes');

    expect(manifestEntry?.url).toBe(`/data/black-holes/catalog.json?v=${blackHoleSource.version}`);
  });

  it('distingue un noyau supermassif, un système actif et un système dormant', () => {
    expect(requiredObject('sagittarius-a-star')).toMatchObject({
      scientificConfidence: 'observed',
      physical: { massKg: 7.95388e36, radiusKm: 11_813_000.32 },
      visual: { blackHoleActivity: 'quiescent' },
      metadata: { massSolar: 4_000_000 },
    });
    expect(requiredObject('cygnus-x-1')).toMatchObject({
      scientificConfidence: 'calculated',
      physical: { massKg: 4.2155564e31, radiusKm: 62.608901696 },
      visual: { blackHoleActivity: 'active' },
      metadata: { massSolar: 21.2 },
    });
    expect(requiredObject('gaia-bh1')).toMatchObject({
      scientificConfidence: 'calculated',
      physical: { massKg: 1.84331169e31, radiusKm: 27.3766282416 },
      visual: { blackHoleActivity: 'dormant' },
      metadata: { massSolar: 9.27 },
    });
  });

  it('déclare un noyau 3D pour Sagittarius A* sans image de fond statique', () => {
    expect(requiredObject('sagittarius-a-star').metadata).toMatchObject({
      lensingEnvironment: 'procedural-nuclear-star-cluster',
    });
    expect(
      dataset.objects
        .filter(({ id }) => id !== 'sagittarius-a-star')
        .every(({ metadata }) => metadata?.['lensingEnvironment'] === undefined),
    ).toBe(true);
  });

  it('sépare le centre galactique des deux positions héliocentriques', () => {
    expect(requiredStaticPosition('sagittarius-a-star')).toEqual([0, 0, 0]);
    expect(requiredObject('sagittarius-a-star').referenceFrame).toBe('galactic');

    for (const object of dataset.objects.filter(({ id }) => id !== 'sagittarius-a-star')) {
      const [x, y, z] = requiredStaticPosition(object.id);
      const measuredDistanceKpc = Math.hypot(x, y, z) / 1_000;
      const documentedDistance = object.metadata?.['distanceKpc'];

      expect(object.referenceFrame).toBe('stellar');
      expect(documentedDistance).toEqual(expect.any(Number));
      expect(measuredDistanceKpc).toBeCloseTo(documentedDistance as number, 3);
    }
  });

  it('reproduit les vecteurs héliocentriques depuis les coordonnées ICRS J2000 publiées', () => {
    for (const object of dataset.objects.filter(({ id }) => id !== 'sagittarius-a-star')) {
      const expected = equatorialToHeliocentricGalactic(
        requiredMetadataNumber(object, 'rightAscensionDegrees'),
        requiredMetadataNumber(object, 'declinationDegrees'),
        requiredMetadataNumber(object, 'distanceKpc'),
      );
      const actual = requiredStaticPosition(object.id);

      expect(actual[0]).toBeCloseTo(expected[0] * 1_000, 3);
      expect(actual[1]).toBeCloseTo(expected[1] * 1_000, 3);
      expect(actual[2]).toBeCloseTo(expected[2] * 1_000, 3);
    }
  });

  it('garde Gaia BH1 au-delà du Système solaire dans la projection visuelle', () => {
    const coordinates = new CoordinateSystem();
    const provider = requiredObject('gaia-bh1').positionProvider;

    if (provider.type !== 'static') {
      throw new Error('Position statique manquante pour Gaia BH1.');
    }
    const rendered = coordinates.toRenderPosition(provider.position, provider.unit, 'stellar');
    const renderedDistance = Math.hypot(rendered.x, rendered.y, rendered.z);
    const uranusAphelion = coordinates.toSceneDistance(20.1, 'astronomical-unit', 'solar-system');

    expect(renderedDistance).toBeGreaterThan(uranusAphelion * 5);
    expect(convertDistance(0.478, 'kiloparsec', 'light-year')).toBeCloseTo(1_559, 0);
  });

  function requiredObject(id: string): SpaceObject {
    const object = byId.get(id);

    if (!object) {
      throw new Error(`Trou noir manquant : ${id}.`);
    }

    return object;
  }

  function requiredStaticPosition(id: string): [number, number, number] {
    const provider = requiredObject(id).positionProvider;

    if (provider.type !== 'static') {
      throw new Error(`Position statique manquante pour ${id}.`);
    }

    return provider.position;
  }
});

function requiredMetadataNumber(object: SpaceObject, key: string): number {
  const value = object.metadata?.[key];

  if (typeof value !== 'number') {
    throw new Error(`Métadonnée numérique ${key} manquante pour ${object.id}.`);
  }

  return value;
}

function equatorialToHeliocentricGalactic(
  rightAscensionDegrees: number,
  declinationDegrees: number,
  distanceKpc: number,
): [number, number, number] {
  const rightAscension = (rightAscensionDegrees * Math.PI) / 180;
  const declination = (declinationDegrees * Math.PI) / 180;
  const equatorial = [
    distanceKpc * Math.cos(declination) * Math.cos(rightAscension),
    distanceKpc * Math.cos(declination) * Math.sin(rightAscension),
    distanceKpc * Math.sin(declination),
  ] as const;
  const galactic = EQUATORIAL_TO_GALACTIC.map((row) =>
    row.reduce((sum, coefficient, index) => sum + coefficient * equatorial[index]!, 0),
  );

  return [-galactic[0]!, galactic[2]!, galactic[1]!];
}
