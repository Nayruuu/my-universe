import {
  getStellarVisualProfile,
  getStellarVisualProfileFromTemperature,
} from './stellar-visual-profile';

describe('getStellarVisualProfile', () => {
  it.each([
    ['O5V', -0.3, 'blue-white'],
    ['b2 iv', -0.1, 'blue-white'],
    ['A0', 0, 'blue-white'],
    ['DA2', 0.05, 'white-dwarf'],
    ['F8V', 0.55, 'yellow-dwarf'],
    ['G2V', 0.65, 'yellow-dwarf'],
    ['K5V', 1.15, 'orange-dwarf'],
    ['M4V', 1.65, 'red-dwarf'],
    ['M2IV', 1.5, 'red-dwarf'],
    ['K3III', 1.3, 'red-giant'],
    ['M2 Iab', 1.8, 'red-supergiant'],
    ['M1Ib-II', 1.7, 'red-supergiant'],
    ['L2', 1.9, 'brown-dwarf'],
    ['T8', 2, 'brown-dwarf'],
    ['Y0', 2.1, 'brown-dwarf'],
  ] as const)('maps %s to the %s visual family', (spectralType, colorIndex, family) => {
    expect(getStellarVisualProfile(spectralType, colorIndex).family).toBe(family);
  });

  it.each([
    [null, -0.2, 'blue-white'],
    ['', 0.4, 'yellow-dwarf'],
    ['?', 1.1, 'orange-dwarf'],
    ['carbon', 1.8, 'red-dwarf'],
    [null, Number.NaN, 'yellow-dwarf'],
  ] as const)('falls back from %s and B−V %s to %s', (spectralType, colorIndex, family) => {
    expect(getStellarVisualProfile(spectralType, colorIndex).family).toBe(family);
  });

  it.each([
    [12_000, 'blue-white'],
    [7_800, 'blue-white'],
    [5_778, 'yellow-dwarf'],
    [4_500, 'orange-dwarf'],
    [3_200, 'red-dwarf'],
    [1_800, 'brown-dwarf'],
    [Number.NaN, 'yellow-dwarf'],
  ] as const)('maps %s K to the %s visual family', (temperatureKelvin, family) => {
    expect(getStellarVisualProfileFromTemperature(temperatureKelvin).family).toBe(family);
  });

  it('keeps every surface parameter inside a bounded visual budget', () => {
    const profiles = [
      getStellarVisualProfile('B1V', -0.2),
      getStellarVisualProfile('DA2', 0),
      getStellarVisualProfile('G2V', 0.65),
      getStellarVisualProfile('K7V', 1.35),
      getStellarVisualProfile('M8V', 1.95),
      getStellarVisualProfile('K3III', 1.3),
      getStellarVisualProfile('M2Iab', 1.8),
      getStellarVisualProfile('L3', 2),
    ];

    for (const profile of profiles) {
      expect(profile.shaderIndex).toBeGreaterThanOrEqual(0);
      expect(profile.shaderIndex).toBeLessThanOrEqual(7);
      expect(profile.cellScale).toBeGreaterThanOrEqual(5);
      expect(profile.cellScale).toBeLessThanOrEqual(34);
      expect(profile.surfaceContrast).toBeGreaterThan(0);
      expect(profile.surfaceContrast).toBeLessThanOrEqual(0.68);
      expect(profile.faculaStrength).toBeGreaterThanOrEqual(0.08);
      expect(profile.faculaStrength).toBeLessThanOrEqual(0.72);
      expect(profile.coronaStrength).toBeGreaterThanOrEqual(0.26);
      expect(profile.coronaStrength).toBeLessThanOrEqual(1.35);
      expect(profile.spotStrength).toBeGreaterThanOrEqual(0.02);
      expect(profile.spotStrength).toBeLessThanOrEqual(0.44);
      expect(profile.visualScale).toBeGreaterThanOrEqual(0.68);
      expect(profile.visualScale).toBeLessThanOrEqual(1.3);
    }

    const blueWhite = profiles[0]!;
    const whiteDwarf = profiles[1]!;
    const redDwarf = profiles[4]!;
    const redSupergiant = profiles[6]!;

    expect(whiteDwarf.cellScale).toBeGreaterThan(redSupergiant.cellScale);
    expect(redSupergiant.visualScale).toBeGreaterThan(redDwarf.visualScale);
    expect(blueWhite.coronaStrength).toBeGreaterThan(redDwarf.coronaStrength);
    expect(redDwarf.surfaceContrast).toBeGreaterThan(blueWhite.surfaceContrast);
  });
});
