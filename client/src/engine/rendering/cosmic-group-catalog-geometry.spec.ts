import { CoordinateSystem } from '../coordinates/coordinate-system';
import { type CosmicGroupCatalog } from '../loaders/cosmic-group-catalog';
import { CosmicGroupCatalogRegistry } from '../objects/cosmic-group-catalog-registry';
import {
  createCosmicGroupFilamentGeometry,
  createCosmicGroupPointGeometry,
} from './cosmic-group-catalog-geometry';

describe('géométrie du catalogue Cosmicflows-4', () => {
  it('trie les groupes par seuil de révélation sans perdre leur provenance', () => {
    const registry = createRegistry();
    const points = createCosmicGroupPointGeometry(registry);

    expect(points.geometry.getAttribute('position').count).toBe(3);
    expect(points.geometry.getAttribute('pointSize').count).toBe(3);
    expect(points.geometry.getAttribute('galaxySeed').count).toBe(3);
    expect(points.geometry.drawRange.count).toBe(0);
    expect(points.objectIds).toHaveLength(3);
    expect(new Set(points.objectIds)).toEqual(new Set(registry.objectIds));
    expect(points.revealThresholds[0]).toBe(0);
    expect([...points.revealThresholds]).toEqual(
      [...points.revealThresholds].sort((left, right) => left - right),
    );
  });

  it('trie les filaments par confiance et conserve leurs deux sommets', () => {
    const registry = createRegistry();
    const filaments = createCosmicGroupFilamentGeometry(registry, registry.catalog.filamentPairs);

    expect(filaments.geometry.getAttribute('position').count).toBe(4);
    expect(filaments.geometry.getAttribute('lineAlpha').count).toBe(4);
    expect(filaments.geometry.drawRange.count).toBe(0);
    expect(filaments.revealThresholds).toHaveLength(2);
    expect([...filaments.revealThresholds]).toEqual(
      [...filaments.revealThresholds].sort((left, right) => left - right),
    );
  });

  it('accepte un catalogue vide sans calculer de sphère englobante', () => {
    const registry = new CosmicGroupCatalogRegistry(emptyCatalog(), new CoordinateSystem());
    const points = createCosmicGroupPointGeometry(registry);
    const filaments = createCosmicGroupFilamentGeometry(registry, registry.catalog.filamentPairs);

    expect(points.geometry.boundingSphere?.radius).toBe(0);
    expect(filaments.geometry.boundingSphere).toBeNull();
  });
});

function createRegistry(): CosmicGroupCatalogRegistry {
  return new CosmicGroupCatalogRegistry(
    {
      count: 3,
      referenceEpochJulianDay: 2_451_545,
      minimumDistanceMpc: 12.1,
      maximumDistanceMpc: 120,
      positionsMpc: new Float32Array([12.1, 0, 0, 50, 10, 0, 118, -12, 2]),
      distancesMpc: new Float32Array([12.1, 51, 120]),
      distanceModulusErrors: new Float32Array([0.1, 0.5, 0.9]),
      velocitiesCmbKmPerSecond: new Int32Array([28, 3_000, 7_000]),
      pgcIds: new Uint32Array([35, 12, 84]),
      distanceModuli: new Float32Array([30.413, 33, 35]),
      filamentPairs: new Uint32Array([0, 1, 1, 2]),
    },
    new CoordinateSystem(),
  );
}

function emptyCatalog(): CosmicGroupCatalog {
  return {
    count: 0,
    referenceEpochJulianDay: 2_451_545,
    minimumDistanceMpc: 0,
    maximumDistanceMpc: 0,
    positionsMpc: new Float32Array(),
    distancesMpc: new Float32Array(),
    distanceModulusErrors: new Float32Array(),
    velocitiesCmbKmPerSecond: new Int32Array(),
    pgcIds: new Uint32Array(),
    distanceModuli: new Float32Array(),
    filamentPairs: new Uint32Array(),
  };
}
