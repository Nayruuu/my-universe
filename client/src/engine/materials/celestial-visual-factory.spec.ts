import * as THREE from 'three';
import { SpaceObject } from '../../data/models/universe.models';
import { PICKING_LAYER } from '../selection/selection-layers';
import {
  createCelestialVisual,
  createCelestialVisualAssets,
  createPhotonRingTexture,
  createSelectionMarker,
  createSharedGlowTexture,
  getGalaxyTextureResolution,
  requestCelestialLodTextures,
  type CelestialVisualAssets,
} from './celestial-visual-factory';
import { DEFERRED_TEXTURE_SOURCE } from './planetary-textures';

describe('imposteurs galactiques', () => {
  let assets: CelestialVisualAssets;

  beforeEach(() => {
    assets = {
      glowTexture: new THREE.Texture(),
      photonRingTexture: new THREE.Texture(),
      galaxyTextures: {
        spiral: new THREE.Texture(),
        elliptical: new THREE.Texture(),
        irregular: new THREE.Texture(),
      },
      sphereGeometry: new THREE.SphereGeometry(1, 8, 6),
      selectionGeometry: new THREE.SphereGeometry(1, 8, 6),
      ringGeometry: new THREE.RingGeometry(1, 2, 8),
      selectionMaterial: new THREE.MeshBasicMaterial(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    assets.glowTexture.dispose();
    assets.photonRingTexture.dispose();
    Object.values(assets.galaxyTextures).forEach((texture) => texture.dispose());
    assets.sphereGeometry.dispose();
    assets.selectionGeometry.dispose();
    assets.ringGeometry.dispose();
    assets.selectionMaterial.dispose();
  });

  it('crée une silhouette orientée avec une cible de sélection indépendante', () => {
    const visual = createCelestialVisual(createGalaxy(), 'medium', assets);
    const sprite = visual.lod.farSprite;
    const selectionTarget = visual.pickables[0];

    expect(sprite).toBeInstanceOf(THREE.Sprite);
    if (!sprite) {
      throw new Error('Imposteur galactique absent.');
    }
    expect(sprite.name).toBe('andromeda-galaxy-impostor');
    expect(sprite.scale.toArray()).toEqual([1_040, 364, 1]);
    expect(sprite.material.map).toBe(assets.galaxyTextures.spiral);
    expect(sprite.material.rotation).toBeCloseTo(THREE.MathUtils.degToRad(35));
    expect(sprite.layers.mask & (1 << PICKING_LAYER)).toBe(0);
    expect(sprite.userData['objectId']).toBe('andromeda');
    expect(sprite.material.userData['visualStyle']).toBe('structured-galaxy-impostor');
    expect(sprite.material.userData['layers']).toEqual([
      'outer-star-halo',
      'dust-lanes',
      'stellar-core',
    ]);
    expect(sprite.material.color.r).toBeGreaterThan(0.8);
    expect(sprite.material.color.g).toBeGreaterThan(0.8);
    expect(sprite.material.color.b).toBeGreaterThan(0.8);
    expect(selectionTarget?.name).toBe('andromeda-selection-target');
    expect(selectionTarget?.scale.x).toBeCloseTo(598);
    expect(selectionTarget?.layers.mask & (1 << PICKING_LAYER)).not.toBe(0);
    expect(visual.pickables).toEqual([
      selectionTarget,
      visual.lod.nearRoot?.getObjectByName('andromeda-galaxy-structured-disk'),
    ]);
    expect(visual.lod.farAspectRatio).toBe(0.35);
    expect(visual.lod.nearRoot?.name).toBe('andromeda-galaxy-near-volume');
    expect(visual.lod.nearRoot?.visible).toBe(false);
    expect(visual.lod.nearMaterials).toHaveLength(2);

    sprite.material.dispose();
  });

  it('augmente la résolution des imposteurs galactiques avec la qualité', () => {
    expect(getGalaxyTextureResolution('low')).toBe(256);
    expect(getGalaxyTextureResolution('medium')).toBe(384);
    expect(getGalaxyTextureResolution('high')).toBe(512);
  });

  it.each(['region', 'universe'] as const)(
    'ne crée aucune géométrie pour le référentiel %s',
    (type) => {
      const visual = createCelestialVisual(
        {
          ...createGalaxy(),
          id: type === 'region' ? 'local-group' : 'cosmic-web',
          name: type === 'region' ? 'Groupe local' : 'Réseau cosmique',
          type,
        },
        'medium',
        assets,
      );

      expect(visual.root.children).toHaveLength(0);
      expect(visual.pickables).toHaveLength(0);
      expect(visual.lod.farSprite).toBeNull();
    },
  );

  it('applique les valeurs galactiques par défaut', () => {
    const galaxy = createGalaxy();

    galaxy.visual = {
      visualRadius: 10,
      scaleMode: 'adaptive',
    };
    const visual = createCelestialVisual(galaxy, 'medium', assets);

    expect(visual.lod.farSprite?.material.map).toBe(assets.galaxyTextures.elliptical);
    expect(visual.lod.farAspectRatio).toBe(0.72);
    visual.lod.farSprite?.material.dispose();
  });

  it('laisse la Voie lactée à son volume galactique spécialisé', () => {
    const milkyWay = createGalaxy();

    milkyWay.id = 'milky-way';
    const visual = createCelestialVisual(milkyWay, 'high', assets);

    expect(visual.lod.nearRoot).toBeNull();
    expect(visual.lod.nearMaterials).toHaveLength(0);
    expect(visual.pickables).toEqual([visual.lod.farSprite]);
    visual.lod.farSprite?.material.dispose();
  });

  it('renforce uniquement les galaxies du catalogue de l’univers proche', () => {
    const nearbyGalaxy = createGalaxy();

    nearbyGalaxy.metadata = { nearbyUniverseLabelRank: 3 };
    const nearbyVisual = createCelestialVisual(nearbyGalaxy, 'medium', assets);
    const localVisual = createCelestialVisual(createGalaxy(), 'medium', assets);

    expect(localVisual.lod.farBaseOpacity).toBeCloseTo(0.72);
    expect(nearbyVisual.lod.farBaseOpacity).toBeCloseTo(0.86);
    expect(nearbyVisual.lod.farBaseOpacity).toBeGreaterThan(localVisual.lod.farBaseOpacity);
    nearbyVisual.lod.farSprite?.material.dispose();
    localVisual.lod.farSprite?.material.dispose();
  });

  it('éclaire localement les systèmes exoplanétaires sans multiplier les lumières stellaires', () => {
    const host = createPlanet('trappist-1');

    host.type = 'star';
    host.metadata = { exoplanetHost: true };
    host.physical = { spectralType: 'M8V', temperatureK: 2_566 };
    host.visual.color = '#ff765b';
    const hostVisual = createCelestialVisual(host, 'medium', assets);
    const ordinaryStar = createPlanet('ordinary-star');

    ordinaryStar.type = 'star';
    const ordinaryVisual = createCelestialVisual(ordinaryStar, 'medium', assets);
    const hotStar = createPlanet('hot-star');

    hotStar.type = 'star';
    hotStar.physical = { temperatureK: 12_000 };
    hotStar.visual.color = '#a8c8ff';
    const hotVisual = createCelestialVisual(hotStar, 'high', assets);
    const colorIndexStar = createPlanet('color-index-star');

    colorIndexStar.type = 'star';
    colorIndexStar.metadata = { colorIndexBv: 1.2 };
    colorIndexStar.visual.color = '#ffb46b';
    const colorIndexVisual = createCelestialVisual(colorIndexStar, 'low', assets);
    const light = hostVisual.root.getObjectByName('trappist-1-system-light');
    const body = hostVisual.root.getObjectByName('trappist-1-body');

    expect(light).toBeInstanceOf(THREE.PointLight);
    expect(body).toBeInstanceOf(THREE.Mesh);
    if (!(body instanceof THREE.Mesh) || !(body.material instanceof THREE.ShaderMaterial)) {
      throw new Error('Photosphère procédurale de l’étoile absente.');
    }
    expect(body.material.userData['visualStyle']).toBe('procedural-stellar-photosphere');
    expect(body.material.userData['visualFamily']).toBe('red-dwarf');
    expect(body.material.fragmentShader).toContain('limbDarkening');
    expect(body.material.fragmentShader).toContain('granulation');
    expect(body.material.fragmentShader).toContain('stellarFbm');
    expect(body.material.fragmentShader).toContain('illustrativeStellarTint');
    const ordinaryBody = ordinaryVisual.root.getObjectByName('ordinary-star-body');
    const hotBody = hotVisual.root.getObjectByName('hot-star-body');
    const colorIndexBody = colorIndexVisual.root.getObjectByName('color-index-star-body');

    expect(
      (ordinaryBody as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>).material.userData[
        'visualFamily'
      ],
    ).toBe('yellow-dwarf');
    expect(
      (hotBody as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>).material.userData[
        'visualFamily'
      ],
    ).toBe('blue-white');
    expect(
      (colorIndexBody as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>).material.userData[
        'visualFamily'
      ],
    ).toBe('orange-dwarf');
    expect(light?.userData['scientificConfidence']).toBe('illustrative');
    expect(ordinaryVisual.root.getObjectByProperty('type', 'PointLight')).toBeUndefined();
    const hostWithoutColor = createPlanet('colorless-host');

    hostWithoutColor.type = 'star';
    hostWithoutColor.metadata = { exoplanetHost: true };
    delete hostWithoutColor.visual.color;
    expect(
      createCelestialVisual(hostWithoutColor, 'medium', assets).root.getObjectByName(
        'colorless-host-system-light',
      ),
    ).toBeInstanceOf(THREE.PointLight);
  });

  it('laisse les étoiles et leur sélection être occultées par les corps au premier plan', () => {
    const sun = createPlanet('sun');

    sun.type = 'star';
    sun.visual.color = '#fff1c2';
    sun.visual.emissiveIntensity = 1.6;
    const visual = createCelestialVisual(sun, 'medium', assets);
    const body = visual.rotatingBody as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      stroke: vi.fn(),
      setLineDash: vi.fn(),
      strokeStyle: '',
      lineWidth: 1,
    } as unknown as CanvasRenderingContext2D);
    const marker = createSelectionMarker();

    expect(body.material.depthTest).toBe(true);
    expect(body.material.depthWrite).toBe(true);
    expect(body.material.vertexShader).toContain('#include <logdepthbuf_pars_vertex>');
    expect(body.material.vertexShader).toContain('#include <logdepthbuf_vertex>');
    expect(body.material.fragmentShader).toContain('#include <logdepthbuf_pars_fragment>');
    expect(body.material.fragmentShader).toContain('#include <logdepthbuf_fragment>');
    expect(body.material.fragmentShader).toContain('surfaceRadiance');
    expect(body.material.uniforms['surfaceRadiance']?.value).toBe(1.6);
    expect(marker.material.depthTest).toBe(true);
    expect(marker.material.depthWrite).toBe(false);

    marker.material.map?.dispose();
    marker.material.dispose();
  });

  it('compose une supernova en flash temporel et coquille volumétrique sélectionnable', () => {
    const supernova = createPlanet('sn-1987a');

    supernova.type = 'supernova';
    supernova.scientificConfidence = 'observed';
    supernova.visual = {
      color: '#77d8ff',
      secondaryColor: '#ff6b8f',
      visualRadius: 1.8,
      scaleMode: 'adaptive',
    };
    supernova.metadata = {
      visualPeakJulianDay: 2_446_849.5,
      supernovaRiseDays: 20,
      supernovaDecayDays: 650,
      shellFormationDays: 60,
      appearanceReferenceJulianDay: 2_461_257.5,
      appearanceConfidence: 'illustrative',
    };
    const visual = createCelestialVisual(supernova, 'high', assets);
    const shell = visual.root.getObjectByName('sn-1987a-supernova-shell');
    const flash = visual.root.getObjectByName('sn-1987a-supernova-flash');

    expect(visual.supernova).not.toBeNull();
    expect(shell).toBeInstanceOf(THREE.Mesh);
    expect(flash).toBeInstanceOf(THREE.Sprite);
    expect(shell?.userData['scientificConfidence']).toBe('illustrative');
    expect(shell?.userData['visualStyle']).toBe('procedural-volumetric-supernova-remnant');
    expect(visual.supernova?.shellLayers.map((layer) => layer.name)).toEqual([
      'sn-1987a-supernova-shell',
      'sn-1987a-supernova-filaments',
      'sn-1987a-supernova-emission-knots',
    ]);
    expect(visual.supernova?.shellLayers.every((layer) => layer.material.transparent)).toBe(true);
    expect(visual.supernova?.shellLayers[0]?.material.fragmentShader).toContain('fbm');
    expect(visual.supernova?.shellLayers[1]?.material.fragmentShader).toContain('ridgedFilaments');
    expect(visual.supernova?.shellLayers[2]?.userData['emissionLayer']).toBe('knots');
    expect(visual.lod.farSprite?.userData['visualStyle']).toBe('temporal-supernova-impostor');
    expect(visual.pickables).toHaveLength(1);
    expect(visual.pickables[0]?.userData['objectId']).toBe('sn-1987a');

    visual.supernova?.updateAppearance({ julianDay: 2_446_849.5 });
    expect(visual.supernova?.phase).toBe('peak');
    expect(flash?.visible).toBe(true);
    expect(visual.lod.farSprite?.userData['appearanceOpacity']).toBe(1);

    visual.supernova?.updateAppearance({ julianDay: 2_461_257.5 });
    expect(visual.supernova?.phase).toBe('remnant');
    expect(flash?.visible).toBe(false);
    expect(shell?.scale.x).toBeCloseTo(1.8);
    expect(shell?.scale.y).toBeCloseTo(1.8);
    expect(shell?.scale.z).toBeCloseTo(1.8);
    expect(visual.supernova?.shellLayers[1]?.scale.x).toBeCloseTo(1.8 * 0.86);
    expect(visual.supernova?.shellLayers[2]?.scale.x).toBeCloseTo(1.8 * 0.7);
    expect(visual.supernova?.materials).toHaveLength(4);
  });

  it('affiche directement un rémanent sans date historique vérifiée', () => {
    const remnant = createPlanet('cassiopeia-a');

    remnant.type = 'supernova-remnant';
    remnant.visual = {
      visualRadius: 2.4,
      scaleMode: 'adaptive',
    };
    remnant.metadata = {
      appearanceReferenceJulianDay: 2_461_257.5,
      appearanceConfidence: 'illustrative',
    };
    const visual = createCelestialVisual(remnant, 'low', assets);

    visual.supernova?.updateAppearance({ julianDay: 2_451_545 });
    expect(visual.supernova?.phase).toBe('remnant');
    expect(visual.root.getObjectByName('cassiopeia-a-supernova-shell')?.userData['quality']).toBe(
      'low',
    );
    expect(visual.supernova?.shellLayers[2]?.visible).toBe(false);
    expect(visual.lod.farSprite?.userData['appearanceOpacity']).toBe(1);
  });

  it('signale chaque contexte Canvas 2D indispensable', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(() => createSharedGlowTexture()).toThrow('halo stellaire');
    expect(() => createPhotonRingTexture()).toThrow('anneau photonique');
    expect(() => createSelectionMarker()).toThrow('marqueur de sélection');
    const visual = createCelestialVisual(createPlanet('eris'), 'medium', assets);

    expect(() => requestCelestialLodTextures(visual.lod)).toThrow('texture de eris');
  });

  it('signale aussi un contexte absent pendant la génération galactique', () => {
    const context = visualCanvasContext();

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValueOnce(context)
      .mockReturnValueOnce(context)
      .mockReturnValueOnce(null);

    expect(() => createCelestialVisualAssets('low')).toThrow('imposteurs galactiques');
  });

  it('diffère et déduplique les textures statiques jusqu’au premier LOD proche', () => {
    const visual = createCelestialVisual(createPlanet('earth'), 'high', assets);
    const body = visual.rotatingBody as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.MeshStandardMaterial
    >;
    const texture = body.material.map!;
    const image = texture.image as HTMLImageElement;
    const initialVersion = texture.version;
    const textureWithoutSource = new THREE.Texture();

    expect(image.getAttribute('src')).toBeNull();
    expect(visual.lod.deferredTextures).toHaveLength(3);
    visual.lod.deferredTextures.push(textureWithoutSource);
    expect(requestCelestialLodTextures(visual.lod)).toBe(3);
    expect(image.src).toContain('textures/earth-blue-marble-2048.jpg');
    expect(requestCelestialLodTextures(visual.lod)).toBe(0);

    image.onload?.(new Event('load'));

    expect(texture.version).toBe(initialVersion + 1);
    body.material.dispose();
    texture.dispose();
    textureWithoutSource.dispose();
  });

  it('compose la Terre haute qualité avec surface, lumières nocturnes et nuages NASA', () => {
    const visual = createCelestialVisual(createPlanet('earth'), 'high', assets);

    requestCelestialLodTextures(visual.lod);
    const body = visual.rotatingBody as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.MeshStandardMaterial
    >;
    const clouds = visual.root.getObjectByName('earth-cloud-layer') as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.MeshStandardMaterial
    >;
    const atmosphere = visual.root.getObjectByName('earth-atmosphere') as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.ShaderMaterial
    >;

    expect((body.material.map?.image as HTMLImageElement).src).toContain(
      'textures/earth-blue-marble-2048.jpg',
    );
    expect(body.material.map?.repeat.x).toBe(1);
    expect(body.material.map?.offset.x).toBe(0);
    expect(body.material.map?.userData['longitudeConvention']).toBe('east-positive');
    expect((body.material.emissiveMap?.image as HTMLImageElement).src).toContain(
      'textures/earth-night-lights-2048.jpg',
    );
    expect(body.material.emissiveMap?.repeat.x).toBe(1);
    expect(body.material.emissiveIntensity).toBeGreaterThan(0.7);
    expect(body.material.userData['visualStyle']).toBe('nasa-surface-and-night-lights');
    expect(clouds.parent).toBe(body);
    expect(visual.solarEclipse?.eventMapRoot.parent).toBe(body);
    expect(visual.solarEclipse?.mesh.parent).not.toBe(body);
    expect(clouds.scale.toArray()).toEqual([1.012, 1.012, 1.012]);
    expect(clouds.material.map).toBe(clouds.material.alphaMap);
    expect((clouds.material.map?.image as HTMLImageElement).src).toContain(
      'textures/earth-clouds-2048.jpg',
    );
    expect(clouds.material.map?.repeat.x).toBe(1);
    expect(clouds.material.userData['scientificConfidence']).toBe('observed');
    expect(atmosphere.material.userData['visualStyle']).toBe('fresnel-atmospheric-scattering');
    expect(atmosphere.material.uniforms['intensity']!.value).toBe(1);
    atmosphere.material.opacity = 0.21;
    (atmosphere.material.onBeforeRender as () => void)();
    expect(atmosphere.material.uniforms['layerOpacity']!.value).toBe(0.21);
  });

  it('conserve une Terre légère sans nuages ni lumières nocturnes en qualité faible', () => {
    const visual = createCelestialVisual(createPlanet('earth'), 'low', assets);
    const body = visual.rotatingBody as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.MeshStandardMaterial
    >;
    const atmosphere = visual.root.getObjectByName('earth-atmosphere') as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.ShaderMaterial
    >;

    expect(body.material.map).toBeInstanceOf(THREE.Texture);
    expect(body.material.emissiveMap).toBeNull();
    expect(visual.root.getObjectByName('earth-cloud-layer')).toBeUndefined();
    expect(atmosphere.material.uniforms['intensity']!.value).toBe(0.72);
  });

  it('utilise la carte globale Hubble observée pour Jupiter', () => {
    const jupiter = createPlanet('jupiter');

    jupiter.visual.color = '#d2b28e';
    jupiter.visual.secondaryColor = '#8d6247';
    const visual = createCelestialVisual(jupiter, 'high', assets);

    requestCelestialLodTextures(visual.lod);
    const body = visual.rotatingBody as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.MeshStandardMaterial
    >;
    const texture = body.material.map!;

    expect((texture.image as HTMLImageElement).src).toContain('textures/jupiter-hubble-2048.jpg');
    expect(texture.userData['visualStyle']).toBe('observed-hubble-global-map');
    expect(texture.userData['scientificConfidence']).toBe('observed');
    expect(texture.userData['polarTreatment']).toBe('illustrative-stretch');
    expect(texture.userData['bodyFixedAlignment']).toBe('illustrative-source-epoch');
    expect(body.material.emissiveMap).toBe(texture);
    expect(body.material.userData['shadowFill']).toBe('illustrative');
  });

  it('utilise les cartes LRO et LOLA pour la couleur et le relief lunaire', () => {
    const visual = createCelestialVisual(createPlanet('moon'), 'high', assets);

    requestCelestialLodTextures(visual.lod);
    const body = visual.rotatingBody as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.MeshStandardMaterial
    >;
    const colorTexture = body.material.map!;
    const reliefTexture = body.material.bumpMap!;

    expect((colorTexture.image as HTMLImageElement).src).toContain('textures/moon-lroc-2048.jpg');
    expect(colorTexture.userData['visualStyle']).toBe('observed-lro-color-mosaic');
    expect(colorTexture.userData['scientificConfidence']).toBe('observed');
    expect(colorTexture.userData['visualTreatment']).toBe('aesthetic-processing');
    expect(colorTexture.repeat.x).toBe(1);
    expect(colorTexture.offset.x).toBe(0);
    expect(colorTexture.userData['longitudeConvention']).toBe('east-positive');
    expect((reliefTexture.image as HTMLImageElement).src).toContain(
      'textures/moon-lola-relief-1024.jpg',
    );
    expect(reliefTexture.userData['visualStyle']).toBe('observed-lola-elevation');
    expect(reliefTexture.repeat.x).toBe(1);
    expect(reliefTexture.offset.x).toBe(0);
    expect(body.material).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    expect(body.material.bumpScale).toBeCloseTo(0.032);
    expect(body.material.displacementMap).toBe(reliefTexture);
    expect(body.material.displacementScale).toBeCloseTo(0.012);
    expect(body.material.displacementBias).toBeCloseTo(-0.006);
    expect(body.material.roughness).toBe(1);
    expect(body.material.emissiveMap).toBe(colorTexture);
    expect(body.material.emissiveIntensity).toBeCloseTo(0.18);
    expect(body.material.userData['reliefScale']).toBe('visually-exaggerated');
    expect(body.material.userData['silhouetteReliefScale']).toBe(
      'lola-derived-visually-exaggerated',
    );
    expect(body.material.userData['shadowFill']).toBe('illustrative-earthshine-like-fill');
    expect(body.material.userData['visualStyle']).toBe('observed-lro-regolith-with-lola-relief');
  });

  it('utilise la mosaïque Viking contrôlée pour la surface de Mars', () => {
    const visual = createCelestialVisual(createPlanet('mars'), 'high', assets);

    requestCelestialLodTextures(visual.lod);
    const body = visual.rotatingBody as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.MeshStandardMaterial
    >;
    const texture = body.material.map!;

    expect((texture.image as HTMLImageElement).src).toContain('textures/mars-viking-2048.jpg');
    expect(texture.userData['visualStyle']).toBe('observed-viking-colorized-mosaic');
    expect(texture.userData['scientificConfidence']).toBe('observed');
    expect(texture.userData['colorConfidence']).toBe('illustrative');
    expect(texture.repeat.x).toBe(1);
    expect(texture.offset.x).toBe(0);
    expect(texture.userData['longitudeConvention']).toBe('east-positive');
    expect(body.material.userData['visualStyle']).toBe('observed-planetary-surface');
  });

  it('distingue les observations radar de la couleur simulée sur Vénus', () => {
    const visual = createCelestialVisual(createPlanet('venus'), 'medium', assets);

    requestCelestialLodTextures(visual.lod);
    const body = visual.rotatingBody as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.MeshStandardMaterial
    >;
    const texture = body.material.map!;

    expect((texture.image as HTMLImageElement).src).toContain('textures/venus-magellan-1024.jpg');
    expect(texture.userData['visualStyle']).toBe('observed-magellan-radar-simulated-color');
    expect(texture.userData['scientificConfidence']).toBe('observed');
    expect(texture.userData['colorConfidence']).toBe('simulated');
    expect(texture.repeat.x).toBe(1);
    expect(texture.offset.x).toBe(0);
    expect(texture.userData['longitudeConvention']).toBe('east-positive');
    expect(body.material.userData['visualStyle']).toBe('radar-derived-planetary-surface');
  });

  it('identifie les nouvelles mosaïques de missions comme surfaces observées', () => {
    const visual = createCelestialVisual(createPlanet('enceladus'), 'medium', assets);
    const body = visual.rotatingBody as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.MeshStandardMaterial
    >;

    expect(body.material.userData['visualStyle']).toBe('observed-planetary-surface');
    expect(body.material.userData['scientificConfidence']).toBe('observed');
  });

  it.each([
    ['phobos', 'moon'],
    ['deimos', 'moon'],
    ['ceres', 'dwarf-planet'],
    ['vesta', 'asteroid'],
    ['bennu', 'asteroid'],
    ['67p-churyumov-gerasimenko', 'comet'],
  ] as const)('prépare la forme observée de %s en chargement différé', (id, type) => {
    const object = createPlanet(id);

    object.type = type;
    const visual = createCelestialVisual(object, 'high', assets);
    const fallback = visual.root.getObjectByName(`${id}-body`);

    expect(visual.rotatingBody).toBeInstanceOf(THREE.Group);
    expect(visual.rotatingBody?.name).toBe(`${id}-rotation-root`);
    expect(fallback).toBeInstanceOf(THREE.Mesh);
    expect(fallback?.parent).toBe(visual.rotatingBody);
    expect(visual.lod.deferredResources).toHaveLength(1);
  });

  it('ajoute une activité cométaire séparée de la rotation du noyau', () => {
    const object = createPlanet('halley');

    object.type = 'comet';
    object.cometActivity = {
      activationDistanceAu: 5,
      saturatedDistanceAu: 0.575,
      scientificConfidence: 'illustrative',
      source: 'NASA comet activity overview',
    };
    const visual = createCelestialVisual(object, 'medium', assets);

    expect(visual.cometActivity?.root.name).toBe('halley-activity');
    expect(visual.cometActivity?.root.parent).toBe(visual.lod.nearRoot);
    expect(visual.cometActivity?.root.parent).not.toBe(visual.rotatingBody);
    expect(visual.lod.nearMaterials).toHaveLength(4);
  });

  it('conserve le maillage sphérique direct pour un corps sans forme observée', () => {
    const visual = createCelestialVisual(createPlanet('eris'), 'high', assets);

    expect(visual.rotatingBody).toBeInstanceOf(THREE.Mesh);
    expect(visual.lod.deferredResources).toBeUndefined();
  });

  it('applique une silhouette tri-axiale mesurée sans nouvelle géométrie', () => {
    const phobos = createPlanet('phobos');

    phobos.type = 'moon';
    phobos.visual.visualRadius = 2;
    phobos.physical = {
      radiusKm: 11.08,
      shape: {
        type: 'triaxial-ellipsoid',
        dimensionsKm: [26.06, 22.8, 18.28],
        scientificConfidence: 'observed',
        source: 'NASA Planetary Data System',
      },
    };
    const visual = createCelestialVisual(phobos, 'medium', assets);
    const body = visual.root.getObjectByName('phobos-body');
    const hitTarget = visual.root.getObjectByName('phobos-selection-target');

    expect(visual.rotatingBody).toBeInstanceOf(THREE.Group);
    expect(body).toBeInstanceOf(THREE.Mesh);
    if (!(body instanceof THREE.Mesh)) {
      throw new Error('Corps tri-axial de Phobos absent.');
    }
    expect(body.geometry).toBe(assets.sphereGeometry);
    expect(body.scale.x / body.scale.z).toBeCloseTo(26.06 / 22.8, 10);
    expect(body.scale.y / body.scale.z).toBeCloseTo(18.28 / 22.8, 10);
    expect(body.scale.x * body.scale.y * body.scale.z).toBeCloseTo(8, 10);
    expect(body?.userData).toMatchObject({
      shapeDimensionsKm: [26.06, 22.8, 18.28],
      shapeScientificConfidence: 'observed',
      shapeSource: 'NASA Planetary Data System',
    });
    expect(hitTarget!.scale.x).toBeGreaterThan(2 * 1.45);
    expect(visual.lod.deferredResources).toHaveLength(1);
  });

  it('conserve les anneaux ronds dans le repère équatorial d’un corps allongé', () => {
    const haumea = createPlanet('haumea');

    haumea.type = 'dwarf-planet';
    haumea.visual.hasRings = true;
    haumea.physical = {
      radiusKm: 715,
      shape: {
        type: 'triaxial-ellipsoid',
        dimensionsKm: [2322, 1704, 1026],
        scientificConfidence: 'calculated',
        source: 'Ortiz et al. 2017',
      },
    };
    const visual = createCelestialVisual(haumea, 'high', assets);
    const rings = visual.root.getObjectByName('haumea-rings');

    expect(visual.rotatingBody).toBeInstanceOf(THREE.Group);
    expect(rings?.parent).toBe(visual.rotatingBody);
    expect(rings?.scale.toArray()).toEqual([1, 1, 1]);
  });

  it('conserve les trois corps rocheux sans texture coûteuse en qualité faible', () => {
    for (const id of ['moon', 'mars', 'venus']) {
      const visual = createCelestialVisual(createPlanet(id), 'low', assets);
      const body = visual.rotatingBody as THREE.Mesh<
        THREE.BufferGeometry,
        THREE.MeshStandardMaterial
      >;

      expect(body.material.map).toBeNull();
      expect(body.material.bumpMap).toBeNull();
    }
  });

  it('donne à Saturne un atlas atmosphérique NASA différé et identifié comme illustratif', () => {
    const saturn = createPlanet('saturn');

    saturn.visual.color = '#d7c193';
    saturn.visual.secondaryColor = '#9b835f';
    const visual = createCelestialVisual(saturn, 'high', assets);
    const body = visual.rotatingBody as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.MeshStandardMaterial
    >;
    const texture = body.material.map!;

    expect((texture.image as HTMLImageElement).getAttribute('src')).toBeNull();
    expect(requestCelestialLodTextures(visual.lod)).toBe(1);
    expect((texture.image as HTMLImageElement).src).toContain('textures/saturn-nasa-vtad-2048.jpg');
    expect(texture.anisotropy).toBe(8);
    expect(texture.userData['visualStyle']).toBe('illustrative-nasa-vtad-atmosphere-map');
    expect(texture.userData['scientificConfidence']).toBe('illustrative');
    expect(texture.userData['projectionTreatment']).toBe('cubemap-to-equirectangular');
    expect(body.material.emissiveMap).toBe(texture);
    expect(body.material.emissiveIntensity).toBeGreaterThan(0.1);
    expect(body.material.userData['shadowFill']).toBe('illustrative');
    expect(body.material.userData['visualStyle']).toBe('illustrative-atmospheric-snapshot');
    expect(body.material.userData['scientificConfidence']).toBe('illustrative');
  });

  it('conserve un remplissage illustratif sur la carte atmosphérique de Neptune', () => {
    const neptune = createPlanet('neptune');

    neptune.visual.color = '#356bc4';
    neptune.visual.secondaryColor = '#173477';
    const visual = createCelestialVisual(neptune, 'medium', assets);
    const body = visual.rotatingBody as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.MeshStandardMaterial
    >;

    expect(body.material.emissiveMap).toBe(body.material.map);
    expect(body.material.userData['shadowFill']).toBe('illustrative');
    expect(body.material.map?.userData[DEFERRED_TEXTURE_SOURCE]).toBe(
      'textures/neptune-nasa-vtad-1024.jpg',
    );
  });

  it('préserve un détail très discret sur la face nocturne d’une exoplanète', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(proceduralCanvasContext());
    const exoplanet = createPlanet('kepler-452-b');

    exoplanet.type = 'exoplanet';
    exoplanet.visual.color = '#73b7a5';
    exoplanet.visual.secondaryColor = '#436c72';
    const visual = createCelestialVisual(exoplanet, 'medium', assets);
    const body = visual.rotatingBody as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.MeshStandardMaterial
    >;

    expect(body.material.emissiveMap).toBe(body.material.map);
    expect(body.material.emissiveIntensity).toBeCloseTo(0.11);
    expect(body.material.userData['shadowFill']).toBe('illustrative');
  });

  it('place les anneaux dans le repère équatorial du corps en rotation', () => {
    const saturn = createPlanet('saturn');

    saturn.visual.hasRings = true;
    const visual = createCelestialVisual(saturn, 'low', assets);
    const rings = visual.root.getObjectByName('saturn-rings');

    expect(rings).toBeInstanceOf(THREE.Mesh);
    expect(rings?.parent).toBe(visual.rotatingBody);
    expect(rings?.scale.toArray()).toEqual([1, 1, 1]);
    expect(rings?.rotation.x).toBeCloseTo(Math.PI / 2);
    expect(rings?.rotation.z).toBeCloseTo(0);
  });
});

