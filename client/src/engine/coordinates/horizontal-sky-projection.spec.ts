import { projectHorizontalSky } from './horizontal-sky-projection';

describe('projectHorizontalSky', () => {
  it('place le zénith au centre indépendamment de l’azimut', () => {
    expect(projectHorizontalSky(90, 0)).toEqual({
      x: 0,
      y: 0,
      radialDistance: 0,
      isAboveHorizon: true,
      clampedToHorizon: false,
    });
    expect(projectHorizontalSky(90, 247)).toMatchObject({
      x: 0,
      y: 0,
      radialDistance: 0,
    });
  });

  it('oriente le nord en haut et l’est à droite sur le cercle de l’horizon', () => {
    expect(projectHorizontalSky(0, 0)).toMatchObject({ x: 0, y: -1 });
    expect(projectHorizontalSky(0, 90)).toMatchObject({ x: 1 });
    expect(projectHorizontalSky(0, 90).y).toBeCloseTo(0, 12);
    expect(projectHorizontalSky(0, 180).x).toBeCloseTo(0, 12);
    expect(projectHorizontalSky(0, 180).y).toBeCloseTo(1, 12);
    expect(projectHorizontalSky(0, 270).x).toBeCloseTo(-1, 12);
  });

  it('projette la position de référence de Sirius au-dessus de Paris', () => {
    const projection = projectHorizontalSky(23.290_150_6, 165.539_599_8);

    expect(projection.radialDistance).toBeCloseTo(0.741_220_548_9, 10);
    expect(projection.x).toBeCloseTo(0.185_090_785_2, 10);
    expect(projection.y).toBeCloseTo(0.717_739_021_7, 10);
    expect(projection.isAboveHorizon).toBe(true);
    expect(projection.clampedToHorizon).toBe(false);
  });

  it('épingle sous l’horizon dans la bonne direction sans simuler une position visible', () => {
    const projection = projectHorizontalSky(-55.255_609_5, 333.198_646);

    expect(projection.radialDistance).toBe(1);
    expect(Math.hypot(projection.x, projection.y)).toBeCloseTo(1, 12);
    expect(projection.x).toBeLessThan(0);
    expect(projection.y).toBeLessThan(0);
    expect(projection.isAboveHorizon).toBe(false);
    expect(projection.clampedToHorizon).toBe(true);
  });

  it('rejette les coordonnées horizontales non physiques', () => {
    for (const [altitude, azimuth] of [
      [Number.NaN, 0],
      [-91, 0],
      [91, 0],
      [0, Number.POSITIVE_INFINITY],
      [0, -1],
      [0, 360],
    ]) {
      expect(() => projectHorizontalSky(altitude!, azimuth!)).toThrow(RangeError);
    }
  });
});
