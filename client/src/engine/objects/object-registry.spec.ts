import * as THREE from 'three';
import { GraphicQuality, SpaceObject } from '../../data/models/universe.models';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import { EarthEclipseKind } from '../simulation/earth-eclipse';
import { dateToJulianDay } from '../simulation/time-utils';
import { ObjectRegistry } from './object-registry';

const ECLIPSE_TIME = {
  julianDay: dateToJulianDay(new Date('2026-08-12T17:45:53.800Z')),
};

describe('ObjectRegistry', () => {
  beforeEach(() => {
    installCanvasContext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('construit la hiérarchie, calcule les positions et expose les objets', () => {
    const { registry, root } = createRegistry('low');
    const target = new THREE.Vector3();

    expect(registry.has('earth')).toBe(true);
    expect(registry.has('unknown')).toBe(false);
    expect(registry.getDefinition('earth')?.name).toBe('Terre');
    expect(registry.getDefinition('unknown')).toBeUndefined();
    expect(registry.getWorldPosition('unknown')).toBeNull();
    expect(registry.getWorldPosition('sun')).toBeInstanceOf(THREE.Vector3);
    expect(registry.getWorldPosition('earth', target)).toBe(target);
    expect(registry.getOrbitRadius('moon')).toBeGreaterThan(0);
    expect(registry.getOrbitRadius('mars')).toBeGreaterThan(0);
    expect(registry.getOrbitRadius('asteroid')).toBeNull();
    expect(registry.getPickables().length).toBeGreaterThan(1);

    const appearance = registry.updatePositions(ECLIPSE_TIME);

    expect(['partial', 'annular', 'total']).toContain(appearance.phase);
    registry.updateBodyRotations(ECLIPSE_TIME);
    expect(root.getObjectByName('astronomical-object-registry')).toBeDefined();

    const access = registry as unknown as RegistryAccess;

    for (const entry of access.entries.values()) {
      entry.lod.visibilityBlend = entry.definition.id === 'sun' ? 1 : 0;
    }
    expect(registry.visibleObjectCount).toBe(1);

    registry.dispose();
    expect(root.children).toHaveLength(0);
    expect(registry.getPickables()).toHaveLength(0);
  });

  it('actualise l’activité cométaire à partir de la distance héliocentrique', () => {
    const root = new THREE.Group();
    const sun = staticObject('sun', 'Soleil', 'star');
    const comet: SpaceObject = {
      ...staticObject('test-comet', 'Comète test', 'comet'),
      parentId: 'sun',
      cometActivity: {
        activationDistanceAu: 5,
        saturatedDistanceAu: 1,
        scientificConfidence: 'illustrative',
        source: 'NASA comet activity overview',
      },
      positionProvider: {
        type: 'static',
        position: [1, 0, 0],
        unit: 'astronomical-unit',
      },
    };
    const registry = new ObjectRegistry(root, new CoordinateSystem(), [sun, comet], 'low');

    registry.updatePositions(ECLIPSE_TIME);

    const activity = root.getObjectByName('test-comet-activity')!;
    const direction = new THREE.Vector3(0, 1, 0).applyQuaternion(activity.quaternion);

    expect(activity.visible).toBe(true);
    expect(direction.x).toBeCloseTo(1, 6);
    registry.dispose();
  });

  it('calcule toutes les orbites à la date scientifique demandée', () => {
    const phobos = keplerianObject('phobos', 'Phobos', 'moon', 'mars', 0.000_062_7, 0.3187, {
      rotationHours: 7.6538,
    });
    const staticMoon: SpaceObject = {
      ...staticObject('static-moon', 'Lune statique', 'moon'),
      parentId: 'mars',
    };
    const registryWithPhobos = new ObjectRegistry(
      new THREE.Group(),
      new CoordinateSystem(),
      [...diverseObjects(), phobos, staticMoon],
      'low',
    );
    const entries = (registryWithPhobos as unknown as RegistryAccess).entries;
    const scientificTime = { julianDay: 2_461_250.5 };
    const marsPosition = vi.spyOn(entries.get('mars')!.provider, 'getPositionAt');
    const moonPosition = vi.spyOn(entries.get('moon')!.provider, 'getPositionAt');
    const phobosPosition = vi.spyOn(entries.get('phobos')!.provider, 'getPositionAt');
    const staticMoonPosition = vi.spyOn(entries.get('static-moon')!.provider, 'getPositionAt');

    registryWithPhobos.updatePositions(scientificTime);

    expect(marsPosition).toHaveBeenCalledWith(scientificTime);
    expect(moonPosition).toHaveBeenCalledWith(scientificTime);
    expect(phobosPosition).toHaveBeenCalledWith(scientificTime);
    expect(staticMoonPosition).toHaveBeenCalledWith(scientificTime);

    phobosPosition.mockClear();
    registryWithPhobos.updatePositions(scientificTime);
    expect(phobosPosition).toHaveBeenCalledWith(scientificTime);
    registryWithPhobos.dispose();
  });

  it('expose un diagnostic de surface solide après stabilisation du LOD', () => {
    const { registry } = createRegistry('high');
    const camera = new THREE.PerspectiveCamera(48, 1, 0.01, 1_000_000);

    expect(registry.getVisualDiagnostics('unknown')).toBeNull();
    registry.updatePositions(ECLIPSE_TIME);
    const earthPosition = registry.getWorldPosition('earth')!;

    camera.position.copy(earthPosition).add(new THREE.Vector3(0, 0, 4.8));
    registry.select('earth');
    registry.setNavigationTarget('earth');
    registry.updateLod(camera, 900, 0, 2);

    const diagnostics = registry.getVisualDiagnostics('earth');

    expect(diagnostics).toMatchObject({
      objectId: 'earth',
      bodyPresent: true,
      bodyVisible: true,
      visualVisible: true,
      nearVisible: true,
      transparent: true,
      depthTest: true,
      depthWrite: true,
      surfaceTexture: {
        requested: true,
        loaded: false,
        source: expect.stringContaining('textures/earth-blue-marble-2048.jpg'),
        width: 0,
        height: 0,
      },
    });
    expect(diagnostics?.nearBlend).toBeGreaterThan(0.999);
    expect(diagnostics?.visibilityBlend).toBeGreaterThan(0.999);
    expect(diagnostics?.opacity).toBeGreaterThan(0.999);
    registry.dispose();
  });

  it('expose la position galactocentrique indépendamment du floating origin', () => {
    const root = new THREE.Group();
    const sun: SpaceObject = {
      ...staticObject('sun', 'Soleil', 'star'),
      referenceFrame: 'galactic',
      positionProvider: {
        type: 'static',
        position: [8.178, 0, 0],
        unit: 'kiloparsec',
      },
    };
    const registry = new ObjectRegistry(root, new CoordinateSystem(), [sun], 'low');

    registry.updatePositions(ECLIPSE_TIME);
    const galactocentric = registry.getSpacePosition('sun');

    expect(galactocentric?.x).toBeGreaterThan(2_000);
    expect(galactocentric?.y).toBe(0);
    expect(galactocentric?.z).toBe(0);

    root.position.set(-1_600, 25, -40);
    root.updateMatrixWorld(true);
    const world = registry.getWorldPosition('sun');

    expect(registry.getSpacePosition('sun')).toEqual(galactocentric);
    expect(world?.x).toBeCloseTo(galactocentric!.x - 1_600, 8);
    expect(registry.getSpacePosition('unknown')).toBeNull();
    registry.dispose();
  });

  it('laisse les étoiles liées à un catalogue au batch partagé', () => {
    const root = new THREE.Group();
    const linkedStar: SpaceObject = {
      ...staticObject('sirius', 'Sirius', 'star'),
      referenceFrame: 'stellar',
      positionProvider: {
        type: 'catalog',
        catalogId: 'hyg-v41-bright-stars',
        identifier: 'HIP 32349',
      },
    };
    const resolvedLinkedStar: SpaceObject = {
      ...staticObject('vega', 'Véga', 'star'),
      referenceFrame: 'stellar',
      metadata: { catalogPointRepresentation: true },
    };
    const ordinaryStar = staticObject('ordinary', 'Ordinaire', 'star');
    const registry = new ObjectRegistry(
      root,
      new CoordinateSystem(),
      [linkedStar, resolvedLinkedStar, ordinaryStar],
      'low',
    );

    registry.updatePositions(ECLIPSE_TIME);

    expect(registry.has('sirius')).toBe(false);
    expect(registry.has('vega')).toBe(false);
    expect(registry.has('ordinary')).toBe(true);
    registry.dispose();
  });

  it('ancre une étoile hôte héliocentrique au Soleil et son exoplanète à cette étoile', () => {
    const root = new THREE.Group();
    const milkyWay = {
      ...staticObject('milky-way', 'Voie lactée', 'galaxy'),
      referenceFrame: 'local-group' as const,
      positionProvider: {
        type: 'static' as const,
        position: [0, 0, 0] as [number, number, number],
        unit: 'kiloparsec' as const,
      },
    };
    const sun = {
      ...staticObject('sun', 'Soleil', 'star'),
      parentId: 'milky-way',
      referenceFrame: 'galactic' as const,
      positionProvider: {
        type: 'static' as const,
        position: [8.178, 0, 0] as [number, number, number],
        unit: 'kiloparsec' as const,
      },
    };
    const host = {
      ...staticObject('kepler-452', 'Kepler-452', 'star'),
      parentId: 'milky-way',
      referenceFrame: 'stellar' as const,
      positionProvider: {
        type: 'static' as const,
        position: [-114.227452241, 95.689533348, 531.223385135] as [number, number, number],
        unit: 'parsec' as const,
      },
    };
    const planet: SpaceObject = {
      ...staticObject('kepler-452-b', 'Kepler-452 b', 'exoplanet'),
      parentId: 'kepler-452',
      referenceFrame: 'stellar',
      positionProvider: {
        type: 'illustrative-orbit',
        semiMajorAxis: 1.046,
        orbitalPeriodDays: 384.843,
        epochJulianDay: 2_451_545,
        visualPhaseAtEpochDegrees: 0,
        visualInclinationDegrees: 0,
        unit: 'astronomical-unit',
        distanceScale: 3_800,
      },
    };
    const registry = new ObjectRegistry(
      root,
      new CoordinateSystem(),
      [milkyWay, sun, host, planet],
      'low',
    );

    registry.updatePositions({ julianDay: 2_451_545 });

    expect(root.getObjectByName('kepler-452')?.parent?.name).toBe('sun');
    expect(root.getObjectByName('kepler-452-b')?.parent?.name).toBe('kepler-452');
    expect(registry.getOrbitRadius('kepler-452-b')).toBeGreaterThan(15);
    registry.setNavigationTarget('kepler-452-b');
    const camera = new THREE.PerspectiveCamera(48, 1, 0.01, 1_000_000);
    const planetPosition = registry.getWorldPosition('kepler-452-b')!;

    camera.position.copy(planetPosition).add(new THREE.Vector3(0, 0, 5));
    registry.updateLod(camera, 900, 0, 2);
    const access = registry as unknown as RegistryAccess;

    expect(access.entries.get('kepler-452')?.lod.visibilityBlend).toBeGreaterThan(0.9);
    registry.dispose();
  });

  it('conserve le parent galactique d’une étoile héliocentrique si le Soleil est absent', () => {
    const root = new THREE.Group();
    const milkyWay = {
      ...staticObject('milky-way', 'Voie lactée', 'galaxy'),
      referenceFrame: 'local-group' as const,
    };
    const host = {
      ...staticObject('remote-host', 'Hôte distante', 'star'),
      parentId: 'milky-way',
      referenceFrame: 'stellar' as const,
    };
    const registry = new ObjectRegistry(root, new CoordinateSystem(), [milkyWay, host], 'low');

    expect(root.getObjectByName('remote-host')?.parent?.name).toBe('milky-way');
    registry.dispose();
  });

  it('diffère les géométries orbitales et les libère hors des échelles solaires', () => {
    const { registry } = createRegistry('low');
    const access = registry as unknown as RegistryAccess;
    const camera = new THREE.PerspectiveCamera(48, 1, 0.01, 1_000_000);

    camera.position.set(0, 0, 120);
    expect(orbitLines(access.registryRoot)).toHaveLength(0);

    registry.updateLod(camera, 900, 1, 2);
    expect(orbitLines(access.registryRoot).length).toBeGreaterThan(0);
    const orbit = orbitLine(access.registryRoot, 'mars');
    const disposeGeometry = vi.spyOn(orbit.geometry, 'dispose');
    const disposeMaterial = vi.spyOn(orbit.material, 'dispose');

    registry.updateLod(camera, 900, 3, 2);

    expect(orbitLines(access.registryRoot)).toHaveLength(0);
    expect(disposeGeometry).toHaveBeenCalledOnce();
    expect(disposeMaterial).toHaveBeenCalledOnce();

    registry.setNavigationTarget(null);
    registry.select(null);
    access.currentLodLevel = 2;
    access.applyOrbitVisibility();
    expect(orbitLines(access.registryRoot)).toHaveLength(0);
    registry.dispose();
  });

  it('incline les corps et leurs guides selon leur pôle IAU à la date simulée', () => {
    const { registry } = createRegistry('low');
    const access = registry as unknown as RegistryAccess;

    registry.updateBodyRotations({ julianDay: 2_451_545 });
    const uranus = access.entries.get('uranus')?.rotatingBody;

    expect(uranus).not.toBeNull();
    const north = new THREE.Vector3(0, 1, 0).applyQuaternion(uranus!.quaternion);

    expect(north.x).toBeCloseTo(-0.21199958, 6);
    expect(north.y).toBeCloseTo(0.134363, 6);
    expect(north.z).toBeCloseTo(0.96798903, 6);

    registry.select('uranus');
    registry.setNavigationTarget('sun');
    access.currentLodLevel = 0;
    access.updateActiveObjectAdornments();
    const rotationGuide = access.activeObjectAdornmentController.rotationGuide;

    rotationGuide.updateWorldMatrix(true, false);
    const guideNorth = new THREE.Vector3(0, 1, 0).transformDirection(rotationGuide.matrixWorld);

    expect(guideNorth.dot(north)).toBeCloseTo(1, 10);
    registry.dispose();
  });

  it('gère sélection, navigation, orbites et guide de rotation', () => {
    const { registry } = createRegistry('low');
    const access = registry as unknown as RegistryAccess;

    registry.select(null);
    registry.select('unknown');
    registry.select('region');
    const adornments = access.activeObjectAdornmentController;

    expect(adornments.selectionMarker.parent).toBeNull();

    registry.select('andromeda');
    expect(adornments.selectionMarker.scale.x).toBeCloseTo(6);
    registry.select('test-black-hole');
    expect(adornments.selectionMarker.scale.x).toBeCloseTo(10.4);
    expect(adornments.selectionMarker.visible).toBe(false);
    expect(registry.getAdornmentDiagnostics().selectionMarker.depthTest).toBe(true);
    expect(registry.getLensingForeground('test-black-hole')).toBeInstanceOf(THREE.Group);
    expect(registry.getLensingForeground('test-black-hole')?.name).toBe(
      'test-black-hole-lensing-foreground',
    );
    expect(registry.getLensingForeground('earth')).toBeNull();
    expect(registry.getLensingForeground('unknown')).toBeNull();
    registry.select('mars');
    registry.setNavigationTarget('sun');
    access.currentLodLevel = 0;
    access.applyOrbitVisibility();
    access.updateActiveObjectAdornments();
    expect(adornments.rotationGuide.visible).toBe(true);
    expect(adornments.rotationGuide.userData['direction']).toBe('prograde');
    expect(orbitLine(access.registryRoot, 'mars').userData['active']).toBe(true);
    expect(orbitLine(access.registryRoot, 'mars').material.color.getHexString()).toBe('ff9e83');
    expect(orbitLine(access.registryRoot, 'earth').material.color.getHexString()).toBe('43b4dd');
    expect(orbitLine(access.registryRoot, 'venus').material.color.getHexString()).toBe('e0a141');
    expect(
      new Set(
        ['earth', 'venus', 'mars'].map((objectId) =>
          orbitLine(access.registryRoot, objectId).material.color.getHexString(),
        ),
      ).size,
    ).toBe(3);

    registry.select('venus');
    registry.setNavigationTarget('sun');
    access.updateActiveObjectAdornments();
    expect(adornments.rotationGuide.userData['direction']).toBe('retrograde');
    expect(adornments.rotationGuide.scale.z).toBe(-1);

    registry.select('bare-spinner');
    access.updateActiveObjectAdornments();
    registry.select('asteroid');
    registry.setNavigationTarget('sun');
    access.updateActiveObjectAdornments();
    expect(adornments.rotationGuide.userData['objectId']).toBe('sun');

    registry.setNavigationTarget(null);
    registry.select(null);
    access.updateActiveObjectAdornments();
    expect(adornments.rotationGuide.visible).toBe(false);

    registry.select('moon');
    registry.setNavigationTarget('earth');
    access.currentLodLevel = 2;
    access.applyOrbitVisibility();
    expect(orbitLine(access.registryRoot, 'moon').visible).toBe(true);
    access.currentLodLevel = 3;
    access.applyOrbitVisibility();
    expect(access.registryRoot.getObjectByName('moon-orbit')).toBeUndefined();

    registry.setDisplayOptions(displayOptions(false));
    registry.setDisplayOptions(displayOptions(true));
    registry.setSolarObserverActive(true, 1.2);
    expect(orbitLines(access.registryRoot)).toHaveLength(0);
    registry.setSolarObserverActive(false);

    registry.dispose();
  });

  it('met à jour toutes les représentations LOD et l’observateur solaire', () => {
    const { registry } = createRegistry('low');
    const access = registry as unknown as RegistryAccess;
    const camera = new THREE.PerspectiveCamera(48, 1, 0.01, 1_000_000);

    camera.position.set(0, 0, 18);
    registry.updatePositions(ECLIPSE_TIME);
    registry.select('earth');
    registry.setNavigationTarget('earth');
    registry.updateLod(camera, 600, 0, 2);
    registry.updateLod(camera, 600, 0, 2);
    expect(registry.visibleObjectCount).toBeGreaterThan(0);

    registry.select('sirius');
    registry.setNavigationTarget(null);
    registry.updateLod(camera, 600, 3, 0);
    registry.updateLod(camera, 600, 4, 2);
    registry.setSolarObserverActive(true, 1.25);
    registry.updateLod(camera, 600, 0, 2);
    expect(access.entries.get('earth')?.visualRoot.visible).toBe(false);
    expect(access.entries.get('sun')?.observerCorona?.visible).toBe(true);

    registry.setSolarObserverActive(false);
    registry.select('andromeda');
    registry.updateLod(camera, 600, 4, 2);
    registry.select('region');
    registry.updateLod(camera, 600, 4, 2);

    const earth = access.entries.get('earth')!;

    earth.lod.visibilityBlend = 0;
    registry.updateLod(camera, 600, 4, 0);
    expect(earth.pickTarget?.layers.isEnabled(1)).toBe(false);

    registry.dispose();
  });

  it('synchronise le flash et le rémanent d’une supernova avec le temps et les fondus LOD', () => {
    const object = staticObject('sn-1987a', 'SN 1987A', 'supernova', {
      color: '#77d8ff',
      secondaryColor: '#ff6b8f',
      visualRadius: 1.8,
    });

    object.metadata = {
      visualPeakJulianDay: 2_446_849.5,
      supernovaRiseDays: 20,
      supernovaDecayDays: 650,
      shellFormationDays: 60,
      appearanceReferenceJulianDay: 2_461_257.5,
    };
    const registry = new ObjectRegistry(
      new THREE.Group(),
      new CoordinateSystem(),
      [object],
      'high',
    );
    const access = registry as unknown as RegistryAccess;
    const entry = access.entries.get('sn-1987a')!;
    const camera = new THREE.PerspectiveCamera(48, 1, 0.01, 1_000_000);
    const auxiliaryMaterial = new THREE.ShaderMaterial();

    entry.lod.nearMaterials.push({
      material: auxiliaryMaterial,
      baseOpacity: 1,
      baseDepthWrite: false,
    });
    entry.lod.nearRoot?.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), auxiliaryMaterial));

    registry.select('sn-1987a');
    registry.setNavigationTarget('sn-1987a');
    registry.updatePositions({ julianDay: 2_446_800 });
    camera.position.copy(entry.node.getWorldPosition(new THREE.Vector3())).addScalar(5);
    registry.updateLod(camera, 900, 2, 10);
    expect(entry.supernova?.phase).toBe('pre-event');
    expect(entry.lod.farSprite?.userData['appearanceOpacity']).toBe(0);

    registry.updatePositions({ julianDay: 2_446_849.5 });
    registry.updateLod(camera, 900, 2, 10);
    expect(entry.supernova?.phase).toBe('peak');
    expect(entry.supernova?.flash.visible).toBe(true);
    expect(entry.supernova?.shell.visible).toBe(false);
    expect(entry.supernova?.shell.material.uniforms['layerOpacity']!.value).toBe(0);

    registry.updatePositions({ julianDay: 2_461_257.5 });
    registry.updateLod(camera, 900, 2, 10);
    const shellMaterial = entry.supernova!.shell.material;

    expect(entry.supernova?.phase).toBe('remnant');
    expect(entry.supernova?.flash.visible).toBe(false);
    expect(entry.supernova?.shell.visible).toBe(true);
    expect(shellMaterial.opacity).toBeGreaterThan(0);
    expect(shellMaterial.uniforms['layerOpacity']!.value).toBe(shellMaterial.opacity);

    camera.position.set(0, 0, 100_000);
    registry.updateLod(camera, 900, 2, 10);
    expect(entry.lod.farSprite?.visible).toBe(true);
    expect(entry.lod.farSprite?.material.opacity).toBeGreaterThan(0);
    registry.dispose();
  });

  it('demande les textures statiques seulement au premier passage en LOD proche', () => {
    const { registry } = createRegistry('high');
    const access = registry as unknown as RegistryAccess;
    const camera = new THREE.PerspectiveCamera(48, 1, 0.01, 1_000_000);
    const earth = access.entries.get('earth')!;
    const mars = access.entries.get('mars')!;

    registry.updatePositions(ECLIPSE_TIME);
    expect(textureSources(earth)).toEqual([null, null, null]);
    expect(textureSources(mars)).toEqual([null]);

    camera.position.set(0, 0, 100_000);
    registry.updateLod(camera, 900, 4, 2);
    expect(textureSources(earth)).toEqual([null, null, null]);

    camera.position.copy(earth.node.getWorldPosition(new THREE.Vector3())).addScalar(2);
    registry.select('earth');
    registry.updateLod(camera, 900, 4, 2);

    expect(earth.lod.deferredTexturesRequested).toBe(true);
    expect(textureSources(earth).every((source) => source?.includes('textures/earth-'))).toBe(true);
    expect(mars.lod.deferredTexturesRequested).toBe(false);
    expect(textureSources(mars)).toEqual([null]);

    registry.updateLod(camera, 900, 4, 2);
    expect(earth.lod.deferredTexturesRequested).toBe(true);
    registry.dispose();
  }, 10_000);

  it('fond progressivement l’imposteur de la Voie lactée avec sa représentation galactique', () => {
    const registry = new ObjectRegistry(
      new THREE.Group(),
      new CoordinateSystem(),
      [
        staticObject('milky-way', 'Voie lactée', 'galaxy', {
          visualRadius: 360,
          galaxyShape: 'spiral',
        }),
      ],
      'low',
    );
    const access = registry as unknown as RegistryAccess;
    const camera = new THREE.PerspectiveCamera(48, 1, 0.01, 40_000);
    const sprite = access.entries.get('milky-way')!.lod.farSprite!;

    camera.position.set(0, 0, 9_600);
    registry.setNavigationTarget('milky-way');
    registry.updateLod(camera, 900, 3, 2);
    expect(sprite.visible).toBe(false);

    camera.position.set(0, 0, 13_300);
    registry.updateLod(camera, 900, 3, 2);
    expect(sprite.visible).toBe(true);
    const transitionOpacity = sprite.material.opacity;

    camera.position.set(0, 0, 17_000);
    registry.updateLod(camera, 900, 4, 2);
    expect(sprite.visible).toBe(true);
    expect(sprite.material.opacity).toBeGreaterThan(transitionOpacity);

    registry.updateLod(camera, 900, 6, 2);
    expect(sprite.visible).toBe(false);

    registry.select('milky-way');
    registry.setNavigationTarget('milky-way');
    registry.updateLod(camera, 900, 0, 2);
    expect(sprite.visible).toBe(false);
    registry.dispose();
  });

  it('agrandit les galaxies extragalactiques en priorisant le Groupe local', () => {
    const galaxy = staticObject('m81', 'Galaxie de Bode', 'galaxy', {
      visualRadius: 12,
      galaxyShape: 'spiral',
    });

    galaxy.metadata = { nearbyUniverseLabelRank: 1 };
    const registry = new ObjectRegistry(
      new THREE.Group(),
      new CoordinateSystem(),
      [galaxy],
      'high',
    );
    const access = registry as unknown as RegistryAccess;
    const camera = new THREE.PerspectiveCamera(48, 1, 0.01, 500_000);
    const sprite = access.entries.get('m81')!.lod.farSprite!;

    camera.position.set(0, 0, 120_000);
    registry.updateLod(camera, 900, 4, 10);
    const localGroupScale = sprite.scale.x;

    registry.updateLod(camera, 900, 5, 10);
    const nearbyUniverseScale = sprite.scale.x;

    expect(localGroupScale).toBeGreaterThan(nearbyUniverseScale * 1.2);
    registry.dispose();
  });

  it('batch les galaxies du catalogue tout en restaurant leur imposteur au focus', () => {
    const catalogGalaxy = staticObject('lv-ngc-test', 'NGC test', 'galaxy', {
      color: '#9fb9dd',
      visualRadius: 12,
      galaxyShape: 'spiral',
    });
    const curatedGalaxy = staticObject('m81', 'Galaxie de Bode', 'galaxy', {
      color: '#d7b07f',
      visualRadius: 18,
      galaxyShape: 'spiral',
    });

    catalogGalaxy.metadata = {
      nearbyUniverseLabelRank: 100,
      nearbyUniversePointBatch: true,
    };
    curatedGalaxy.metadata = { nearbyUniverseLabelRank: 1 };
    const registry = new ObjectRegistry(
      new THREE.Group(),
      new CoordinateSystem(),
      [catalogGalaxy, curatedGalaxy],
      'high',
    );
    const access = registry as unknown as RegistryAccess;
    const camera = new THREE.PerspectiveCamera(48, 1, 0.01, 500_000);
    const catalogEntry = access.entries.get('lv-ngc-test')!;
    const curatedEntry = access.entries.get('m81')!;
    const batchIds = access.farObjectBatch.points.userData['objectIds'] as string[];
    const catalogBatchIndex = batchIds.indexOf('lv-ngc-test');
    const visibleIndices = access.farObjectBatch.points.userData['visibleIndices'] as Uint8Array;

    expect(registry.batchedGalaxyCount).toBe(1);
    expect(catalogBatchIndex).toBeGreaterThanOrEqual(0);
    expect(batchIds).not.toContain('m81');

    camera.position.set(0, 0, 120_000);
    registry.updateLod(camera, 900, 5, 10);

    expect(access.farObjectBatch.points.visible).toBe(true);
    expect(visibleIndices[catalogBatchIndex]).toBe(1);
    expect(catalogEntry.lod.farSprite?.visible).toBe(false);
    expect(curatedEntry.lod.farSprite?.visible).toBe(true);

    registry.select('lv-ngc-test');
    registry.updateLod(camera, 900, 5, 10);

    expect(visibleIndices[catalogBatchIndex]).toBe(0);
    expect(catalogEntry.lod.farSprite?.visible).toBe(true);

    registry.select(null);
    registry.setNavigationTarget('lv-ngc-test');
    registry.updateLod(camera, 900, 5, 10);

    expect(visibleIndices[catalogBatchIndex]).toBe(0);
    expect(catalogEntry.lod.farSprite?.visible).toBe(true);

    registry.dispose();
  });

  it('conserve le sous-groupe galactique actif pendant le zoom contextuel', () => {
    const localGroup = staticObject('local-group', 'Groupe local', 'region');
    const milkyWay = {
      ...staticObject('milky-way', 'Voie lactée', 'galaxy', {
        visualRadius: 360,
        galaxyShape: 'spiral',
      }),
      parentId: 'local-group',
    };
    const largeMagellanicCloud = {
      ...staticObject('large-magellanic-cloud', 'Grand Nuage de Magellan', 'galaxy'),
      parentId: 'milky-way',
    };
    const andromeda = {
      ...staticObject('andromeda', 'Andromède', 'galaxy'),
      parentId: 'local-group',
    };
    const m32 = {
      ...staticObject('m32', 'M32', 'galaxy'),
      parentId: 'andromeda',
    };
    const triangulum = {
      ...staticObject('triangulum', 'Triangle', 'galaxy'),
      parentId: 'andromeda',
    };
    const registry = new ObjectRegistry(
      new THREE.Group(),
      new CoordinateSystem(),
      [localGroup, milkyWay, largeMagellanicCloud, andromeda, m32, triangulum],
      'high',
    );
    const camera = new THREE.PerspectiveCamera(48, 1, 0.01, 40_000);

    camera.position.set(0, 0, 2_800);
    registry.setNavigationTarget('andromeda');
    registry.updateLod(camera, 900, 3, 2);

    expect(registry.isVisibleForLabels('andromeda')).toBe(true);
    expect(registry.isVisibleForLabels('m32')).toBe(true);
    expect(registry.isVisibleForLabels('triangulum')).toBe(true);
    expect(registry.isVisibleForLabels('large-magellanic-cloud')).toBe(false);

    registry.setNavigationTarget('m32');
    registry.updateLod(camera, 900, 3, 2);
    expect(registry.isVisibleForLabels('triangulum')).toBe(true);

    registry.setNavigationTarget(null);
    registry.select('m32');
    registry.updateLod(camera, 900, 3, 2);
    expect(registry.isVisibleForLabels('andromeda')).toBe(true);
    expect(registry.isVisibleForLabels('triangulum')).toBe(true);

    registry.select(null);
    registry.updateLod(camera, 900, 3, 2);

    registry.setNavigationTarget('milky-way');
    registry.updateLod(camera, 900, 3, 2);
    expect(registry.isVisibleForLabels('milky-way')).toBe(true);
    expect(registry.isVisibleForLabels('large-magellanic-cloud')).toBe(true);
    expect(registry.isVisibleForLabels('andromeda')).toBe(false);

    registry.setNavigationTarget('local-group');
    registry.updateLod(camera, 900, 4, 2);
    expect(registry.isVisibleForLabels('andromeda')).toBe(true);
    expect(registry.isVisibleForLabels('large-magellanic-cloud')).toBe(true);
    expect(registry.isVisibleForLabels('unknown')).toBe(false);

    registry.dispose();
  });

  it('adapte les satellites contextuels au budget de qualité', () => {
    const localGroup = staticObject('local-group', 'Groupe local', 'region');
    const milkyWay = {
      ...staticObject('milky-way', 'Voie lactée', 'galaxy'),
      parentId: 'local-group',
    };
    const majorSatellite = {
      ...staticObject('large-magellanic-cloud', 'Grand Nuage de Magellan', 'galaxy'),
      parentId: 'milky-way',
      metadata: { mapLabelRank: 2 },
    };
    const faintSatellite = {
      ...staticObject('ursa-minor-dwarf', 'Galaxie naine de la Petite Ourse', 'galaxy'),
      parentId: 'milky-way',
      metadata: { mapLabelRank: 29 },
    };
    const registry = new ObjectRegistry(
      new THREE.Group(),
      new CoordinateSystem(),
      [localGroup, milkyWay, majorSatellite, faintSatellite],
      'low',
    );
    const camera = new THREE.PerspectiveCamera(48, 1, 0.01, 40_000);

    camera.position.set(0, 0, 2_800);
    registry.setNavigationTarget('milky-way');
    registry.updateLod(camera, 900, 3, 2);

    expect(registry.isVisibleForLabels('large-magellanic-cloud')).toBe(true);
    expect(registry.isVisibleForLabels('ursa-minor-dwarf')).toBe(false);

    registry.dispose();
  });

  it.each(['medium', 'high'] as const)(
    'construit et actualise aussi la qualité %s',
    (quality: GraphicQuality) => {
      const { registry } = createRegistry(quality);
      const camera = new THREE.PerspectiveCamera(48, 1, 0.01, 1_000_000);

      camera.position.set(0, 0, 80);
      registry.updatePositions(ECLIPSE_TIME);
      registry.updateLod(camera, 900, 1, 0.5);
      registry.dispose();
    },
  );

  it('affiche puis retire les trajectoires d’éclipse avec ou sans Terre', async () => {
    const { registry } = createRegistry('low');
    const withoutEarth = new ObjectRegistry(
      new THREE.Group(),
      new CoordinateSystem(),
      [staticObject('sun', 'Soleil', 'star')],
      'low',
    );

    for (const kind of ['partial', 'annular', 'total'] satisfies EarthEclipseKind[]) {
      await registry.showSolarEclipsePath(ECLIPSE_TIME, kind);
      registry.clearSolarEclipsePath();
    }
    await withoutEarth.showSolarEclipsePath(ECLIPSE_TIME, 'partial');
    withoutEarth.clearSolarEclipsePath();

    const cancelledPath = registry.showSolarEclipsePath(ECLIPSE_TIME, 'total');

    registry.clearSolarEclipsePath();
    await cancelledPath;

    registry.dispose();
    withoutEarth.dispose();
  });

  it('libère une seule fois géométries, matériaux, sprites et textures partagés', () => {
    const { registry } = createRegistry('low');
    const access = registry as unknown as RegistryAccess;
    const deferredResource = { request: vi.fn(() => Promise.resolve()), dispose: vi.fn() };
    const texture = new THREE.Texture();
    const firstMaterial = new THREE.MeshBasicMaterial({ map: texture });
    const secondMaterial = new THREE.MeshBasicMaterial();
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const geometry = new THREE.BoxGeometry();
    const mesh = new THREE.Mesh(geometry, [firstMaterial, secondMaterial]);
    const sprite = new THREE.Sprite(spriteMaterial);
    const textureDispose = vi.spyOn(texture, 'dispose');
    const geometryDispose = vi.spyOn(geometry, 'dispose');
    const firstDispose = vi.spyOn(firstMaterial, 'dispose');

    access.entries.get('earth')!.lod.deferredResources = [deferredResource];
    access.registryRoot.add(mesh, sprite);
    registry.dispose();

    expect(deferredResource.dispose).toHaveBeenCalledOnce();
    expect(textureDispose).toHaveBeenCalledOnce();
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(firstDispose).toHaveBeenCalledOnce();
  });
});

