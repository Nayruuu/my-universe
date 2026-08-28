import * as THREE from 'three';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import {
  CosmicStructureCatalog,
  CosmicStructureCatalogMetadata,
} from '../loaders/cosmic-structure-catalog';
import { CosmicStructureCatalogRegistry } from '../objects/cosmic-structure-catalog-registry';
import { PICKING_LAYER } from '../selection/selection-layers';
import { ALL_COSMIC_MAP_LAYERS, DEFAULT_COSMIC_MAP_LAYERS } from './cosmic-map-policy';
import * as cosmicMapPolicy from './cosmic-map-policy';
import {
  CosmicStructureCatalogBatch,
  getCosmicStructureTargetOpacity,
} from './cosmic-structure-catalog-batch';
import { prepareCosmicStructureGeometry } from './cosmic-structure-catalog-visual';
import { prepareCatalogIncrementally } from '../core/catalog-preparation';

describe('CosmicStructureCatalogBatch', () => {
  it('prépare progressivement les mêmes attributs, identifiants et marqueurs sélectionnables', async () => {
    const base = createCatalog();
    const count = 1_025;
    const catalog: CosmicStructureCatalog = {
      ...base,
      count,
      positionsMpc: Float32Array.from({ length: count * 3 }, (_, i) => base.positionsMpc[i % 12]!),
      distancesMpc: Float32Array.from({ length: count }, (_, i) => base.distancesMpc[i % 4]!),
      densityContrasts: Float32Array.from(
        { length: count },
        (_, i) => base.densityContrasts[i % 4]!,
      ),
      flags: new Uint8Array(count),
      radiiMpc: Float32Array.from({ length: count }, (_, i) => base.radiiMpc[i % 4]!),
      boundaryDistancesMpc: Float32Array.from(
        { length: count },
        (_, i) => base.boundaryDistancesMpc[i % 4]!,
      ),
      confidences: Float32Array.from({ length: count }, (_, i) => base.confidences[i % 4]!),
      galaxyCounts: Uint32Array.from({ length: count }, (_, i) => base.galaxyCounts[i % 4]!),
      sourceIndices: Uint16Array.from({ length: count }, (_, i) => i % 4),
      catalogNumericIds: Uint16Array.from({ length: count }, (_, i) => i + 1),
      identifiers: Array.from({ length: count }, (_, i) => `test-${i}`),
      structureTypes: Array.from({ length: count }, (_, i) => base.structureTypes[i % 4]!),
    };
    const registry = new CosmicStructureCatalogRegistry(catalog, new CoordinateSystem());
    const synchronous = new CosmicStructureCatalogBatch(registry);
    const pause = vi.fn(async () => undefined);
    const prepared = await prepareCatalogIncrementally(
      prepareCosmicStructureGeometry(registry),
      pause,
    );
    const progressive = new CosmicStructureCatalogBatch(registry, 'high', prepared);

    expect(pause).toHaveBeenCalledTimes(11);
    expect(progressive.points.geometry).toBe(prepared.geometry);
    expect(progressive.points.geometry.boundingSphere).toEqual(
      synchronous.points.geometry.boundingSphere,
    );
    expect(progressive.points.geometry.drawRange).toEqual(synchronous.points.geometry.drawRange);
    for (const name of Object.keys(synchronous.points.geometry.attributes)) {
      expect(progressive.points.geometry.getAttribute(name).array).toEqual(
        synchronous.points.geometry.getAttribute(name).array,
      );
    }
    expect(progressive.points.userData).toEqual(synchronous.points.userData);
    expect(progressive.points.material.vertexShader).toBe(synchronous.points.material.vertexShader);
    expect(progressive.points.material.fragmentShader).toBe(
      synchronous.points.material.fragmentShader,
    );
    progressive.updateDistance(170_000, 10);
    synchronous.updateDistance(170_000, 10);
    for (const id of registry.objectIds) {
      expect(progressive.isObjectVisible(id)).toBe(synchronous.isObjectVisible(id));
    }
    progressive.select(registry.objectIds[count - 1]!);
    expect(progressive.selectionPoint.position).toEqual(
      registry.getLocalPosition(registry.objectIds[count - 1]!),
    );
    const dispose = vi.spyOn(prepared.geometry, 'dispose');

    progressive.dispose();
    expect(dispose).toHaveBeenCalledOnce();
    synchronous.dispose();
  });

  it('rend toutes les structures en un batch GPU avec une symbolique typée', () => {
    const batch = createBatch();
    const geometry = batch.points.geometry;

    expect(batch.root.children).toEqual([batch.points, batch.selectionPoint]);
    expect(geometry.getAttribute('position').count).toBe(4);
    expect(geometry.getAttribute('pointSize').count).toBe(4);
    expect(geometry.getAttribute('pointAlpha').count).toBe(4);
    expect(geometry.getAttribute('structureKind').count).toBe(4);
    expect(geometry.getAttribute('revealThreshold').count).toBe(4);
    expect(geometry.getAttribute('shapeSeed').count).toBe(4);
    expect(batch.points.material.blending).toBe(THREE.NormalBlending);
    expect(new Set(Array.from(geometry.getAttribute('structureKind').array))).toEqual(
      new Set([0, 1, 3, 4]),
    );
    expect(batch.points.userData).toMatchObject({
      catalogCount: 4,
      sourceCount: 4,
      scientificConfidence: 'calculated',
      voidRepresentation: 'adaptive-catalog-underdensity-volume',
      voidBoundaryStyle: 'diffuse-fill-without-ring',
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
    expect(batch.points.material.fragmentShader).toContain('vec3 underdensityInterior');
    expect(batch.points.material.fragmentShader).toContain('float diffuseBoundary');
    expect(batch.points.material.fragmentShader).toContain('float warpedRadius');
    expect(batch.points.material.fragmentShader).toContain('float mottledInterior');
    expect(batch.points.material.fragmentShader).toContain('float edgeFade');
    expect(batch.points.material.fragmentShader).not.toContain('smoothstep(0.22, 0.7');
    expect(batch.points.material.fragmentShader).not.toContain('float ring =');
    const objectIds = batch.points.userData['objectIds'] as readonly string[];
    const voidIndex = objectIds.indexOf('lss-boss-voids-cmass-north-60');

    expect(geometry.getAttribute('pointSize').getX(voidIndex)).toBeGreaterThan(45);
    expect(geometry.getAttribute('pointAlpha').getX(voidIndex)).toBeGreaterThan(0.9);
    batch.dispose();
  });

  it('encode des silhouettes distinctes pour les murs, bassins, attracteurs et répulseurs', () => {
    const batch = createBatch();
    const shader = batch.points.material.fragmentShader;

    expect(shader).toContain('bool isWall');
    expect(shader).toContain('bool isBasin');
    expect(shader).toContain('bool isAttractor');
    expect(shader).toContain('bool isRepeller');
    expect(shader).toContain('float wallDistance');
    expect(shader).toContain('float basinBoundary');
    expect(shader).toContain('float inwardFlow');
    expect(shader).toContain('float outwardFlow');
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
    expect(batch.isObjectVisible('lss-boss-voids-cmass-north-60')).toBe(true);
    batch.updateDistance(40_000, 10);
    expect(batch.points.userData['visibleIndices']).toEqual(new Uint8Array([0, 0, 0, 0]));
    batch.dispose();
  });

  it('active séparément chaque famille scientifique et conserve le catalogue complet', () => {
    const batch = createBatch();

    batch.updateDistance(170_000, 10);
    expect(batch.visibleCount).toBe(4);
    expect(batch.isObjectVisible('lss-sdss-main50-239-027-0091')).toBe(true);
    expect(batch.isObjectVisible('lss-planck-clusters-psz2-g000-04-45-13')).toBe(true);
    expect(batch.isObjectVisible('lss-boss-voids-cmass-north-60')).toBe(true);
    expect(batch.isObjectVisible('lss-tempel-filaments-f42')).toBe(true);

    batch.setLayers({ ...DEFAULT_COSMIC_MAP_LAYERS, voids: false });
    expect(batch.visibleCount).toBe(3);
    expect(batch.isObjectVisible('lss-boss-voids-cmass-north-60')).toBe(false);

    batch.setLayers(ALL_COSMIC_MAP_LAYERS);
    expect(batch.visibleCount).toBe(4);
    expect(batch.isObjectVisible('lss-boss-voids-cmass-north-60')).toBe(true);
    expect(batch.isObjectVisible('lss-tempel-filaments-f42')).toBe(true);
    expect(batch.points.userData['layerState']).toEqual(ALL_COSMIC_MAP_LAYERS);

    batch.setLayers({
      ...DEFAULT_COSMIC_MAP_LAYERS,
      clusters: false,
      superclusters: false,
      filaments: false,
      voids: false,
    });
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

  it('ne reparcourt pas les structures déjà visibles ou entièrement masquées à chaque image', () => {
    const batch = createBatch();
    const visibleIndices = batch.points.userData['visibleIndices'] as Uint8Array;
    const fill = vi.spyOn(visibleIndices, 'fill');

    batch.updateDistance(40_000, 10);
    batch.updateDistance(40_000, 1 / 60);
    expect(fill).not.toHaveBeenCalled();
    batch.updateDistance(170_000, 10);
    fill.mockClear();
    batch.updateDistance(170_000, 1 / 60);
    expect(fill).not.toHaveBeenCalled();
    batch.updateDistance(40_000, 10);
    expect(visibleIndices).toEqual(new Uint8Array(4));
    expect(fill).toHaveBeenCalledExactlyOnceWith(0, 0, 4);
    batch.dispose();
  });

  it('conserve le masque exact en zoomant dans les deux sens et en changeant les couches', () => {
    const registry = new CosmicStructureCatalogRegistry(createCatalog(), new CoordinateSystem());
    const batch = new CosmicStructureCatalogBatch(registry);
    const objectIds = batch.points.userData['objectIds'] as string[];
    const thresholds = batch.points.geometry.getAttribute('revealThreshold');

    for (const quality of ['high', 'medium', 'low'] as const) {
      batch.setQuality(quality);
      for (const layers of [
        DEFAULT_COSMIC_MAP_LAYERS,
        { ...DEFAULT_COSMIC_MAP_LAYERS, voids: false, clusters: false },
        ALL_COSMIC_MAP_LAYERS,
      ]) {
        batch.setLayers(layers);
        for (const distance of [170_000, 420_000, 900_000, 250_000, 40_000, 170_000]) {
          for (let frame = 0; frame < 6; frame += 1) {
            batch.updateDistance(distance, 0.3);
            const uniforms = batch.points.material.uniforms;
            const expected = objectIds.map((id, index) =>
              Number(
                uniforms['catalogOpacity']!.value > 0.004 &&
                  thresholds.getX(index) <= uniforms['detailLevel']!.value &&
                  cosmicMapPolicy.isCosmicMapLayerEnabled(
                    registry.catalog.structureTypes[registry.getIndex(id)!]!,
                    layers,
                  ),
              ),
            );

            expect(batch.points.userData['visibleIndices']).toEqual(new Uint8Array(expected));
            expect(batch.visibleCount).toBe(expected.reduce((sum, value) => sum + value, 0));
            objectIds.forEach((id, index) => {
              expect(batch.isObjectVisible(id)).toBe(expected[index] === 1);
            });
          }
        }
      }
    }
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
