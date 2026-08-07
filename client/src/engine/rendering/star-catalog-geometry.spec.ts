import { CoordinateSystem } from '../coordinates/coordinate-system';
import type { StarCatalog } from '../loaders/star-catalog';
import { StarCatalogRegistry } from '../objects/star-catalog-registry';
import { createStarCatalogGeometry, stellarCatalogSurfaceSeed } from './star-catalog-geometry';

describe('StarCatalogGeometry', () => {
  it('encodes catalogue positions and deterministic visual attributes for the GPU', () => {
    const registry = new StarCatalogRegistry(createCatalog(), new CoordinateSystem());
    const geometry = createStarCatalogGeometry(registry);

    expect(geometry.getAttribute('position').array).toBe(registry.renderPositions);
    expect(Array.from(geometry.getAttribute('color').array)).toHaveLength(6);
    expect(Array.from(geometry.getAttribute('pointSize').array)).toEqual([
      expect.any(Number),
      expect.any(Number),
    ]);
    expect(geometry.getAttribute('pointSize').getX(0)).toBeGreaterThan(
      geometry.getAttribute('pointSize').getX(1),
    );
    expect(Array.from(geometry.getAttribute('surfaceProfile').array)).toEqual([0, 4]);
    expect(geometry.getAttribute('surfaceSeed').getX(0)).toBeCloseTo(stellarCatalogSurfaceSeed(1));
    expect(geometry.getAttribute('surfaceSeed').getX(1)).toBeCloseTo(stellarCatalogSurfaceSeed(2));
    expect(geometry.drawRange).toEqual({ start: 0, count: 2 });
    expect(geometry.boundingSphere).not.toBeNull();
  });

  it('keeps catalogue surface seeds stable and bounded', () => {
    expect(stellarCatalogSurfaceSeed(42)).toBe(stellarCatalogSurfaceSeed(42));
    expect(stellarCatalogSurfaceSeed(42)).toBeGreaterThanOrEqual(0);
    expect(stellarCatalogSurfaceSeed(42)).toBeLessThan(1);
    expect(stellarCatalogSurfaceSeed(42)).not.toBe(stellarCatalogSurfaceSeed(43));
  });
});

function createCatalog(): StarCatalog {
  return {
    count: 2,
    referenceEpochJulianDay: 2_451_545,
    positionsParsec: new Float32Array([1, 2, 3, 2, 2, 3]),
    velocitiesParsecPerYear: new Float32Array(6),
    apparentMagnitudes: new Float32Array([-1.4, 6.5]),
    colorIndicesBv: new Float32Array([-0.2, 1.7]),
    catalogIds: new Uint32Array([1, 2]),
    names: ['Étoile chaude', 'Étoile froide'],
    aliases: [[], []],
    spectralTypes: ['B2V', 'M5V'],
  };
}