interface RegistryEntryAccess {
  readonly definition: SpaceObject;
  readonly node: THREE.Group;
  readonly visualRoot: THREE.Group;
  readonly rotatingBody: THREE.Object3D | null;
  readonly observerCorona: THREE.Sprite | null;
  readonly supernova: {
    readonly phase: string;
    readonly flash: THREE.Sprite;
    readonly shell: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  } | null;
  readonly provider: {
    getPositionAt(time: { julianDay: number }): { x: number; y: number; z: number };
  };
  readonly pickTarget: THREE.Object3D | null;
  readonly lod: {
    readonly nearRoot: THREE.Group | null;
    readonly farSprite: THREE.Sprite | null;
    readonly deferredTextures: THREE.Texture[];
    readonly deferredTexturesRequested: boolean;
    deferredResources?: Array<{
      request(): Promise<void>;
      dispose(): void;
    }>;
    readonly nearMaterials: Array<{
      material: THREE.Material;
      baseOpacity: number;
      baseDepthWrite: boolean;
    }>;
    visibilityBlend: number;
  };
}

function textureSources(entry: RegistryEntryAccess): Array<string | null> {
  return entry.lod.deferredTextures.map((texture) => {
    const image = texture.image as HTMLImageElement;

    return image.getAttribute('src');
  });
}

