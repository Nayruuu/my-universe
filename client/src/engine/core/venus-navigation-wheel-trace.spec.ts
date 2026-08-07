import * as THREE from 'three';
import type { SpaceObject } from '../../data/models/universe.models';
import { CameraController } from '../camera/camera-controller';
import { NAVIGATION_SCALES } from '../camera/navigation-scales';
import { getMinimumNavigationDistance } from '../camera/navigation-policy';
import venusTrace from './venus-navigation-wheel-trace.fixture.json';
import {
  UniverseNavigationRuntime,
  type NavigationZoomDecision,
} from './universe-navigation-runtime';

const WHEEL_DELTA_PER_SCALE = 480;

const EARTH = {
  id: 'earth',
  name: 'Earth',
  type: 'planet',
  parentId: 'sun',
  referenceFrame: 'solar-system',
  scientificConfidence: 'calculated',
  visual: {
    color: '#4f83cc',
    visualRadius: 0.62,
    scaleMode: 'exaggerated',
  },
} as SpaceObject;

const VENUS = {
  id: 'venus',
  name: 'Venus',
  type: 'planet',
  parentId: 'sun',
  referenceFrame: 'solar-system',
  scientificConfidence: 'calculated',
  visual: {
    color: '#d9b36c',
    visualRadius: 0.56,
    scaleMode: 'exaggerated',
  },
} as SpaceObject;

const earthSegment = venusTrace.segments.earthSemanticTail;
const venusSegment = venusTrace.segments.venusMinimumTraversal;
// Schema v2 predates active-target empty-space acceleration. Keep its raw captured deltas immutable
// and replay them with the interaction calibration that produced the trace.
const HISTORICAL_TRACE_EMPTY_SPACE_ZOOM_MULTIPLIER = 1;

describe('rejeu de la trace de navigation Vénus du 25 août 2026', () => {
  it('reprend exactement la fin du trajet sémantique Terre avant le recentrage hors molette', () => {
    expect(venusTrace.schema).toBe('universe-map/navigation-wheel-trace@2');
    expect(venusTrace.capturedAt).toBe('2026-08-25T07:20:01.928Z');
    expect(venusTrace.sourceRange).toEqual({
      firstSequence: 2768,
      lastSequence: 2895,
      eventCount: 128,
    });
    expect(earthSegment.events).toHaveLength(26);
    expect(venusSegment.events).toHaveLength(102);
    expect(venusTrace.transition).toMatchObject({
      kind: 'non-wheel-state-discontinuity',
      afterSequence: 2793,
      beforeSequence: 2794,
      fromTargetId: 'earth',
      toTargetId: 'venus',
    });

    const replay = replayEarthSemanticTail();

    expect(replay.calculatedJourneyStartDistance).toBeCloseTo(2.7025, 12);
    expect(replay.decisions).toEqual(
      earthSegment.events.map((event) => event.decision as NavigationZoomDecision),
    );
    expect(replay.maximumDistanceError).toBeLessThan(1e-10);
    expect(
      replay.cameraPosition.distanceTo(vector(earthSegment.final.cameraPosition)),
    ).toBeLessThan(1e-9);
    expect(replay.cameraTarget.distanceTo(vector(earthSegment.final.cameraTarget))).toBeLessThan(
      1e-9,
    );
    expect(replay.targetId).toBe('earth');
    expect(replay.semanticZoomActive).toBe(true);
    expect(replay.distance).toBeCloseTo(earthSegment.final.distance, 11);
  });

  it('libère Vénus au minimum, traverse le recentrage flottant et reste libre après un retour partiel', () => {
    expect(venusTrace.selectedId).toBe('venus');
    expect(venusSegment.originShifts.map((shift) => shift.beforeSequence)).toEqual([2893]);

    const replay = replayVenusMinimumTraversal();

    expect(replay.decisions).toEqual(
      venusSegment.events.map((event) => event.decision as NavigationZoomDecision),
    );
    expect(replay.maximumDistanceError).toBeLessThan(1e-10);
    expect(replay.targets.get(2859)).toBe('venus');
    expect(replay.targets.get(2860)).toBeNull();
    expect(replay.targets.get(2895)).toBeNull();
    expect(replay.traversalStartSequence).toBe(2860);
    expect(replay.minimumTraversalActive).toBe(true);
    const cameraCalibrationOffset = replay.cameraPosition
      .clone()
      .sub(vector(venusSegment.final.cameraPosition));
    const targetCalibrationOffset = replay.cameraTarget
      .clone()
      .sub(vector(venusSegment.final.cameraTarget));

    // The immutable browser trace predates bounded free-travel acceleration. Its decisions,
    // distance floor and camera-pivot separation still replay exactly, while the calibrated route
    // deliberately travels farther in the same frame.
    expect(cameraCalibrationOffset.length()).toBeGreaterThan(3_000);
    expect(cameraCalibrationOffset.distanceTo(targetCalibrationOffset)).toBeLessThan(1e-9);
    expect(replay.targetId).toBeNull();
    expect(replay.hasActiveTarget).toBe(false);
    expect(replay.distance).toBeCloseTo(venusSegment.final.distance, 11);
  });
});

