import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import { TempelFilamentSpineCatalog } from '../loaders/tempel-filament-spine-catalog';
import {
  CosmicStructureCatalog,
  CosmicStructureCatalogMetadata,
} from '../loaders/cosmic-structure-catalog';
import { CosmicStructureCatalogRegistry } from '../objects/cosmic-structure-catalog-registry';
import { PICKING_LAYER } from '../selection/selection-layers';
import { ALL_COSMIC_MAP_LAYERS, DEFAULT_COSMIC_MAP_LAYERS } from './cosmic-map-policy';
import {
  TempelFilamentSpineBatch,
  getTempelFilamentVisualProfile,
  getTempelFilamentSpineTargetOpacity,
} from './tempel-filament-spine-batch';

describe('TempelFilamentSpineBatch', () => {
  it('répartit les épines publiées dans au plus huit lots GPU spatiaux', () => {
    const batch = createBatch();
    const pickingLayers = new THREE.Layers();

    pickingLayers.set(PICKING_LAYER);
    expect(batch.tileCount).toBe(3);
    expect(batch.catalogFilamentCount).toBe(3);
    expect(batch.catalogPointCount).toBe(7);
    expect(batch.catalogSegmentCount).toBe(4);
    expect(batch.tiles.every((tile) => tile instanceof THREE.LineSegments)).toBe(true);
    expect(batch.haloTiles).toHaveLength(batch.tileCount);
    expect(batch.haloTiles.every((tile) => tile instanceof LineSegments2)).toBe(true);
    expect(batch.tiles.every((tile) => tile.layers.test(pickingLayers))).toBe(true);
    expect(
      batch.tiles.reduce(
        (total, tile) => total + tile.geometry.getAttribute('position').count / 2,
        0,
      ),
    ).toBe(4);
    expect(batch.tiles[0]?.userData).toMatchObject({
      scientificConfidence: 'calculated',
      representation: 'published-filament-spine-points',
      source: 'Tempel et al. (2014), MNRAS 438, 3465',
    });
    expect(batch.haloTiles[0]?.userData).toMatchObject({
      scientificConfidence: 'illustrative',
      representation: 'screen-space-filament-halo',
      physicalWidth: false,
    });
    expect(batch.getPickables()).toEqual(batch.tiles);
    batch.dispose();
  });

  it('conserve les identifiants et métriques par segment pour la sélection GPU', () => {
    const batch = createBatch();
    const allObjectIds = batch.tiles.flatMap(
      (tile) => tile.userData['objectIds'] as readonly string[],
    );
    const allAlphas = batch.tiles.flatMap((tile) =>
      Array.from(tile.geometry.getAttribute('lineAlpha').array),
    );

    expect(new Set(allObjectIds)).toEqual(
      new Set([
        'lss-sdss-dr8-tempel-filaments-f1',
        'lss-sdss-dr8-tempel-filaments-f2',
        'lss-sdss-dr8-tempel-filaments-f3',
      ]),
    );
    expect(allObjectIds).toHaveLength(8);
    expect(allAlphas).toHaveLength(8);
    expect(Math.max(...allAlphas)).toBeGreaterThan(Math.min(...allAlphas));
    expect(
      batch.tiles.every(
        (tile) =>
          tile.userData['visibleIndices'] instanceof Uint8Array &&
          (tile.userData['visibleIndices'] as Uint8Array).length ===
            tile.geometry.getAttribute('position').count,
      ),
    ).toBe(true);
    batch.dispose();
  });

  it('révèle progressivement les segments selon la distance, la qualité et la couche', () => {
    expect(getTempelFilamentSpineTargetOpacity(140_000)).toBe(0);
    expect(getTempelFilamentSpineTargetOpacity(220_000)).toBeGreaterThan(0);
    expect(getTempelFilamentSpineTargetOpacity(320_000)).toBeCloseTo(0.66, 5);
    expect(getTempelFilamentSpineTargetOpacity(900_000)).toBeCloseTo(0.66, 5);
    const batch = createBatch('low');

    batch.updateDistance(900_000, 10);
    expect(batch.visibleSegmentCount).toBeGreaterThan(0);
    expect(batch.visibleSegmentCount).toBeLessThan(4);
    expect(batch.haloTiles.reduce((total, tile) => total + tile.geometry.instanceCount, 0)).toBe(
      batch.visibleSegmentCount,
    );
    expect(batch.haloTiles.some((tile) => tile.visible)).toBe(true);
    batch.setLayers({ ...DEFAULT_COSMIC_MAP_LAYERS, filaments: false });
    expect(batch.visibleSegmentCount).toBe(0);
    expect(batch.tiles.every((tile) => !tile.visible)).toBe(true);
    expect(batch.haloTiles.every((tile) => !tile.visible)).toBe(true);
    batch.setLayers(ALL_COSMIC_MAP_LAYERS);
    batch.updateDistance(900_000, 10);
    expect(batch.visibleSegmentCount).toBeGreaterThan(0);
    expect(batch.visibleSegmentCount).toBeLessThan(4);
    batch.updateDistance(170_000, 10);
    const lowDetailCount = batch.visibleSegmentCount;

    batch.setQuality('medium');
    expect(batch.visibleSegmentCount).toBeGreaterThanOrEqual(lowDetailCount);
    batch.setQuality('high');
    expect(batch.visibleSegmentCount).toBe(4);
    batch.setLayers({ ...DEFAULT_COSMIC_MAP_LAYERS, filaments: false });
    expect(batch.visibleSegmentCount).toBe(0);
    batch.dispose();
  });

  it('dimensionne le halo en pixels selon la qualité sans modifier la largeur scientifique', () => {
    const low = getTempelFilamentVisualProfile('low');
    const medium = getTempelFilamentVisualProfile('medium');
    const high = getTempelFilamentVisualProfile('high');
    const batch = createBatch('low');

    expect(low.haloWidthPixels).toBeGreaterThan(1);
    expect(medium.haloWidthPixels).toBeGreaterThan(low.haloWidthPixels);
    expect(high.haloWidthPixels).toBeGreaterThan(medium.haloWidthPixels);
    expect(high.selectionWidthPixels).toBeGreaterThan(high.hoverWidthPixels);
    expect(high.haloOpacityScale).toBeLessThan(0.5);
    expect(low.maximumHaloDetail).toBeLessThan(medium.maximumHaloDetail);
    expect(medium.maximumHaloDetail).toBeLessThan(high.maximumHaloDetail);
    expect(high.maximumHaloDetail).toBeLessThan(0.1);
    expect(batch.haloTiles[0]?.material.uniforms['linewidth']!.value).toBe(low.haloWidthPixels);
    batch.setQuality('high');
    expect(batch.haloTiles[0]?.material.uniforms['linewidth']!.value).toBe(high.haloWidthPixels);
    expect(batch.selectionHalo.material.uniforms['linewidth']!.value).toBe(
      high.selectionWidthPixels,
    );
    expect(batch.hoverHalo.material.uniforms['linewidth']!.value).toBe(high.hoverWidthPixels);
    expect(batch.haloTiles[0]?.material.blending).toBe(THREE.AdditiveBlending);
    expect(batch.selectionHalo.material.blending).toBe(THREE.NormalBlending);
    expect(batch.hoverHalo.material.blending).toBe(THREE.NormalBlending);
    batch.updateDistance(170_000, 10);
    expect(batch.visibleSegmentCount).toBe(4);
    expect(
      batch.haloTiles.reduce((total, tile) => total + tile.geometry.instanceCount, 0),
    ).toBeLessThan(batch.visibleSegmentCount);
    batch.dispose();
  });

  it('ne réécrit pas les grands masques de sélection quand le segment visible reste stable', () => {
    const batch = createBatch('high');

    batch.setLayers(ALL_COSMIC_MAP_LAYERS);
    batch.updateDistance(900_000, 10);
    const drawRangeSpies = batch.tiles.map((tile) => vi.spyOn(tile.geometry, 'setDrawRange'));

    batch.updateDistance(900_000, 10);

    expect(drawRangeSpies.every((spy) => spy.mock.calls.length === 0)).toBe(true);
    batch.dispose();
  });

  it('adapte la radiance et expose les épines entières au survol et à la sélection', () => {
    const batch = createBatch();

    batch.setPhotographicRadiance(1.2);
    expect(batch.tiles[0]?.material.uniforms['radiance']!.value).toBeCloseTo(1.2);
    batch.updateDistance(900_000, 10);
    expect(batch.haloTiles[0]?.material.opacity).toBeGreaterThan(0);
    batch.setPhotographicRadiance(0);
    expect(batch.tiles[0]?.material.uniforms['radiance']!.value).toBe(0.5);
    batch.setPhotographicRadiance(2);
    expect(batch.tiles[0]?.material.uniforms['radiance']!.value).toBe(1.5);

    batch.hover('lss-sdss-dr8-tempel-filaments-f1');
    expect(batch.hoverLine.visible).toBe(true);
    expect(batch.hoverHalo.visible).toBe(true);
    expect(batch.hoverLine.userData['objectId']).toBe('lss-sdss-dr8-tempel-filaments-f1');
    expect(batch.hoverLine.geometry.getAttribute('position').count).toBe(4);
    expect(batch.hoverHalo.geometry.instanceCount).toBe(2);
    batch.select('lss-sdss-dr8-tempel-filaments-f1');
    expect(batch.selectionLine.visible).toBe(true);
    expect(batch.selectionHalo.visible).toBe(true);
    expect(batch.selectionLine.geometry.getAttribute('position').count).toBe(4);
    expect(batch.hoverLine.visible).toBe(false);
    expect(batch.hoverHalo.visible).toBe(false);
    batch.select(null);
    expect(batch.selectionLine.visible).toBe(false);
    expect(batch.hoverLine.visible).toBe(true);
    batch.hover('missing');
    expect(batch.hoverLine.visible).toBe(false);
    expect(batch.hoverHalo.visible).toBe(false);
    batch.select('missing');
    expect(batch.selectionLine.visible).toBe(false);
    expect(batch.selectionHalo.visible).toBe(false);
    batch.hover(null);
    expect(batch.hoverLine.userData['objectId']).toBeNull();
    batch.dispose();
  });

  it('libère les géométries et matériaux créés', () => {
    const batch = createBatch();
    const geometries = batch.tiles.map((tile) => tile.geometry);
    const tileMaterial = batch.tiles[0]!.material;
    const disposeGeometry = geometries.map((geometry) => vi.spyOn(geometry, 'dispose'));
    const disposeTileMaterial = vi.spyOn(tileMaterial, 'dispose');
    const disposeSelectionGeometry = vi.spyOn(batch.selectionLine.geometry, 'dispose');
    const disposeSelectionMaterial = vi.spyOn(batch.selectionLine.material, 'dispose');
    const disposeHoverGeometry = vi.spyOn(batch.hoverLine.geometry, 'dispose');
    const disposeHoverMaterial = vi.spyOn(batch.hoverLine.material, 'dispose');
    const haloGeometries = batch.haloTiles.map((tile) => tile.geometry);
    const disposeHaloGeometry = haloGeometries.map((geometry) => vi.spyOn(geometry, 'dispose'));
    const disposeHaloMaterial = vi.spyOn(batch.haloTiles[0]!.material, 'dispose');
    const disposeSelectionHaloGeometry = vi.spyOn(batch.selectionHalo.geometry, 'dispose');
    const disposeSelectionHaloMaterial = vi.spyOn(batch.selectionHalo.material, 'dispose');
    const disposeHoverHaloGeometry = vi.spyOn(batch.hoverHalo.geometry, 'dispose');
    const disposeHoverHaloMaterial = vi.spyOn(batch.hoverHalo.material, 'dispose');

    batch.dispose();

    expect(disposeGeometry.every((dispose) => dispose.mock.calls.length === 1)).toBe(true);
    expect(disposeTileMaterial).toHaveBeenCalledOnce();
    expect(disposeSelectionGeometry).toHaveBeenCalledOnce();
    expect(disposeSelectionMaterial).toHaveBeenCalledOnce();
    expect(disposeHoverGeometry).toHaveBeenCalledOnce();
    expect(disposeHoverMaterial).toHaveBeenCalledOnce();
    expect(disposeHaloGeometry.every((dispose) => dispose.mock.calls.length === 1)).toBe(true);
    expect(disposeHaloMaterial).toHaveBeenCalledOnce();
    expect(disposeSelectionHaloGeometry).toHaveBeenCalledOnce();
    expect(disposeSelectionHaloMaterial).toHaveBeenCalledOnce();
    expect(disposeHoverHaloGeometry).toHaveBeenCalledOnce();
    expect(disposeHoverHaloMaterial).toHaveBeenCalledOnce();
    expect(batch.root.children).toHaveLength(0);
  });

  it('rejette une épine sans détection Tempel correspondante', () => {
    const catalog = spineCatalog();
    const registry = createRegistry(2);

    expect(
      () => new TempelFilamentSpineBatch(catalog, registry, new CoordinateSystem(), 'high'),
    ).toThrow('Filament Tempel F3 absent du catalogue de structures');
  });

  it('ignore les détections provenant des autres catalogues de structures', () => {
    const registry = createRegistry();
    const mutableMetadata = registry.catalog.metadata as unknown as {
      sources: CosmicStructureCatalogMetadata['sources'];
    };

    mutableMetadata.sources = [
      {
        id: 'other-source',
        name: 'Other source',
        citation: 'Other et al. (2026)',
        sourceUrl: 'https://example.test/other',
        structureType: 'filament',
        method: 'Other method',
        objectNamePrefix: 'Other filament',
        scientificConfidence: 'calculated',
        recordCount: 0,
      },
      ...mutableMetadata.sources,
    ];
    registry.catalog.sourceIndices.set([0, 1, 1]);
    const fullCatalog = spineCatalog();
    const catalog: TempelFilamentSpineCatalog = {
      ...fullCatalog,
      filamentCount: 2,
      pointCount: 4,
      segmentCount: 2,
      filamentIds: new Uint16Array([2, 3]),
      pointOffsets: new Uint32Array([0, 2, 4]),
      positionsMpc: fullCatalog.positionsMpc.slice(9),
      visitMap: fullCatalog.visitMap.slice(3),
      density: fullCatalog.density.slice(3),
      orientationStrength: fullCatalog.orientationStrength.slice(3),
    };
    const batch = new TempelFilamentSpineBatch(catalog, registry, new CoordinateSystem());

    expect(batch.catalogFilamentCount).toBe(2);
    batch.dispose();
  });
});

