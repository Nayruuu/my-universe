import { createEarthSkyProjector } from './earth-sky-perspective';

describe('projection perspective du ciel terrestre', () => {
  it('place la direction visée exactement au centre du champ', () => {
    const project = createEarthSkyProjector({
      centerAltitudeDegrees: 23.290_150_6,
      centerAzimuthDegrees: 165.539_599_8,
      verticalFieldOfViewDegrees: 80,
      width: 1_200,
      height: 800,
    });

    expect(project(23.290_150_6, 165.539_599_8)).toEqual({
      x: expect.closeTo(600, 10),
      y: expect.closeTo(400, 10),
      depth: expect.closeTo(1, 10),
    });
  });

  it('respecte les directions locales et place l’horizon sous une cible élevée', () => {
    const project = createEarthSkyProjector({
      centerAltitudeDegrees: 25,
      centerAzimuthDegrees: 180,
      verticalFieldOfViewDegrees: 90,
      width: 1_000,
      height: 1_000,
    });
    const east = project(25, 170);
    const west = project(25, 190);
    const horizon = project(0, 180);

    expect(east?.x).toBeLessThan(500);
    expect(west?.x).toBeGreaterThan(500);
    expect(horizon?.x).toBeCloseTo(500, 10);
    expect(horizon?.y).toBeGreaterThan(500);
  });

  it('écarte les directions derrière la caméra ou hors du champ visible', () => {
    const project = createEarthSkyProjector({
      centerAltitudeDegrees: 0,
      centerAzimuthDegrees: 0,
      verticalFieldOfViewDegrees: 60,
      width: 900,
      height: 600,
    });

    expect(project(0, 180)).toBeNull();
    expect(project(0, 90)).toBeNull();
    expect(project(0, 20)).not.toBeNull();
  });

  it('rejette une caméra ou des coordonnées horizontales invalides', () => {
    const valid = {
      centerAltitudeDegrees: 0,
      centerAzimuthDegrees: 0,
      verticalFieldOfViewDegrees: 80,
      width: 900,
      height: 600,
    };

    for (const configuration of [
      { ...valid, centerAltitudeDegrees: 91 },
      { ...valid, centerAzimuthDegrees: 360 },
      { ...valid, verticalFieldOfViewDegrees: 0 },
      { ...valid, verticalFieldOfViewDegrees: 180 },
      { ...valid, width: 0 },
      { ...valid, height: Number.NaN },
    ]) {
      expect(() => createEarthSkyProjector(configuration)).toThrow(RangeError);
    }

    const project = createEarthSkyProjector(valid);

    expect(() => project(-91, 0)).toThrow(RangeError);
    expect(() => project(0, -1)).toThrow(RangeError);
  });
});
