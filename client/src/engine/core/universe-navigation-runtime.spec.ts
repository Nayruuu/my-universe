import * as THREE from 'three';
import { type Mock } from 'vitest';
import { type SpaceObject } from '../../data/models/universe.models';
import { LodManager } from '../lod/lod-manager';
import {
  type NavigationCameraController,
  UniverseNavigationRuntime,
} from './universe-navigation-runtime';

describe('UniverseNavigationRuntime', () => {
  it('adopte, suit et libère une cible sans dépendre du moteur principal', () => {
    const harness = createHarness();

    harness.runtime.restoreTarget('earth');
    expect(harness.runtime.targetId).toBe('earth');

    harness.runtime.adoptTarget('earth');
    harness.runtime.follow(harness.controller);
    expect(harness.setNavigationTarget).toHaveBeenCalledWith('earth');
    expect(harness.controller.follow).toHaveBeenCalledWith(harness.positions.get('earth'));

    harness.runtime.handleNavigationIntent(harness.controller, 'mars');
    expect(harness.runtime.targetId).toBe('mars');
    expect(harness.controller.adoptZoomTarget).toHaveBeenCalledWith(
      harness.positions.get('mars'),
      harness.definitions.get('mars'),
    );
    expect(harness.emitTargetChanged).toHaveBeenLastCalledWith('mars');

    harness.emitTargetChanged.mockClear();
    harness.runtime.handleNavigationIntent(harness.controller, 'mars');
    harness.runtime.handleNavigationIntent(harness.controller, 'unknown');
    expect(harness.emitTargetChanged).not.toHaveBeenCalled();

    harness.runtime.handleNavigationIntent(harness.controller, null);
    expect(harness.controller.releaseTarget).toHaveBeenCalledOnce();
    expect(harness.setNavigationTarget).toHaveBeenLastCalledWith(null);
    expect(harness.emitTargetChanged).toHaveBeenLastCalledWith(null);

    harness.emitTargetChanged.mockClear();
    harness.runtime.releaseTarget(null);
    harness.runtime.follow(null);
    harness.runtime.restoreTarget('unknown');
    harness.runtime.follow(harness.controller);
    expect(harness.emitTargetChanged).not.toHaveBeenCalled();
    expect(harness.controller.follow).toHaveBeenCalledOnce();

    harness.runtime.reset();
    expect(harness.runtime.targetId).toBeNull();
  });

  it('stabilise les ancres de zoom et change de référentiel avec la hiérarchie', () => {
    const harness = createHarness();

    harness.runtime.adoptTarget('earth');
    harness.runtime.handleSemanticZoomIntent(harness.controller, 'mars', -120);
    expect(harness.runtime.targetId).toBe('mars');
    expect(harness.controller.adoptZoomAnchor).toHaveBeenCalledWith(harness.positions.get('mars'));
    expect(harness.controller.trackTarget).toHaveBeenCalledWith(
      harness.positions.get('mars'),
      harness.definitions.get('mars'),
    );
    expect(harness.runtime.lastZoomAnchor).toEqual({
      anchorType: 'object',
      anchorObjectId: 'mars',
    });

    harness.controller.isTransitioning = true;
    harness.runtime.handleSemanticZoomIntent(harness.controller, 'earth', -120, {
      x: 0.4,
      y: -0.2,
    });
    expect(harness.controller.adoptZoomPointer).toHaveBeenLastCalledWith(0.4, -0.2);
    expect(harness.runtime.targetId).toBe('mars');

    harness.controller.isTransitioning = false;
    harness.controller.controls.target.set(3, -1, 2);
    harness.runtime.handleSemanticZoomIntent(harness.controller, null, 120);
    expect(harness.controller.adoptZoomAnchor).toHaveBeenLastCalledWith(
      harness.controller.controls.target,
    );
    expect(harness.runtime.lastZoomAnchor).toEqual({
      anchorType: 'target',
      anchorObjectId: null,
    });

    harness.runtime.adoptTarget('earth');
    harness.runtime.synchronizeContext(harness.controller, 3);
    expect(harness.runtime.targetId).toBe('milky-way');
    expect(harness.controller.transitionReferenceFrame).toHaveBeenCalledWith(
      harness.positions.get('milky-way'),
      harness.definitions.get('milky-way'),
    );
    expect(harness.runtime.resolveContext(3)).toMatchObject({
      targetId: 'milky-way',
      referenceFrame: 'galactic',
    });

    harness.positions.delete('local-group');
    harness.runtime.synchronizeContext(harness.controller, 4);
    expect(harness.runtime.targetId).toBe('milky-way');

    harness.runtime.handleSemanticZoomIntent(null, 'earth', -120);
  });

  it('synchronise la cible lors d’un changement de niveau produit par le zoom direct', () => {
    const harness = createHarness();

    harness.runtime.adoptTarget('earth');
    harness.controller.zoomBy.mockImplementation(() => {
      harness.controller.distanceToTarget = 9_600;
    });
    harness.runtime.zoomBy(harness.controller, 1.5);

    expect(harness.controller.zoomBy).toHaveBeenCalledWith(1.5);
    expect(harness.runtime.targetId).toBe('milky-way');
    expect(harness.controller.transitionReferenceFrame).toHaveBeenCalledOnce();

    harness.runtime.zoomBy(null, 0.5);
  });
});

