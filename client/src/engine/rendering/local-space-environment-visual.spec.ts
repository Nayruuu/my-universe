import * as THREE from 'three';
import {
  applyLocalSpaceVisualProfile,
  createLocalSpaceEnvironmentVisual,
} from './local-space-environment-visual';

describe('LocalSpaceEnvironmentVisual', () => {
  it('construit les trois couches GPU et applique leur profil cinématique', () => {
    const visual = createLocalSpaceEnvironmentVisual({
      galacticDetail: 0.78,
      zodiacalGrain: 0.7,
      coronaRayStrength: 0.56,
    });

    expect(visual.galacticBand).toBeInstanceOf(THREE.Mesh);
    expect(visual.zodiacalLight).toBeInstanceOf(THREE.Mesh);
    expect(visual.solarCorona).toBeInstanceOf(THREE.Sprite);
    expect(visual.galacticBand.userData).toMatchObject({
      scientificConfidence: 'illustrative',
      physicalPhenomenon: 'integrated-milky-way-light-and-dust',
      sourceCredit: 'ESO/S. Brunier',
      displayGrade: 'eso-photographic-neutral-warm-v4',
    });
    expect(visual.coronaTexture.userData['visualLayers']).toEqual([
      'warmCore',
      'softHalo',
      'coronaRays',
    ]);

    applyLocalSpaceVisualProfile(visual, {
      galacticDetail: 1,
      zodiacalGrain: 1,
      coronaRayStrength: 0.82,
    });

    expect(visual.galacticBandMaterial.uniforms['detailStrength']!.value).toBe(1);
    expect(visual.galacticBandMaterial.uniforms['panoramaBlend']!.value).toBe(0);
    expect(visual.galacticBandMaterial.fragmentShader).toContain(
      'photographicMix = panoramaReady * panoramaBlend',
    );
    expect(visual.galacticBandMaterial.fragmentShader).toContain(
      'mix(panoramaGray, panoramaColor, 1.12)',
    );
    expect(visual.zodiacalMaterial.uniforms['grainStrength']!.value).toBe(1);
    expect(visual.coronaMaterial.color.g).toBeCloseTo(0.82 + 0.82 * 0.14);
    expect(visual.coronaMaterial.color.b).toBeCloseTo(0.66 + 0.82 * 0.26);
  });
});
