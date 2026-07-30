import * as THREE from 'three';
import { SpaceObject } from '../../data/models/universe.models';
import {
  findLabelHit,
  getMaximumLabelCount,
  isLabelVisibleAtLevel,
  LabelManager,
  type LabelObject,
  type LabelHitRegion,
  type ScreenRectangle,
} from './label-manager';

const regions: LabelHitRegion[] = [
  {
    objectId: 'sirius',
    rectangle: {
      left: 100,
      top: 80,
      right: 180,
      bottom: 104,
    },
  },
];

describe('zones interactives des labels', () => {
  it('reconnaît un clic directement sur le nom', () => {
    expect(findLabelHit(regions, 140, 92)).toBe('sirius');
  });

  it('élargit légèrement la zone de clic sans capter les zones éloignées', () => {
    expect(findLabelHit(regions, 95, 92)).toBe('sirius');
    expect(findLabelHit(regions, 80, 92)).toBeNull();
  });
});

describe('hiérarchie des labels par échelle', () => {
  const star = createLabelObject('sirius', 'star', { galacticLabel: true });
  const secondaryStar = createLabelObject('procyon', 'star');
  const galaxy = createLabelObject('milky-way', 'galaxy');
  const neighboringGalaxy = createLabelObject('andromeda', 'galaxy');
  const region = createLabelObject('local-group', 'region');
  const brightestCatalogStar = createLabelObject('hyg-1', 'star', {
    catalogRecordIndex: 0,
  });
  const secondaryCatalogStar = createLabelObject('hyg-120', 'star', {
    catalogRecordIndex: 120,
  });
  const galacticCatalogStar = createLabelObject('hyg-50', 'star', {
    catalogRecordIndex: 50,
  });

  it('réserve les noms stellaires au voisinage et quelques repères à la galaxie', () => {
    expect(isLabelVisibleAtLevel(star, 0)).toBe(false);
    expect(isLabelVisibleAtLevel(star, 1)).toBe(true);
    expect(isLabelVisibleAtLevel(star, 2)).toBe(true);
    expect(isLabelVisibleAtLevel(star, 3)).toBe(true);
    expect(isLabelVisibleAtLevel(secondaryStar, 3)).toBe(false);
    expect(isLabelVisibleAtLevel(star, 4)).toBe(false);
  });

  it('réserve les galaxies voisines à la vue du Groupe local', () => {
    expect(isLabelVisibleAtLevel(galaxy, 2)).toBe(false);
    expect(isLabelVisibleAtLevel(galaxy, 3)).toBe(true);
    expect(isLabelVisibleAtLevel(neighboringGalaxy, 3)).toBe(false);
    expect(isLabelVisibleAtLevel(neighboringGalaxy, 4)).toBe(true);
  });

  it('révèle progressivement les noms HYG selon l’échelle', () => {
    expect(isLabelVisibleAtLevel(brightestCatalogStar, 0)).toBe(true);
    expect(isLabelVisibleAtLevel(brightestCatalogStar, 3)).toBe(true);
    expect(isLabelVisibleAtLevel(secondaryCatalogStar, 0)).toBe(false);
    expect(isLabelVisibleAtLevel(secondaryCatalogStar, 1)).toBe(false);
    expect(isLabelVisibleAtLevel(secondaryCatalogStar, 2)).toBe(true);
    expect(isLabelVisibleAtLevel(secondaryCatalogStar, 3)).toBe(false);
    expect(isLabelVisibleAtLevel(galacticCatalogStar, 3)).toBe(true);
    expect(isLabelVisibleAtLevel(galacticCatalogStar, 4)).toBe(false);
  });

  it('ne transforme pas une région de navigation en objet cartographique', () => {
    expect(isLabelVisibleAtLevel(region, 4)).toBe(false);
  });

  it('borne la densité selon la qualité et le niveau de détail', () => {
    expect(getMaximumLabelCount('low', 2)).toBe(14);
    expect(getMaximumLabelCount('medium', 2)).toBe(26);
    expect(getMaximumLabelCount('high', 2)).toBe(40);
    expect(getMaximumLabelCount('high', 0)).toBe(14);
    expect(getMaximumLabelCount('high', 3)).toBe(28);
    expect(getMaximumLabelCount('high', 4)).toBe(28);
  });
});

