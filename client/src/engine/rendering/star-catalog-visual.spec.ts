import * as THREE from 'three';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import type { StarCatalog } from '../loaders/star-catalog';
import { CATALOG_STAR_VISUAL_RADIUS, StarCatalogRegistry } from '../objects/star-catalog-registry';
import { PICKING_LAYER } from '../selection/selection-layers';
import {
  applyActiveCatalogStarAppearance,
  applyStarCatalogQuality,
  createStarCatalogVisual,
} from './star-catalog-visual';

describe('StarCatalogVisual', () => {
  it('construit les primitives mutualisées et applique les profils optiques', () => {
    const registry = new StarCatalogRegistry(createCatalog(), new CoordinateSystem());
    const visual = createStarCatalogVisual(registry);
    const pickingLayers = new THREE.Layers();

    pickingLayers.set(PICKING_LAYER);
    expect(visual.points.geometry.getAttribute('position').count).toBe(2);
    expect(visual.visibleIndices).toEqual(new Uint8Array([0, 0]));
    expect(visual.points.layers.test(pickingLayers)).toBe(true);
    expect(visual.selectionPoint.layers.test(pickingLayers)).toBe(true);
    expect(visual.activeDetail.children).toEqual([visual.activeHalo, visual.activeCore]);

    applyStarCatalogQuality(visual, 'low');
    expect(visual.points.material.uniforms['diffractionStrength']!.value).toBe(0);
    expect(visual.points.userData['quality']).toBe('low');

    applyStarCatalogQuality(visual, 'high');
    expect(visual.points.material.uniforms['surfaceDetail']!.value).toBe(1);
    expect(visual.activeCore.material.uniforms['granulationStrength']!.value).toBe(0.28);

    const visualScale = applyActiveCatalogStarAppearance(visual, registry, 1, 52, 0.8);

    expect(visualScale).toBeLessThan(1);
    expect(visual.activeHalo.userData['visualFamily']).toBe('red-dwarf');
    expect(visual.activeCore.userData['visualFamily']).toBe('red-dwarf');
    expect(visual.activeHalo.material.uniforms['pointSize']!.value).toBeCloseTo(52 * visualScale);
    expect(visual.activeCore.scale.x).toBeCloseTo(CATALOG_STAR_VISUAL_RADIUS * visualScale);
    expect(visual.activeCore.material.uniforms['layerOpacity']!.value).toBe(0.8);
  });
});

function createCatalog(): StarCatalog {
  return {
    count: 2,
    referenceEpochJulianDay: 2_451_545,
    positionsParsec: new Float32Array([1, 2, 3, 2, 2, 3]),
    apparentMagnitudes: new Float32Array([-1.4, 6.5]),
    colorIndicesBv: new Float32Array([-0.2, 1.7]),
    catalogIds: new Uint32Array([1, 2]),
    names: ['Étoile chaude', 'Étoile froide'],
    aliases: [[], []],
    spectralTypes: ['B2V', 'M5V'],
  };
}