function orbitLines(
  root: THREE.Object3D,
): Array<THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial>> {
  const lines: Array<THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial>> = [];

  root.traverse((object) => {
    if (object.userData['kind'] === 'orbit') {
      lines.push(object as THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial>);
    }
  });

  return lines;
}

function orbitLine(
  root: THREE.Object3D,
  objectId: string,
): THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial> {
  const line = root.getObjectByName(`${objectId}-orbit`);

  expect(line).toBeInstanceOf(THREE.LineLoop);

  return line as THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial>;
}

interface RegistryAccess {
  readonly entries: Map<string, RegistryEntryAccess>;
  readonly activeObjectAdornmentController: {
    readonly rotationGuide: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
    readonly selectionMarker: THREE.Sprite;
  };
  readonly farObjectBatch: {
    readonly points: THREE.Points;
  };
  readonly registryRoot: THREE.Group;
  currentLodLevel: number;
  applyOrbitVisibility(): void;
  updateActiveObjectAdornments(): void;
}

function createRegistry(quality: GraphicQuality): {
  registry: ObjectRegistry;
  root: THREE.Group;
} {
  const root = new THREE.Group();

  return {
    registry: new ObjectRegistry(root, new CoordinateSystem(), diverseObjects(), quality),
    root,
  };
}

