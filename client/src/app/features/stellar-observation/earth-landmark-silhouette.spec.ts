import {
  createEarthLandmarkSilhouette,
  EARTH_LANDMARK_SILHOUETTE_FAMILIES,
  type EarthLandmarkSilhouetteFamily,
} from './earth-landmark-silhouette';

describe('générateur compact de silhouettes de monuments', () => {
  const families: readonly EarthLandmarkSilhouetteFamily[] = [
    'skyscraper',
    'tower',
    'bridge',
    'monument',
    'religious',
    'palace',
    'stadium',
    'historic-building',
    'mountain-natural',
    'generic-landmark',
    'cathedral',
    'mosque',
    'pagoda',
    'triumphal-arch',
    'obelisk',
    'statue',
    'suspension-bridge',
    'arch-bridge',
  ];

  it('expose toutes les familles prises en charge sans doublon', () => {
    expect(EARTH_LANDMARK_SILHOUETTE_FAMILIES).toEqual(families);
    expect(new Set(EARTH_LANDMARK_SILHOUETTE_FAMILIES).size).toBe(families.length);
  });

  it('produit une silhouette opaque, non triviale et distincte pour chaque famille', () => {
    const silhouettes = families.map((family) =>
      createEarthLandmarkSilhouette({
        family,
        id: `fixture-${family}`,
        seed: 42,
        height: 240,
        aspectRatio: 1.25,
      }),
    );

    for (const silhouette of silhouettes) {
      expect(silhouette.width).toBe(300);
      expect(silhouette.height).toBe(240);
      expect(silhouette.viewBox).toBe('0 0 300 240');
      expect(silhouette.path.startsWith('M')).toBe(true);
      expect(silhouette.path.length).toBeGreaterThan(60);
      expect(silhouette.path).not.toMatch(/NaN|Infinity/);
      expect(silhouette.fill).toBe('#050a11');
      expect(silhouette.fillRule).toBe('nonzero');
      expect(silhouette.opacity).toBe(1);
    }

    expect(new Set(silhouettes.map(({ path }) => path)).size).toBe(families.length);
  });

  it('est déterministe pour un identifiant et une graine donnés', () => {
    const options = {
      family: 'historic-building' as const,
      id: 'notre-dame-de-paris',
      seed: 2026,
      height: 180,
      aspectRatio: 1.8,
    };

    expect(createEarthLandmarkSilhouette(options)).toEqual(createEarthLandmarkSilhouette(options));
    expect(createEarthLandmarkSilhouette({ ...options, seed: 2027 }).path).not.toBe(
      createEarthLandmarkSilhouette(options).path,
    );
  });

  it("utilise l'identifiant comme graine lorsque la graine explicite est absente", () => {
    const alpha = createEarthLandmarkSilhouette({
      family: 'tower',
      id: 'alpha-tower',
    });
    const alphaAgain = createEarthLandmarkSilhouette({
      family: 'tower',
      id: 'alpha-tower',
    });
    const beta = createEarthLandmarkSilhouette({
      family: 'tower',
      id: 'beta-tower',
    });

    expect(alpha).toEqual(alphaAgain);
    expect(alpha.path).not.toBe(beta.path);
  });

  it('respecte la hauteur et le rapport demandés dans leurs limites', () => {
    expect(
      createEarthLandmarkSilhouette({
        family: 'bridge',
        id: 'wide-bridge',
        height: 128,
        aspectRatio: 3.5,
      }),
    ).toMatchObject({ height: 128, width: 448, viewBox: '0 0 448 128' });

    expect(
      createEarthLandmarkSilhouette({
        family: 'skyscraper',
        id: 'bounded-skyscraper',
        height: 1_000,
        aspectRatio: 0.05,
      }),
    ).toMatchObject({ height: 512, width: 128, viewBox: '0 0 128 512' });
  });

  it('retombe sur des dimensions sûres lorsque les paramètres sont invalides', () => {
    expect(
      createEarthLandmarkSilhouette({
        family: 'generic-landmark',
        id: 'fallback',
        height: Number.NaN,
        aspectRatio: Number.POSITIVE_INFINITY,
      }),
    ).toMatchObject({ height: 200, width: 200, viewBox: '0 0 200 200' });
  });
});
