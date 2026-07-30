import * as THREE from 'three';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import { CosmicGroupCatalog } from '../loaders/cosmic-group-catalog';
import { CosmicGroupCatalogRegistry } from '../objects/cosmic-group-catalog-registry';
import { PICKING_LAYER } from '../selection/selection-layers';
import {
  CosmicGroupCatalogBatch,
  getCosmicCatalogTargetOpacity,
} from './cosmic-group-catalog-batch';

describe('CosmicGroupCatalogBatch', () => {
  it('rend tout Cosmicflows-4 avec un seul Points et des attributs GPU', () => {
    const batch = createBatch();
    const geometry = batch.points.geometry;

    expect(batch.root.children).toEqual([batch.points, batch.selectionPoint]);
    expect(geometry.getAttribute('position').count).toBe(2);
    expect(geometry.getAttribute('pointSize').count).toBe(2);
    expect(geometry.getAttribute('pointAlpha').count).toBe(2);
    expect(batch.points.userData['catalogCount']).toBe(2);
    expect(batch.points.userData['scientificConfidence']).toBe('calculated');
    expect(batch.points.userData['objectIds']).toEqual(['cf4-pgc-35', 'cf4-pgc-12']);
    const pickingLayers = new THREE.Layers();

    pickingLayers.set(PICKING_LAYER);
    expect(batch.points.layers.test(pickingLayers)).toBe(true);
    expect(batch.selectionPoint.layers.test(pickingLayers)).toBe(true);
    batch.setPhotographicRadiance(1.16);
    expect(batch.points.material.uniforms['radiance']!.value).toBeCloseTo(1.16);
    batch.setPhotographicRadiance(0);
    expect(batch.points.material.uniforms['radiance']!.value).toBe(0.5);
    batch.setPhotographicRadiance(2);
    expect(batch.points.material.uniforms['radiance']!.value).toBe(1.5);
    batch.dispose();
  });

  it('fait varier continûment son opacité avec la distance de caméra', () => {
    expect(getCosmicCatalogTargetOpacity(40_000)).toBe(0);
    expect(getCosmicCatalogTargetOpacity(120_000)).toBeCloseTo(0.288_64, 5);
    expect(getCosmicCatalogTargetOpacity(240_000)).toBeCloseTo(0.82, 5);
    expect(getCosmicCatalogTargetOpacity(420_000)).toBeCloseTo(0.82, 5);

    const opacityBeforeOldThreshold = getCosmicCatalogTargetOpacity(199_999);
    const opacityAfterOldThreshold = getCosmicCatalogTargetOpacity(200_001);

    expect(Math.abs(opacityAfterOldThreshold - opacityBeforeOldThreshold)).toBeLessThan(0.000_01);
  });

  it('reste visible et s’estompe progressivement dans l’Univers proche', () => {
    const batch = createBatch();

    batch.updateDistance(40_000, 10);
    expect(batch.visibleCount).toBe(0);
    expect(batch.points.visible).toBe(false);

    batch.updateDistance(420_000, 10);
    expect(batch.visibleCount).toBe(2);
    expect(batch.points.visible).toBe(true);
    expect(batch.points.userData['visibleIndices']).toEqual(new Uint8Array([1, 1]));

    batch.updateDistance(120_000, 1 / 60);
    const transitionOpacity = batch.points.material.uniforms['catalogOpacity']!.value as number;

    expect(transitionOpacity).toBeGreaterThan(0.288_64);
    expect(transitionOpacity).toBeLessThan(0.82);
    expect(batch.points.visible).toBe(true);

    batch.updateDistance(120_000, 10);
    expect(batch.points.material.uniforms['catalogOpacity']!.value).toBeCloseTo(0.288_64, 5);

    batch.updateDistance(40_000, 10);
    expect(batch.visibleCount).toBe(0);
    expect(batch.points.userData['visibleIndices']).toEqual(new Uint8Array([0, 0]));
    batch.dispose();
  });

  it('favorise visuellement les distances les mieux contraintes', () => {
    const batch = createBatch();
    const sizes = batch.points.geometry.getAttribute('pointSize') as THREE.BufferAttribute;
    const alphas = batch.points.geometry.getAttribute('pointAlpha') as THREE.BufferAttribute;

    expect(sizes.getX(0)).toBeGreaterThan(sizes.getX(1));
    expect(alphas.getX(0)).toBeGreaterThan(alphas.getX(1));
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
  };
}
