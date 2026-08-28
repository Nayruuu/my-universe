import * as THREE from 'three';
import type { SpaceObject } from '../../data/models/universe.models';
import { calculateMilkyWayReferenceFrameScale } from '../coordinates/galaxy-scale-model';
import type { CelestialLodRepresentation } from '../materials/celestial-visual-factory';
import { PICKING_LAYER } from '../selection/selection-layers';
import {
  ObjectLodController,
  type ObjectLodEntry,
  type ObjectLodState,
} from './object-lod-controller';

describe('ObjectLodController', () => {
  it('actualise une représentation détaillée sélectionnée et ses matériaux', () => {
    const fixture = createFixture([
      object('sun', 'star'),
      object('earth', 'planet', 'sun', { atmosphereColor: '#75b9ff' }),
    ]);
    const earth = fixture.entries.get('earth')!;
    const texture = new THREE.Texture();
    const material = earth.lod.nearMaterials[0]!.material as THREE.ShaderMaterial;
    const deferredResource = { request: vi.fn(() => Promise.resolve()), dispose: vi.fn() };

    material.userData['photographicGlow'] = true;
    material.userData['appearanceOpacity'] = 0.5;
    earth.lod.farSprite!.userData['appearanceOpacity'] = 0.25;
    earth.lod.deferredTextures.push(texture);
    earth.lod.deferredResources = [deferredResource];
    fixture.camera.position.set(0, 0, 5);

    const result = fixture.controller.update(
      fixture.camera,
      900,
      state({ lodLevel: 4, selectedId: 'earth', navigationTargetId: 'sun' }),
      Number.POSITIVE_INFINITY,
    );

    expect(result.selectionMarkerScale).toBeGreaterThan(3);
    expect(earth.lod.visibilityBlend).toBe(1);
    expect(earth.lod.nearBlend).toBe(1);
    expect(earth.lod.deferredTexturesRequested).toBe(true);
    expect(deferredResource.request).toHaveBeenCalledOnce();
    expect(earth.lod.nearRoot?.visible).toBe(true);
    expect(material.opacity).toBeGreaterThan(0);
    expect(material.opacity).toBeLessThan(1);
    expect(material.depthWrite).toBe(true);
    expect(material.uniforms['layerOpacity']!.value).toBe(material.opacity);
    expect(earth.lod.farSprite?.visible).toBe(false);
    expect(earth.visualRoot.visible).toBe(true);
    expect(earth.pickTarget?.layers.isEnabled(PICKING_LAYER)).toBe(true);
    expect(earth.lunarEclipse?.setVisibilityBlend).toHaveBeenCalledWith(1);
    expect(earth.solarEclipse?.setVisibilityBlend).toHaveBeenCalledWith(1);
    expect(fixture.batch.commit).toHaveBeenCalledOnce();
  });

  it('ne charge pas une forme observée tant que sa représentation proche reste inactive', () => {
    const fixture = createFixture([object('bennu', 'asteroid')]);
    const bennu = fixture.entries.get('bennu')!;
    const deferredResource = { request: vi.fn(() => Promise.resolve()), dispose: vi.fn() };

    bennu.lod.deferredResources = [deferredResource];
    bennu.node.position.set(100_000, 0, 0);
    fixture.camera.position.set(0, 0, 0);
    fixture.controller.update(fixture.camera, 900, state({ lodLevel: 4 }), Infinity);

    expect(deferredResource.request).not.toHaveBeenCalled();
  });

  it('réserve une forme observée lourde à un objet proche réellement actif', () => {
    const fixture = createFixture([object('bennu', 'asteroid')]);
    const bennu = fixture.entries.get('bennu')!;
    const deferredResource = { request: vi.fn(() => Promise.resolve()), dispose: vi.fn() };

    bennu.lod.deferredResources = [deferredResource];
    fixture.camera.position.set(0, 0, 5);
    fixture.controller.update(fixture.camera, 900, state({ lodLevel: 0 }), Infinity);

    expect(bennu.lod.nearBlend).toBe(1);
    expect(deferredResource.request).not.toHaveBeenCalled();

    fixture.controller.update(
      fixture.camera,
      900,
      state({ lodLevel: 0, navigationTargetId: 'bennu' }),
      Infinity,
    );

    expect(deferredResource.request).toHaveBeenCalledOnce();
  });

  it('délègue les objets lointains au batch et masque les cibles individuelles', () => {
    const fixture = createFixture([object('m81', 'galaxy')], new Map([['m81', 0]]));
    const galaxy = fixture.entries.get('m81')!;

    galaxy.node.position.set(120_000, 0, 0);
    fixture.camera.position.set(0, 0, 0);
    const result = fixture.controller.update(
      fixture.camera,
      900,
      state({ lodLevel: 5 }),
      Number.POSITIVE_INFINITY,
    );

    expect(result.selectionMarkerScale).toBeNull();
    expect(galaxy.lod.nearRoot?.visible).toBe(false);
    expect(galaxy.lod.farSprite?.visible).toBe(false);
    expect(galaxy.pickTarget?.layers.isEnabled(PICKING_LAYER)).toBe(false);
    expect(fixture.batch.updatePoint).toHaveBeenCalledOnce();
    expect(fixture.batch.updatePoint.mock.calls[0]?.[0]).toBe(0);
    expect(fixture.batch.updatePoint.mock.calls[0]?.[3]).toBeGreaterThan(0);
  });

  it('limite la vue observateur au Soleil et à la Lune', () => {
    const fixture = createFixture([
      object('sun', 'star'),
      object('earth', 'planet', 'sun'),
      object('moon', 'moon', 'earth'),
      object('mars', 'planet', 'sun'),
    ]);

    fixture.camera.position.set(0, 0, 5);
    fixture.controller.update(
      fixture.camera,
      900,
      state({
        lodLevel: 0,
        selectedId: 'earth',
        navigationTargetId: 'earth',
        solarObserverActive: true,
        earthObserverActive: true,
      }),
      Number.POSITIVE_INFINITY,
    );

    expect(fixture.entries.get('sun')?.lod.visibilityBlend).toBe(1);
    expect(fixture.entries.get('moon')?.lod.visibilityBlend).toBe(1);
    expect(fixture.entries.get('earth')?.lod.visibilityBlend).toBe(0);
    expect(fixture.entries.get('earth')?.visualRoot.visible).toBe(false);
    expect(fixture.entries.get('mars')?.lod.visibilityBlend).toBe(0);
    expect(fixture.entries.get('sun')?.observerCorona?.visible).toBe(true);
    expect(fixture.entries.get('sun')?.observerCorona?.material.opacity).toBeGreaterThan(0);
  });

  it('retire les maquettes cartographiques dans le ciel terrestre', () => {
    const fixture = createFixture([
      object('sun', 'star'),
      object('earth', 'planet', 'sun'),
      object('moon', 'moon', 'earth'),
      object('mars', 'planet', 'sun'),
    ]);

    fixture.camera.position.set(0, 0, 5);
    fixture.controller.update(
      fixture.camera,
      900,
      state({
        lodLevel: 0,
        selectedId: 'mars',
        navigationTargetId: 'earth',
        earthObserverActive: true,
      }),
      Number.POSITIVE_INFINITY,
    );

    for (const entry of fixture.entries.values()) {
      expect(entry.lod.visibilityBlend).toBe(0);
      expect(entry.visualRoot.visible).toBe(false);
      expect(entry.pickTarget?.layers.isEnabled(PICKING_LAYER)).toBe(false);
    }
  });

  it('préserve le sous-groupe galactique actif et les ancêtres de navigation', () => {
    const fixture = createFixture([
      object('local-group', 'region'),
      object('milky-way', 'galaxy', 'local-group'),
      object('large-magellanic-cloud', 'galaxy', 'milky-way'),
      object('andromeda', 'galaxy', 'local-group'),
      object('m32', 'galaxy', 'andromeda'),
      object('triangulum', 'galaxy', 'andromeda'),
    ]);

    fixture.camera.position.set(0, 0, 2_800);
    fixture.controller.update(
      fixture.camera,
      900,
      state({ lodLevel: 3, navigationTargetId: 'm32' }),
      Number.POSITIVE_INFINITY,
    );

    expect(fixture.entries.get('andromeda')?.lod.visibilityBlend).toBe(1);
    expect(fixture.entries.get('m32')?.lod.visibilityBlend).toBe(1);
    expect(fixture.entries.get('triangulum')?.lod.visibilityBlend).toBe(1);
    expect(fixture.entries.get('large-magellanic-cloud')?.lod.visibilityBlend).toBe(0);

    fixture.controller.update(
      fixture.camera,
      900,
      state({ lodLevel: 0, selectedId: 'milky-way', navigationTargetId: 'milky-way' }),
      Number.POSITIVE_INFINITY,
    );
    expect(fixture.entries.get('milky-way')?.lod.visibilityBlend).toBe(0);
  });

  it('masque un objet stellaire comprimé mais conserve une cible active', () => {
    const stellarObject: SpaceObject = {
      ...object('stellar-host', 'star'),
      referenceFrame: 'stellar',
    };
    const fixture = createFixture([stellarObject]);
    const stellarHost = fixture.entries.get('stellar-host')!;

    fixture.camera.position.set(0, 0, 5);
    fixture.controller.update(
      fixture.camera,
      900,
      state({ lodLevel: 2 }),
      Number.POSITIVE_INFINITY,
    );

    expect(stellarHost.lod.visibilityBlend).toBe(1);
    expect(stellarHost.visualRoot.visible).toBe(true);

    fixture.controller.update(
      fixture.camera,
      900,
      state({ lodLevel: 2, stellarNeighborhoodReveal: 0 }),
      Number.POSITIVE_INFINITY,
    );

    expect(stellarHost.lod.visibilityBlend).toBe(0);
    expect(stellarHost.visualRoot.visible).toBe(false);

    fixture.controller.update(
      fixture.camera,
      900,
      state({
        lodLevel: 2,
        selectedId: 'stellar-host',
        stellarNeighborhoodReveal: 0,
      }),
      Number.POSITIVE_INFINITY,
    );

    expect(stellarHost.lod.visibilityBlend).toBe(1);
    expect(stellarHost.visualRoot.visible).toBe(true);
  });

  it('conserve un fondu identique du voisinage local de part et d’autre du seuil stellaire', () => {
    const exoplanet: SpaceObject = {
      ...object('kepler-b', 'exoplanet', 'kepler'),
      referenceFrame: 'stellar',
    };
    const fixture = createFixture([
      object('sun', 'star'),
      object('earth', 'planet', 'sun'),
      exoplanet,
    ]);

    fixture.camera.position.set(0, 0, 5);
    fixture.controller.update(
      fixture.camera,
      900,
      state({ lodLevel: 1, stellarNeighborhoodReveal: 0.45 }),
      Number.POSITIVE_INFINITY,
    );

    expect(fixture.entries.get('sun')?.lod.visibilityBlend).toBe(1);
    expect(fixture.entries.get('earth')?.lod.visibilityBlend).toBeCloseTo(0.45, 10);
    expect(fixture.entries.get('kepler-b')?.lod.visibilityBlend).toBeCloseTo(0.45, 10);

    fixture.controller.update(
      fixture.camera,
      900,
      state({ lodLevel: 2, stellarNeighborhoodReveal: 0.45 }),
      Number.POSITIVE_INFINITY,
    );

    expect(fixture.entries.get('earth')?.lod.visibilityBlend).toBeCloseTo(0.45, 10);
    expect(fixture.entries.get('kepler-b')?.lod.visibilityBlend).toBeCloseTo(0.45, 10);

    fixture.controller.update(
      fixture.camera,
      900,
      state({ lodLevel: 2, selectedId: 'earth', stellarNeighborhoodReveal: 0 }),
      Number.POSITIVE_INFINITY,
    );

    expect(fixture.entries.get('earth')?.lod.visibilityBlend).toBe(1);
    expect(fixture.entries.get('kepler-b')?.lod.visibilityBlend).toBe(0);
  });

  it('conserve le proxy de sélection de la Voie lactée sans rendre un second visuel', () => {
    const fixture = createFixture([object('milky-way', 'galaxy', 'local-group')]);
    const milkyWay = fixture.entries.get('milky-way')!;

    milkyWay.lod.farSprite!.userData['pickingProxyOnly'] = true;
    milkyWay.lod.farSprite!.material.colorWrite = false;
    fixture.camera.position.set(0, 0, 17_000);
    fixture.controller.update(
      fixture.camera,
      900,
      state({ lodLevel: 4, selectedId: 'milky-way', navigationTargetId: 'milky-way' }),
      Number.POSITIVE_INFINITY,
    );

    expect(milkyWay.lod.farAlpha).toBe(0);
    expect(milkyWay.lod.farSprite?.material.opacity).toBe(0);
    expect(milkyWay.lod.farSprite?.material.colorWrite).toBe(false);
    expect(milkyWay.lod.farSprite?.visible).toBe(true);
    expect(milkyWay.lod.farSprite?.userData['worldDiameter']).toBeCloseTo(
      calculateMilkyWayReferenceFrameScale(17_000).worldDiameter,
      6,
    );
    expect(milkyWay.lod.farSprite?.userData['minimumScreenDiameterApplied']).toBe(false);
    expect(milkyWay.lod.farSprite?.scale.x).toBeGreaterThan(306.601);
    expect(milkyWay.visualRoot.visible).toBe(true);
    expect(milkyWay.pickTarget?.layers.isEnabled(PICKING_LAYER)).toBe(true);

    fixture.controller.update(
      fixture.camera,
      900,
      state({ lodLevel: 6, selectedId: 'milky-way', navigationTargetId: 'milky-way' }),
      Number.POSITIVE_INFINITY,
    );
    expect(milkyWay.lod.farSprite?.visible).toBe(false);
    expect(milkyWay.pickTarget?.layers.isEnabled(PICKING_LAYER)).toBe(false);
  });

  it('conserve un diamètre physique monde sous une racine de référentiel redimensionnée', () => {
    const fixture = createFixture([object('andromeda', 'galaxy')]);
    const andromeda = fixture.entries.get('andromeda')!;
    const frameRoot = new THREE.Group();

    frameRoot.scale.setScalar(0.4);
    fixture.root.add(frameRoot);
    frameRoot.add(andromeda.node);
    andromeda.lod.farBaseDiameter = 100;
    fixture.camera.position.set(0, 0, 100);
    fixture.controller.update(
      fixture.camera,
      900,
      state({ lodLevel: 4, selectedId: 'andromeda' }),
      Number.POSITIVE_INFINITY,
    );

    expect(andromeda.lod.farSprite?.scale.x).toBeCloseTo(100, 8);
    expect(andromeda.lod.farSprite?.getWorldScale(new THREE.Vector3()).x).toBeCloseTo(40, 8);
  });

  it('synchronise la cible d’une galaxie avec son diamètre rendu à l’écran', () => {
    const fixture = createFixture([object('draco-dwarf', 'galaxy')]);
    const dwarf = fixture.entries.get('draco-dwarf')!;

    dwarf.lod.farBaseDiameter = 4.42;
    dwarf.pickTarget!.userData['renderDiameterRadiusMultiplier'] = 0.575;
    fixture.camera.position.set(0, 0, 760);
    fixture.controller.update(
      fixture.camera,
      900,
      state({ lodLevel: 4 }),
      Number.POSITIVE_INFINITY,
    );

    expect(dwarf.lod.farSprite?.scale.x).toBeGreaterThan(4.42);
    expect(dwarf.pickTarget?.scale.x).toBeCloseTo(dwarf.lod.farSprite!.scale.x * 0.575, 8);
  });
});

