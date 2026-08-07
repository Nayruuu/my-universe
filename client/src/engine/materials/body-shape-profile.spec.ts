import type { TriaxialBodyShapeDefinition } from '../../data/models/universe.models';
import { calculateTriaxialBodyScale } from './body-shape-profile';

describe('profil de forme tri-axiale', () => {
  it('conserve une sphère quand aucune forme scientifique n’est disponible', () => {
    expect(calculateTriaxialBodyScale(undefined)).toEqual([1, 1, 1]);
  });

  it('préserve les rapports publiés et le volume visuel', () => {
    const shape: TriaxialBodyShapeDefinition = {
      type: 'triaxial-ellipsoid',
      dimensionsKm: [26.06, 22.8, 18.28],
      scientificConfidence: 'observed',
      source: 'NASA Planetary Data System',
    };
    const [x, y, z] = calculateTriaxialBodyScale(shape);

    expect(x / z).toBeCloseTo(26.06 / 22.8, 10);
    expect(y / z).toBeCloseTo(18.28 / 22.8, 10);
    expect(x * y * z).toBeCloseTo(1, 10);
  });
});
