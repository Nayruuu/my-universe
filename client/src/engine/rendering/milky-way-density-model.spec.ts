import {
  calculateGalactocentricSpiralAngle,
  MILKY_WAY_ARM_COUNT,
  MILKY_WAY_ARM_PITCH_DEGREES,
  MILKY_WAY_ARM_REFERENCE_RADIUS,
} from './milky-way-density-model';

describe('modèle de densité illustratif de la Voie lactée', () => {
  it('répartit quatre bras autour du centre galactique à intervalles réguliers', () => {
    const angles = Array.from({ length: MILKY_WAY_ARM_COUNT }, (_, armIndex) =>
      calculateGalactocentricSpiralAngle(MILKY_WAY_ARM_REFERENCE_RADIUS, armIndex),
    );

    expect(MILKY_WAY_ARM_COUNT).toBe(4);
    for (let armIndex = 1; armIndex < angles.length; armIndex += 1) {
      expect(angles[armIndex]! - angles[armIndex - 1]!).toBeCloseTo(Math.PI / 2, 10);
    }
  });

  it('utilise une spirale logarithmique d’environ treize degrés', () => {
    const innerRadius = MILKY_WAY_ARM_REFERENCE_RADIUS;
    const outerRadius = innerRadius * 2.4;
    const innerAngle = calculateGalactocentricSpiralAngle(innerRadius, 0);
    const outerAngle = calculateGalactocentricSpiralAngle(outerRadius, 0);
    const recoveredPitch = Math.atan(
      Math.log(outerRadius / innerRadius) / (outerAngle - innerAngle),
    );

    expect((recoveredPitch * 180) / Math.PI).toBeCloseTo(MILKY_WAY_ARM_PITCH_DEGREES, 10);
  });
});
