import * as THREE from 'three';
import {
  calculateExtragalacticBackgroundOpacity,
  ExtragalacticBackground,
} from './extragalactic-background';

describe('ExtragalacticBackground', () => {
  it('construit un fond de galaxies étendues en un seul lot explicitement illustratif', () => {
    const background = new ExtragalacticBackground();
    const { geometry, material } = background.points;

    expect(background.points).toBeInstanceOf(THREE.Points);
    expect(background.points.name).toBe('illustrative-extragalactic-background');
    expect(background.points.visible).toBe(false);
    expect(background.points.frustumCulled).toBe(false);
    expect(background.points.renderOrder).toBe(0);
    expect(background.points.userData).toMatchObject({
      scientificConfidence: 'illustrative',
      catalogAssociation: 'none',
      sceneRole: 'non-interactive-distant-galaxy-background',
      observerAnchoring: 'camera-centered-celestial-shell',
      motionModel: 'fixed-sky-directions-without-translational-parallax',
      populationTreatment:
        'representative-sample-of-the-cosmological-galaxy-population-not-a-literal-count',
      visualStyle: 'extended-elliptical-spiral-and-irregular-low-surface-brightness-impostors',
      galacticOcclusion: 'illustrative-zone-of-avoidance-from-galactic-latitude',
      shellRadius: 180_000,
      quality: 'medium',
      qualityScale: 1.08,
    });
    expect(geometry.getAttribute('position').count).toBe(52_000);
    expect(geometry.getAttribute('galaxyColor').count).toBe(52_000);
    expect(geometry.getAttribute('galaxySize').count).toBe(52_000);
    expect(geometry.getAttribute('galaxyAlpha').count).toBe(52_000);
    expect(geometry.getAttribute('galaxyAngle').count).toBe(52_000);
    expect(geometry.getAttribute('galaxyAxisRatio').count).toBe(52_000);
    expect(geometry.getAttribute('galaxyProfile').count).toBe(52_000);
    expect(geometry.getAttribute('galaxyProminence').count).toBe(52_000);
    expect(geometry.getAttribute('galaxySeed').count).toBe(52_000);
    expect(geometry.getAttribute('galacticTransmission').count).toBe(52_000);
    expect(geometry.drawRange.count).toBe(24_000);
    expect(material.vertexShader).toContain('galaxyAlpha * galacticTransmission');
    expect(material.fragmentShader).toContain('float spiralArms');
    expect(material.fragmentShader).toContain('float ellipticalLight');
    expect(material.fragmentShader).toContain('float irregularLobe');
    expect(material.fragmentShader).not.toContain('stellarCore');
    expect(material.blending).toBe(THREE.NormalBlending);
    expect(material.depthWrite).toBe(false);

    const positions = geometry.getAttribute('position');
    const sizes = geometry.getAttribute('galaxySize');
    const transmissions = geometry.getAttribute('galacticTransmission');

    for (const index of [0, 1_000, 21_000, 51_999]) {
      expect(
        Math.hypot(positions.getX(index), positions.getY(index), positions.getZ(index)),
      ).toBeCloseTo(180_000, -1);
    }
    expect(minimumAttributeValue(sizes)).toBeGreaterThanOrEqual(2.35);
    expect(maximumAttributeValue(sizes)).toBeGreaterThan(9);
    expect(minimumAttributeValue(transmissions)).toBeCloseTo(0.1, 4);
    expect(maximumAttributeValue(transmissions)).toBeCloseTo(1, 4);

    background.dispose();
  });

  it('adapte la densité, le ratio de pixels et suit exactement la caméra', () => {
    const background = new ExtragalacticBackground();
    const geometryDispose = vi.spyOn(background.points.geometry, 'dispose');
    const materialDispose = vi.spyOn(background.points.material, 'dispose');

    background.setQuality('low');
    expect(background.points.geometry.drawRange.count).toBe(10_000);
    expect(background.points.material.uniforms['qualityScale']!.value).toBe(1.18);
    background.setQuality('high');
    expect(background.points.geometry.drawRange.count).toBe(52_000);
    expect(background.points.material.uniforms['qualityScale']!.value).toBe(1);
    background.setPixelRatio(0.1);
    expect(background.points.material.uniforms['pixelRatio']!.value).toBe(0.5);
    background.setPixelRatio(4);
    expect(background.points.material.uniforms['pixelRatio']!.value).toBe(1.5);
    background.setObserverPosition(new THREE.Vector3(12, -7, 31));
    expect(background.points.position.toArray()).toEqual([12, -7, 31]);

    background.update(calculateExtragalacticBackgroundOpacity(12_000), 0, 0);
    expect(background.points.visible).toBe(false);
    background.update(calculateExtragalacticBackgroundOpacity(12_000), 10, 0);
    expect(background.points.visible).toBe(true);
    expect(background.points.material.uniforms['opacity']!.value).toBeCloseTo(0.62, 6);
    expect(background.points.material.uniforms['radiance']!.value).toBe(0.5);
    background.update(1, 10, 2);
    expect(background.points.material.uniforms['opacity']!.value).toBeCloseTo(1, 6);
    expect(background.points.material.uniforms['radiance']!.value).toBe(1.5);
    background.update(0, 10, 1);
    expect(background.points.visible).toBe(false);

    background.dispose();
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
  });

  it('apparaît et disparaît continûment entre les échelles locales et cosmologiques', () => {
    expect(calculateExtragalacticBackgroundOpacity(0)).toBe(0);
    expect(calculateExtragalacticBackgroundOpacity(1_600)).toBe(0);
    expect(calculateExtragalacticBackgroundOpacity(2_400)).toBeCloseTo(0.31, 8);
    expect(calculateExtragalacticBackgroundOpacity(3_200)).toBeCloseTo(0.62, 8);
    expect(calculateExtragalacticBackgroundOpacity(12_000)).toBeCloseTo(0.62, 8);
    expect(calculateExtragalacticBackgroundOpacity(45_000)).toBeCloseTo(0.62, 8);
    expect(calculateExtragalacticBackgroundOpacity(60_000)).toBeCloseTo(0.31, 8);
    expect(calculateExtragalacticBackgroundOpacity(75_000)).toBe(0);
    expect(calculateExtragalacticBackgroundOpacity(-1)).toBe(0);
    expect(calculateExtragalacticBackgroundOpacity(Number.NaN)).toBe(0);
    expect(calculateExtragalacticBackgroundOpacity(Number.POSITIVE_INFINITY)).toBe(0);

    for (const boundary of [1_600, 3_200, 45_000, 75_000]) {
      const before = calculateExtragalacticBackgroundOpacity(boundary - 0.01);
      const after = calculateExtragalacticBackgroundOpacity(boundary + 0.01);

      expect(Math.abs(after - before)).toBeLessThan(0.001);
    }
  });
});

function minimumAttributeValue(
  attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
): number {
  let minimum = Number.POSITIVE_INFINITY;

  for (let index = 0; index < attribute.count; index += 1) {
    minimum = Math.min(minimum, attribute.getX(index));
  }

  return minimum;
}

function maximumAttributeValue(
  attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
): number {
  let maximum = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < attribute.count; index += 1) {
    maximum = Math.max(maximum, attribute.getX(index));
  }

  return maximum;
}
