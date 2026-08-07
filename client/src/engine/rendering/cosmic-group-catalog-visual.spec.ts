import * as THREE from 'three';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import type { CosmicGroupCatalog } from '../loaders/cosmic-group-catalog';
import { CosmicGroupCatalogRegistry } from '../objects/cosmic-group-catalog-registry';
import { PICKING_LAYER } from '../selection/selection-layers';
import { DEFAULT_COSMIC_MAP_LAYERS } from './cosmic-map-policy';
import { createCosmicGroupCatalogVisual } from './cosmic-group-catalog-visual';

describe('createCosmicGroupCatalogVisual', () => {
  it('construit les trois primitives GPU et leurs index de visibilité', () => {
    const registry = new CosmicGroupCatalogRegistry(createCatalog(), new CoordinateSystem());
    const visual = createCosmicGroupCatalogVisual(registry, DEFAULT_COSMIC_MAP_LAYERS);
    const pickingLayers = new THREE.Layers();

    pickingLayers.set(PICKING_LAYER);
    expect(visual.points.geometry.getAttribute('position').count).toBe(2);
    expect(visual.filaments.geometry.getAttribute('position').count).toBe(2);
    expect(visual.points.layers.test(pickingLayers)).toBe(true);
    expect(visual.selectionPoint.layers.test(pickingLayers)).toBe(true);
    expect(visual.pointRevealThresholds).toHaveLength(2);
    expect(visual.filamentRevealThresholds).toHaveLength(1);
    expect(visual.visibleIndices).toEqual(new Uint8Array([0, 0]));
    expect(visual.renderIndexByObjectId).toEqual(
      new Map([
        ['cf4-pgc-35', 0],
        ['cf4-pgc-12', 1],
      ]),
    );
    expect(visual.points.userData).toMatchObject({
      catalogCount: 2,
      layerState: DEFAULT_COSMIC_MAP_LAYERS,
      objectIds: ['cf4-pgc-35', 'cf4-pgc-12'],
    });
  });
});

function createCatalog(): CosmicGroupCatalog {
  return {
    count: 2,
    referenceEpochJulianDay: 2_451_545,
    minimumDistanceMpc: 12.1,
    maximumDistanceMpc: 99.611,
    positionsMpc: new Float32Array([12.1, 0, 0, 98.993, -11.08, 0.062]),
    distancesMpc: new Float32Array([12.1, 99.611]),
    distanceModulusErrors: new Float32Array([0.1, 0.8]),
    velocitiesCmbKmPerSecond: new Int32Array([28, 6_179]),
    pgcIds: new Uint32Array([35, 12]),
    distanceModuli: new Float32Array([30.413, 34.995]),
    filamentPairs: new Uint32Array([0, 1]),
  };
}
