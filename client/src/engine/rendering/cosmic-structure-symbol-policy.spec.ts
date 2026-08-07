import { getCosmicStructureSymbolStyle } from './cosmic-structure-symbol-policy';

describe('getCosmicStructureSymbolStyle', () => {
  it('réserve une silhouette cartographique lisible aux quatre familles de flux nommées', () => {
    const wall = getCosmicStructureSymbolStyle('wall', 225, 0, 1);
    const basin = getCosmicStructureSymbolStyle('basin', 100, 0, 0.9);
    const attractor = getCosmicStructureSymbolStyle('attractor', 0, 0, 1);
    const repeller = getCosmicStructureSymbolStyle('repeller', 0, 0, 1);

    expect(wall.size).toBeGreaterThanOrEqual(32);
    expect(basin.size).toBeGreaterThanOrEqual(26);
    expect(attractor.size).toBeGreaterThanOrEqual(18);
    expect(repeller.size).toBeGreaterThanOrEqual(20);
    expect([wall.alpha, basin.alpha, attractor.alpha, repeller.alpha]).toEqual(
      expect.arrayContaining([expect.any(Number)]),
    );
  });

  it('conserve les tailles compactes des détections denses et le volume diffus des vides', () => {
    const cluster = getCosmicStructureSymbolStyle('cluster', 0, 0, 0.94);
    const cosmicVoid = getCosmicStructureSymbolStyle('void', 45, 75, 1);
    const cosmicVoidWithoutBoundary = getCosmicStructureSymbolStyle('void', 45, Number.NaN, 1);

    expect(cluster.size).toBeLessThanOrEqual(9);
    expect(cosmicVoid.size).toBeGreaterThan(45);
    expect(cosmicVoid.alpha).toBeGreaterThan(0.9);
    expect(cosmicVoidWithoutBoundary.size).toBeLessThan(cosmicVoid.size);
  });
});
