import * as THREE from 'three';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import { type CosmicWebVolume } from '../loaders/cosmic-web-volume';
import {
  CosmicWebVolumeRenderer,
  getCosmicWebVolumeProfile,
  getCosmicWebVolumeTargetOpacity,
} from './cosmic-web-volume';

describe('CosmicWebVolumeRenderer', () => {
  it('adapte le coût et la finesse du ray marching à la qualité', () => {
    const low = getCosmicWebVolumeProfile('low');
    const medium = getCosmicWebVolumeProfile('medium');
    const high = getCosmicWebVolumeProfile('high');

    expect(low.stepCount).toBe(16);
    expect(medium.stepCount).toBe(26);
    expect(high.stepCount).toBe(40);
    expect(low.stepCount).toBeLessThan(medium.stepCount);
    expect(medium.stepCount).toBeLessThan(high.stepCount);
    expect(low.emptySpaceLeap).toBeGreaterThan(medium.emptySpaceLeap);
    expect(medium.emptySpaceLeap).toBeGreaterThan(high.emptySpaceLeap);
    expect(high.emptySpaceLeap).toBeGreaterThan(1);
    expect(low.densityThreshold).toBeGreaterThan(high.densityThreshold);
    expect(low.maximumOpacity).toBeLessThan(high.maximumOpacity);
    expect(high.densityThreshold).toBeLessThanOrEqual(0.05);
    expect(high.absorption).toBeGreaterThanOrEqual(8);
    expect(high.maximumOpacity).toBeLessThanOrEqual(0.35);
    expect(getCosmicWebVolumeTargetOpacity(140_000, high)).toBe(0);
    expect(getCosmicWebVolumeTargetOpacity(230_000, high)).toBeGreaterThan(0);
    expect(getCosmicWebVolumeTargetOpacity(230_000, high)).toBeLessThan(high.maximumOpacity);
    expect(getCosmicWebVolumeTargetOpacity(420_000, high)).toBe(high.maximumOpacity);
  });

  it('construit un unique volume GPU, le masque par couche et libère ses ressources', () => {
    const renderer = new CosmicWebVolumeRenderer(createVolume(), new CoordinateSystem(), 'medium');
    const texture = renderer.material.uniforms['densityTexture']!.value as THREE.Data3DTexture;

    expect(renderer.mesh).toBeInstanceOf(THREE.Mesh);
    expect(texture).toBeInstanceOf(THREE.Data3DTexture);
    expect(texture.image.width).toBe(8);
    expect(renderer.material.fragmentShader).toContain('#define gl_FragColor fragmentColor');
    expect(renderer.material.fragmentShader).toContain(
      'distanceAlongRay += rayStep * emptySpaceLeap',
    );
    expect(renderer.material.fragmentShader).toContain('float chromaticVariation');
    expect(renderer.material.fragmentShader).toContain('vec3 warmNodeColor');
    expect(renderer.mesh.scale.toArray()).toEqual([160_000, 160_000, 160_000]);
    expect(renderer.mesh.userData).toMatchObject({
      scientificConfidence: 'simulated',
      sourceGroupCount: 3,
      sourceEdgeCount: 2,
      volumeResolution: 8,
      visualPalette: 'density-driven-cyan-violet-amber',
    });

    renderer.updateDistance(420_000, 10, 1.2);
    expect(renderer.mesh.visible).toBe(true);
    expect(renderer.material.uniforms['volumeOpacity']!.value).toBeCloseTo(
      getCosmicWebVolumeProfile('medium').maximumOpacity,
      5,
    );
    expect(renderer.material.uniforms['radiance']!.value).toBeCloseTo(1.2);

    renderer.setQuality('high');
    expect(renderer.material.uniforms['stepCount']!.value).toBe(
      getCosmicWebVolumeProfile('high').stepCount,
    );
    expect(renderer.material.uniforms['emptySpaceLeap']!.value).toBe(
      getCosmicWebVolumeProfile('high').emptySpaceLeap,
    );
    renderer.setEnabled(false);
    expect(renderer.mesh.visible).toBe(false);
    renderer.setEnabled(true);
    renderer.updateDistance(40_000, 10, 0);
    expect(renderer.mesh.visible).toBe(false);
    expect(renderer.material.uniforms['radiance']!.value).toBe(0.5);

    const geometryDispose = vi.spyOn(renderer.mesh.geometry, 'dispose');
    const materialDispose = vi.spyOn(renderer.material, 'dispose');
    const textureDispose = vi.spyOn(texture, 'dispose');

    renderer.dispose();
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(textureDispose).toHaveBeenCalledOnce();
  });
});

function createVolume(): CosmicWebVolume {
  const density = new Uint8Array(8 ** 3);

  density[8 ** 3 / 2] = 255;

  return {
    resolution: 8,
    halfExtentMpc: 800,
    referenceEpochJulianDay: 2_451_545,
    sourceGroupCount: 3,
    sourceEdgeCount: 2,
    density,
  };
}
