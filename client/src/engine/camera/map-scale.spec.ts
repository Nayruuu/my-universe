import { calculateMapScale } from './map-scale';

describe('échelle cartographique', () => {
  it.each([
    [0, 4.8, 'kilometer'],
    [1, 520, 'astronomical-unit'],
    [2, 1_400, 'light-year'],
    [3, 9_600, 'kiloparsec'],
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
});