describe('LabelManager', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('signale explicitement l’absence de Canvas 2D', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    expect(() => new LabelManager(document.createElement('div'), [], 'medium')).toThrow(
      'Canvas 2D indisponible',
    );
  });

  it('gère son cycle de vie, ses dimensions, sa qualité et ses zones de clic', () => {
    const context = installContext();
    const container = document.createElement('div');
    const manager = new LabelManager(container, [], 'medium');
    const access = manager as unknown as LabelManagerAccess;

    manager.setEnabled(true);
    manager.setEnabled(false);
    manager.setEnabled(false);
    expect(manager.hitTest(10, 10)).toBeNull();
    manager.setEnabled(true);

    manager.resize(0, 100);
    manager.resize(100, 0);
    manager.resize(400, 300);
    manager.setQuality('medium');
    manager.setQuality('high');
    manager.setQuality('low');
    manager.setQuality('medium');
    manager.setTransientObject(createLabelObject('temporary', 'star'));
    manager.setHoveredObject('temporary');
    manager.setHoveredObject('temporary');
    manager.setHoveredObject(null);

    Object.defineProperty(access.canvas, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 20, top: 30, width: 400, height: 300 }),
    });
    access.hitRegions.push({
      objectId: 'earth',
      rectangle: { left: 90, top: 70, right: 130, bottom: 100 },
    });
    expect(manager.hitTest(120, 115)).toBe('earth');
    expect(manager.hitTest(300, 200)).toBeNull();

    manager.clear();
    expect(context.clearRect).toHaveBeenCalled();
    manager.dispose();
    expect(container.childElementCount).toBe(0);
    expect(access.candidates).toEqual([]);
    expect(access.occupiedRectangles).toEqual([]);
    expect(access.hitRegions).toEqual([]);
  });

  it('collecte, classe et complète les candidats visibles', () => {
    installContext();
    const objects: LabelObject[] = [
      createLabelObject('region', 'region'),
      createLabelObject('hidden-planet', 'planet'),
      createLabelObject('near-star', 'star'),
      createLabelObject('catalog-2', 'star', { catalogRecordIndex: 2 }),
      createLabelObject('catalog-1', 'star', { catalogRecordIndex: 1 }),
    ];
    const manager = new LabelManager(document.createElement('div'), objects, 'medium');
    const access = manager as unknown as LabelManagerAccess;
    const camera = cameraForLabels();
    const positions = new Map<string, THREE.Vector3>([
      ['near-star', new THREE.Vector3(0.1, 0, 0)],
      ['catalog-2', new THREE.Vector3(0.2, 0, 0)],
      ['catalog-1', new THREE.Vector3(0.3, 0, 0)],
      ['selected-hidden', new THREE.Vector3(0, 0, 0)],
      ['temporary', new THREE.Vector3(-0.2, 0, 0)],
    ]);
    const reader = (id: string, target: THREE.Vector3): THREE.Vector3 | null => {
      const position = positions.get(id);

      return position ? target.copy(position) : null;
    };

    access.collectCandidate(objects[0]!, camera, reader, 1, null);
    access.collectCandidate(objects[1]!, camera, reader, 4, null);
    access.collectCandidate(createLabelObject('missing', 'star'), camera, reader, 1, null);
    access.collectCandidate(
      createLabelObject('selected-hidden', 'planet'),
      camera,
      reader,
      4,
      'selected-hidden',
    );
    expect(access.candidates.map(({ object }) => object.id)).toEqual(['selected-hidden']);

    manager.setTransientObject(objects[2]!);
    access.collectCandidates(camera, reader, 1, null);
    expect(access.candidates.some(({ object }) => object.id === 'near-star')).toBe(true);

    manager.setTransientObject(createLabelObject('temporary', 'star'));
    access.collectCandidates(camera, reader, 1, 'catalog-2');
    expect(access.candidates[0]?.object.id).toBe('catalog-2');
    expect(access.candidates.map(({ object }) => object.id)).toContain('temporary');

    manager.setTransientObject(null);
    access.collectCandidates(camera, reader, 1, null);
  });

  it('rend les candidats, applique les exclusions écran et respecte le plafond', () => {
    const context = installContext();
    const manager = new LabelManager(document.createElement('div'), [], 'low');
    const access = manager as unknown as LabelManagerAccess;
    const camera = cameraForLabels();
    const center = new THREE.Vector3(0, 0, 0);
    const positions = new Map<string, THREE.Vector3 | null>([
      ['null', null],
      ['behind', new THREE.Vector3(0, 0, 20)],
      ['outside', new THREE.Vector3(3, 0, 0)],
      ['left', new THREE.Vector3(-0.98, 0, 0)],
      ['right', new THREE.Vector3(0.98, 0, 0)],
      ['center', center],
      ['selected', center],
    ]);
    const reader = (id: string, target: THREE.Vector3): THREE.Vector3 | null => {
      const position = positions.has(id) ? positions.get(id)! : center;

      return position ? target.copy(position) : null;
    };

    manager.resize(400, 300);
    vi.spyOn(access, 'collectCandidates').mockImplementation(() => undefined);
    const overlaps = vi.spyOn(access, 'overlapsExistingLabel').mockReturnValue(false);

    access.candidates.push(
      candidate('null'),
      candidate('behind'),
      candidate('outside'),
      candidate('left'),
      candidate('right'),
      candidate('center', 'planet'),
    );
    manager.render(camera, reader, 1, null, 1_000);
    manager.render(camera, reader, 1, null, 1_001);

    expect(context.fillText).toHaveBeenCalled();
    expect(access.hitRegions.length).toBeGreaterThan(0);

    access.lastRenderTime = Number.NEGATIVE_INFINITY;
    access.candidates.length = 0;
    for (let index = 0; index < 14; index += 1) {
      access.candidates.push(candidate(`visible-${index}`));
    }
    access.candidates.push(candidate('selected', 'star', true), candidate('never-rendered'));
    manager.render(camera, reader, 1, 'selected', 2_000);
    expect(access.hitRegions.some(({ objectId }) => objectId === 'selected')).toBe(true);

    manager.resize(1_000, 500);
    access.lastRenderTime = Number.NEGATIVE_INFINITY;
    access.candidates.length = 0;
    access.candidates.push(candidate('center'));
    overlaps.mockReturnValue(true);
    manager.render(camera, reader, 1, null, 2_500);

    manager.setEnabled(false);
    manager.render(camera, reader, 1, null, 3_000);
  });

  it('dessine toutes les variantes de cartouches, ancres et collisions', () => {
    const context = installContext(300);
    const manager = new LabelManager(document.createElement('div'), [], 'high');
    const access = manager as unknown as LabelManagerAccess;
    const planet = createLabelObject('earth', 'planet');
    const galaxy = createLabelObject('andromeda', 'galaxy');
    const star = createLabelObject('sirius', 'star');
    const catalog = createLabelObject('hyg-1', 'star', { catalogRecordIndex: 0 });

    const selectedRectangle = access.measureRectangle(planet, 100, 100, true);
    const galaxyRectangle = access.measureRectangle(galaxy, 100, 100, false);
    const starRectangle = access.measureRectangle(star, 100, 100, false);
    const catalogRectangle = access.measureRectangle(catalog, 100, 100, false);

    access.drawLabel(star, starRectangle, true, false);
    access.drawLabel(catalog, catalogRectangle, false, true);
    access.drawLabel(catalog, catalogRectangle, false, false);
    access.drawLabel(star, starRectangle, false, false);
    access.drawLabel(planet, selectedRectangle, false, false);
    access.drawLabel(galaxy, galaxyRectangle, false, false);
    access.drawAnchor(starRectangle, 100, 120, false, false);
    access.drawAnchor(starRectangle, 100, 120, true, false);
    access.drawAnchor(starRectangle, 100, 120, false, true);

    access.occupiedRectangles.push({ left: 10, top: 10, right: 40, bottom: 40 });
    expect(access.overlapsExistingLabel({ left: 20, top: 20, right: 30, bottom: 30 })).toBe(true);
    expect(access.overlapsExistingLabel({ left: 50, top: 20, right: 60, bottom: 30 })).toBe(false);
    expect(access.overlapsExistingLabel({ left: -20, top: 20, right: 0, bottom: 30 })).toBe(false);
    expect(access.overlapsExistingLabel({ left: 20, top: 50, right: 30, bottom: 60 })).toBe(false);
    expect(access.overlapsExistingLabel({ left: 20, top: -20, right: 30, bottom: 0 })).toBe(false);

    expect(context.stroke).toHaveBeenCalled();
    manager.dispose();
  });
});

