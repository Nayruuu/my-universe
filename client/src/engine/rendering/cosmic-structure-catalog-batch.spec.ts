import * as THREE from 'three';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import {
  CosmicStructureCatalog,
  CosmicStructureCatalogMetadata,
} from '../loaders/cosmic-structure-catalog';
import { CosmicStructureCatalogRegistry } from '../objects/cosmic-structure-catalog-registry';
import { PICKING_LAYER } from '../selection/selection-layers';
import { ALL_COSMIC_MAP_LAYERS, DEFAULT_COSMIC_MAP_LAYERS } from './cosmic-map-policy';
import {
  CosmicStructureCatalogBatch,
  getCosmicStructureTargetOpacity,
} from './cosmic-structure-catalog-batch';

describe('CosmicStructureCatalogBatch', () => {
  it('rend toutes les structures en un batch GPU avec une symbolique typée', () => {
    const batch = createBatch();
    const geometry = batch.points.geometry;

    expect(batch.root.children).toEqual([batch.points, batch.selectionPoint]);
    expect(geometry.getAttribute('position').count).toBe(4);
    expect(geometry.getAttribute('pointSize').count).toBe(4);
    expect(geometry.getAttribute('pointAlpha').count).toBe(4);
    expect(geometry.getAttribute('structureKind').count).toBe(4);
    expect(geometry.getAttribute('revealThreshold').count).toBe(4);
    expect(batch.points.material.blending).toBe(THREE.NormalBlending);
    expect(new Set(Array.from(geometry.getAttribute('structureKind').array))).toEqual(
      new Set([0, 1, 3, 4]),
    );
    expect(batch.points.userData).toMatchObject({
      catalogCount: 4,
      sourceCount: 4,
      scientificConfidence: 'calculated',
      structureCounts: { supercluster: 1, void: 1, filament: 1, cluster: 1 },
    });
    expect(new Set(batch.points.userData['objectIds'] as readonly string[])).toEqual(
      new Set([
        'lss-sdss-main50-239-027-0091',
        'lss-boss-voids-cmass-north-60',
        'lss-tempel-filaments-f42',
        'lss-planck-clusters-psz2-g000-04-45-13',
      ]),
    );
    const pickingLayers = new THREE.Layers();

    pickingLayers.set(PICKING_LAYER);
    expect(batch.points.layers.test(pickingLayers)).toBe(true);
    expect(batch.selectionPoint.layers.test(pickingLayers)).toBe(true);
    batch.dispose();
  });

  it('adapte la finesse et la radiance sans supprimer les données du catalogue', () => {
    const batch = createBatch('low');

    expect(batch.points.geometry.getAttribute('position').count).toBe(4);
    expect(batch.points.material.uniforms['detailScale']!.value).toBe(0.75);
    batch.setQuality('medium');
    expect(batch.points.material.uniforms['detailScale']!.value).toBe(0.9);
    batch.setQuality('high');
    expect(batch.points.material.uniforms['detailScale']!.value).toBe(1);
    batch.setPhotographicRadiance(1.2);
    expect(batch.points.material.uniforms['radiance']!.value).toBeCloseTo(1.2);
    batch.setPhotographicRadiance(0);
    expect(batch.points.material.uniforms['radiance']!.value).toBe(0.5);
    batch.setPhotographicRadiance(2);
    expect(batch.points.material.uniforms['radiance']!.value).toBe(1.5);
    batch.dispose();
  });

  it('fait apparaître continûment les symboles à l’échelle cosmique', () => {
    expect(getCosmicStructureTargetOpacity(140_000)).toBe(0);
    expect(getCosmicStructureTargetOpacity(220_000)).toBeGreaterThan(0);
    expect(getCosmicStructureTargetOpacity(220_000)).toBeLessThan(0.52);
    expect(getCosmicStructureTargetOpacity(320_000)).toBeCloseTo(0.52, 5);
    expect(getCosmicStructureTargetOpacity(500_000)).toBeCloseTo(0.52, 5);
    const batch = createBatch();

    batch.updateDistance(40_000, 10);
    expect(batch.visibleCount).toBe(0);
    expect(batch.points.visible).toBe(false);
    batch.updateDistance(500_000, 10);
    expect(batch.visibleCount).toBeGreaterThan(0);
    expect(batch.visibleCount).toBeLessThan(4);
    expect(batch.points.visible).toBe(true);
    expect(batch.points.geometry.drawRange.count).toBeGreaterThan(0);
    expect(batch.isObjectVisible('lss-sdss-main50-239-027-0091')).toBe(true);
    expect(batch.isObjectVisible('lss-boss-voids-cmass-north-60')).toBe(false);
    batch.updateDistance(40_000, 10);
    expect(batch.points.userData['visibleIndices']).toEqual(new Uint8Array([0, 0, 0, 0]));
    batch.dispose();
  });

  it('active séparément chaque famille scientifique et conserve le catalogue complet', () => {
    const batch = createBatch();

    batch.updateDistance(170_000, 10);
    expect(batch.visibleCount).toBe(2);
    expect(batch.isObjectVisible('lss-sdss-main50-239-027-0091')).toBe(true);
    expect(batch.isObjectVisible('lss-planck-clusters-psz2-g000-04-45-13')).toBe(true);
    expect(batch.isObjectVisible('lss-boss-voids-cmass-north-60')).toBe(false);
    expect(batch.isObjectVisible('lss-tempel-filaments-f42')).toBe(false);

    batch.setLayers(ALL_COSMIC_MAP_LAYERS);
    expect(batch.visibleCount).toBe(4);
    expect(batch.isObjectVisible('lss-boss-voids-cmass-north-60')).toBe(true);
    expect(batch.isObjectVisible('lss-tempel-filaments-f42')).toBe(true);
    expect(batch.points.userData['layerState']).toEqual(ALL_COSMIC_MAP_LAYERS);

    batch.setLayers({ ...DEFAULT_COSMIC_MAP_LAYERS, clusters: false, superclusters: false });
    expect(batch.visibleCount).toBe(0);
    expect(batch.points.visible).toBe(false);
    expect(batch.isObjectVisible('missing')).toBeNull();
    expect(batch.isObjectVisibleForLabels('missing')).toBeNull();
    batch.dispose();
  });

  it('réutilise un marqueur pour sélectionner, cadrer et choisir une structure', () => {
    const batch = createBatch();

    batch.setPixelRatio(1.5);
    batch.select('lss-boss-voids-cmass-north-60');
    expect(batch.selectionPoint.visible).toBe(true);
    expect(batch.selectionPoint.userData['objectId']).toBe('lss-boss-voids-cmass-north-60');
    expect(batch.selectionPoint.position.toArray()).toEqual([-157_020, 287_680, 337_280]);
    expect(batch.selectionPoint.material.uniforms['pixelRatio']!.value).toBe(1.5);
    expect(batch.getWorldPosition('lss-boss-voids-cmass-north-60')).not.toBeNull();
    expect(batch.getPickables()).toEqual([batch.selectionPoint, batch.points]);
    batch.select(null);
    expect(batch.selectionPoint.visible).toBe(false);
    batch.select('missing');
    expect(batch.selectionPoint.visible).toBe(false);
    expect(batch.getWorldPosition('missing')).toBeNull();
    batch.setPixelRatio(0.1);
    expect(batch.selectionPoint.material.uniforms['pixelRatio']!.value).toBe(0.5);
    batch.dispose();
  });
});

