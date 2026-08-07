import { earthLandmarkSilhouetteProfile } from './earth-landmark-silhouette-profile';

describe('profil visuel des repères terrestres', () => {
  it.each([
    ['St Paul’s Cathedral', 'religious', 'cathedral'],
    ['Sultan Ahmed Mosque', 'religious', 'mosque'],
    ['Five-storey Pagoda', 'religious', 'pagoda'],
    ['Arc de Triomphe', 'monument', 'triumphal-arch'],
    ['Washington Monument', 'monument', 'obelisk'],
    ['Statue of Liberty', 'monument', 'statue'],
    ['Golden Gate Bridge', 'bridge', 'suspension-bridge'],
    ['Roman Aqueduct', 'bridge', 'arch-bridge'],
    ['One World Trade Center', 'tower', 'skyscraper'],
  ] as const)('attribue une silhouette reconnaissable à %s', (name, category, expectedFamily) => {
    expect(earthLandmarkSilhouetteProfile(category, name).family).toBe(expectedFamily);
  });

  it('conserve des profils sûrs pour les catégories sans indice lexical', () => {
    expect(earthLandmarkSilhouetteProfile('palace', 'Royal residence')).toEqual({
      aspectRatio: 1.6,
      family: 'palace',
    });
    expect(earthLandmarkSilhouetteProfile('illustrative-cityscape-anchor', 'City skyline')).toEqual(
      { aspectRatio: 1.2, family: 'generic-landmark' },
    );
  });
});
