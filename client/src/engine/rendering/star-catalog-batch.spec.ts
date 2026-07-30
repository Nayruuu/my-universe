import * as THREE from 'three';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import { StarCatalog } from '../loaders/star-catalog';
import { colorIndexToRgb } from '../materials/star-color';
import { StarCatalogRegistry } from '../objects/star-catalog-registry';
import { PICKING_LAYER } from '../selection/selection-layers';
import { StarCatalogBatch } from './star-catalog-batch';

describe('StarCatalogBatch', () => {
  it('convertit le repère équatorial HYG vers le repère vertical Three.js', () => {
    const batch = createBatch(1);
    const position = batch.points.geometry.getAttribute('position') as THREE.BufferAttribute;

    expect(position.getX(0)).toBeGreaterThan(0);
    expect(position.getY(0)).toBeGreaterThan(0);
    expect(position.getZ(0)).toBeLessThan(0);
    expect(batch.points.userData['scientificConfidence']).toBe('observed');
    expect(batch.visibleCount).toBe(0);
    const pickingLayers = new THREE.Layers();

    pickingLayers.set(PICKING_LAYER);
    expect(batch.points.layers.test(pickingLayers)).toBe(true);
    expect(batch.selectionPoint.layers.test(pickingLayers)).toBe(true);
    batch.dispose();
  });

  it('garde le batch visible à toutes les échelles et permet une limite explicite', () => {
    const batch = createBatch(6_000);

    batch.setDrawLimit(2_000);
    batch.setPixelRatio(1.5);
    batch.updateLod(2, 1);

    expect(batch.points.geometry.drawRange.count).toBe(2_000);
    expect(batch.points.material.uniforms['pixelRatio']!.value).toBe(1.5);
    expect(batch.visibleCount).toBe(2_000);
    expect(
      (batch.points.userData['visibleIndices'] as Uint8Array).reduce(
        (total, value) => total + value,
        0,
      ),
    ).toBe(2_000);

    batch.setDrawLimit(10_000);
    expect(batch.points.geometry.drawRange.count).toBe(6_000);

    batch.updateLod(0, 2);
    batch.updateLod(0, 0.1);
    batch.updateLod(99, 0.1);
    expect(batch.visibleCount).toBe(6_000);
    expect(
      (batch.points.userData['visibleIndices'] as Uint8Array).every((value) => value === 1),
    ).toBe(true);
    batch.setDrawLimit(-2);
    expect(batch.visibleCount).toBe(0);
    batch.setDrawLimit(2.9);
    expect(batch.points.geometry.drawRange.count).toBe(2);
    batch.setPixelRatio(0.1);
    expect(batch.points.material.uniforms['pixelRatio']!.value).toBe(0.5);
    batch.dispose();
  });

  it('rend les étoiles brillantes plus grandes et chaudes ou froides selon B−V', () => {
    const batch = createBatch(2);
    const sizes = batch.points.geometry.getAttribute('pointSize') as THREE.BufferAttribute;
    const blue = colorIndexToRgb(-0.2);
    const red = colorIndexToRgb(1.7);

    expect(sizes.getX(0)).toBeGreaterThan(sizes.getX(1));
    expect(blue[2]).toBeGreaterThan(blue[0]);
    expect(red[0]).toBeGreaterThan(red[2]);
    batch.dispose();
  });

  it('réutilise un unique marqueur pour cibler même une étoile hors du draw range', () => {
    const batch = createBatch(6_000);

    batch.setDrawLimit(2_000);
    batch.select('hyg-6000');

    expect(batch.selectionPoint.visible).toBe(true);
    expect(batch.selectionPoint.userData['objectId']).toBe('hyg-6000');
    expect(batch.getPickables()).toEqual([batch.selectionPoint, batch.points]);
    expect(batch.getWorldPosition('hyg-6000')).not.toBeNull();

    batch.select(null);
    expect(batch.selectionPoint.visible).toBe(false);
    batch.select('missing');
    expect(batch.selectionPoint.visible).toBe(false);
    expect(batch.getWorldPosition('missing')).toBeNull();
    batch.dispose();
  });
});

function createBatch(count: number): StarCatalogBatch {
  return new StarCatalogBatch(
    new StarCatalogRegistry(createCatalog(count), new CoordinateSystem()),
  );
}

function createCatalog(count: number): StarCatalog {
  const positionsParsec = new Float32Array(count * 3);
  const apparentMagnitudes = new Float32Array(count);
  const colorIndicesBv = new Float32Array(count);
  const catalogIds = new Uint32Array(count);

  for (let index = 0; index < count; index += 1) {
    const offset = index * 3;

    positionsParsec[offset] = 1 + index * 0.001;
    positionsParsec[offset + 1] = 2;
    positionsParsec[offset + 2] = 3;
    apparentMagnitudes[index] = index === 0 ? -1.4 : 6.5;
    colorIndicesBv[index] = index === 0 ? -0.2 : 1.7;
    catalogIds[index] = index + 1;
  }

  return {
    count,
    referenceEpochJulianDay: 2_451_545,
    positionsParsec,
    apparentMagnitudes,
    colorIndicesBv,
    catalogIds,
    names: Array.from({ length: count }, (_, index) => `Étoile ${index + 1}`),
    aliases: Array.from({ length: count }, () => []),
    spectralTypes: Array.from({ length: count }, () => null),
  };
}