function createBatch(quality: 'low' | 'medium' | 'high' = 'high'): TempelFilamentSpineBatch {
  return new TempelFilamentSpineBatch(
    spineCatalog(),
    createRegistry(),
    new CoordinateSystem(),
    quality,
  );
}

function spineCatalog(): TempelFilamentSpineCatalog {
  return {
    filamentCount: 3,
    pointCount: 7,
    segmentCount: 4,
    referenceEpochJulianDay: 2_451_545,
    minimumDistanceMpc: Math.sqrt(300),
    maximumDistanceMpc: Math.sqrt(1_764),
    filamentIds: new Uint16Array([1, 2, 3]),
    pointOffsets: new Uint32Array([0, 3, 5, 7]),
    positionsMpc: new Float32Array([
      10, 10, 10, 11, 11, 11, 12, 12, 12, -20, 20, 20, -21, 21, 21, -30, -30, -30, -31, -31, -31,
    ]),
    visitMap: new Uint8Array([32, 64, 96, 128, 160, 192, 224]),
    density: new Uint8Array([48, 80, 112, 144, 176, 208, 240]),
    orientationStrength: new Uint8Array([64, 96, 128, 160, 192, 224, 255]),
  };
}

function createRegistry(filamentCount = 3): CosmicStructureCatalogRegistry {
  const positions = new Float32Array([11, 11, 11, -20.5, 20.5, 20.5, -30.5, -30.5, -30.5]);
  const distances = new Float32Array([
    Math.hypot(11, 11, 11),
    Math.hypot(-20.5, 20.5, 20.5),
    Math.hypot(-30.5, -30.5, -30.5),
  ]);
  const metadata: CosmicStructureCatalogMetadata = {
    version: '1.0.0',
    recordCount: filamentCount,
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
        recordCount: filamentCount,
      },
    ],
  };
  const catalog: CosmicStructureCatalog = {
    count: filamentCount,
    referenceEpochJulianDay: 2_451_545,
    minimumDistanceMpc: distances[0]!,
    maximumDistanceMpc: distances[filamentCount - 1]!,
    positionsMpc: positions.slice(0, filamentCount * 3),
    distancesMpc: distances.slice(0, filamentCount),
    radiiMpc: new Float32Array([2, 1, 1]),
    confidences: new Float32Array([1, 1, 1]),
    densityContrasts: new Float32Array([Number.NaN, Number.NaN, Number.NaN]),
    boundaryDistancesMpc: new Float32Array([Number.NaN, Number.NaN, Number.NaN]),
    galaxyCounts: new Uint32Array(filamentCount),
    sourceIndices: new Uint16Array(filamentCount),
    catalogNumericIds: new Uint16Array([1, 2, 3].slice(0, filamentCount)),
    flags: new Uint8Array(filamentCount),
    identifiers: ['F1', 'F2', 'F3'].slice(0, filamentCount),
    structureTypes: Array.from({ length: filamentCount }, () => 'filament' as const),
    metadata,
  };

  return new CosmicStructureCatalogRegistry(catalog, new CoordinateSystem());
}
