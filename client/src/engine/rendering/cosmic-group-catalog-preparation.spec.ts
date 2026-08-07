import * as THREE from 'three';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import { CosmicGroupCatalogRegistry } from '../objects/cosmic-group-catalog-registry';
import { CATALOG_PREPARATION_CHUNK_SIZE } from '../core/catalog-preparation';
import {
  createCosmicGroupFilamentGeometry,
  createCosmicGroupPointGeometry,
} from './cosmic-group-catalog-geometry';
import {
  disposePreparedCosmicGroupCatalog,
  prepareCosmicGroupCatalog,
} from './cosmic-group-catalog-preparation';
import { LocalVolumeDepthBackdrop } from './local-volume-depth-backdrop';

describe('préparation incrémentale Cosmicflows', () => {
  afterEach(() => vi.restoreAllMocks());

  it('préserve chaque attribut et identifiant après plusieurs lots et un dernier lot incomplet', async () => {
    const registry = createRegistry();
    const pause = vi.fn(async () => undefined);
    const prepared = await prepareCosmicGroupCatalog(registry, pause);
    const points = createCosmicGroupPointGeometry(registry);
    const filaments = createCosmicGroupFilamentGeometry(registry, registry.catalog.filamentPairs);
    const backdrop = new LocalVolumeDepthBackdrop(registry, 'high');

    expect(pause).toHaveBeenCalledTimes(30);
    expect(prepared.groups.points.objectIds).toEqual(points.objectIds);
    expect(prepared.groups.points.revealThresholds).toEqual(points.revealThresholds);
    expect(prepared.groups.filaments.revealThresholds).toEqual(filaments.revealThresholds);
    for (const [actual, expected] of [
      [prepared.groups.points.geometry, points.geometry],
      [prepared.groups.filaments.geometry, filaments.geometry],
      [prepared.backdrop, backdrop.points.geometry],
    ] as const) {
      expect(Object.keys(actual.attributes)).toEqual(Object.keys(expected.attributes));
      for (const name of Object.keys(expected.attributes)) {
        expect(actual.getAttribute(name).array).toEqual(expected.getAttribute(name).array);
      }
      expect(actual.boundingSphere).toEqual(expected.boundingSphere);
    }
    disposePreparedCosmicGroupCatalog(prepared);
    points.geometry.dispose();
    filaments.geometry.dispose();
    backdrop.dispose();
  });

  it.each([
    [1, 0],
    [9, 1],
    [20, 2],
  ])(
    'libère les géométries terminées si la pause %i échoue',
    async (failurePause, completedCount) => {
      const registry = createRegistry();
      const dispose = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');
      const error = new Error('cancelled');
      let pauses = 0;

      await expect(
        prepareCosmicGroupCatalog(registry, async () => {
          pauses += 1;
          if (pauses === failurePause) {
            throw error;
          }
        }),
      ).rejects.toBe(error);
      expect(pauses).toBe(failurePause);
      expect(dispose).toHaveBeenCalledTimes(completedCount);
    },
  );
});

function createRegistry(): CosmicGroupCatalogRegistry {
  const count = CATALOG_PREPARATION_CHUNK_SIZE * 2 + 1;

  return new CosmicGroupCatalogRegistry(
    {
      count,
      referenceEpochJulianDay: 2_451_545,
      minimumDistanceMpc: 12,
      maximumDistanceMpc: 160,
      positionsMpc: Float32Array.from({ length: count * 3 }, (_, index) => index * 0.1),
      distancesMpc: Float32Array.from({ length: count }, (_, index) => 12 + index * 0.1),
      distanceModulusErrors: new Float32Array(count).fill(0.2),
      velocitiesCmbKmPerSecond: new Int32Array(count).fill(1_200),
      pgcIds: Uint32Array.from({ length: count }, (_, index) => 100 + index),
      distanceModuli: new Float32Array(count).fill(31),
      filamentPairs: Uint32Array.from({ length: (count - 1) * 2 }, (_, index) =>
        Math.floor((index + 1) / 2),
      ),
    },
    new CoordinateSystem(),
  );
}
