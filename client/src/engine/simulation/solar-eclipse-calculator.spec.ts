import { AstroTime, Vector } from 'astronomy-engine';
import {
  calculateSolarEclipseAppearance,
  calculateSolarApparentDiscRatio,
  calculateSolarEclipsePath,
  calculateSolarShadowGeometryFromVectors,
  createSolarEclipseAppearanceFromGeometry,
} from './solar-eclipse-calculator';
import { ASTRONOMY_ENGINE_MAX_JULIAN_DAY } from './astronomy-engine-time-domain';

describe('géométrie pure d’une éclipse solaire', () => {
  it('retourne une géométrie neutre lorsque Soleil et Lune sont confondus', () => {
    const coincidentPosition = new Vector(1, 0, 0, new AstroTime(0));
    const geometry = calculateSolarShadowGeometryFromVectors(
      coincidentPosition,
      coincidentPosition,
    );
    const appearance = createSolarEclipseAppearanceFromGeometry(geometry);

    expect(geometry).toMatchObject({
      phase: 'none',
      surfacePoint: null,
      closestAxisPoint: { x: 0, y: 0, z: 0 },
    });
    expect(appearance.shadowDirection).toEqual({ x: 0, y: 0, z: 0 });
    expect(appearance.centralLatitude).toBeNull();
    expect(appearance.centralLongitude).toBeNull();
  });

  it('stabilise le rapport apparent lorsque les deux disques tendent vers zéro', () => {
    expect(
      calculateSolarApparentDiscRatio(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY),
    ).toBe(1);
    expect(calculateSolarApparentDiscRatio(1, 0.00257)).toBeGreaterThan(0);
  });

  it('n’invente pas d’éclipse un million d’années hors du domaine des éphémérides', () => {
    const unsupportedTime = {
      julianDay: ASTRONOMY_ENGINE_MAX_JULIAN_DAY + 365_250_000,
    };

    expect(calculateSolarEclipseAppearance(unsupportedTime)).toEqual({
      phase: 'none',
      sunPositionInEarthRadii: { x: 0, y: 0, z: 0 },
      moonPositionInEarthRadii: { x: 0, y: 0, z: 0 },
      shadowDirection: { x: 0, y: 0, z: 0 },
      centralLatitude: null,
      centralLongitude: null,
    });
    expect(calculateSolarEclipsePath(unsupportedTime)).toEqual([]);
  });
});