interface LabelCandidateTest {
  object: LabelObject;
  distanceSquared: number;
  priority: number;
  selected: boolean;
}

interface LabelManagerAccess {
  readonly canvas: HTMLCanvasElement;
  readonly hitRegions: LabelHitRegion[];
  readonly candidates: LabelCandidateTest[];
  readonly occupiedRectangles: ScreenRectangle[];
  lastRenderTime: number;
  collectCandidates(
    camera: THREE.Camera,
    reader: (objectId: string, target: THREE.Vector3) => THREE.Vector3 | null,
    lodLevel: number,
    selectedId: string | null,
  ): void;
  collectCandidate(
    object: LabelObject,
    camera: THREE.Camera,
    reader: (objectId: string, target: THREE.Vector3) => THREE.Vector3 | null,
    lodLevel: number,
    selectedId: string | null,
  ): void;
  measureRectangle(
    object: LabelObject,
    centerX: number,
    baselineY: number,
    selected: boolean,
  ): ScreenRectangle;
  drawLabel(
    object: LabelObject,
    rectangle: ScreenRectangle,
    selected: boolean,
    hovered: boolean,
  ): void;
  drawAnchor(
    rectangle: ScreenRectangle,
    pointX: number,
    pointY: number,
    selected: boolean,
    hovered: boolean,
  ): void;
  overlapsExistingLabel(rectangle: ScreenRectangle): boolean;
}

