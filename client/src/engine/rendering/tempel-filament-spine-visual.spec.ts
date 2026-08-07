import { CoordinateSystem } from '../coordinates/coordinate-system';
import type { TempelFilamentSpineCatalog } from '../loaders/tempel-filament-spine-catalog';
import type {
  CosmicStructureCatalog,
  CosmicStructureCatalogMetadata,
} from '../loaders/cosmic-structure-catalog';
import { CosmicStructureCatalogRegistry } from '../objects/cosmic-structure-catalog-registry';
import {
  createTempelFilamentSpineVisual,
  updateTempelFilamentHighlight,
} from './tempel-filament-spine-visual';

describe('TempelFilamentSpineVisual', () => {
  it('construit les tuiles et réutilise les surbrillances d’une épine', () => {
    const catalog = createSpineCatalog();
    const visual = createTempelFilamentSpineVisual(catalog, createRegistry(), 200);

    expect(visual.tileStates).toHaveLength(1);
    expect(visual.tiles).toHaveLength(1);
    expect(visual.haloTiles).toHaveLength(1);
    expect(visual.filamentIndexByObjectId).toEqual(
      new Map([['lss-sdss-dr8-tempel-filaments-f1', 0]]),
    );

    updateTempelFilamentHighlight(
      visual.selectionLine,
      visual.selectionHalo,
      catalog,
      0,
      200,
      'lss-sdss-dr8-tempel-filaments-f1',
    );
    expect(visual.selectionLine.visible).toBe(true);
    expect(visual.selectionLine.geometry.getAttribute('position').count).toBe(2);
    expect(visual.selectionHalo.geometry.instanceCount).toBe(1);

    updateTempelFilamentHighlight(
      visual.selectionLine,
      visual.selectionHalo,
      catalog,
      undefined,
      200,
      null,
    );
    expect(visual.selectionLine.visible).toBe(false);
    expect(visual.selectionHalo.visible).toBe(false);
  });
});

function createSpineCatalog(): TempelFilamentSpineCatalog {
  return {
    filamentCount: 1,
    pointCount: 2,
    segmentCount: 1,
    referenceEpochJulianDay: 2_451_545,
    minimumDistanceMpc: Math.sqrt(300),
    maximumDistanceMpc: Math.sqrt(363),
    filamentIds: new Uint16Array([1]),
    pointOffsets: new Uint32Array([0, 2]),
    positionsMpc: new Float32Array([10, 10, 10, 11, 11, 11]),
    visitMap: new Uint8Array([32, 64]),
    density: new Uint8Array([48, 80]),
    orientationStrength: new Uint8Array([64, 96]),
  };
}

function createRegistry(): CosmicStructureCatalogRegistry {
  const metadata: CosmicStructureCatalogMetadata = {
    version: '1.0.0',
    recordCount: 1,
    referenceEpochJulianDay: 2_451_545,
    referenceFrame: 'equatorial-j2000',
    distanceUnit: 'megaparsec',
    scientificConfidence: 'calculated',
    sources: [
      {
        id: 'sdss-dr8-tempel-filaments',
        name: 'SDSS DR8 Bisous cosmic filaments',
        citation: 'Tempel et al. (2014), MNRAS 438, 3465',
        sourceUrl: 'https://example.test/tempel',
        structureType: 'filament',
        method: 'Bisous',
        objectNamePrefix: 'Filament SDSS',
        scientificConfidence: 'calculated',
        recordCount: 1,
      },
    ],
  };
  const catalog: CosmicStructureCatalog = {
    count: 1,
    referenceEpochJulianDay: 2_451_545,
    minimumDistanceMpc: Math.sqrt(363),
    maximumDistanceMpc: Math.sqrt(363),
    positionsMpc: new Float32Array([11, 11, 11]),
    distancesMpc: new Float32Array([Math.sqrt(363)]),
    radiiMpc: new Float32Array([2]),
    confidences: new Float32Array([1]),
    densityContrasts: new Float32Array([Number.NaN]),
    boundaryDistancesMpc: new Float32Array([Number.NaN]),
    galaxyCounts: new Uint32Array(1),
    sourceIndices: new Uint16Array(1),
    catalogNumericIds: new Uint16Array([1]),
    flags: new Uint8Array(1),
    identifiers: ['F1'],
    structureTypes: ['filament'],
    metadata,
  };

  return new CosmicStructureCatalogRegistry(catalog, new CoordinateSystem());
}
