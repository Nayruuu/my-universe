import localGroupSource from '../../../public/data/galaxies/local-group.json';
import { SpaceObject } from '../models/universe.models';
import { parseUniverseDataset } from './dataset-validator';
import {
  assertLocalGroupCatalogCoordinates,
  galacticCoordinatesToCartesian,
} from './local-group-catalog';

describe('catalogue cartographique du Groupe local', () => {
  it('convertit les coordonnées galactiques de référence en coordonnées cartésiennes', () => {
    const andromeda = galacticCoordinatesToCartesian(783, 121.2, -21.6);

    expect(andromeda.x).toBeCloseTo(-377.131, 0);
    expect(andromeda.y).toBeCloseTo(-288.242, 0);
    expect(andromeda.z).toBeCloseTo(622.718, 0);

    const northPole = galacticCoordinatesToCartesian(10, 0, 90);

    expect(northPole.x).toBeCloseTo(0, 10);
    expect(northPole.y).toBeCloseTo(10, 10);
    expect(northPole.z).toBeCloseTo(0, 10);
  });

  it('fournit 31 galaxies observées avec une priorité cartographique unique', () => {
    const dataset = parseUniverseDataset(localGroupSource, 'local-group');
    const galaxies = dataset.objects.filter((object) => object.type === 'galaxy');
    const ranks = galaxies
      .map((object) => object.metadata?.['mapLabelRank'])
      .filter((rank): rank is number => typeof rank === 'number')
      .sort((left, right) => left - right);

    expect(galaxies).toHaveLength(31);
    expect(ranks).toEqual(Array.from({ length: 31 }, (_, index) => index));
    expect(galaxies.map((object) => object.id)).toEqual(
      expect.arrayContaining([
        'andromeda',
        'triangulum',
        'large-magellanic-cloud',
        'fornax-dwarf',
        'andromeda-i',
        'pegasus-dwarf',
        'ugc-4879',
      ]),
    );
    expect(() => assertLocalGroupCatalogCoordinates(dataset.objects)).not.toThrow();
  });

  it('documente une taille physique pour chaque galaxie du Groupe local', () => {
    const dataset = parseUniverseDataset(localGroupSource, 'local-group');
    const galaxies = dataset.objects.filter((object) => object.type === 'galaxy');

    for (const object of galaxies) {
      const diameterLightYears = object.metadata?.['diameterLy'];
      const halfLightRadiusParsecs = object.metadata?.['halfLightRadiusPc'];
      const hasPhysicalDiameter = typeof diameterLightYears === 'number' && diameterLightYears > 0;
      const hasHalfLightRadius =
        typeof halfLightRadiusParsecs === 'number' && halfLightRadiusParsecs > 0;

      expect(
        hasPhysicalDiameter || hasHalfLightRadius,
        `${object.id} doit documenter diameterLy ou halfLightRadiusPc`,
      ).toBe(true);
    }
  });

  it('conserve les tailles indépendantes publiées pour les Nuages de Magellan et Draco', () => {
    const dataset = parseUniverseDataset(localGroupSource, 'local-group');
    const byId = new Map(dataset.objects.map((object) => [object.id, object]));

    expect(byId.get('large-magellanic-cloud')?.metadata?.['diameterLy']).toBe(14_000);
    expect(byId.get('small-magellanic-cloud')?.metadata?.['diameterLy']).toBe(7_000);
    expect(byId.get('large-magellanic-cloud')?.metadata?.['sizeSource']).toContain(
      'NASA SVS 11293',
    );
    expect(byId.get('draco-dwarf')?.metadata?.['halfLightRadiusPc']).toBe(221);
    expect(byId.get('draco-dwarf')?.metadata?.['source']).toContain('McConnachie 2012');
  });

  it('valide une position relative à la galaxie hôte', () => {
    const host = galaxy('host', undefined, [100, 0, 0], {
      distanceKpc: 100,
      galacticLongitudeDegrees: 0,
      galacticLatitudeDegrees: 0,
    });
    const satellite = galaxy('satellite', 'host', [0, 20, 0], {
      distanceKpc: Math.hypot(100, 20),
      galacticLongitudeDegrees: 0,
      galacticLatitudeDegrees: (Math.atan2(20, 100) * 180) / Math.PI,
    });

    expect(() => assertLocalGroupCatalogCoordinates([host, satellite], 0.01)).not.toThrow();
  });

  it('rejette une position qui dérive des coordonnées cataloguées', () => {
    const displaced = galaxy('displaced', undefined, [12, 0, 0], {
      distanceKpc: 10,
      galacticLongitudeDegrees: 0,
      galacticLatitudeDegrees: 0,
    });

    expect(() => assertLocalGroupCatalogCoordinates([displaced], 0.5)).toThrow(
      'Coordonnées galactiques incohérentes pour displaced',
    );
  });

  it.each([
    {
      id: 'procedural',
      positionProvider: {
        type: 'procedural' as const,
        generatorId: 'test-galaxy',
        seed: 1,
      },
    },
    {
      id: 'parsecs',
      positionProvider: {
        type: 'static' as const,
        position: [10, 0, 0] as [number, number, number],
        unit: 'parsec' as const,
      },
    },
  ])('rejette le fournisseur de position non cartographique $id', ({ id, positionProvider }) => {
    const documented = {
      ...galaxy(id, undefined, [10, 0, 0], {
        distanceKpc: 10,
        galacticLongitudeDegrees: 0,
        galacticLatitudeDegrees: 0,
      }),
      positionProvider,
    } satisfies SpaceObject;

    expect(() => assertLocalGroupCatalogCoordinates([documented])).toThrow(
      `Position galactique statique en kiloparsecs requise pour ${id}.`,
    );
  });

  it('ignore les objets non documentés ou hors du référentiel du Groupe local', () => {
    const undocumented = galaxy('undocumented', undefined, [1, 0, 0]);
    const stellar = {
      ...galaxy('stellar', undefined, [1, 0, 0], {
        distanceKpc: 1,
        galacticLongitudeDegrees: 0,
        galacticLatitudeDegrees: 0,
      }),
      referenceFrame: 'stellar' as const,
    };

    expect(() => assertLocalGroupCatalogCoordinates([undocumented, stellar])).not.toThrow();
  });
});

function galaxy(
  id: string,
  parentId: string | undefined,
  position: [number, number, number],
  metadata: SpaceObject['metadata'] = {},
): SpaceObject {
  return {
    id,
    name: id,
    type: 'galaxy',
    ...(parentId ? { parentId } : {}),
    referenceFrame: 'local-group',
    scientificConfidence: 'observed',
    visual: {
      visualRadius: 1,
      scaleMode: 'adaptive',
    },
    positionProvider: {
      type: 'static',
      position,
      unit: 'kiloparsec',
    },
    metadata,
  };
}
