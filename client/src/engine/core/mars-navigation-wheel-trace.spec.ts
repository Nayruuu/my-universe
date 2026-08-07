import * as THREE from 'three';
import type { SpaceObject } from '../../data/models/universe.models';
import { CameraController } from '../camera/camera-controller';
import { getMinimumNavigationDistance } from '../camera/navigation-policy';
import marsTrace from './mars-navigation-wheel-trace.fixture.json';
import {
  UniverseNavigationRuntime,
  type NavigationZoomDecision,
} from './universe-navigation-runtime';

const MARS = {
  id: 'mars',
  name: 'Mars',
  type: 'planet',
  parentId: 'sun',
  referenceFrame: 'solar-system',
  scientificConfidence: 'calculated',
  visual: {
    color: '#b75d3f',
    visualRadius: 0.46,
    scaleMode: 'exaggerated',
  },
} as SpaceObject;

const releaseIndex = marsTrace.events.findIndex((event) => event.decision === 'release-target');
const traversalBoundary = resolveTraversalBoundary();
// Schema v2 predates active-target empty-space acceleration. Keep its raw captured deltas immutable
// and replay them with the interaction calibration that produced the trace.
const HISTORICAL_TRACE_EMPTY_SPACE_ZOOM_MULTIPLIER = 1;

describe('rejeu de la trace de navigation Mars du 25 août 2026', () => {
  it('reprend les 128 événements exacts et restaure Mars au retour', () => {
    expect(marsTrace.schema).toBe('universe-map/navigation-wheel-trace@2');
    expect(marsTrace.capturedAt).toBe('2026-08-25T06:14:11.330Z');
    expect(marsTrace.events).toHaveLength(128);
    expect(marsTrace.events[0]?.sequence).toBe(2254);
    expect(marsTrace.events.at(-1)?.sequence).toBe(2381);
    expect(releaseIndex).toBeGreaterThanOrEqual(0);
    expect(traversalBoundary.event.sequence).toBe(2337);

    const replay = replayMarsTrace(false);

    expect(replay.decisions).toEqual(
      marsTrace.events.map((event) => event.decision as NavigationZoomDecision),
    );
    expect(replay.maximumDistanceError).toBeLessThan(1e-10);
    expect(replay.targets.get(2265)).toBe('mars');
    expect(replay.targets.get(2266)).toBeNull();
    expect(replay.targets.get(2336)).toBeNull();
    expect(replay.targets.get(2337)).toBe('mars');
    expect(replay.targetId).toBe('mars');
    expect(replay.hasActiveTarget).toBe(true);
    expect(replay.distance).toBeCloseTo(18.207672099017415, 11);
  });

  it('reste identique si l’événement frontière est séparé au point exact du rembobinage', () => {
    const combined = replayMarsTrace(false);
    const split = replayMarsTrace(true);

    expect(split.targetId).toBe('mars');
    expect(split.cameraPosition.distanceTo(combined.cameraPosition)).toBeLessThan(1e-10);
    expect(split.cameraTarget.distanceTo(combined.cameraTarget)).toBeLessThan(1e-10);
    expect(split.distance).toBeCloseTo(combined.distance, 12);
  });
});

interface MarsTraceReplay {
  readonly cameraPosition: THREE.Vector3;
  readonly cameraTarget: THREE.Vector3;
  readonly decisions: NavigationZoomDecision[];
  readonly distance: number;
  readonly hasActiveTarget: boolean;
  readonly maximumDistanceError: number;
  readonly targetId: string | null;
  readonly targets: ReadonlyMap<number, string | null>;
}

function replayMarsTrace(splitBoundaryEvent: boolean): MarsTraceReplay {
  const camera = new THREE.PerspectiveCamera(
    48,
    marsTrace.viewport.width / marsTrace.viewport.height,
    0.025,
    marsTrace.initial.maximumDistance * 2,
  );
  const canvas = document.createElement('canvas');
  const controller = new CameraController(camera, canvas, vi.fn());
  const trackedMarsPosition = new THREE.Vector3(
    marsTrace.initial.cameraTarget.x,
    marsTrace.initial.cameraTarget.y,
    marsTrace.initial.cameraTarget.z,
  );
  const runtime = new UniverseNavigationRuntime(
    {
      hasPrimaryRegistry: () => true,
      getDefinition: (objectId) => (objectId === MARS.id ? MARS : undefined),
      getWorldPosition: (objectId, target = new THREE.Vector3()) =>
        objectId === MARS.id ? target.copy(trackedMarsPosition) : null,
      setNavigationTarget: vi.fn(),
      selectLodLevel: () => 0,
      emitTargetChanged: vi.fn(),
    },
    {
      activeTargetPointerZoomMaximumMultiplier: HISTORICAL_TRACE_EMPTY_SPACE_ZOOM_MULTIPLIER,
    },
  );
  const decisions: NavigationZoomDecision[] = [];
  const targets = new Map<number, string | null>();
  let maximumDistanceError = 0;

  runtime.adoptTarget(MARS.id);
  controller.setNavigationConstraints(MARS);
  controller.controls.target.set(
    marsTrace.initial.cameraTarget.x,
    marsTrace.initial.cameraTarget.y,
    marsTrace.initial.cameraTarget.z,
  );
  camera.position.set(
    marsTrace.initial.cameraPosition.x,
    marsTrace.initial.cameraPosition.y,
    marsTrace.initial.cameraPosition.z,
  );
  camera.lookAt(controller.controls.target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  controller.controls.update();

  expect(controller.distanceToTarget).toBeCloseTo(marsTrace.initial.distance, 12);
  expect(controller.controls.minDistance).toBeCloseTo(marsTrace.initial.minimumDistance, 12);
  expect(getMinimumNavigationDistance(MARS)).toBeCloseTo(marsTrace.initial.minimumDistance, 12);

  for (const event of marsTrace.events) {
    const deltas =
      splitBoundaryEvent && event.sequence === traversalBoundary.event.sequence
        ? [traversalBoundary.undoDeltaY, event.deltaY - traversalBoundary.undoDeltaY]
        : [event.deltaY];
    let decision: NavigationZoomDecision = 'ignored';

    for (const deltaY of deltas) {
      decision = runtime.handleSemanticZoomIntent(controller, null, deltaY, marsTrace.pointer);
    }
    decisions.push(decision);
    targets.set(event.sequence, runtime.targetId);
    maximumDistanceError = Math.max(
      maximumDistanceError,
      Math.abs(controller.distanceToTarget - event.recordedAfterDistance),
    );
  }

  const replay = {
    cameraPosition: camera.position.clone(),
    cameraTarget: controller.controls.target.clone(),
    decisions,
    distance: controller.distanceToTarget,
    hasActiveTarget: controller.hasActiveTarget,
    maximumDistanceError,
    targetId: runtime.targetId,
    targets,
  };

  controller.dispose();

  return replay;
}

function resolveTraversalBoundary(): {
  readonly event: (typeof marsTrace.events)[number];
  readonly undoDeltaY: number;
} {
  if (releaseIndex < 0) {
    throw new Error('The captured Mars trace does not contain a target release.');
  }
  let traversalCoordinate = 0;

  for (const event of marsTrace.events.slice(releaseIndex)) {
    const coordinateBeforeEvent = traversalCoordinate;

    traversalCoordinate += event.deltaY;
    if (coordinateBeforeEvent < 0 && traversalCoordinate >= 0) {
      return {
        event,
        undoDeltaY: -coordinateBeforeEvent,
      };
    }
  }

  throw new Error('The captured Mars trace never unwinds its minimum-distance traversal.');
}
