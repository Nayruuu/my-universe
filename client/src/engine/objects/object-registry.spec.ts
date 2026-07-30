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
    registry.updateBodyRotations(ECLIPSE_TIME, null);
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

  it('synchronise la rotation terrestre et tolère un registre sans Terre', () => {
    const { registry } = createRegistry('low');
    const empty = new ObjectRegistry(new THREE.Group(), new CoordinateSystem(), [], 'low');

    expect(empty.synchronizeEarthRotation(ECLIPSE_TIME, 1)).toBe(true);
    expect(registry.synchronizeEarthRotation(ECLIPSE_TIME, -1)).toBe(false);
    expect(registry.synchronizeEarthRotation(ECLIPSE_TIME, Math.PI * 2)).toBe(true);

    empty.dispose();
    registry.dispose();
  });

  it('gère sélection, navigation, orbites et guide de rotation', () => {
    const { registry } = createRegistry('low');
    const access = registry as unknown as RegistryAccess;

    registry.select(null);
    registry.select('unknown');
    registry.select('region');
    expect(access.selectionMarker.parent).toBeNull();

    registry.select('andromeda');
    expect(access.selectionMarker.scale.x).toBeCloseTo(6);
    registry.select('mars');
    registry.setNavigationTarget('sun');
    access.currentLodLevel = 0;
    access.applyOrbitVisibility();
    access.applyRotationGuideVisibility();
    expect(access.rotationGuide.visible).toBe(true);
    expect(access.rotationGuide.userData['direction']).toBe('prograde');
    expect(access.orbitVisuals.get('mars')?.line.userData['active']).toBe(true);

    registry.select('venus');
    registry.setNavigationTarget('sun');
    access.applyRotationGuideVisibility();
    expect(access.rotationGuide.userData['direction']).toBe('retrograde');
    expect(access.rotationGuide.scale.z).toBe(-1);

    registry.select('bare-spinner');
    access.applyRotationGuideVisibility();
    registry.select('asteroid');
    registry.setNavigationTarget('sun');
    access.applyRotationGuideVisibility();
    expect(access.rotationGuide.userData['objectId']).toBe('sun');

    registry.setNavigationTarget(null);
    registry.select(null);
    access.applyRotationGuideVisibility();
    expect(access.rotationGuide.visible).toBe(false);

    registry.select('moon');
    registry.setNavigationTarget('earth');
    access.currentLodLevel = 2;
    access.applyOrbitVisibility();
    expect(access.orbitVisuals.get('moon')?.line.visible).toBe(true);
    access.currentLodLevel = 3;
    access.applyOrbitVisibility();
    expect(access.orbitVisuals.get('moon')?.line.visible).toBe(false);

    registry.setDisplayOptions(displayOptions(false));
    registry.setDisplayOptions(displayOptions(true));
    registry.setSolarObserverActive(true, 1.2);
    expect(access.orbitVisuals.get('moon')?.line.visible).toBe(false);
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

  it('affiche puis retire les trajectoires d’éclipse avec ou sans Terre', () => {
    const { registry } = createRegistry('low');
    const withoutEarth = new ObjectRegistry(
      new THREE.Group(),
      new CoordinateSystem(),
      [staticObject('sun', 'Soleil', 'star')],
      'low',
    );

    for (const kind of ['partial', 'annular', 'total'] satisfies EarthEclipseKind[]) {
      registry.showSolarEclipsePath(ECLIPSE_TIME, kind);
      registry.clearSolarEclipsePath();
    }
    withoutEarth.showSolarEclipsePath(ECLIPSE_TIME, 'partial');
    withoutEarth.clearSolarEclipsePath();

    registry.dispose();
    withoutEarth.dispose();
  });

  it('couvre les gardes privées et toutes les causes de masquage du marqueur', () => {
    const { registry } = createRegistry('low');
    const access = registry as unknown as RegistryAccess;
    const staticEntry = access.entries.get('asteroid')!;
    const earth = access.entries.get('earth')!;
    const mars = access.entries.get('mars')!;

    access.createOrbitLine(staticEntry);
    const marsParent = mars.definition.parentId;

    delete mars.definition.parentId;
    access.createOrbitLine(mars);
    mars.definition.parentId = marsParent;
    access.updateBodyRotation(access.entries.get('region')!, ECLIPSE_TIME);
    access.updateBodyRotation(staticEntry, ECLIPSE_TIME);
    access.updateBodyRotation(earth, ECLIPSE_TIME);
    access.updateBodyRotation(mars, ECLIPSE_TIME);

    access.solarObserverActive = false;
    access.solarEclipsePathActive = false;
    access.solarEclipseActive = false;
    access.rotationGuide.visible = false;
    access.applySelectionMarkerVisibility();
    expect(access.selectionMarker.visible).toBe(true);

    access.solarObserverActive = true;
    access.applySelectionMarkerVisibility();
    access.solarObserverActive = false;
    access.solarEclipsePathActive = true;
    access.applySelectionMarkerVisibility();
    access.solarEclipsePathActive = false;
    access.solarEclipseActive = true;
    access.applySelectionMarkerVisibility();
    access.solarEclipseActive = false;
    access.rotationGuide.visible = true;
    access.applySelectionMarkerVisibility();
    expect(access.selectionMarker.visible).toBe(false);

    registry.dispose();
  });

  it('libère une seule fois géométries, matériaux, sprites et textures partagés', () => {
    const { registry } = createRegistry('low');
    const access = registry as unknown as RegistryAccess;
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

    access.registryRoot.add(mesh, sprite);
    registry.dispose();

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
  readonly pickTarget: THREE.Object3D | null;
  readonly lod: {
    readonly nearRoot: THREE.Group | null;
    readonly farSprite: THREE.Sprite | null;
    visibilityBlend: number;
  };
}

interface RegistryAccess {
  readonly entries: Map<string, RegistryEntryAccess>;
  readonly orbitVisuals: Map<
    string,
    {
      readonly line: THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial>;
    }
  >;
  readonly registryRoot: THREE.Group;
  readonly rotationGuide: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  readonly selectionMarker: THREE.Sprite;
  currentLodLevel: number;
  solarObserverActive: boolean;
  solarEclipsePathActive: boolean;
  solarEclipseActive: boolean;
  createOrbitLine(entry: RegistryEntryAccess): void;
  updateBodyRotation(entry: RegistryEntryAccess, time: { julianDay: number }): void;
  applyOrbitVisibility(): void;
  applyRotationGuideVisibility(): void;
  applySelectionMarkerVisibility(): void;
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
      rotationPeriodHours: 609.12,
    }),
    ephemerisObject('earth', 'Terre', 'planet', 'sun', 'earth', 'sun', 365.256, {
      color: '#4c84bd',
      atmosphereColor: '#75b9ff',
      rotationPeriodHours: 23.934,
    }),
    ephemerisObject('moon', 'Lune', 'moon', 'earth', 'moon', 'earth', 27.321, {
      color: '#c7c2b8',
      rotationPeriodHours: 655.7,
    }),
    keplerianObject('mars', 'Mars', 'planet', 'sun', 1.52, 686.98, {
      color: '#c66f49',
      rotationPeriodHours: 24.623,
    }),
    keplerianObject('venus', 'Vénus', 'planet', 'sun', 0.72, 224.7, {
      atmosphereColor: '#e8cf87',
      rotationPeriodHours: -5832.5,
    }),
    staticObject('bare-spinner', 'Rotation nue', 'planet', {
      rotationPeriodHours: 12,
    }),
    staticObject('asteroid', 'Astéroïde', 'asteroid'),
    staticObject('sirius', 'Sirius', 'star', { color: '#dce8ff' }),
    staticObject('saturn', 'Saturne', 'planet', {
      color: '#d6bd8b',
      hasRings: true,
      rotationPeriodHours: 10.7,
    }),
    staticObject('uranus', 'Uranus', 'planet', {
      color: '#b8e1e8',
      hasRings: true,
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

function staticObject(
  id: string,
  name: string,
  type: SpaceObject['type'],
  visual: Partial<SpaceObject['visual']> = {},
): SpaceObject {
  return {
    id,
    name,
    type,
    referenceFrame: type === 'galaxy' ? 'local-group' : 'solar-system',
    scientificConfidence: 'calculated',
    visual: {
      visualRadius: visual.visualRadius ?? 1,
      scaleMode: 'adaptive',
      ...visual,
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
  visual: Partial<SpaceObject['visual']>,
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
  visual: Partial<SpaceObject['visual']>,
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

function displayOptions(showOrbits: boolean) {
  return {
    showOrbits,
    showLabels: true,
    quality: 'low' as const,
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