function createFixture(
  objects: readonly SpaceObject[],
  batchIndices: ReadonlyMap<string, number> = new Map(),
): {
  controller: ObjectLodController;
  entries: Map<string, ObjectLodEntry>;
  camera: THREE.PerspectiveCamera;
  root: THREE.Group;
  batch: {
    updatePoint: ReturnType<typeof vi.fn>;
    commit: ReturnType<typeof vi.fn>;
  };
} {
  const root = new THREE.Group();
  const entries = new Map<string, ObjectLodEntry>();
  const batch = {
    updatePoint: vi.fn(),
    commit: vi.fn(),
  };

  for (const definition of objects) {
    const node = new THREE.Group();
    const visualRoot = new THREE.Group();
    const nearRoot = new THREE.Group();
    const material = new THREE.ShaderMaterial({
      transparent: true,
      opacity: 1,
      uniforms: { layerOpacity: { value: 0 } },
    });
    const farSprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, opacity: 1 }));
    const pickTarget = new THREE.Object3D();
    const observerCorona = new THREE.Sprite(
      new THREE.SpriteMaterial({ transparent: true, opacity: 0 }),
    );
    const lod: CelestialLodRepresentation = {
      nearRoot,
      farSprite,
      nearMaterials: [{ material, baseOpacity: 1, baseDepthWrite: true }],
      deferredTextures: [],
      deferredTexturesRequested: false,
      nearBlend: 0,
      visibilityBlend: 0,
      farAlpha: 0,
      farBaseOpacity: 0.8,
      farBaseDiameter: 2,
      farAspectRatio: 1,
    };

    node.name = definition.id;
    node.add(visualRoot);
    visualRoot.add(nearRoot, farSprite);
    root.add(node);
    entries.set(definition.id, {
      definition,
      node,
      visualRoot,
      lunarEclipse: { setVisibilityBlend: vi.fn() },
      solarEclipse: { setVisibilityBlend: vi.fn() },
      observerCorona,
      lod,
      farBatchIndex: batchIndices.get(definition.id) ?? null,
      pickTarget,
    });
  }

  return {
    controller: new ObjectLodController(root, entries, batch, 'high'),
    entries,
    camera: new THREE.PerspectiveCamera(48, 1, 0.01, 1_000_000),
    root,
    batch,
  };
}

function state(overrides: Partial<ObjectLodState>): ObjectLodState {
  return {
    lodLevel: 0,
    selectedId: null,
    navigationTargetId: null,
    solarObserverActive: false,
    earthObserverActive: false,
    ...overrides,
  };
}

function object(
  id: string,
  type: SpaceObject['type'],
  parentId?: string,
  visual: Partial<SpaceObject['visual']> = {},
): SpaceObject {
  return {
    id,
    name: id,
    type,
    ...(parentId ? { parentId } : {}),
    referenceFrame: type === 'galaxy' || type === 'region' ? 'local-group' : 'solar-system',
    scientificConfidence: 'calculated',
    visual: {
      visualRadius: 1,
      scaleMode: 'adaptive',
      ...visual,
    },
    positionProvider: {
      type: 'static',
      position: [0, 0, 0],
      unit: 'astronomical-unit',
    },
  };
}
