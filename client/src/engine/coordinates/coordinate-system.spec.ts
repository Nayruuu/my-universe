import { CoordinateSystem } from './coordinate-system';

describe('CoordinateSystem.writeRenderPosition', () => {
  it('écrit la même projection stellaire que l’API objet', () => {
    const coordinates = new CoordinateSystem();
    const expected = coordinates.toRenderPosition([1, -2, 3], 'parsec', 'stellar');
    const target = new Float32Array(5);

    coordinates.writeRenderPosition(1, -2, 3, 'parsec', 'stellar', target, 2);

    expect(target[2]).toBeCloseTo(expected.x, 4);
    expect(target[3]).toBeCloseTo(expected.y, 4);
    expect(target[4]).toBeCloseTo(expected.z, 4);
  });

  it('écrit une origine exacte', () => {
    const target = new Float32Array([1, 1, 1]);

    new CoordinateSystem().writeRenderPosition(0, 0, 0, 'parsec', 'stellar', target, 0);

    expect(target).toEqual(new Float32Array(3));
  });

  it('conserve linéairement les 8,178 kpc du Soleil dans le disque galactique', () => {
    const coordinates = new CoordinateSystem();
    const sun = coordinates.toRenderPosition([8.178, 0, 0], 'kiloparsec', 'galactic');

    // GRAVITY Collaboration 2019, A&A 625:L10: R0 = 8.178 kpc.
    expect(sun.x).toBeCloseTo(736.02, 8);
    expect(sun.y).toBe(0);
    expect(sun.z).toBe(0);
    expect(sun.x).toBeLessThan(coordinates.toSceneDistance(50_000, 'light-year', 'galactic'));
  });
});
