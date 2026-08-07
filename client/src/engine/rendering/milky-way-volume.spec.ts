import * as THREE from 'three';
import {
  createMilkyWayVolumeSample,
  getMilkyWayCinematicProfile,
  MILKY_WAY_ATLAS_URL,
  MilkyWayVolume,
  sampleMilkyWayVolume,
} from './milky-way-volume';

describe('MilkyWayVolume', () => {
  it('augmente la profondeur, la poussière et le halo sans ajouter de maillage', () => {
    const low = getMilkyWayCinematicProfile('low');
    const medium = getMilkyWayCinematicProfile('medium');
    const high = getMilkyWayCinematicProfile('high');

    expect(low.parallaxStrength).toBeLessThan(medium.parallaxStrength);
    expect(medium.parallaxStrength).toBeLessThan(high.parallaxStrength);
    expect(low.dustAbsorption).toBeLessThan(medium.dustAbsorption);
    expect(medium.dustAbsorption).toBeLessThan(high.dustAbsorption);
    expect(low.glowStrength).toBeLessThan(medium.glowStrength);
    expect(medium.glowStrength).toBeLessThan(high.glowStrength);
    expect(low.colorGradeStrength).toBeLessThan(high.colorGradeStrength);
  });

  it('fait apparaître puis disparaître la galaxie sans coupure de distance', () => {
    const sample = createMilkyWayVolumeSample();

    sampleMilkyWayVolume(1_400, sample);
    expect(sample.opacity).toBe(0);
    expect(sample.scale).toBe(1);

    sampleMilkyWayVolume(9_600, sample);
    expect(sample.opacity).toBeCloseTo(0.92, 6);
    expect(sample.scale).toBeCloseTo(1, 6);

    sampleMilkyWayVolume(13_300, sample);
    expect(sample.opacity).toBeGreaterThan(0);
    expect(sample.opacity).toBeLessThan(0.92);
    expect(sample.scale).toBeGreaterThan(0.16);
    expect(sample.scale).toBeLessThan(1);

    sampleMilkyWayVolume(14_500, sample);
    expect(sample.opacity).toBeGreaterThan(0.15);
    expect(sample.scale).toBeGreaterThan(0.28);

    sampleMilkyWayVolume(15_000, sample);
    expect(sample.opacity).toBeGreaterThan(0.08);

    sampleMilkyWayVolume(17_000, sample);
    expect(sample.opacity).toBe(0);
    expect(sample.scale).toBeCloseTo(0.16, 6);

    const before = sampleMilkyWayVolume(2_399, createMilkyWayVolumeSample()).opacity;
    const after = sampleMilkyWayVolume(2_401, createMilkyWayVolumeSample()).opacity;

    expect(Math.abs(after - before)).toBeLessThan(0.002);
    expect(sampleMilkyWayVolume(Number.NaN, sample).opacity).toBe(0);
    expect(sampleMilkyWayVolume(-1, sample).opacity).toBe(0);
    expect(sampleMilkyWayVolume(Number.POSITIVE_INFINITY, sample)).toEqual({
      opacity: 0,
      scale: 0.16,
    });
  });

  it('construit un disque multicouche et un bulbe réellement volumique', () => {
    const volume = new MilkyWayVolume(async () => new THREE.Texture(document.createElement('img')));
    const base = volume.root.getObjectByName('milky-way-volume-disc-base');
    const upper = volume.root.getObjectByName('milky-way-volume-disc-upper');
    const lower = volume.root.getObjectByName('milky-way-volume-disc-lower');
    const bulge = volume.root.getObjectByName('milky-way-volume-bulge');

    expect(volume.root.userData['scientificConfidence']).toBe('illustrative');
    expect(volume.root.userData['visualStructure']).toBe(
      'asymmetric-continuous-four-arm-galactic-disc',
    );
    expect(volume.root.userData['atlasUrl']).toBe(MILKY_WAY_ATLAS_URL);
    expect(volume.root.userData['depthTechnique']).toBe(
      'domain-warped-atlas-parallax-with-dust-rifts',
    );
    expect(volume.root.userData['morphologyModel']).toBe(
      'barred-spiral-with-two-major-and-two-minor-arms',
    );
    expect(base).toBeInstanceOf(THREE.Mesh);
    expect(upper).toBeInstanceOf(THREE.Mesh);
    expect(lower).toBeInstanceOf(THREE.Mesh);
    expect(bulge).toBeInstanceOf(THREE.Mesh);
    expect(base?.position.y).toBe(0);
    expect(upper?.position.y).toBeGreaterThan(0);
    expect(lower?.position.y).toBeLessThan(0);
    expect(bulge?.scale.y).toBeGreaterThan(base?.scale.y ?? 0);
    expect(volume.atlasStatus).toBe('idle');

    volume.setQuality('low');
    volume.dispose();
  });

  it('charge l’atlas une seule fois, configure sa colorimétrie et adapte les couches à la qualité', async () => {
    const texture = new THREE.Texture(document.createElement('img'));
    const loadAsync = vi
      .spyOn(THREE.TextureLoader.prototype, 'loadAsync')
      .mockResolvedValue(texture);
    const volume = new MilkyWayVolume();

    const firstLoad = volume.ensureAtlas();
    const secondLoad = volume.ensureAtlas();

    expect(volume.atlasStatus).toBe('loading');
    await expect(firstLoad).resolves.toBe(true);
    await expect(secondLoad).resolves.toBe(true);
    expect(loadAsync).toHaveBeenCalledOnce();
    expect(loadAsync).toHaveBeenCalledWith(MILKY_WAY_ATLAS_URL);
    expect(volume.atlasStatus).toBe('ready');
    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);

    volume.update(9_600, 10);
    volume.setQuality('low');
    expect(volume.visibleDiscLayerCount).toBe(1);
    expect(texture.anisotropy).toBe(1);
    const lowProfile = readCinematicUniforms(volume);

    volume.setQuality('medium');
    expect(volume.visibleDiscLayerCount).toBe(2);
    expect(texture.anisotropy).toBe(2);
    const mediumProfile = readCinematicUniforms(volume);

    volume.setQuality('high');
    expect(volume.visibleDiscLayerCount).toBe(3);
    expect(texture.anisotropy).toBe(4);
    expect(volume.drawMeshCount).toBe(4);
    const highProfile = readCinematicUniforms(volume);

    expect(lowProfile.parallaxStrength).toBeLessThan(mediumProfile.parallaxStrength);
    expect(mediumProfile.parallaxStrength).toBeLessThan(highProfile.parallaxStrength);
    expect(lowProfile.dustAbsorption).toBeLessThan(highProfile.dustAbsorption);
    expect(lowProfile.glowStrength).toBeLessThan(highProfile.glowStrength);

    const base = volume.root.getObjectByName('milky-way-volume-disc-base') as THREE.Mesh<
      THREE.PlaneGeometry,
      THREE.ShaderMaterial
    >;

    expect(base.material.fragmentShader).toContain('viewParallax');
    expect(base.material.fragmentShader).toContain('domainWarp');
    expect(base.material.fragmentShader).toContain('spiralPhase');
    expect(base.material.fragmentShader).toContain('continuousEmission');
    expect(base.material.fragmentShader).toContain('dustRift');
    expect(base.material.fragmentShader).toContain('dustAbsorption');
    expect(base.material.fragmentShader).toContain('colorGradeStrength');

    await expect(volume.ensureAtlas()).resolves.toBe(true);
    expect(loadAsync).toHaveBeenCalledOnce();
    volume.dispose();
  });

  it('conserve le rendu particulaire si le chargement de l’atlas échoue', async () => {
    const loader = vi.fn().mockRejectedValue(new Error('texture indisponible'));
    const volume = new MilkyWayVolume(loader);

    await expect(volume.ensureAtlas()).resolves.toBe(false);
    await expect(volume.ensureAtlas()).resolves.toBe(false);
    expect(loader).toHaveBeenCalledOnce();
    expect(volume.atlasStatus).toBe('failed');

    volume.update(9_600, 10);
    expect(volume.visibleDiscLayerCount).toBe(0);
    expect(volume.drawMeshCount).toBe(1);
    volume.dispose();
    volume.dispose();
    await expect(volume.ensureAtlas()).resolves.toBe(false);
  });

  it('libère une texture qui termine son chargement après la destruction', async () => {
    const texture = new THREE.Texture(document.createElement('img'));
    const textureDispose = vi.spyOn(texture, 'dispose');
    let resolveTexture: ((value: THREE.Texture) => void) | undefined;
    const volume = new MilkyWayVolume(
      () =>
        new Promise((resolve) => {
          resolveTexture = resolve;
        }),
    );

    const loading = volume.ensureAtlas();

    volume.dispose();
    resolveTexture?.(texture);
    await expect(loading).resolves.toBe(false);
    expect(textureDispose).toHaveBeenCalledOnce();
    expect(volume.atlasStatus).toBe('failed');
  });

  it('amortit l’opacité, masque les ressources hors transition et les libère', async () => {
    const texture = new THREE.Texture(document.createElement('img'));
    const textureDispose = vi.spyOn(texture, 'dispose');
    const volume = new MilkyWayVolume(async () => texture);
    const base = volume.root.getObjectByName('milky-way-volume-disc-base') as THREE.Mesh<
      THREE.PlaneGeometry,
      THREE.ShaderMaterial
    >;
    const geometryDispose = vi.spyOn(base.geometry, 'dispose');
    const materialDispose = vi.spyOn(base.material, 'dispose');

    await volume.ensureAtlas();
    volume.setQuality('high');
    volume.update(9_600, 0);
    expect(base.material.uniforms['opacity']!.value).toBe(0);

    volume.update(9_600, 1 / 60);
    const partialOpacity = base.material.uniforms['opacity']!.value as number;

    expect(partialOpacity).toBeGreaterThan(0);
    expect(partialOpacity).toBeLessThan(0.92);

    volume.update(9_600, 10);
    expect(volume.root.visible).toBe(true);
    expect(volume.root.scale.x).toBeCloseTo(1, 4);

    volume.update(17_000, 10);
    expect(volume.root.visible).toBe(false);
    expect(volume.drawMeshCount).toBe(0);

    volume.dispose();
    expect(textureDispose).toHaveBeenCalledOnce();
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(volume.root.children).toHaveLength(0);
  });
});

function readCinematicUniforms(volume: MilkyWayVolume): {
  parallaxStrength: number;
  dustAbsorption: number;
  glowStrength: number;
} {
  const base = volume.root.getObjectByName('milky-way-volume-disc-base') as THREE.Mesh<
    THREE.PlaneGeometry,
    THREE.ShaderMaterial
  >;

  return {
    parallaxStrength: base.material.uniforms['parallaxStrength']!.value as number,
    dustAbsorption: base.material.uniforms['dustAbsorption']!.value as number,
    glowStrength: base.material.uniforms['glowStrength']!.value as number,
  };
}
