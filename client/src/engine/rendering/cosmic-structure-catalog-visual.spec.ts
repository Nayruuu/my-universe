import * as THREE from 'three';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import type {
  CosmicStructureCatalog,
  CosmicStructureCatalogMetadata,
} from '../loaders/cosmic-structure-catalog';
import { CosmicStructureCatalogRegistry } from '../objects/cosmic-structure-catalog-registry';
import { PICKING_LAYER } from '../selection/selection-layers';
import { DEFAULT_COSMIC_MAP_LAYERS } from './cosmic-map-policy';
import { createCosmicStructureCatalogVisual } from './cosmic-structure-catalog-visual';

describe('createCosmicStructureCatalogVisual', () => {
  it('construit les primitives GPU, les métadonnées et l’index de visibilité', () => {
    const registry = new CosmicStructureCatalogRegistry(createCatalog(), new CoordinateSystem());
    const visual = createCosmicStructureCatalogVisual(registry, DEFAULT_COSMIC_MAP_LAYERS);
    const pickingLayers = new THREE.Layers();

    pickingLayers.set(PICKING_LAYER);
    expect(visual.points.geometry.getAttribute('position').count).toBe(1);
    expect(visual.points.geometry.getAttribute('structureKind').getX(0)).toBe(0);
    expect(visual.points.layers.test(pickingLayers)).toBe(true);
    expect(visual.selectionPoint.layers.test(pickingLayers)).toBe(true);
    expect(visual.revealThresholds).toEqual(new Float32Array([0]));
    expect(visual.structureTypes).toEqual(['cluster']);
    expect(visual.visibleIndices).toEqual(new Uint8Array([0]));
    expect(visual.renderIndexByObjectId).toEqual(
      new Map([['lss-planck-clusters-psz2-g000-04-45-13', 0]]),
    );
    expect(visual.points.userData).toMatchObject({
      catalogCount: 1,
      sourceCount: 1,
      layerState: DEFAULT_COSMIC_MAP_LAYERS,
      structureCounts: { cluster: 1 },
      objectIds: ['lss-planck-clusters-psz2-g000-04-45-13'],
    });
  });
});

function createCatalog(): CosmicStructureCatalog {
  return {
    count: 1,
    referenceEpochJulianDay: 2_451_545,
    minimumDistanceMpc: Math.hypot(200, -300, 100),
    maximumDistanceMpc: Math.hypot(200, -300, 100),
    positionsMpc: new Float32Array([200, -300, 100]),
    distancesMpc: new Float32Array([Math.hypot(200, -300, 100)]),
    radiiMpc: new Float32Array([0]),
    confidences: new Float32Array([0.94]),
    densityContrasts: new Float32Array([Number.NaN]),
    boundaryDistancesMpc: new Float32Array([Number.NaN]),
    galaxyCounts: new Uint32Array([0]),
    sourceIndices: new Uint16Array([0]),
    catalogNumericIds: new Uint16Array([1]),
    flags: new Uint8Array([0]),
    identifiers: ['PSZ2 G000.04+45.13'],
    structureTypes: ['cluster'],
    metadata: createMetadata(),
  };
}

function createMetadata(): CosmicStructureCatalogMetadata {
  return {
    version: '1.0.0',
    recordCount: 1,
    referenceEpochJulianDay: 2_451_545,
    referenceFrame: 'equatorial-j2000',
    distanceUnit: 'megaparsec',
    scientificConfidence: 'calculated',
    sources: [
      {
        id: 'planck-clusters',
        name: 'Planck PSZ2',
        citation: 'Planck Collaboration (2016)',
        sourceUrl: 'https://example.test/clusters',
        structureType: 'cluster',
        method: 'Sunyaev-Zeldovich',
        objectNamePrefix: 'Amas Planck',
        scientificConfidence: 'calculated',
        recordCount: 1,
      },
    ],
  };
}