function createHarness(): {
  readonly runtime: UniverseNavigationRuntime;
  readonly controller: MutableNavigationCameraController;
  readonly definitions: Map<string, SpaceObject>;
  readonly positions: Map<string, THREE.Vector3>;
  readonly setNavigationTarget: ReturnType<typeof vi.fn>;
  readonly emitTargetChanged: ReturnType<typeof vi.fn>;
} {
  const definitions = new Map<string, SpaceObject>([
    ['earth', object('earth', 'Terre', 'planet', 'sun')],
    ['mars', object('mars', 'Mars', 'planet', 'sun')],
    ['sun', object('sun', 'Soleil', 'star', 'milky-way')],
    ['milky-way', object('milky-way', 'Voie lactée', 'galaxy', 'local-group')],
    [
      'local-group',
      object('local-group', 'Groupe local', 'region', 'nearby-universe', 'local-group'),
    ],
    [
      'nearby-universe',
      object('nearby-universe', 'Univers proche', 'region', 'cosmic-web', 'nearby-universe'),
    ],
    ['cosmic-web', object('cosmic-web', 'Réseau cosmique', 'universe', undefined, 'cosmic-web')],
  ]);
  const positions = new Map(
    [...definitions.keys()].map((objectId, index) => [
      objectId,
      new THREE.Vector3(index + 1, index * 0.5, -index),
    ]),
  );
  const setNavigationTarget = vi.fn();
  const emitTargetChanged = vi.fn();
  const lodManager = new LodManager();
  const runtime = new UniverseNavigationRuntime({
    hasPrimaryRegistry: () => true,
    getDefinition: (objectId) => definitions.get(objectId),
    getWorldPosition: (objectId, target = new THREE.Vector3()) => {
      const position = positions.get(objectId);

      return position ? target.copy(position) : null;
    },
    setNavigationTarget,
    selectLodLevel: (distance) => lodManager.selectLevel(distance),
    emitTargetChanged,
  });
  const controller: MutableNavigationCameraController = {
    controls: { target: new THREE.Vector3() },
    distanceToTarget: 24,
    isTransitioning: false,
    adoptZoomAnchor: vi.fn<NavigationCameraController['adoptZoomAnchor']>(),
    adoptZoomPointer: vi.fn<NavigationCameraController['adoptZoomPointer']>(),
    adoptZoomTarget: vi.fn<NavigationCameraController['adoptZoomTarget']>(),
    trackTarget: vi.fn<NavigationCameraController['trackTarget']>(),
    zoomSemantically: vi.fn<NavigationCameraController['zoomSemantically']>(),
    zoomBy: vi.fn<NavigationCameraController['zoomBy']>(),
    transitionReferenceFrame: vi.fn<NavigationCameraController['transitionReferenceFrame']>(),
    releaseTarget: vi.fn<NavigationCameraController['releaseTarget']>(),
    follow: vi.fn<NavigationCameraController['follow']>(),
  };

  return {
    runtime,
    controller,
    definitions,
    positions,
    setNavigationTarget,
    emitTargetChanged,
  };
}

type MutableNavigationCameraController = Omit<
  NavigationCameraController,
  | 'distanceToTarget'
  | 'isTransitioning'
  | 'adoptZoomAnchor'
  | 'adoptZoomPointer'
  | 'adoptZoomTarget'
  | 'trackTarget'
  | 'zoomSemantically'
  | 'zoomBy'
  | 'transitionReferenceFrame'
  | 'releaseTarget'
  | 'follow'
> & {
  distanceToTarget: number;
  isTransitioning: boolean;
  readonly adoptZoomAnchor: Mock<NavigationCameraController['adoptZoomAnchor']>;
  readonly adoptZoomPointer: Mock<NavigationCameraController['adoptZoomPointer']>;
  readonly adoptZoomTarget: Mock<NavigationCameraController['adoptZoomTarget']>;
  readonly trackTarget: Mock<NavigationCameraController['trackTarget']>;
  readonly zoomSemantically: Mock<NavigationCameraController['zoomSemantically']>;
  readonly zoomBy: Mock<NavigationCameraController['zoomBy']>;
  readonly transitionReferenceFrame: Mock<NavigationCameraController['transitionReferenceFrame']>;
  readonly releaseTarget: Mock<NavigationCameraController['releaseTarget']>;
  readonly follow: Mock<NavigationCameraController['follow']>;
};

function object(
  id: string,
  name: string,
  type: SpaceObject['type'],
  parentId?: string,
  referenceFrame: SpaceObject['referenceFrame'] = 'solar-system',
): SpaceObject {
  return {
    id,
    name,
    type,
    ...(parentId ? { parentId } : {}),
    referenceFrame,
    scientificConfidence: 'calculated',
    visual: {
      visualRadius: 1,
      scaleMode: 'adaptive',
    },
    positionProvider: {
      type: 'static',
      position: [0, 0, 0],
      unit: 'astronomical-unit',
    },
  };
}
