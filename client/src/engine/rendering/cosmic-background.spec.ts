import * as THREE from 'three';
import {
  CosmicBackground,
  createCosmicBackgroundSample,
  sampleCosmicBackground,
} from './cosmic-background';

describe('fond cosmique continu', () => {
  it('définit une palette sombre distincte aux principales échelles', () => {
    const planetary = sampleCosmicBackground(4.8, createCosmicBackgroundSample());
    const stellar = sampleCosmicBackground(1_400, createCosmicBackgroundSample());
    const galactic = sampleCosmicBackground(9_600, createCosmicBackgroundSample());
    const cosmic = sampleCosmicBackground(420_000, createCosmicBackgroundSample());

    expect(planetary.upperColor.getHexString()).toBe('01030a');
    expect(planetary.lowerColor.getHexString()).toBe('020817');
    expect(stellar.lowerColor.getHexString()).toBe('081323');
    expect(galactic.lowerColor.getHexString()).toBe('0a1023');
    expect(cosmic.lowerColor.getHexString()).toBe('090718');
    expect(galactic.hazeStrength).toBeGreaterThan(planetary.hazeStrength);
    expect(galactic.nebulaStrength).toBeGreaterThan(planetary.nebulaStrength);
    expect(galactic.dustStrength).toBeGreaterThan(planetary.dustStrength);
    expect(galactic.accentColor.getHexString()).not.toBe(galactic.hazeColor.getHexString());
    expect(cosmic.vignetteStrength).toBeGreaterThan(planetary.vignetteStrength);
  });

  it('interpole selon la distance logarithmique sans saut aux frontières de LOD', () => {
    const beforeBoundary = sampleCosmicBackground(11_999, createCosmicBackgroundSample());
    const afterBoundary = sampleCosmicBackground(12_001, createCosmicBackgroundSample());
    const midpoint = sampleCosmicBackground(
      Math.sqrt(1_400 * 9_600),
      createCosmicBackgroundSample(),
    );
    const stellar = sampleCosmicBackground(1_400, createCosmicBackgroundSample());
    const galactic = sampleCosmicBackground(9_600, createCosmicBackgroundSample());

    expect(colorDistance(beforeBoundary.upperColor, afterBoundary.upperColor)).toBeLessThan(0.001);
    expect(Math.abs(beforeBoundary.hazeStrength - afterBoundary.hazeStrength)).toBeLessThan(0.001);
    expect(midpoint.hazeStrength).toBeCloseTo(
      (stellar.hazeStrength + galactic.hazeStrength) / 2,
      8,
    );
  });

  it('borne les distances invalides ou extérieures à la carte', () => {
    const planetary = sampleCosmicBackground(4.8, createCosmicBackgroundSample());
    const cosmic = sampleCosmicBackground(420_000, createCosmicBackgroundSample());

    expect(sampleCosmicBackground(-10, createCosmicBackgroundSample())).toEqual(planetary);
    expect(sampleCosmicBackground(Number.NaN, createCosmicBackgroundSample())).toEqual(planetary);
    expect(
      sampleCosmicBackground(Number.POSITIVE_INFINITY, createCosmicBackgroundSample()),
    ).toEqual(cosmic);
  });

  it('amortit les couleurs et les détails dans un unique rectangle GPU', () => {
    const background = new CosmicBackground();
    const material = background.mesh.material;
    const initialUpper = uniformColor(material, 'upperColor').clone();
    const target = sampleCosmicBackground(9_600, createCosmicBackgroundSample());

    expect(background.mesh.name).toBe('scale-aware-cosmic-background');
    expect(background.mesh.renderOrder).toBeLessThan(0);
    expect(background.mesh.frustumCulled).toBe(false);
    expect(background.mesh.userData['scientificConfidence']).toBe('illustrative');
    expect(background.mesh.userData['transitionDriver']).toBe('continuous-camera-distance');
    expect(material.depthTest).toBe(false);
    expect(material.depthWrite).toBe(false);
    expect(material.transparent).toBe(false);
    expect(material.toneMapped).toBe(false);
    expect(material.fragmentShader).toContain('nebulaStrength');
    expect(material.fragmentShader).toContain('dustStrength');
    expect(material.fragmentShader).toContain('accentColor');
    expect(background.mesh.geometry.getAttribute('position').count).toBe(6);

    background.update(9_600, 1 / 60);
    const transitioningUpper = uniformColor(material, 'upperColor');

    expect(colorDistance(transitioningUpper, initialUpper)).toBeGreaterThan(0);
    expect(colorDistance(transitioningUpper, target.upperColor)).toBeGreaterThan(0);

    background.update(9_600, 10);
    expect(colorDistance(uniformColor(material, 'upperColor'), target.upperColor)).toBeLessThan(
      0.000_001,
    );
    expect(uniformNumber(material, 'nebulaStrength')).toBeCloseTo(target.nebulaStrength, 6);
    expect(uniformNumber(material, 'dustStrength')).toBeCloseTo(target.dustStrength, 6);
    expect(colorDistance(uniformColor(material, 'accentColor'), target.accentColor)).toBeLessThan(
      0.000_001,
    );

    const mediumDetail = uniformNumber(material, 'detailStrength');

    background.setQuality('low');
    background.update(9_600, 10);
    expect(uniformNumber(material, 'detailStrength')).toBeLessThan(mediumDetail);

    background.setQuality('high');
    background.update(9_600, 10);
    expect(uniformNumber(material, 'detailStrength')).toBeGreaterThan(mediumDetail);
  });

  it('conserve son état sans temps écoulé et libère ses ressources', () => {
    const background = new CosmicBackground();
    const material = background.mesh.material;
    const before = uniformColor(material, 'lowerColor').clone();
    const geometryDispose = vi.spyOn(background.mesh.geometry, 'dispose');
    const materialDispose = vi.spyOn(material, 'dispose');

    background.update(420_000, 0);
    expect(uniformColor(material, 'lowerColor')).toEqual(before);

    background.dispose();
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
  });
});

function uniformColor(material: THREE.ShaderMaterial, name: string): THREE.Color {
  return material.uniforms[name]!.value as THREE.Color;
}

function uniformNumber(material: THREE.ShaderMaterial, name: string): number {
  return material.uniforms[name]!.value as number;
}

function colorDistance(left: THREE.Color, right: THREE.Color): number {
  return Math.hypot(left.r - right.r, left.g - right.g, left.b - right.b);
}