interface TraceReplay {
  readonly cameraPosition: THREE.Vector3;
  readonly cameraTarget: THREE.Vector3;
  readonly decisions: NavigationZoomDecision[];
  readonly distance: number;
  readonly maximumDistanceError: number;
  readonly targetId: string | null;
}

interface EarthSemanticTailReplay extends TraceReplay {
  readonly calculatedJourneyStartDistance: number;
  readonly semanticZoomActive: boolean;
}

interface VenusMinimumTraversalReplay extends TraceReplay {
  readonly hasActiveTarget: boolean;
  readonly minimumTraversalActive: boolean;
  readonly targets: ReadonlyMap<number, string | null>;
  readonly traversalStartSequence: number | null;
}

function replayEarthSemanticTail(): EarthSemanticTailReplay {
  const camera = createCamera(earthSegment.initial.maximumDistance);
  const controller = new CameraController(camera, document.createElement('canvas'), vi.fn());
  const earthPosition = vector(earthSegment.initial.cameraTarget);
  const runtime = createRuntime(new Map([[EARTH.id, EARTH]]), new Map([[EARTH.id, earthPosition]]));
  const calculatedJourneyStartDistance = inferEarthSemanticJourneyStartDistance();
  const initialSemanticProgress = resolveInitialEarthSemanticProgress();
  const decisions: NavigationZoomDecision[] = [];
  let maximumDistanceError = 0;

  runtime.adoptTarget(EARTH.id);
  controller.setNavigationConstraints(EARTH);
  controller.controls.target.copy(vector(earthSegment.initial.cameraTarget));
  camera.position
    .copy(vector(earthSegment.initial.cameraPosition))
    .sub(controller.controls.target)
    .setLength(calculatedJourneyStartDistance)
    .add(controller.controls.target);
  camera.lookAt(controller.controls.target);
  camera.updateMatrixWorld();
  controller.controls.update();
  controller.zoomSemantically(initialSemanticProgress * WHEEL_DELTA_PER_SCALE);

  expect(controller.semanticZoomActive).toBe(true);
  expect(controller.distanceToTarget).toBeCloseTo(earthSegment.initial.distance, 11);

  camera.position.copy(vector(earthSegment.initial.cameraPosition));
  controller.controls.target.copy(vector(earthSegment.initial.cameraTarget));
  camera.lookAt(controller.controls.target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  controller.controls.update();

  expect(runtime.targetId).toBe(earthSegment.initial.targetId);
  expect(controller.controls.minDistance).toBeCloseTo(earthSegment.initial.minimumDistance, 12);
  expect(getMinimumNavigationDistance(EARTH)).toBeCloseTo(earthSegment.initial.minimumDistance, 12);

  for (const event of earthSegment.events) {
    decisions.push(runtime.handleSemanticZoomIntent(controller, null, event.deltaY, event.pointer));
    maximumDistanceError = Math.max(
      maximumDistanceError,
      Math.abs(controller.distanceToTarget - event.recordedAfter.distance),
    );
    expect(runtime.targetId).toBe(event.recordedAfter.targetId);
    expect(controller.semanticZoomActive).toBe(event.recordedAfter.semanticZoomActive);
  }

  const replay = {
    calculatedJourneyStartDistance,
    cameraPosition: camera.position.clone(),
    cameraTarget: controller.controls.target.clone(),
    decisions,
    distance: controller.distanceToTarget,
    maximumDistanceError,
    semanticZoomActive: controller.semanticZoomActive,
    targetId: runtime.targetId,
  };

  controller.dispose();

  return replay;
}

function replayVenusMinimumTraversal(): VenusMinimumTraversalReplay {
  const camera = createCamera(venusSegment.initial.maximumDistance);
  const controller = new CameraController(camera, document.createElement('canvas'), vi.fn());
  const venusPosition = vector(venusSegment.initial.cameraTarget);
  const runtime = createRuntime(new Map([[VENUS.id, VENUS]]), new Map([[VENUS.id, venusPosition]]));
  const shiftsBySequence = new Map(
    venusSegment.originShifts.map((originShift) => [originShift.beforeSequence, originShift.shift]),
  );
  const decisions: NavigationZoomDecision[] = [];
  const targets = new Map<number, string | null>();
  let maximumDistanceError = 0;
  let traversalStartSequence: number | null = null;

  runtime.adoptTarget(VENUS.id);
  controller.setNavigationConstraints(VENUS);
  controller.controls.target.copy(vector(venusSegment.initial.cameraTarget));
  camera.position.copy(vector(venusSegment.initial.cameraPosition));
  camera.lookAt(controller.controls.target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  controller.controls.update();

  expect(runtime.targetId).toBe(venusSegment.initial.targetId);
  expect(controller.distanceToTarget).toBeCloseTo(venusSegment.initial.distance, 12);
  expect(controller.controls.minDistance).toBeCloseTo(venusSegment.initial.minimumDistance, 12);
  expect(getMinimumNavigationDistance(VENUS)).toBeCloseTo(venusSegment.initial.minimumDistance, 12);

  for (const event of venusSegment.events) {
    const originShift = shiftsBySequence.get(event.sequence);

    if (originShift) {
      const shift = vector(originShift);

      camera.position.sub(shift);
      controller.controls.target.sub(shift);
      venusPosition.sub(shift);
      controller.shiftTrackedPosition(shift);
    }
    const traversalWasActive = controller.minimumTraversalActive;

    decisions.push(runtime.handleSemanticZoomIntent(controller, null, event.deltaY, event.pointer));
    if (!traversalWasActive && controller.minimumTraversalActive) {
      traversalStartSequence = event.sequence;
    }
    targets.set(event.sequence, runtime.targetId);
    maximumDistanceError = Math.max(
      maximumDistanceError,
      Math.abs(controller.distanceToTarget - event.recordedAfter.distance),
    );
    expect(runtime.targetId).toBe(event.recordedAfter.targetId);
    expect(controller.atMinimumNavigationDistance).toBe(event.recordedAfter.atMinimumDistance);
    expect(controller.semanticZoomActive).toBe(event.recordedAfter.semanticZoomActive);
  }

  const replay = {
    cameraPosition: camera.position.clone(),
    cameraTarget: controller.controls.target.clone(),
    decisions,
    distance: controller.distanceToTarget,
    hasActiveTarget: controller.hasActiveTarget,
    maximumDistanceError,
    minimumTraversalActive: controller.minimumTraversalActive,
    targetId: runtime.targetId,
    targets,
    traversalStartSequence,
  };

  controller.dispose();

  return replay;
}

function inferEarthSemanticJourneyStartDistance(): number {
  const planetaryDistance = NAVIGATION_SCALES[0]!.distance;
  const crossingIndex = earthSegment.events.findIndex(
    (event) => event.recordedAfter.distance < planetaryDistance,
  );

  if (crossingIndex < 0) {
    throw new Error('La trace Terre ne traverse pas la frontière planétaire attendue.');
  }
  const progressAfterCrossing =
    resolveInitialEarthSemanticProgress() +
    earthSegment.events
      .slice(0, crossingIndex + 1)
      .reduce((total, event) => total + event.deltaY / WHEEL_DELTA_PER_SCALE, 0);
  const distanceAfterCrossing = earthSegment.events[crossingIndex]!.recordedAfter.distance;

  return Math.exp(
    (Math.log(distanceAfterCrossing) - progressAfterCrossing * Math.log(planetaryDistance)) /
      (1 - progressAfterCrossing),
  );
}

function resolveInitialEarthSemanticProgress(): number {
  const planetaryDistance = NAVIGATION_SCALES[0]!.distance;
  const solarSystemDistance = NAVIGATION_SCALES[1]!.distance;

  return (
    1 +
    Math.log(earthSegment.initial.distance / planetaryDistance) /
      Math.log(solarSystemDistance / planetaryDistance)
  );
}

function createCamera(maximumDistance: number): THREE.PerspectiveCamera {
  return new THREE.PerspectiveCamera(
    48,
    venusTrace.viewport.width / venusTrace.viewport.height,
    0.025,
    maximumDistance * 2,
  );
}

function createRuntime(
  definitions: ReadonlyMap<string, SpaceObject>,
  positions: ReadonlyMap<string, THREE.Vector3>,
): UniverseNavigationRuntime {
  return new UniverseNavigationRuntime(
    {
      hasPrimaryRegistry: () => true,
      getDefinition: (objectId) => definitions.get(objectId),
      getWorldPosition: (objectId, target = new THREE.Vector3()) => {
        const position = positions.get(objectId);

        return position ? target.copy(position) : null;
      },
      setNavigationTarget: vi.fn(),
      selectLodLevel: () => 0,
      emitTargetChanged: vi.fn(),
    },
    {
      activeTargetPointerZoomMaximumMultiplier: HISTORICAL_TRACE_EMPTY_SPACE_ZOOM_MULTIPLIER,
    },
  );
}

function vector(value: {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}): THREE.Vector3 {
  return new THREE.Vector3(value.x, value.y, value.z);
}
