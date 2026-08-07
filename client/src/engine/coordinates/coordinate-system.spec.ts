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
});