function diverseObjects(): SpaceObject[] {
  return [
    staticObject('sun', 'Soleil', 'star', {
      color: '#fff1c2',
      rotationHours: 609.12,
    }),
    ephemerisObject('earth', 'Terre', 'planet', 'sun', 'earth', 'sun', 365.256, {
      color: '#4c84bd',
      atmosphereColor: '#75b9ff',
      rotationHours: 23.934,
    }),
    ephemerisObject('moon', 'Lune', 'moon', 'earth', 'moon', 'earth', 27.321, {
      color: '#c7c2b8',
      rotationHours: 655.7,
    }),
    keplerianObject('mars', 'Mars', 'planet', 'sun', 1.52, 686.98, {
      color: '#c66f49',
      rotationHours: 24.623,
    }),
    keplerianObject('venus', 'Vénus', 'planet', 'sun', 0.72, 224.7, {
      atmosphereColor: '#e8cf87',
      rotationHours: -5832.5,
    }),
    staticObject('bare-spinner', 'Rotation nue', 'planet', {
      rotationHours: 12,
    }),
    staticObject('asteroid', 'Astéroïde', 'asteroid'),
    staticObject('sirius', 'Sirius', 'star', { color: '#dce8ff' }),
    staticObject('test-black-hole', 'Trou noir', 'black-hole', {
      visualRadius: 2,
      blackHoleActivity: 'dormant',
    }),
    staticObject('saturn', 'Saturne', 'planet', {
      color: '#d6bd8b',
      hasRings: true,
      rotationHours: 10.7,
    }),
    staticObject('uranus', 'Uranus', 'planet', {
      color: '#b8e1e8',
      hasRings: true,
      rotationHours: -17.24,
    }),
    staticObject('andromeda', 'Andromède', 'galaxy', {
      visualRadius: 12,
      galaxyShape: 'spiral',
      galaxyAxisRatio: 0.42,
    }),
    staticObject('triangulum', 'Triangle', 'galaxy', {
      visualRadius: 8,
    }),
    staticObject('region', 'Région', 'region'),
    {
      ...staticObject('orphan', 'Orphelin', 'planet'),
      parentId: 'missing',
    },
  ];
}