interface ContextSpies {
  readonly clearRect: ReturnType<typeof vi.fn>;
  readonly fillText: ReturnType<typeof vi.fn>;
  readonly stroke: ReturnType<typeof vi.fn>;
}

function installContext(measuredWidth = 80): ContextSpies {
  const context = {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    measureText: vi.fn(() => ({ width: measuredWidth })),
    beginPath: vi.fn(),
    roundRect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    font: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    textAlign: 'start',
    textBaseline: 'alphabetic',
  };

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );

  return context;
}

function cameraForLabels(): THREE.OrthographicCamera {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);

  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();

  return camera;
}

function candidate(
  id: string,
  type: SpaceObject['type'] = 'star',
  selected = false,
): LabelCandidateTest {
  return {
    object: createLabelObject(id, type),
    distanceSquared: 1,
    priority: 0,
    selected,
  };
}

function createLabelObject(
  id: string,
  type: SpaceObject['type'],
  metadata?: SpaceObject['metadata'],
): SpaceObject {
  return {
    id,
    name: id,
    type,
    referenceFrame: type === 'galaxy' ? 'galactic' : 'stellar',
    scientificConfidence: 'observed',
    visual: {
      visualRadius: 1,
      scaleMode: 'adaptive',
    },
    positionProvider: {
      type: 'static',
      position: [0, 0, 0],
      unit: 'light-year',
    },
    ...(metadata ? { metadata } : {}),
  };
}
