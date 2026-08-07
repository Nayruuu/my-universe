import * as THREE from 'three';
import type { SpaceObject } from '../../data/models/universe.models';
import {
  ActiveObjectAdornmentController,
  type ActiveObjectAdornmentEntry,
} from './active-object-adornment-controller';

describe('ActiveObjectAdornmentController', () => {
  beforeEach(() => {
    installCanvasContext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('attache le marqueur et donne la priorité au corps sélectionné pour le guide', () => {
    const { root, entries, earth, venus } = createFixture();
    const controller = new ActiveObjectAdornmentController(root, entries, 'low');

    expect(controller.rotationGuide.geometry.getAttribute('position').count).toBe(82);

    controller.select('region');
    expect(controller.selectionMarker.parent).toBeNull();
    controller.select('unknown');
    expect(controller.selectionMarker.parent).toBeNull();
    controller.select(null);
    expect(controller.selectionMarker.parent).toBeNull();

    controller.select('earth');
    expect(controller.selectionMarker.parent).toBe(earth.node);
    expect(controller.selectionMarker.scale.x).toBeCloseTo(3.3);
    controller.setSelectionMarkerScale(12);
    controller.setSelectionMarkerScale(null);
    expect(controller.selectionMarker.scale.x).toBe(12);

    controller.update({
      selectedId: 'earth',
      navigationTargetId: 'venus',
      solarObserverActive: false,
      solarEclipsePathActive: false,
      solarEclipseActive: false,
      lodLevel: 0,
    });

    expect(controller.rotationGuide.parent).toBe(earth.rotatingBody);
    expect(controller.rotationGuide.visible).toBe(true);
    expect(controller.rotationGuide.scale.z).toBe(1);
    expect(controller.rotationGuide.material.color.getHexString()).toBe('75b9ff');
    expect(controller.rotationGuide.userData['objectId']).toBe('earth');
    expect(controller.rotationGuide.userData['direction']).toBe('prograde');
    expect(controller.selectionMarker.visible).toBe(false);
    expect(controller.getDiagnostics()).toEqual({
      selectionMarker: { depthTest: true },
      rotationGuide: {
        visible: true,
        objectId: 'earth',
        direction: 'prograde',
        style: 'moving-highlight',
        parentName: '',
        directionScale: 1,
        vertexCount: 82,
        hasVertexColors: true,
      },
    });

    controller.select('asteroid');
    controller.update({
      selectedId: 'asteroid',
      navigationTargetId: 'venus',
      solarObserverActive: false,
      solarEclipsePathActive: false,
      solarEclipseActive: false,
      lodLevel: 0,
    });

    expect(controller.rotationGuide.parent).toBe(venus.rotatingBody);
    expect(controller.rotationGuide.scale.z).toBe(-1);
    expect(controller.rotationGuide.material.color.getHexString()).toBe('d6a45f');
    expect(controller.rotationGuide.userData['direction']).toBe('retrograde');

    controller.update({
      selectedId: 'bare-spinner',
      navigationTargetId: 'earth',
      solarObserverActive: false,
      solarEclipsePathActive: false,
      solarEclipseActive: false,
      lodLevel: 0,
    });
    expect(controller.rotationGuide.parent).toBe(earth.rotatingBody);

    controller.update({
      selectedId: null,
      navigationTargetId: null,
      solarObserverActive: false,
      solarEclipsePathActive: false,
      solarEclipseActive: false,
      lodLevel: 0,
    });
    expect(controller.rotationGuide.visible).toBe(false);
    expect(controller.rotationGuide.userData['objectId']).toBeNull();
    expect(controller.getDiagnostics().rotationGuide.objectId).toBeNull();

    controller.dispose();
  });

  it('masque les ornements selon le niveau, l’observateur et les éclipses', () => {
    const { root, entries } = createFixture();
    const controller = new ActiveObjectAdornmentController(root, entries, 'medium');
    const baseState = {
      selectedId: 'earth',
      navigationTargetId: null,
      solarObserverActive: false,
      solarEclipsePathActive: false,
      solarEclipseActive: false,
      lodLevel: 1,
    } as const;

    expect(controller.rotationGuide.geometry.getAttribute('position').count).toBe(114);
    controller.select('earth');
    controller.update(baseState);
    expect(controller.rotationGuide.visible).toBe(false);
    expect(controller.selectionMarker.visible).toBe(true);

    controller.update({ ...baseState, solarObserverActive: true });
    expect(controller.selectionMarker.visible).toBe(false);
    controller.update({ ...baseState, solarEclipsePathActive: true });
    expect(controller.selectionMarker.visible).toBe(false);
    controller.update({ ...baseState, solarEclipseActive: true });
    expect(controller.selectionMarker.visible).toBe(false);

    controller.select('black-hole');
    controller.update({ ...baseState, selectedId: 'black-hole' });
    expect(controller.selectionMarker.visible).toBe(false);

    controller.dispose();
  });

  it('construit le guide haute qualité et libère le marqueur', () => {
    const { root, entries } = createFixture();
    const controller = new ActiveObjectAdornmentController(root, entries, 'high');
    const disposeTexture = vi.spyOn(controller.selectionMarker.material.map!, 'dispose');
    const disposeMaterial = vi.spyOn(controller.selectionMarker.material, 'dispose');

    expect(controller.rotationGuide.geometry.getAttribute('position').count).toBe(146);
    controller.select('black-hole');
    expect(controller.selectionMarker.scale.x).toBeCloseTo(10.4);
    controller.dispose();

    expect(controller.selectionMarker.parent).toBeNull();
    expect(disposeTexture).toHaveBeenCalledOnce();
    expect(disposeMaterial).toHaveBeenCalledOnce();
  });

  it('retourne des diagnostics sûrs lorsque le guide est détaché ou incomplet', () => {
    const { root, entries } = createFixture();
    const controller = new ActiveObjectAdornmentController(root, entries, 'low');

    controller.rotationGuide.userData['style'] = 42;
    controller.rotationGuide.removeFromParent();
    controller.rotationGuide.geometry.deleteAttribute('position');

    expect(controller.getDiagnostics().rotationGuide).toEqual({
      visible: false,
      objectId: null,
      direction: null,
      style: null,
      parentName: null,
      directionScale: 1,
      vertexCount: 0,
      hasVertexColors: false,
    });

    controller.dispose();
  });
});

function createFixture(): {
  root: THREE.Group;
  entries: Map<string, ActiveObjectAdornmentEntry>;
  earth: ActiveObjectAdornmentEntry;
  venus: ActiveObjectAdornmentEntry;
} {
  const root = new THREE.Group();
  const earth = entry(
    object('earth', 'planet', 'prograde', {
      color: '#4c84bd',
      atmosphereColor: '#75b9ff',
    }),
    true,
  );
  const venus = entry(
    object('venus', 'planet', 'retrograde', {
      color: '#d6a45f',
    }),
    true,
  );
  const values = [
    earth,
    venus,
    entry(object('bare-spinner', 'planet', 'prograde'), false),
    entry(object('asteroid', 'asteroid'), false),
    entry(object('region', 'region'), false),
    entry(object('black-hole', 'black-hole', undefined, { visualRadius: 2 }), false),
  ];

  return {
    root,
    entries: new Map(values.map((value) => [value.definition.id, value])),
    earth,
    venus,
  };
}

function entry(definition: SpaceObject, withRotatingBody: boolean): ActiveObjectAdornmentEntry {
  const node = new THREE.Group();
  const rotatingBody = withRotatingBody ? new THREE.Group() : null;

  if (rotatingBody) {
    node.add(rotatingBody);
  }

  return { definition, node, rotatingBody };
}

function object(
  id: string,
  type: SpaceObject['type'],
  direction?: 'prograde' | 'retrograde',
  visual: Partial<SpaceObject['visual']> = {},
): SpaceObject {
  return {
    id,
    name: id,
    type,
    referenceFrame: 'solar-system',
    scientificConfidence: 'calculated',
    ...(direction
      ? {
          rotation: {
            siderealPeriodHours: 24,
            direction,
            bodyFixedFrame: `IAU_${id.toUpperCase()}`,
            orientationModel: 'iau-wgccre-2015' as const,
            scientificConfidence: 'calculated' as const,
            source: 'Test fixture',
          },
        }
      : {}),
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

function installCanvasContext(): void {
  const context = {
    clearRect: vi.fn(),
    setLineDash: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    strokeStyle: '',
    lineWidth: 1,
  };

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
}