function createGalaxy(): SpaceObject {
  return {
    id: 'andromeda',
    name: 'Andromède',
    type: 'galaxy',
    referenceFrame: 'local-group',
    scientificConfidence: 'observed',
    visual: {
      color: '#b7c9e5',
      visualRadius: 520,
      scaleMode: 'adaptive',
      galaxyShape: 'spiral',
      galaxyAxisRatio: 0.35,
      galaxyRotationDegrees: 35,
    },
    positionProvider: {
      type: 'static',
      position: [-377, -288, 623],
      unit: 'kiloparsec',
    },
  };
}

function createPlanet(id: string): SpaceObject {
  return {
    id,
    name: id,
    type: 'planet',
    referenceFrame: 'solar-system',
    scientificConfidence: 'calculated',
    visual: {
      visualRadius: 1,
      scaleMode: 'adaptive',
      atmosphereColor: id === 'earth' ? '#5ca9e6' : undefined,
    },
    positionProvider: {
      type: 'static',
      position: [0, 0, 0],
      unit: 'astronomical-unit',
    },
  };
}

function visualCanvasContext(): CanvasRenderingContext2D {
  const gradient = { addColorStop: vi.fn() };

  return {
    createRadialGradient: vi.fn(() => gradient),
    fillRect: vi.fn(),
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D;
}

function proceduralCanvasContext(): CanvasRenderingContext2D {
  return {
    createImageData: vi.fn((width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
      colorSpace: 'srgb',
    })),
    putImageData: vi.fn(),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    save: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillStyle: '',
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
}
