import { calculateMapScale } from './map-scale';

describe('échelle cartographique', () => {
  it.each([
    [0, 4.8, 'kilometer'],
    [1, 520, 'astronomical-unit'],
    [2, 700, 'light-year'],
    [3, 3_600, 'kiloparsec'],
    [4, 17_000, 'kiloparsec'],
    [5, 120_000, 'megaparsec'],
    [6, 420_000, 'megaparsec'],
  ] as const)(
    'adapte le niveau %s à son unité scientifique',
    (lodLevel, cameraDistance, expectedUnit) => {
      const scale = calculateMapScale(cameraDistance, lodLevel, 900);

      expect(scale).not.toBeNull();
      expect(scale?.unit).toBe(expectedUnit);
      expect(scale?.value).toBeGreaterThan(0);
      expect(scale?.pixelWidth).toBeGreaterThanOrEqual(42);
      expect(scale?.pixelWidth).toBeLessThanOrEqual(92);
      expect(scale?.adapted).toBe(true);
    },
  );

  it('borne le niveau et refuse les dimensions invalides', () => {
    expect(calculateMapScale(420_000, 99, 900)?.unit).toBe('megaparsec');
    expect(calculateMapScale(4.8, -2, 900)?.unit).toBe('kilometer');
    expect(calculateMapScale(0, 0, 900)).toBeNull();
    expect(calculateMapScale(4.8, 0, 0)).toBeNull();
    expect(calculateMapScale(Number.NaN, 0, 900)).toBeNull();
  });

  it.each([50_000, 200_000])(
    'conserve la même métrique scientifique pendant la transition à %s unités',
    (cameraDistance) => {
      const kiloparsecScale = calculateMapScale(cameraDistance, 4, 900)!;
      const megaparsecScale = calculateMapScale(cameraDistance, 5, 900)!;

      expect(kiloparsecScale.value).toBe(megaparsecScale.value * 1_000);
      expect(kiloparsecScale.pixelWidth).toBeCloseTo(megaparsecScale.pixelWidth, 8);
    },
  );

  it('conserve la même métrique au changement de référentiel galactique et stellaire', () => {
    const galacticScale = calculateMapScale(2_200, 3, 900);
    const stellarScale = calculateMapScale(2_200, 2, 900);

    expect(galacticScale).toEqual(stellarScale);
  });

  it('réduit progressivement la distance affichée pendant la plongée dans la Voie lactée', () => {
    const distances = [3_600, 3_000, 2_400, 1_800, 1_400, 1_050, 700];
    const scalesInLightYears = distances.map((cameraDistance) => {
      const scale = calculateMapScale(cameraDistance, cameraDistance > 1_400 ? 3 : 2, 900)!;

      return scale.unit === 'kiloparsec' ? scale.value * 3_261.563_777 : scale.value;
    });

    for (let index = 1; index < scalesInLightYears.length; index += 1) {
      expect(scalesInLightYears[index]).toBeLessThanOrEqual(scalesInLightYears[index - 1]!);
    }
  });
});
