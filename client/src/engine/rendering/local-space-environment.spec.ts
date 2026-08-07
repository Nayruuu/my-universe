import * as THREE from 'three';
import {
  createLocalSpaceEnvironmentSample,
  getLocalSpaceCinematicProfile,
  getLocalSpaceObserverOpacity,
  LOCAL_MILKY_WAY_PANORAMA_URL,
  LOCAL_MILKY_WAY_SOURCE_PAGE_URL,
  LocalSpaceEnvironment,
  sampleLocalSpaceEnvironment,
} from './local-space-environment';

describe('LocalSpaceEnvironment', () => {
  it('donne une identité continue au Système solaire et au voisinage stellaire', () => {
    const planetary = sampleLocalSpaceEnvironment(4.8, createLocalSpaceEnvironmentSample());
    const solar = sampleLocalSpaceEnvironment(520, createLocalSpaceEnvironmentSample());
    const nightSky = sampleLocalSpaceEnvironment(520, createLocalSpaceEnvironmentSample(), 0, true);
    const stellar = sampleLocalSpaceEnvironment(1_400, createLocalSpaceEnvironmentSample());
    const galactic = sampleLocalSpaceEnvironment(9_600, createLocalSpaceEnvironmentSample());

    expect(planetary.galacticBandOpacity).toBeCloseTo(0.4, 8);
    expect(planetary.zodiacalLightOpacity).toBe(0);
    expect(planetary.solarCoronaOpacity).toBe(0);
    expect(planetary.solarCoronaDiameter).toBe(0);
    expect(solar.galacticBandOpacity).toBeGreaterThan(0.12);
    expect(solar.galacticBandOpacity).toBeGreaterThan(planetary.galacticBandOpacity);
    expect(solar.zodiacalLightOpacity).toBeGreaterThan(0.16);
    expect(solar.solarCoronaOpacity).toBeGreaterThan(0.6);
    expect(solar.solarCoronaDiameter).toBeGreaterThan(35);
    expect(nightSky).toEqual({
      galacticBandOpacity: solar.galacticBandOpacity,
      zodiacalLightOpacity: 0,
      solarCoronaOpacity: 0,
      solarCoronaDiameter: 0,
    });
    expect(stellar.galacticBandOpacity).toBeGreaterThan(solar.galacticBandOpacity);
    expect(stellar.zodiacalLightOpacity).toBeGreaterThan(0);
    expect(stellar.zodiacalLightOpacity).toBeLessThan(solar.zodiacalLightOpacity);
    expect(stellar.solarCoronaOpacity).toBeGreaterThan(0.2);
    expect(galactic).toEqual({
      galacticBandOpacity: 0,
      zodiacalLightOpacity: 0,
      solarCoronaOpacity: 0,
      solarCoronaDiameter: 0,
    });
  });

  it('reste continu aux frontières et borne les distances invalides', () => {
    const before = sampleLocalSpaceEnvironment(519, createLocalSpaceEnvironmentSample());
    const after = sampleLocalSpaceEnvironment(521, createLocalSpaceEnvironmentSample());

    expect(Math.abs(after.galacticBandOpacity - before.galacticBandOpacity)).toBeLessThan(0.004);
    expect(Math.abs(after.zodiacalLightOpacity - before.zodiacalLightOpacity)).toBeLessThan(0.004);
    expect(sampleLocalSpaceEnvironment(Number.NaN, createLocalSpaceEnvironmentSample())).toEqual(
      sampleLocalSpaceEnvironment(0, createLocalSpaceEnvironmentSample()),
    );
    expect(
      sampleLocalSpaceEnvironment(Number.POSITIVE_INFINITY, createLocalSpaceEnvironmentSample()),
    ).toEqual(sampleLocalSpaceEnvironment(9_600, createLocalSpaceEnvironmentSample()));
  });

  it('retire le panorama héliocentrique quand l’observateur quitte le voisinage solaire', () => {
    const local = sampleLocalSpaceEnvironment(22, createLocalSpaceEnvironmentSample(), 0);
    const transition = sampleLocalSpaceEnvironment(22, createLocalSpaceEnvironmentSample(), 4_800);
    const remote = sampleLocalSpaceEnvironment(22, createLocalSpaceEnvironmentSample(), 7_200);

    expect(local.galacticBandOpacity).toBeCloseTo(0.4, 8);
    expect(getLocalSpaceObserverOpacity(0)).toBe(1);
    expect(getLocalSpaceObserverOpacity(4_800)).toBeGreaterThan(0);
    expect(getLocalSpaceObserverOpacity(4_800)).toBeLessThan(1);
    expect(transition.galacticBandOpacity).toBeGreaterThan(0);
    expect(transition.galacticBandOpacity).toBeLessThan(local.galacticBandOpacity);
    expect(remote).toEqual({
      galacticBandOpacity: 0,
      zodiacalLightOpacity: 0,
      solarCoronaOpacity: 0,
      solarCoronaDiameter: 0,
    });
    expect(getLocalSpaceObserverOpacity(Number.NaN)).toBe(1);
    expect(getLocalSpaceObserverOpacity(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('ne produit aucun saut visible aux seuils de transition', () => {
    const boundaries = [120, 420, 850, 900, 2_600, 2_800, 3_200, 7_200, 9_600];

    for (const boundary of boundaries) {
      const before = sampleLocalSpaceEnvironment(
        boundary - 0.01,
        createLocalSpaceEnvironmentSample(),
      );
      const after = sampleLocalSpaceEnvironment(
        boundary + 0.01,
        createLocalSpaceEnvironmentSample(),
      );

      expect(Math.abs(after.galacticBandOpacity - before.galacticBandOpacity)).toBeLessThan(0.001);
      expect(Math.abs(after.zodiacalLightOpacity - before.zodiacalLightOpacity)).toBeLessThan(
        0.001,
      );
      expect(Math.abs(after.solarCoronaOpacity - before.solarCoronaOpacity)).toBeLessThan(0.001);
      expect(Math.abs(after.solarCoronaDiameter - before.solarCoronaDiameter)).toBeLessThan(0.01);
    }
  });

  it('augmente le détail sans multiplier les représentations selon la qualité', () => {
    const low = getLocalSpaceCinematicProfile('low');
    const medium = getLocalSpaceCinematicProfile('medium');
    const high = getLocalSpaceCinematicProfile('high');

    expect(low.galacticDetail).toBeLessThan(medium.galacticDetail);
    expect(medium.galacticDetail).toBeLessThan(high.galacticDetail);
    expect(low.zodiacalGrain).toBeLessThan(high.zodiacalGrain);
    expect(low.coronaRayStrength).toBeLessThan(high.coronaRayStrength);
  });

  it('construit trois couches bornées, orientées dans les bons référentiels', () => {
    const environment = new LocalSpaceEnvironment();
    const band = environment.root.getObjectByName('illustrative-local-milky-way-sky');
    const zodiacal = environment.root.getObjectByName('illustrative-zodiacal-light');
    const corona = environment.root.getObjectByName('illustrative-solar-corona');

    expect(environment.root.children).toEqual([band, zodiacal, corona]);
    expect(environment.root.userData).toMatchObject({
      scientificConfidence: 'illustrative',
      visualRole: 'local-space-cinematic-environment',
    });
    expect(band).toBeInstanceOf(THREE.Mesh);
    expect(band?.rotation.x).toBeCloseTo(THREE.MathUtils.degToRad(-32), 8);
    expect(band?.rotation.z).toBeCloseTo(THREE.MathUtils.degToRad(-6.5), 8);
    expect(band?.userData).toMatchObject({
      physicalPhenomenon: 'integrated-milky-way-light-and-dust',
      referenceFrame: 'galactic-heliocentric',
      galacticCenterDirection: [-1, 0, 0],
      visualStyle: 'inside-milky-way-panoramic-band',
      angularPresentation: 'distant-thin-sky-band',
      sourceCredit: 'ESO/S. Brunier',
      sourceImageId: 'ESO-ESO0932A',
      sourcePageUrl: LOCAL_MILKY_WAY_SOURCE_PAGE_URL,
      sourcePixelDimensions: [6_000, 3_000],
      texturePixelDimensions: [8_192, 1_024],
      sourceAngularLatitudeSpanDegrees: 60,
      angularLatitudeSpanDegrees: 32,
      latitudePresentationScale: 32 / 60,
      visibilityTreatment: 'photographic-continuous-light',
      displayGrade: 'eso-photographic-v3',
      sourceProjection: 'full-sky-panorama-galactic-plane-horizontal',
      presentationPitchDegrees: -32,
      presentationRollDegrees: -6.5,
      presentationComposition: 'diagonal-cinematic-sky',
      orientationConfidence: 'illustrative',
      visualLayers: ['integrated-starlight', 'central-bulge', 'dust-rifts', 'star-forming-clouds'],
    });
    expect(zodiacal).toBeInstanceOf(THREE.Mesh);
    expect(zodiacal?.rotation.x).toBeCloseTo(-Math.PI / 2, 8);
    expect(zodiacal?.userData['referencePlane']).toBe('ecliptic-approximation');
    expect(corona).toBeInstanceOf(THREE.Sprite);
    expect(corona?.userData['physicalPhenomenon']).toBe('solar-corona-and-diffraction');
    expect(environment.maximumDrawMeshCount).toBe(3);

    const bandMaterial = (band as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>).material;
    const zodiacalMaterial = (zodiacal as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>)
      .material;
    const coronaMaterial = (corona as THREE.Sprite).material;

    expect(bandMaterial.fragmentShader).toContain('galacticLatitude');
    expect(bandMaterial.fragmentShader).toContain('galacticCenter');
    expect(bandMaterial.fragmentShader).toContain('starCloud');
    expect(bandMaterial.fragmentShader).not.toContain('float fineStar(');
    expect(bandMaterial.fragmentShader).toContain('dustLane');
    expect(bandMaterial.fragmentShader).toContain('dustRift');
    expect(bandMaterial.uniforms['panoramaExposure']!.value).toBeGreaterThanOrEqual(1.1);
    expect(bandMaterial.uniforms['panoramaExposure']!.value).toBeLessThanOrEqual(1.25);
    expect(bandMaterial.blending).toBe(THREE.NormalBlending);
    expect(bandMaterial.depthTest).toBe(false);
    expect(zodiacalMaterial.fragmentShader).toContain('radialFade');
    expect(coronaMaterial.map?.userData['visualLayers']).toContain('coronaRays');
    environment.dispose();
  });

  it('charge une seule fois le panorama intérieur et conserve le shader comme couche de profondeur', async () => {
    const texture = new THREE.Texture(document.createElement('img'));
    const textureDispose = vi.spyOn(texture, 'dispose');
    const loader = vi.fn().mockResolvedValueOnce(texture);
    const environment = new LocalSpaceEnvironment(loader);
    const band = environment.root.getObjectByName('illustrative-local-milky-way-sky') as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.ShaderMaterial
    >;

    expect(environment.panoramaStatus).toBe('idle');
    const firstLoad = environment.ensurePanorama();
    const secondLoad = environment.ensurePanorama();

    expect(environment.panoramaStatus).toBe('loading');
    await expect(firstLoad).resolves.toBe(true);
    await expect(secondLoad).resolves.toBe(true);
    expect(loader).toHaveBeenCalledOnce();
    expect(loader).toHaveBeenCalledWith(LOCAL_MILKY_WAY_PANORAMA_URL);
    expect(LOCAL_MILKY_WAY_PANORAMA_URL).toBe('/textures/milky-way-eso-band-8k-v3.webp');
    expect(environment.panoramaStatus).toBe('ready');
    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(texture.wrapS).toBe(THREE.RepeatWrapping);
    expect(texture.minFilter).toBe(THREE.LinearFilter);
    expect(texture.generateMipmaps).toBe(false);
    expect(band.material.uniforms['panorama']!.value).toBe(texture);
    expect(band.material.uniforms['panoramaReady']!.value).toBe(1);
    expect(band.material.fragmentShader).toContain('panoramaUv');
    expect(band.material.fragmentShader).toContain('panoramaSignal');
    expect(band.material.fragmentShader).toContain('photographicCoverage');
    expect(band.material.fragmentShader).toContain('bandLatitudeWindow');
    expect(band.material.fragmentShader).toContain('latitudeAngle / 0.55850536064');
    expect(band.material.fragmentShader).not.toContain('fineStar(atlasUv)');
    expect(band.material.fragmentShader).not.toContain('panoramaColor += vec3(0.035');
    expect(band.material.fragmentShader).not.toContain('centerFieldBlend');
    environment.setQuality('high');
    expect(texture.anisotropy).toBe(4);
    await expect(environment.ensurePanorama()).resolves.toBe(true);

    environment.dispose();
    expect(textureDispose).toHaveBeenCalledOnce();
    await expect(environment.ensurePanorama()).resolves.toBe(false);
  });

  it('signale un échec définitif lorsque le panorama est indisponible', async () => {
    const environment = new LocalSpaceEnvironment(() =>
      Promise.reject(new Error('texture indisponible')),
    );

    await expect(environment.ensurePanorama()).resolves.toBe(false);
    expect(environment.panoramaStatus).toBe('failed');
    await expect(environment.ensurePanorama()).resolves.toBe(false);
    environment.dispose();
  });

  it('libère le chargement qui se termine après la destruction', async () => {
    const panorama = new THREE.Texture(document.createElement('img'));
    const panoramaDispose = vi.spyOn(panorama, 'dispose');
    let resolvePanorama: ((texture: THREE.Texture) => void) | undefined;
    const environment = new LocalSpaceEnvironment(
      () =>
        new Promise((resolve) => {
          resolvePanorama = resolve;
        }),
    );
    const loading = environment.ensurePanorama();

    environment.dispose();
    resolvePanorama!(panorama);

    await expect(loading).resolves.toBe(false);
    expect(environment.panoramaStatus).toBe('failed');
    expect(panoramaDispose).toHaveBeenCalledOnce();
  });

  it('amortit les fondus, applique la radiance et libère toutes ses ressources', () => {
    const environment = new LocalSpaceEnvironment();
    const band = environment.root.getObjectByName('illustrative-local-milky-way-sky') as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.ShaderMaterial
    >;
    const zodiacal = environment.root.getObjectByName('illustrative-zodiacal-light') as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.ShaderMaterial
    >;
    const corona = environment.root.getObjectByName('illustrative-solar-corona') as THREE.Sprite;
    const bandGeometryDispose = vi.spyOn(band.geometry, 'dispose');
    const bandMaterialDispose = vi.spyOn(band.material, 'dispose');
    const zodiacalGeometryDispose = vi.spyOn(zodiacal.geometry, 'dispose');
    const coronaMaterialDispose = vi.spyOn(corona.material, 'dispose');

    environment.setQuality('high');
    environment.update(520, 0, 1.2);
    expect(environment.drawMeshCount).toBe(0);
    environment.update(520, 1 / 60, 1.2);
    expect(environment.drawMeshCount).toBe(3);
    expect(band.material.uniforms['radiance']!.value).toBe(1.2);
    expect(band.material.uniforms['opacity']!.value).toBeGreaterThan(0);
    expect(band.material.uniforms['opacity']!.value).toBeLessThan(0.3);
    expect(zodiacal.visible).toBe(true);
    expect(corona.visible).toBe(true);
    expect(corona.scale.x).toBeGreaterThan(0);
    expect(environment.root.userData['cinematicQuality']).toBe('high');
    expect(environment.root.userData['observerLocalityOpacity']).toBe(1);

    environment.update(520, 1 / 60, 1.2, 0, true);
    expect(band.visible).toBe(true);
    expect(zodiacal.visible).toBe(false);
    expect(corona.visible).toBe(false);
    expect(environment.drawMeshCount).toBe(1);

    environment.update(22, 10, 1, 7_200);
    expect(environment.drawMeshCount).toBe(0);
    expect(environment.root.userData['observerDistance']).toBe(7_200);
    expect(environment.root.userData['observerLocalityOpacity']).toBe(0);

    environment.update(9_600, 10, 1);
    expect(environment.drawMeshCount).toBe(0);
    environment.dispose();
    environment.dispose();

    expect(bandGeometryDispose).toHaveBeenCalledOnce();
    expect(bandMaterialDispose).toHaveBeenCalledOnce();
    expect(zodiacalGeometryDispose).toHaveBeenCalledOnce();
    expect(coronaMaterialDispose).toHaveBeenCalledOnce();
    expect(environment.root.children).toHaveLength(0);
  });
});
