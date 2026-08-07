import * as THREE from 'three';
import {
  applyStellarPhotosphereAppearance,
  createStellarPhotosphereMaterial,
  type StellarPhotosphereAppearance,
} from './stellar-photosphere-material';
import { getStellarVisualProfile } from './stellar-visual-profile';

describe('matériau de photosphère stellaire', () => {
  const appearance: StellarPhotosphereAppearance = {
    color: '#fff1c2',
    profile: getStellarVisualProfile('G2V', 0.65),
    surfaceSeed: 0.42,
    opacity: 1,
    granulationStrength: 0.28,
  };

  it('applique une radiance neutre par défaut et accepte une intensité émissive explicite', () => {
    const material = createStellarPhotosphereMaterial(appearance);

    expect(material.uniforms['surfaceRadiance']?.value).toBe(1);

    applyStellarPhotosphereAppearance(material, { ...appearance, radiance: 1.6 });
    expect(material.uniforms['surfaceRadiance']?.value).toBe(1.6);

    applyStellarPhotosphereAppearance(material, appearance);
    expect(material.uniforms['surfaceRadiance']?.value).toBe(1);

    material.dispose();
  });

  it('reste compatible avec un ancien shader sans uniforme de radiance', () => {
    const material = createStellarPhotosphereMaterial(appearance);

    delete material.uniforms['surfaceRadiance'];
    expect(() => applyStellarPhotosphereAppearance(material, appearance)).not.toThrow();
    expect(material).toBeInstanceOf(THREE.ShaderMaterial);

    material.dispose();
  });
});
