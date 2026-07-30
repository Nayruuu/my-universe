import canesVenaticiSource from '../../../public/data/tiles/nearby-universe/canes-venatici.json';
import centaurusSource from '../../../public/data/tiles/nearby-universe/centaurus-a.json';
import indexSource from '../../../public/data/tiles/nearby-universe/index.json';
import m81Source from '../../../public/data/tiles/nearby-universe/m81-group.json';
import sculptorSource from '../../../public/data/tiles/nearby-universe/sculptor-group.json';
import virgoSource from '../../../public/data/tiles/nearby-universe/virgo-cluster.json';
import { SpaceObject } from '../models/universe.models';
import { parseUniverseDataset } from './dataset-validator';
import {
  assertNearbyUniverseCatalogCoordinates,
  distanceModulusToMegaparsecs,
  equatorialCoordinatesToCartesian,
} from './nearby-universe-catalog';
import { parseSpaceTileIndex } from './space-tile-index';

describe('catalogue de l’Univers proche', () => {
  it('convertit les coordonnées équatoriales J2000 et les modules de distance', () => {
    expect(equatorialCoordinatesToCartesian(10, 0, 0)).toEqual({
      x: 10,
      y: 0,
      z: 0,
    });
    const pole = equatorialCoordinatesToCartesian(10, 42, 90);

    expect(pole.x).toBeCloseTo(0, 10);
    expect(pole.y).toBeCloseTo(10, 10);
    expect(pole.z).toBeCloseTo(0, 10);
    expect(distanceModulusToMegaparsecs(31.18)).toBeCloseTo(17.219, 3);
  });

  it('fournit 720 galaxies recherchables dans 115 tuiles éditoriales et adaptatives', () => {
    const index = parseSpaceTileIndex(indexSource, 'nearby-universe');
    const legacyTiles = index.tiles.filter((tile) => !tile.id.startsWith('catalog-'));
    const generatedTiles = index.tiles.filter((tile) => tile.id.startsWith('catalog-'));
    const objects = [
      sculptorSource,
      m81Source,
      centaurusSource,
      canesVenaticiSource,
      virgoSource,
    ].flatMap(
      (source, tileIndex) => parseUniverseDataset(source, legacyTiles[tileIndex]!.id).objects,
    );

    expect(index.tiles).toHaveLength(115);
    expect(legacyTiles).toHaveLength(5);
    expect(generatedTiles).toHaveLength(110);
    expect(objects).toHaveLength(22);
    expect(index.searchEntries).toHaveLength(720);
    expect(new Set(objects.map((object) => object.id))).toEqual(
      new Set(
        index.searchEntries.filter((entry) => !entry.id.startsWith('lv-')).map((entry) => entry.id),
      ),
    );
    expect(index.searchEntries.filter((entry) => entry.id.startsWith('lv-'))).toHaveLength(698);
    expect(generatedTiles.every((tile) => tile.objectIds.length <= 24)).toBe(true);
    expect(generatedTiles.some((tile) => (tile.childIds?.length ?? 0) > 0)).toBe(true);
    expect(objects.map((object) => object.id)).toEqual(
      expect.arrayContaining([
        'sculptor-galaxy',
        'bodes-galaxy',
        'cigar-galaxy',
        'centaurus-a',
        'pinwheel-galaxy',
        'virgo-a',
      ]),
    );
    expect(objects.every((object) => object.scientificConfidence === 'observed')).toBe(true);
    expect(objects.every((object) => typeof object.metadata?.['source'] === 'string')).toBe(true);
    expect(index.searchEntries.map((entry) => entry.name)).toEqual(
      expect.arrayContaining(['IC 342', 'NGC 5194', 'LeoP']),
    );
    expect(() => assertNearbyUniverseCatalogCoordinates(objects)).not.toThrow();
  });

  it('rejette une position qui dérive des coordonnées équatoriales cataloguées', () => {
    const displaced = galaxy([2, 0, 0]);

    expect(() => assertNearbyUniverseCatalogCoordinates([displaced], 0.01)).toThrow(
      'Coordonnées équatoriales incohérentes pour displaced',
    );
  });

  it.each([
    {
      positionProvider: {
        type: 'procedural' as const,
        generatorId: 'test',
        seed: 1,
      },
    },
    {
      positionProvider: {
        type: 'static' as const,
        position: [1, 0, 0] as [number, number, number],
        unit: 'kiloparsec' as const,
      },
    },
  ])('exige une position statique en mégaparsecs', ({ positionProvider }) => {
    expect(() =>
      assertNearbyUniverseCatalogCoordinates([{ ...galaxy([1, 0, 0]), positionProvider }]),
    ).toThrow('Position équatoriale statique en mégaparsecs requise pour displaced');
  });

  it('ignore un objet hors catalogue ou hors du référentiel concerné', () => {
    const undocumented = {
      ...galaxy([1, 0, 0]),
      metadata: {},
    };
    const localGroup = {
      ...galaxy([1, 0, 0]),
      referenceFrame: 'local-group' as const,
    };

    expect(() => assertNearbyUniverseCatalogCoordinates([undocumented, localGroup])).not.toThrow();
  });
});

function galaxy(position: [number, number, number]): SpaceObject {
  return {
    id: 'displaced',
    name: 'Déplacée',
    type: 'galaxy',
    parentId: 'nearby-universe',
    referenceFrame: 'nearby-universe',
    scientificConfidence: 'observed',
    visual: {
      visualRadius: 40,
      scaleMode: 'adaptive',
    },
    positionProvider: {
      type: 'static',
      position,
      unit: 'megaparsec',
    },
    metadata: {
      distanceMpc: 1,
      rightAscensionDegrees: 0,
      declinationDegrees: 0,
    },
  };
}
