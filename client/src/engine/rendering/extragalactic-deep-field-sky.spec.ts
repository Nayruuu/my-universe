import * as THREE from 'three';
import {
  calculateExtragalacticDeepFieldOpacity,
  ExtragalacticDeepFieldSky,
  getExtragalacticDeepFieldProfile,
} from './extragalactic-deep-field-sky';

describe('ExtragalacticDeepFieldSky', () => {
  it('construit une voûte procédurale réservée aux vues extérieures des galaxies', () => {
    const sky = new ExtragalacticDeepFieldSky();
    const { material } = sky.mesh;

    expect(sky.mesh).toBeInstanceOf(THREE.Mesh);
    expect(sky.mesh.name).toBe('illustrative-extragalactic-deep-field-sky');
    expect(sky.mesh.visible).toBe(false);
    expect(sky.mesh.frustumCulled).toBe(false);
    expect(sky.mesh.renderOrder).toBe(-100);
    expect(sky.mesh.userData).toMatchObject({
      scientificConfidence: 'illustrative',
      catalogAssociation: 'none',
      sceneRole: 'galaxy-scale-unresolved-deep-field-background',
      scaleScope: 'external-galaxy-views-only',
      representationTechnique: 'single-procedural-spherical-shader-draw',
      observerAnchoring: 'camera-centered-celestial-sphere',
      motionModel: 'fixed-sky-directions-without-translational-parallax',
      rasterAtlas: 'none',
      visualStyle: 'deep-indigo-violet-cosmic-ribbon-with-unresolved-galaxy-grain',
      populationTreatment:
        'procedural-illustration-of-unresolved-distant-galaxy-light-not-a-catalogue',
      sphereRadius: 160_000,
      quality: 'medium',
      detailStrength: 0.78,
      chromaStrength: 0.92,
    });
    expect(sky.mesh.geometry).toBeInstanceOf(THREE.SphereGeometry);
    expect(material.side).toBe(THREE.BackSide);
    expect(material.blending).toBe(THREE.NormalBlending);
    expect(material.depthTest).toBe(false);
    expect(material.depthWrite).toBe(false);
    expect(material.toneMapped).toBe(false);
    expect(material.vertexShader).toContain('skyDirection');
    expect(material.fragmentShader).toContain('float layeredStructure');
    expect(material.fragmentShader).toContain('float unresolvedGalaxyLayer');
    expect(material.fragmentShader).toContain('float fineGalaxies');
    expect(material.fragmentShader).toContain('float brightGalaxies');
    expect(material.fragmentShader).toContain('float darkRift');
    expect(material.fragmentShader).toContain('vec3 cobalt');
    expect(material.fragmentShader).toContain('vec3 violet');
    expect(material.fragmentShader).toContain('vec3 dustyRose');

    sky.dispose();
  });

  it('adapte ses détails à la qualité, suit la caméra et amortit sa visibilité', () => {
    const sky = new ExtragalacticDeepFieldSky();
    const parent = new THREE.Group();
    const geometryDispose = vi.spyOn(sky.mesh.geometry, 'dispose');
    const materialDispose = vi.spyOn(sky.mesh.material, 'dispose');

    parent.add(sky.mesh);
    sky.setQuality('low');
    expect(uniformNumber(sky.mesh.material, 'detailStrength')).toBe(0.55);
    expect(uniformNumber(sky.mesh.material, 'chromaStrength')).toBe(0.82);
    sky.setQuality('high');
    expect(uniformNumber(sky.mesh.material, 'detailStrength')).toBe(1);
    expect(uniformNumber(sky.mesh.material, 'chromaStrength')).toBe(1);
    sky.setObserverPosition(new THREE.Vector3(14, -8, 23));
    expect(sky.mesh.position.toArray()).toEqual([14, -8, 23]);

    sky.update(calculateExtragalacticDeepFieldOpacity(12_000), 0, 0);
    expect(sky.mesh.visible).toBe(false);
    sky.update(calculateExtragalacticDeepFieldOpacity(12_000), 10, 0);
    expect(sky.mesh.visible).toBe(true);
    expect(uniformNumber(sky.mesh.material, 'opacity')).toBeCloseTo(0.58, 6);
    expect(uniformNumber(sky.mesh.material, 'radiance')).toBe(0.5);
    sky.update(1, 10, 2);
    expect(uniformNumber(sky.mesh.material, 'opacity')).toBeCloseTo(1, 6);
    expect(uniformNumber(sky.mesh.material, 'radiance')).toBe(1.5);
    sky.update(0, 10, 1);
    expect(sky.mesh.visible).toBe(false);

    sky.dispose();
    expect(sky.mesh.parent).toBeNull();
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
  });

  it('reste absente de la Voie lactée et décrit une enveloppe extragalactique continue', () => {
    expect(getExtragalacticDeepFieldProfile('low')).toEqual({
      detailStrength: 0.55,
      chromaStrength: 0.82,
    });
    expect(getExtragalacticDeepFieldProfile('medium')).toEqual({
      detailStrength: 0.78,
      chromaStrength: 0.92,
    });
    expect(getExtragalacticDeepFieldProfile('high')).toEqual({
      detailStrength: 1,
      chromaStrength: 1,
    });
    expect(calculateExtragalacticDeepFieldOpacity(0)).toBe(0);
    expect(calculateExtragalacticDeepFieldOpacity(3_600)).toBe(0);
    expect(calculateExtragalacticDeepFieldOpacity(5_800)).toBe(0);
    expect(calculateExtragalacticDeepFieldOpacity(8_900)).toBeCloseTo(0.29, 8);
    expect(calculateExtragalacticDeepFieldOpacity(12_000)).toBeCloseTo(0.58, 8);
    expect(calculateExtragalacticDeepFieldOpacity(45_000)).toBeCloseTo(0.58, 8);
    expect(calculateExtragalacticDeepFieldOpacity(60_000)).toBeCloseTo(0.29, 8);
    expect(calculateExtragalacticDeepFieldOpacity(75_000)).toBe(0);
    expect(calculateExtragalacticDeepFieldOpacity(-1)).toBe(0);
    expect(calculateExtragalacticDeepFieldOpacity(Number.NaN)).toBe(0);
    expect(calculateExtragalacticDeepFieldOpacity(Number.POSITIVE_INFINITY)).toBe(0);

    for (const boundary of [5_800, 12_000, 45_000, 75_000]) {
      const before = calculateExtragalacticDeepFieldOpacity(boundary - 0.01);
      const after = calculateExtragalacticDeepFieldOpacity(boundary + 0.01);

      expect(Math.abs(after - before)).toBeLessThan(0.001);
    }
  });
});

function uniformNumber(material: THREE.ShaderMaterial, name: string): number {
  return material.uniforms[name]!.value as number;
}
