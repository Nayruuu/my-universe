import * as THREE from 'three';
import { calculateMilkyWaySceneScale } from '../coordinates/galaxy-scale-model';
import { calculateMilkyWayStellarHaloOpacity, MilkyWayStellarHalo } from './milky-way-stellar-halo';

describe('MilkyWayStellarHalo', () => {
  it('construit un environnement stellaire étendu, discontinu et explicitement illustratif', () => {
    const halo = new MilkyWayStellarHalo();
    const { points } = halo;
    const positions = points.geometry.getAttribute('position');
    const clusterMembership = points.geometry.getAttribute('clusterMembership');

    expect(points.name).toBe('illustrative-milky-way-stellar-halo');
    expect(points.visible).toBe(false);
    expect(points.frustumCulled).toBe(false);
    expect(points.renderOrder).toBe(2);
    expect(points.userData).toMatchObject({
      scientificConfidence: 'illustrative',
      visualRole: 'sparse-galactic-surroundings',
      representationTechnique: 'single-batched-static-point-cloud',
      distribution: 'oblate-mixed-power-law-envelope-with-batched-globular-like-concentrations',
      physicalInterpretation: 'uncatalogued-stellar-halo-and-globular-cluster-visual-cues',
      motionModel: 'fixed-galactocentric-points-with-perspective-only-parallax',
      diffuseEmission: 'none',
      fogContribution: 'none',
      colorTreatment: 'old-ivory-amber-population-with-sparse-blue-and-red-stars',
      clusterCount: 48,
      clusterParticleFraction: 1 / 8,
      verticalFlattening: 0.78,
      quality: 'medium',
      qualityDensityCompensation: 1.28,
    });
    expect(points.userData['authoringInnerRadius']).toBeCloseTo(3_876, 8);
    expect(points.userData['authoringOuterRadius']).toBeCloseTo(12_540, 8);
    expect(positions.count).toBe(48_000);
    expect(points.geometry.getAttribute('color').count).toBe(48_000);
    expect(points.geometry.getAttribute('pointSize').count).toBe(48_000);
    expect(points.geometry.getAttribute('pointAlpha').count).toBe(48_000);
    expect(clusterMembership.count).toBe(48_000);
    expect(Array.from(clusterMembership.array).filter((value) => value === 1)).toHaveLength(6_000);
    expect(points.geometry.drawRange.count).toBe(26_000);
    expect(countOutsideDiscRadius(positions, 5_700)).toBeGreaterThan(24_000);
    points.geometry.computeBoundingBox();
    expect(points.geometry.boundingBox!.max.x - points.geometry.boundingBox!.min.x).toBeGreaterThan(
      18_000,
    );
    expect(points.geometry.boundingBox!.max.y - points.geometry.boundingBox!.min.y).toBeGreaterThan(
      13_000,
    );
    expect(points.material.vertexShader).toContain('perspectiveGrowth');
    expect(points.material.vertexShader).not.toContain('travelMotion');
    expect(points.material.fragmentShader).toContain('compactHalo');
    expect(points.material.fragmentShader).not.toContain('noise');
    expect(points.material.blending).toBe(THREE.AdditiveBlending);

    halo.dispose();
  });

  it('adapte la densité et reste fixe dans le même référentiel que le disque', () => {
    const halo = new MilkyWayStellarHalo();
    const geometryDispose = vi.spyOn(halo.points.geometry, 'dispose');
    const materialDispose = vi.spyOn(halo.points.material, 'dispose');

    halo.setQuality('low');
    expect(halo.points.geometry.drawRange.count).toBe(12_000);
    expect(halo.points.material.uniforms['qualityDensityCompensation']!.value).toBe(1.72);
    halo.setQuality('high');
    expect(halo.points.geometry.drawRange.count).toBe(48_000);
    expect(halo.points.material.uniforms['qualityDensityCompensation']!.value).toBe(1);
    halo.setPixelRatio(3);
    expect(halo.points.material.uniforms['pixelRatio']!.value).toBe(1.5);
    halo.setPixelRatio(0.2);
    expect(halo.points.material.uniforms['pixelRatio']!.value).toBe(0.5);

    const sceneScale = calculateMilkyWaySceneScale(9_000);

    halo.update(calculateMilkyWayStellarHaloOpacity(9_000), 10, sceneScale);
    expect(halo.points.visible).toBe(true);
    expect(halo.points.material.uniforms['opacity']!.value).toBeCloseTo(0.46, 6);
    expect(halo.points.scale.toArray()).toEqual([
      sceneScale.modelScale,
      sceneScale.modelScale,
      sceneScale.modelScale,
    ]);
    expect(halo.points.userData).toMatchObject({
      modelScale: sceneScale.modelScale,
      referenceFrameBlend: sceneScale.referenceFrameBlend,
    });
    expect(halo.points.userData['worldOuterRadius']).toBeCloseTo(12_540 * sceneScale.modelScale, 8);
    halo.update(0, 10, sceneScale);
    expect(halo.points.visible).toBe(false);

    halo.dispose();
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
  });

  it('fait apparaître puis disparaître le halo sans seuil spatial brutal', () => {
    expect(calculateMilkyWayStellarHaloOpacity(0)).toBe(0);
    expect(calculateMilkyWayStellarHaloOpacity(1_200)).toBe(0);
    expect(calculateMilkyWayStellarHaloOpacity(2_200)).toBeCloseTo(0.23, 8);
    expect(calculateMilkyWayStellarHaloOpacity(3_200)).toBeCloseTo(0.46, 8);
    expect(calculateMilkyWayStellarHaloOpacity(9_000)).toBeCloseTo(0.46, 8);
    expect(calculateMilkyWayStellarHaloOpacity(28_000)).toBeCloseTo(0.46, 8);
    expect(calculateMilkyWayStellarHaloOpacity(38_000)).toBeCloseTo(0.23, 8);
    expect(calculateMilkyWayStellarHaloOpacity(48_000)).toBe(0);
    expect(calculateMilkyWayStellarHaloOpacity(-1)).toBe(0);
    expect(calculateMilkyWayStellarHaloOpacity(Number.NaN)).toBe(0);
    expect(calculateMilkyWayStellarHaloOpacity(Number.POSITIVE_INFINITY)).toBe(0);

    for (const boundary of [1_200, 3_200, 28_000, 48_000]) {
      const before = calculateMilkyWayStellarHaloOpacity(boundary - 0.01);
      const after = calculateMilkyWayStellarHaloOpacity(boundary + 0.01);

      expect(Math.abs(after - before)).toBeLessThan(0.001);
    }
  });
});

function countOutsideDiscRadius(
  positions: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  radius: number,
): number {
  let count = 0;

  for (let index = 0; index < positions.count; index += 1) {
    if (Math.hypot(positions.getX(index), positions.getZ(index)) > radius) {
      count += 1;
    }
  }

  return count;
}
