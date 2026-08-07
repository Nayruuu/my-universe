import { getHeliocentricCatalogObserverOpacity } from './heliocentric-catalog-visibility';

describe('visibilité des catalogues héliocentriques', () => {
  it('préserve le voisinage du Soleil et masque la frontière artificielle du catalogue', () => {
    expect(getHeliocentricCatalogObserverOpacity(0, 2_000)).toBe(1);
    expect(getHeliocentricCatalogObserverOpacity(1_100, 2_000)).toBe(1);
    expect(getHeliocentricCatalogObserverOpacity(1_360, 2_000)).toBeGreaterThan(0);
    expect(getHeliocentricCatalogObserverOpacity(1_360, 2_000)).toBeLessThan(1);
    expect(getHeliocentricCatalogObserverOpacity(1_600, 2_000)).toBe(0);
    expect(getHeliocentricCatalogObserverOpacity(3_000, 2_000)).toBe(0);
  });

  it('tolère les mesures invalides sans faire disparaître le catalogue', () => {
    expect(getHeliocentricCatalogObserverOpacity(Number.NaN, 2_000)).toBe(1);
    expect(getHeliocentricCatalogObserverOpacity(100, 0)).toBe(1);
    expect(getHeliocentricCatalogObserverOpacity(100, Number.POSITIVE_INFINITY)).toBe(1);
  });

  it('peut conserver un plancher distant borné pour un fond incomplet explicite', () => {
    expect(getHeliocentricCatalogObserverOpacity(3_000, 2_000, 0.12)).toBeCloseTo(0.12);
    expect(getHeliocentricCatalogObserverOpacity(0, 2_000, 0.12)).toBe(1);
    expect(getHeliocentricCatalogObserverOpacity(3_000, 2_000, -1)).toBe(0);
    expect(getHeliocentricCatalogObserverOpacity(3_000, 2_000, 2)).toBe(1);
  });
});
