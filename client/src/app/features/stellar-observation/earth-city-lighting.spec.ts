import { createEarthUrbanLightPools, earthCityLightDensity } from './earth-city-lighting';

describe('earth city lighting', () => {
  it('répartit des halos lumineux stables sur tout le panorama', () => {
    for (const [density, expectedCount] of [
      ['quiet', 10],
      ['balanced', 15],
      ['dense', 21],
    ] as const) {
      const pools = createEarthUrbanLightPools(0x1234_5678, density);

      expect(pools).toHaveLength(expectedCount);
      expect(createEarthUrbanLightPools(0x1234_5678, density)).toEqual(pools);
      expect(
        pools.every(
          ({ opacity, radiusX, radiusY, x, y }) =>
            x >= 0 &&
            x <= 7_200 &&
            y >= 0 &&
            y <= 320 &&
            radiusX > radiusY &&
            opacity > 0 &&
            opacity < 1,
        ),
      ).toBe(true);
      const positions = pools.map(({ x }) => x).sort((first, second) => first - second);
      const circularGaps = positions.map((position, index) => {
        const next = positions[index + 1] ?? positions[0]! + 7_200;

        return next - position;
      });

      expect(Math.max(...circularGaps)).toBeLessThan((7_200 / expectedCount) * 1.5);
      expect(pools.every(({ radiusX }) => radiusX * 2 < 7_200 / expectedCount)).toBe(true);
    }
  });

  it('adapte la densité lumineuse à l’échelle urbaine', () => {
    expect(
      earthCityLightDensity({
        id: 'megacity',
        name: 'Megacity',
        latitude: 0,
        longitude: 0,
        population: 8_000_000,
        timeZone: 'UTC',
      }),
    ).toBe('dense');
    expect(
      earthCityLightDensity({
        id: 'capital',
        name: 'Capital',
        latitude: 0,
        longitude: 0,
        capital: true,
        population: 120_000,
        timeZone: 'UTC',
      }),
    ).toBe('balanced');
    expect(
      earthCityLightDensity({
        id: 'village',
        name: 'Village',
        latitude: 0,
        longitude: 0,
        population: 12_000,
        timeZone: 'UTC',
      }),
    ).toBe('quiet');
  });
});
