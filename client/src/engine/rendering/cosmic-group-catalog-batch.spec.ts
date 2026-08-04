import * as THREE from 'three';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import { CosmicGroupCatalog } from '../loaders/cosmic-group-catalog';
import { CosmicGroupCatalogRegistry } from '../objects/cosmic-group-catalog-registry';
import { PICKING_LAYER } from '../selection/selection-layers';
import { DEFAULT_COSMIC_MAP_LAYERS } from './cosmic-map-policy';
import {
  CosmicGroupCatalogBatch,
  getCosmicCatalogTargetOpacity,
  getCosmicFilamentDetail,
  getCosmicFilamentTargetOpacity,
} from './cosmic-group-catalog-batch';

describe('CosmicGroupCatalogBatch', () => {
  it('rend tout Cosmicflows-4 avec un seul Points et des attributs GPU', () => {
    const batch = createBatch();
    const geometry = batch.points.geometry;

    expect(batch.root.children).toEqual([batch.filaments, batch.points, batch.selectionPoint]);
    expect(geometry.getAttribute('position').count).toBe(2);
    expect(geometry.getAttribute('pointSize').count).toBe(2);
    expect(geometry.getAttribute('pointAlpha').count).toBe(2);
    expect(geometry.getAttribute('pointColor').count).toBe(2);
    expect(geometry.getAttribute('revealThreshold').count).toBe(2);
    expect(batch.points.material.blending).toBe(THREE.AdditiveBlending);
    expect(batch.points.material.vertexShader).toContain('attribute vec3 pointColor');
    expect(batch.points.material.fragmentShader).toContain('float luminousCore');
    expect(batch.points.userData['catalogCount']).toBe(2);
    expect(batch.points.userData['scientificConfidence']).toBe('calculated');
    expect(batch.points.userData['visualColorEncoding']).toBe(
      'illustrative-distance-gradient-near-warm-far-cool',
    );
    expect(batch.points.userData['objectIds']).toEqual(['cf4-pgc-35', 'cf4-pgc-12']);
    expect(batch.filaments).toBeInstanceOf(THREE.LineSegments);
    expect(batch.filaments.userData).toMatchObject({
      scientificConfidence: 'illustrative',
      visualStyle: 'derived-nearest-neighbor-cosmic-filaments',
    });
    const pickingLayers = new THREE.Layers();

    pickingLayers.set(PICKING_LAYER);
    expect(batch.points.layers.test(pickingLayers)).toBe(true);
    expect(batch.selectionPoint.layers.test(pickingLayers)).toBe(true);
    batch.setPhotographicRadiance(1.16);
    expect(batch.points.material.uniforms['radiance']!.value).toBeCloseTo(1.16);
    expect(batch.filaments.material.uniforms['radiance']!.value).toBeCloseTo(1.16);
    batch.setPhotographicRadiance(0);
    expect(batch.points.material.uniforms['radiance']!.value).toBe(0.5);
    batch.setPhotographicRadiance(2);
    expect(batch.points.material.uniforms['radiance']!.value).toBe(1.5);
    batch.dispose();
  });

  it('construit un réseau de filaments en un seul batch avec un budget progressif', () => {
    const registry = new CosmicGroupCatalogRegistry(
      createConnectedCatalog(),
      new CoordinateSystem(),
    );
    const batch = new CosmicGroupCatalogBatch(registry, 'low');
    const edgeCount = batch.filaments.userData['edgeCount'] as number;

    batch.updateDistance(420_000, 10);
    const lowCount = batch.activeFilamentCount;

    expect(edgeCount).toBe(5);
    expect(batch.filaments.geometry.getAttribute('position').count).toBe(edgeCount * 2);
    expect(batch.filaments.geometry.getAttribute('lineAlpha').count).toBe(edgeCount * 2);
    expect(batch.filaments.geometry.getAttribute('detailThreshold').count).toBe(edgeCount * 2);
    expect(lowCount).toBeGreaterThan(0);
    expect(lowCount).toBeLessThan(edgeCount);
    expect(batch.filaments.geometry.drawRange.count).toBe(lowCount * 2);

    batch.setQuality('medium');
    batch.updateDistance(420_000, 10);
    const mediumCount = batch.activeFilamentCount;

    expect(mediumCount).toBeGreaterThanOrEqual(lowCount);
    expect(mediumCount).toBeLessThanOrEqual(edgeCount);
    batch.setQuality('high');
    batch.updateDistance(170_000, 10);
    expect(batch.activeFilamentCount).toBe(edgeCount);
    expect(batch.filaments.geometry.drawRange.count).toBe(edgeCount * 2);
    batch.dispose();
  });

  it('fait varier continûment son opacité avec la distance de caméra', () => {
    expect(getCosmicCatalogTargetOpacity(110_000)).toBe(0);
    expect(getCosmicCatalogTargetOpacity(120_000)).toBeGreaterThan(0);
    expect(getCosmicCatalogTargetOpacity(120_000)).toBeLessThan(0.01);
    expect(getCosmicCatalogTargetOpacity(300_000)).toBeCloseTo(0.58, 5);
    expect(getCosmicCatalogTargetOpacity(420_000)).toBeCloseTo(0.58, 5);
    expect(getCosmicFilamentTargetOpacity(140_000)).toBe(0);
    expect(getCosmicFilamentTargetOpacity(180_000)).toBeGreaterThan(0);
    expect(getCosmicFilamentTargetOpacity(320_000)).toBeCloseTo(0.22, 5);
    expect(getCosmicFilamentDetail(420_000)).toBeCloseTo(0.12, 5);
    expect(getCosmicFilamentDetail(280_000)).toBeGreaterThan(0.12);
    expect(getCosmicFilamentDetail(280_000)).toBeLessThan(1);
    expect(getCosmicFilamentDetail(140_000)).toBe(1);

    const opacityBeforeOldThreshold = getCosmicCatalogTargetOpacity(199_999);
    const opacityAfterOldThreshold = getCosmicCatalogTargetOpacity(200_001);

    expect(Math.abs(opacityAfterOldThreshold - opacityBeforeOldThreshold)).toBeLessThan(0.000_02);
  });

  it('reste visible et s’estompe progressivement dans l’Univers proche', () => {
    const batch = createBatch();

    batch.updateDistance(40_000, 10);
    expect(batch.visibleCount).toBe(0);
    expect(batch.points.visible).toBe(false);

    batch.updateDistance(420_000, 10);
    expect(batch.visibleCount).toBeGreaterThan(0);
    expect(batch.visibleCount).toBeLessThan(2);
    expect(batch.points.visible).toBe(true);
    expect(batch.points.geometry.drawRange.count).toBe(batch.visibleCount);
    expect(batch.points.userData['visibleIndices']).toEqual(new Uint8Array([1, 0]));
    expect(batch.filaments.visible).toBe(false);

    batch.updateDistance(120_000, 1 / 60);
    const transitionOpacity = batch.points.material.uniforms['catalogOpacity']!.value as number;

    expect(transitionOpacity).toBeGreaterThan(getCosmicCatalogTargetOpacity(120_000));
    expect(transitionOpacity).toBeLessThan(0.58);
    expect(batch.points.visible).toBe(true);

    batch.updateDistance(120_000, 10);
    expect(batch.points.material.uniforms['catalogOpacity']!.value).toBeCloseTo(
      getCosmicCatalogTargetOpacity(120_000),
      5,
    );

    batch.updateDistance(40_000, 10);
    expect(batch.visibleCount).toBe(0);
    expect(batch.points.userData['visibleIndices']).toEqual(new Uint8Array([0, 0]));
    batch.dispose();
  });

  it('fait apparaître et disparaître le réseau avec son propre fondu cosmique', () => {
    const batch = new CosmicGroupCatalogBatch(
      new CosmicGroupCatalogRegistry(createConnectedCatalog(), new CoordinateSystem()),
      'high',
    );

    batch.updateDistance(320_000, 10);
    expect(batch.filaments.visible).toBe(true);
    expect(batch.visibleFilamentCount).toBe(batch.activeFilamentCount);
    expect(batch.filaments.material.uniforms['filamentOpacity']!.value).toBeCloseTo(0.22, 5);
    const distantDetail = batch.filaments.material.uniforms['filamentDetail']!.value as number;

    batch.updateDistance(180_000, 10);
    expect(batch.filaments.material.uniforms['filamentDetail']!.value).toBeGreaterThan(
      distantDetail,
    );

    batch.updateDistance(140_000, 10);
    expect(batch.filaments.visible).toBe(false);
    expect(batch.visibleFilamentCount).toBe(0);
    batch.dispose();
  });

  it('sépare les groupes et les liens en couches sans rendre les objets masqués cliquables', () => {
    const batch = createBatch();

    batch.updateDistance(420_000, 10);
    expect(batch.visibleCount).toBeGreaterThan(0);
    expect(batch.visibleFilamentCount).toBeGreaterThanOrEqual(0);

    batch.setLayers({ ...DEFAULT_COSMIC_MAP_LAYERS, groups: false, links: false });
    expect(batch.points.visible).toBe(false);
    expect(batch.filaments.visible).toBe(false);
    expect(batch.visibleCount).toBe(0);
    expect(batch.points.userData['visibleIndices']).toEqual(new Uint8Array([0, 0]));
    expect(batch.isObjectVisible('cf4-pgc-35')).toBe(false);
    expect(batch.isObjectVisible('missing')).toBeNull();
    expect(batch.isObjectVisibleForLabels('missing')).toBeNull();

    batch.setLayers(DEFAULT_COSMIC_MAP_LAYERS);
    expect(batch.points.visible).toBe(true);
    expect(batch.isObjectVisible('cf4-pgc-35')).toBe(true);
    expect(batch.isObjectVisibleForLabels('cf4-pgc-35')).toBe(true);
    batch.dispose();
  });

  it('gère un catalogue vide et départage les liens de priorité identique', () => {
    const emptyBatch = new CosmicGroupCatalogBatch(
      new CosmicGroupCatalogRegistry(createEmptyCatalog(), new CoordinateSystem()),
    );
    const tiedBatch = new CosmicGroupCatalogBatch(
      new CosmicGroupCatalogRegistry(createTiedFilamentCatalog(), new CoordinateSystem()),
    );

    expect(emptyBatch.points.geometry.getAttribute('position').count).toBe(0);
    expect(tiedBatch.filaments.userData['edgeCount']).toBe(2);
    emptyBatch.dispose();
    tiedBatch.dispose();
  });

  it('favorise visuellement les distances les mieux contraintes', () => {
    const batch = createBatch();
    const sizes = batch.points.geometry.getAttribute('pointSize') as THREE.BufferAttribute;
    const alphas = batch.points.geometry.getAttribute('pointAlpha') as THREE.BufferAttribute;
    const colors = batch.points.geometry.getAttribute('pointColor') as THREE.BufferAttribute;

    expect(sizes.getX(0)).toBeGreaterThan(sizes.getX(1));
    expect(sizes.getX(0)).toBeGreaterThan(5);
    expect(alphas.getX(0)).toBeGreaterThan(alphas.getX(1));
    expect(colors.getX(0)).toBeGreaterThan(colors.getX(1));
    expect(colors.getZ(0)).toBeLessThan(colors.getZ(1));
    batch.dispose();
  });

  it('réutilise un marqueur pour sélectionner et localiser un groupe', () => {
    const batch = createBatch();

    batch.setPixelRatio(1.5);
    batch.select('cf4-pgc-12');
    expect(batch.selectionPoint.visible).toBe(true);
    expect(batch.selectionPoint.userData['objectId']).toBe('cf4-pgc-12');
    expect(batch.selectionPoint.position.toArray()).toEqual([
      19_798.599_609_375, -2_216, 12.399_999_618_530_273,
    ]);
    expect(batch.selectionPoint.material.uniforms['pixelRatio']!.value).toBe(1.5);
    expect(batch.getWorldPosition('cf4-pgc-12')).not.toBeNull();
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

function createBatch(): CosmicGroupCatalogBatch {
  return new CosmicGroupCatalogBatch(
    new CosmicGroupCatalogRegistry(createCatalog(), new CoordinateSystem()),
  );
}

function createConnectedCatalog(): CosmicGroupCatalog {
  const positions = [12, 0, 0, 18, 1, 0, 24, -1, 1, 24, 7, 0, 30, 1, -1, 36, 0, 0];
  const distances = Array.from({ length: positions.length / 3 }, (_, index) =>
    Math.hypot(positions[index * 3]!, positions[index * 3 + 1]!, positions[index * 3 + 2]!),
  );

  return {
    count: distances.length,
    referenceEpochJulianDay: 2_451_545,
    minimumDistanceMpc: distances[0]!,
    maximumDistanceMpc: distances.at(-1)!,
    positionsMpc: new Float32Array(positions),
    distancesMpc: new Float32Array(distances),
    distanceModulusErrors: new Float32Array(distances.map((_, index) => 0.1 + index * 0.05)),
    velocitiesCmbKmPerSecond: new Int32Array(distances.map((distance) => distance * 70)),
    pgcIds: new Uint32Array(distances.map((_, index) => 100 + index)),
    distanceModuli: new Float32Array(distances.map((distance) => 5 * Math.log10(distance) + 25)),
    filamentPairs: new Uint32Array([0, 1, 1, 2, 2, 3, 3, 4, 4, 5]),
  };
}

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
    filamentPairs: new Uint32Array(),
  };
}

function createEmptyCatalog(): CosmicGroupCatalog {
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

function createTiedFilamentCatalog(): CosmicGroupCatalog {
  return {
    count: 3,
    referenceEpochJulianDay: 2_451_545,
    minimumDistanceMpc: 12,
    maximumDistanceMpc: 24,
    positionsMpc: new Float32Array([12, 0, 0, 18, 0, 0, 24, 0, 0]),
    distancesMpc: new Float32Array([12, 18, 24]),
    distanceModulusErrors: new Float32Array([0.1, 0.1, 0.1]),
    velocitiesCmbKmPerSecond: new Int32Array([840, 1_260, 1_680]),
    pgcIds: new Uint32Array([1, 2, 3]),
    distanceModuli: new Float32Array([30.396, 31.276, 31.901]),
    filamentPairs: new Uint32Array([0, 1, 1, 2]),
  };
}
