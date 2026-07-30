import { AstroTime, Vector } from 'astronomy-engine';
import {
  calculateSolarApparentDiscRatio,
  calculateSolarShadowGeometryFromVectors,
  createSolarEclipseAppearanceFromGeometry,
} from './solar-eclipse-calculator';

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
});