type VisualFixture = Partial<SpaceObject['visual']> & { rotationHours?: number };

function staticObject(
  id: string,
  name: string,
  type: SpaceObject['type'],
  visual: VisualFixture = {},
): SpaceObject {
  const { rotationHours, ...visualDefinition } = visual;

  return {
    id,
    name,
    type,
    referenceFrame: type === 'galaxy' ? 'local-group' : 'solar-system',
    scientificConfidence: 'calculated',
    ...(rotationHours === undefined ? {} : { rotation: rotationDefinition(id, rotationHours) }),
    visual: {
      visualRadius: visualDefinition.visualRadius ?? 1,
      scaleMode: 'adaptive',
      ...visualDefinition,
    },
    positionProvider: {
      type: 'static',
      position: id === 'sun' ? [0, 0, 0] : [2, 0, 0],
      unit: 'astronomical-unit',
    },
  };
}

function ephemerisObject(
  id: 'earth' | 'moon',
  name: string,
  type: 'planet' | 'moon',
  parentId: string,
  body: 'earth' | 'moon',
  origin: 'sun' | 'earth',
  orbitalPeriodDays: number,
  visual: VisualFixture,
): SpaceObject {
  return {
    ...staticObject(id, name, type, visual),
    parentId,
    positionProvider: {
      type: 'ephemeris',
      body,
      origin,
      orbitalPeriodDays,
      orbitEpochJulianDay: 2_451_545,
    },
  };
}

