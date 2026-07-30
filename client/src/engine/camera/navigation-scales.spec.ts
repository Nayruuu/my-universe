import {
  getNavigationScale,
  getNavigationScaleForLod,
  NAVIGATION_SCALES,
} from './navigation-scales';

describe('cadrages des échelles de navigation', () => {
  it('définit sept distances croissantes associées aux sept LOD', () => {
    expect(NAVIGATION_SCALES.map((scale) => scale.lodLevel)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(NAVIGATION_SCALES.map((scale) => scale.distance)).toEqual(
      [...NAVIGATION_SCALES].map((scale) => scale.distance).sort((left, right) => left - right),
    );
  });

  it('retrouve une échelle par identifiant ou niveau de détail', () => {
    expect(getNavigationScale('stellar-neighborhood').targetId).toBe('sun');
    expect(getNavigationScaleForLod(3).id).toBe('milky-way');
    expect(getNavigationScale('local-group').targetId).toBe('local-group');
    expect(getNavigationScaleForLod(4).id).toBe('local-group');
    expect(getNavigationScale('nearby-universe').targetId).toBe('nearby-universe');
    expect(getNavigationScaleForLod(5).id).toBe('nearby-universe');
    expect(getNavigationScale('cosmic-web')).toEqual(
      expect.objectContaining({
        targetId: 'cosmic-web',
        label: 'Réseau cosmique',
        lodLevel: 6,
      }),
    );
    expect(getNavigationScaleForLod(6).id).toBe('cosmic-web');
    expect(getNavigationScaleForLod(12).id).toBe('cosmic-web');
    expect(getNavigationScaleForLod(-4).id).toBe('planetary');
  });

  it('rejette un identifiant inconnu et replie un LOD non numérique', () => {
    expect(() =>
      getNavigationScale('unknown' as unknown as Parameters<typeof getNavigationScale>[0]),
    ).toThrow('Échelle de navigation inconnue');
    expect(getNavigationScaleForLod(Number.NaN).id).toBe('planetary');
  });
});
