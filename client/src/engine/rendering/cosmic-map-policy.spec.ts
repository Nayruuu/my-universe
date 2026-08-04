import {
  ALL_COSMIC_MAP_LAYERS,
  DEFAULT_COSMIC_MAP_LAYERS,
  getCosmicGroupDetail,
  getCosmicGroupRevealThreshold,
  getCosmicMapDetail,
  getCosmicStructureLayer,
  getCosmicStructureRevealThreshold,
  isCosmicMapLayerEnabled,
  stableMapPriority,
} from './cosmic-map-policy';

describe('politique cartographique du réseau cosmique', () => {
  it('propose une synthèse lisible tout en laissant chaque couche disponible', () => {
    expect(DEFAULT_COSMIC_MAP_LAYERS).toEqual({
      volume: true,
      groups: true,
      links: true,
      clusters: true,
      superclusters: true,
      filaments: false,
      voids: false,
    });
    expect(Object.values(ALL_COSMIC_MAP_LAYERS).every(Boolean)).toBe(true);
  });

  it('révèle progressivement les catalogues quand la caméra se rapproche', () => {
    expect(getCosmicMapDetail(900_000, 'high')).toBeCloseTo(0.018, 6);
    expect(getCosmicMapDetail(420_000, 'high')).toBeCloseTo(0.075, 6);
    expect(getCosmicMapDetail(170_000, 'high')).toBe(1);
    expect(getCosmicMapDetail(1_800_000, 'high')).toBeCloseTo(0.018, 6);
    expect(getCosmicMapDetail(40_000, 'high')).toBe(1);
    expect(getCosmicMapDetail(420_000, 'low')).toBeLessThan(getCosmicMapDetail(420_000, 'medium'));
    expect(getCosmicMapDetail(420_000, 'medium')).toBeLessThan(getCosmicMapDetail(420_000, 'high'));
    expect(getCosmicGroupDetail(420_000, 'high')).toBeCloseTo(0.255, 6);
  });

  it('produit une priorité stable, bornée et indépendante de l’ordre du catalogue', () => {
    const first = stableMapPriority('PGC 42');

    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(1);
    expect(stableMapPriority('PGC 42')).toBe(first);
    expect(stableMapPriority('PGC 43')).not.toBe(first);
    expect(getCosmicGroupRevealThreshold('PGC 42')).toBeGreaterThanOrEqual(first);
    expect(getCosmicGroupRevealThreshold('PGC 42')).toBeLessThanOrEqual(1);
  });

  it('réserve les catalogues redondants et les symboles les plus denses aux vues détaillées', () => {
    const fixedMain = getCosmicStructureRevealThreshold(
      'sdss-structure-1',
      'supercluster',
      'sdss-dr7-main50',
    );
    const adaptiveLrg = getCosmicStructureRevealThreshold(
      'sdss-structure-1',
      'supercluster',
      'sdss-dr7-lrg-adaptive',
    );
    const adaptiveMain = getCosmicStructureRevealThreshold(
      'sdss-structure-1',
      'supercluster',
      'sdss-dr7-main-adaptive',
    );
    const fixedLrg = getCosmicStructureRevealThreshold(
      'sdss-structure-1',
      'supercluster',
      'sdss-dr7-lrg44',
    );
    const unknownSupercluster = getCosmicStructureRevealThreshold(
      'sdss-structure-1',
      'supercluster',
      'future-supercluster-catalog',
    );
    const filament = getCosmicStructureRevealThreshold(
      'structure-1',
      'filament',
      'sdss-dr8-tempel-filaments',
    );
    const cluster = getCosmicStructureRevealThreshold(
      'structure-1',
      'cluster',
      'planck-psz2-clusters',
    );

    expect(adaptiveLrg).toBeGreaterThan(fixedMain);
    expect(adaptiveMain).toBeGreaterThanOrEqual(0.35);
    expect(fixedLrg).toBeGreaterThanOrEqual(0.55);
    expect(unknownSupercluster).toBeGreaterThanOrEqual(0);
    expect(filament).toBeGreaterThan(cluster);
    expect(
      getCosmicStructureRevealThreshold('void-1', 'void', 'boss-dr12-voids'),
    ).toBeLessThanOrEqual(1);
    expect(getCosmicStructureRevealThreshold('wall-1', 'wall', 'future-walls')).toBe(
      stableMapPriority('wall-1'),
    );
  });

  it('associe les types scientifiques à des couches compréhensibles', () => {
    expect(getCosmicStructureLayer('cluster')).toBe('clusters');
    expect(getCosmicStructureLayer('supercluster')).toBe('superclusters');
    expect(getCosmicStructureLayer('wall')).toBe('superclusters');
    expect(getCosmicStructureLayer('basin')).toBe('superclusters');
    expect(getCosmicStructureLayer('attractor')).toBe('superclusters');
    expect(getCosmicStructureLayer('repeller')).toBe('superclusters');
    expect(getCosmicStructureLayer('filament')).toBe('filaments');
    expect(getCosmicStructureLayer('void')).toBe('voids');
    expect(isCosmicMapLayerEnabled('cluster', DEFAULT_COSMIC_MAP_LAYERS)).toBe(true);
    expect(isCosmicMapLayerEnabled('filament', DEFAULT_COSMIC_MAP_LAYERS)).toBe(false);
  });
});
