import { getBlackHoleVisualProfile } from './black-hole-visual-profile';

describe('profil visuel des trous noirs', () => {
  it('conserve un objet dormant sombre avec une lentille locale discrète', () => {
    const profile = getBlackHoleVisualProfile('dormant', 'high');

    expect(profile).toMatchObject({
      activity: 'dormant',
      showAccretionDisk: false,
      showJets: false,
      diskOpacity: 0,
      jetOpacity: 0,
    });
    expect(profile.lensingOpacity).toBeGreaterThan(0);
    expect(profile.lensingOpacity).toBeLessThanOrEqual(0.04);
    expect(profile.photonRingOpacity).toBeGreaterThan(0);
    expect(profile.photonRingOpacity).toBeLessThanOrEqual(0.12);
  });

  it('représente un noyau quiescent sans lui inventer de jets', () => {
    const profile = getBlackHoleVisualProfile('quiescent', 'medium');

    expect(profile.showAccretionDisk).toBe(true);
    expect(profile.showJets).toBe(false);
    expect(profile.diskOpacity).toBeGreaterThan(0);
    expect(profile.diskOpacity).toBeLessThan(0.2);
    expect(profile.jetOpacity).toBe(0);
  });

  it('réserve les jets visibles aux systèmes actifs en qualité moyenne ou haute', () => {
    expect(getBlackHoleVisualProfile('active', 'low').showJets).toBe(false);
    expect(getBlackHoleVisualProfile('active', 'medium').showJets).toBe(true);
    const activeHigh = getBlackHoleVisualProfile('active', 'high');

    expect(activeHigh.showJets).toBe(true);
    expect(activeHigh.jetOpacity).toBeLessThanOrEqual(0.18);
    expect(activeHigh.jetLength).toBeLessThanOrEqual(5);
    expect(activeHigh.diskScale).toBeLessThanOrEqual(1.2);
  });

  it('augmente progressivement le budget visuel sans modifier la nature de la source', () => {
    for (const activity of ['dormant', 'quiescent', 'active'] as const) {
      const low = getBlackHoleVisualProfile(activity, 'low');
      const medium = getBlackHoleVisualProfile(activity, 'medium');
      const high = getBlackHoleVisualProfile(activity, 'high');

      expect(low.activity).toBe(activity);
      expect(low.lensingOpacity).toBeLessThan(medium.lensingOpacity);
      expect(medium.lensingOpacity).toBeLessThan(high.lensingOpacity);
      expect(low.photonRingOpacity).toBeLessThan(medium.photonRingOpacity);
      expect(medium.photonRingOpacity).toBeLessThan(high.photonRingOpacity);
      expect(low.segmentCount).toBeLessThan(medium.segmentCount);
      expect(medium.segmentCount).toBeLessThan(high.segmentCount);
    }
  });
});