function createBatch(quality: 'low' | 'medium' | 'high' = 'high'): CosmicStructureCatalogBatch {
  return new CosmicStructureCatalogBatch(
    new CosmicStructureCatalogRegistry(createCatalog(), new CoordinateSystem()),
    quality,
  );
}

function createCatalog(): CosmicStructureCatalog {
  const filamentPosition = [500, 100, 50] as const;
  const clusterPosition = [200, -300, 100] as const;

  return {
    count: 4,
    referenceEpochJulianDay: 2_451_545,
    minimumDistanceMpc: Math.hypot(-176.1, 163.7, -287.8),
    maximumDistanceMpc: Math.hypot(-785.1, 1_438.4, 1_686.4),
    positionsMpc: new Float32Array([
      -176.1,
      163.7,
      -287.8,
      -785.1,
      1_438.4,
      1_686.4,
      ...filamentPosition,
      ...clusterPosition,
    ]),
    distancesMpc: new Float32Array([
      Math.hypot(-176.1, 163.7, -287.8),
      Math.hypot(-785.1, 1_438.4, 1_686.4),
      Math.hypot(...filamentPosition),
      Math.hypot(...clusterPosition),
    ]),
    radiiMpc: new Float32Array([35.9, 46.14, 12.4, 0]),
    confidences: new Float32Array([0.98, 1, 0.85, 0.94]),
    densityContrasts: new Float32Array([Number.NaN, -0.717, Number.NaN, Number.NaN]),
    boundaryDistancesMpc: new Float32Array([Number.NaN, 75.006, Number.NaN, Number.NaN]),
    galaxyCounts: new Uint32Array([1_038, 35, 0, 0]),
    sourceIndices: new Uint16Array([0, 1, 2, 3]),
    catalogNumericIds: new Uint16Array([1, 60, 42, 1]),
    flags: new Uint8Array([0, 0, 0, 0]),
    identifiers: ['239+027+0091', 'CMASS-North-60', 'F42', 'PSZ2 G000.04+45.13'],
    structureTypes: ['supercluster', 'void', 'filament', 'cluster'],
    metadata: createMetadata(),
  };
}

function createMetadata(): CosmicStructureCatalogMetadata {
  return {
    version: '1.0.0',
    recordCount: 4,
    referenceEpochJulianDay: 2_451_545,
    referenceFrame: 'equatorial-j2000',
    distanceUnit: 'megaparsec',
    scientificConfidence: 'calculated',
    sources: [
      {
        id: 'sdss-main50',
        name: 'SDSS superclusters',
        citation: 'Liivamägi et al. (2012)',
        sourceUrl: 'https://example.test/superclusters',
        structureType: 'supercluster',
        method: 'Luminosity density field',
        objectNamePrefix: 'Superamas SDSS',
        scientificConfidence: 'calculated',
        recordCount: 1,
      },
      {
        id: 'boss-voids',
        name: 'BOSS voids',
        citation: 'Mao et al. (2017)',
        sourceUrl: 'https://example.test/voids',
        structureType: 'void',
        method: 'ZOBOV',
        objectNamePrefix: 'Vide BOSS',
        scientificConfidence: 'calculated',
        recordCount: 1,
      },
      {
        id: 'tempel-filaments',
        name: 'SDSS filaments',
        citation: 'Tempel et al. (2014)',
        sourceUrl: 'https://example.test/filaments',
        structureType: 'filament',
        method: 'Bisous',
        objectNamePrefix: 'Filament SDSS',
        scientificConfidence: 'calculated',
        recordCount: 1,
      },
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