function keplerianObject(
  id: string,
  name: string,
  type: SpaceObject['type'],
  parentId: string,
  semiMajorAxis: number,
  orbitalPeriodDays: number,
  visual: VisualFixture,
): SpaceObject {
  return {
    ...staticObject(id, name, type, visual),
    parentId,
    positionProvider: {
      type: 'keplerian',
      semiMajorAxis,
      eccentricity: 0.02,
      inclination: 1,
      longitudeOfAscendingNode: 2,
      argumentOfPeriapsis: 3,
      meanAnomalyAtEpoch: 4,
      epochJulianDay: 2_451_545,
      orbitalPeriodDays,
      unit: 'astronomical-unit',
    },
  };
}

function rotationDefinition(
  objectId: string,
  signedPeriodHours: number,
): NonNullable<SpaceObject['rotation']> {
  return {
    siderealPeriodHours: Math.abs(signedPeriodHours),
    direction: signedPeriodHours < 0 ? 'retrograde' : 'prograde',
    bodyFixedFrame: objectId === 'earth' ? 'EARTH_GEOGRAPHIC' : `IAU_${objectId.toUpperCase()}`,
    orientationModel:
      objectId === 'earth'
        ? 'earth-geographic'
        : objectId === 'moon'
          ? 'iau-wgccre-2009'
          : 'iau-wgccre-2015',
    scientificConfidence: 'calculated',
    source: 'NASA/JPL test fixture',
  };
}

function displayOptions(showOrbits: boolean) {
  return {
    showOrbits,
    showConstellations: true,
    showLabels: true,
    quality: 'low' as const,
    labelDensity: 'balanced' as const,
    temporalMode: 'state' as const,
  };
}

function installCanvasContext(): void {
  const gradient = {
    addColorStop: vi.fn(),
  };
  const context = {
    createRadialGradient: vi.fn(() => gradient),
    fillRect: vi.fn(),
    save: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    clearRect: vi.fn(),
    setLineDash: vi.fn(),
    stroke: vi.fn(),
    createImageData: vi.fn((width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
    })),
    putImageData: vi.fn(),
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
  };

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
}
