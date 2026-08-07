import * as THREE from 'three';
import type { SpaceObject } from '../../data/models/universe.models';
import { CameraController } from '../camera/camera-controller';
import { getMinimumNavigationDistance } from '../camera/navigation-policy';
import earthTrace from './earth-navigation-wheel-trace.fixture.json';
import {
  UniverseNavigationRuntime,
  type NavigationZoomDecision,
} from './universe-navigation-runtime';

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

describe('rejeu de la trace de navigation Terre du 25 août 2026', () => {
  it('reprend les 128 événements exacts à travers deux recentrages d’origine flottante', () => {
    expect(earthTrace.schema).toBe('universe-map/navigation-wheel-trace@2');
    expect(earthTrace.capturedAt).toBe('2026-08-25T07:07:16.372Z');
    expect(earthTrace.events).toHaveLength(128);
    expect(earthTrace.events[0]?.sequence).toBe(1618);
    expect(earthTrace.events.at(-1)?.sequence).toBe(1745);
    expect(earthTrace.originShifts.map((shift) => shift.beforeSequence)).toEqual([1693, 1734]);
    expect(earthTrace.selectedId).toBe('earth');
    expect(earthTrace.initial.targetId).toBeNull();

    const replay = replayEarthTrace();

    expect(replay.decisions).toEqual(
      earthTrace.events.map((event) => event.decision as NavigationZoomDecision),
    );
    expect(replay.traversalStartSequence).toBe(1650);
    expect(replay.traversalEndSequence).toBe(1734);
    expect(
      replay.maximumDistanceError,
      JSON.stringify({
        sequence: replay.maximumDistanceErrorSequence,
        actual: replay.maximumDistanceErrorActual,
        recorded: replay.maximumDistanceErrorRecorded,
        traversalStartSequence: replay.traversalStartSequence,
        traversalEndSequence: replay.traversalEndSequence,
      }),
    ).toBeLessThan(1e-10);
    expect(replay.cameraPosition.distanceTo(vector(earthTrace.final.cameraPosition))).toBeLessThan(
      1e-9,
    );
    expect(replay.cameraTarget.distanceTo(vector(earthTrace.final.cameraTarget))).toBeLessThan(
      1e-9,
    );
    expect(replay.targetId).toBeNull();
    expect(replay.distance).toBeCloseTo(earthTrace.final.distance, 11);
  });

  it('réactualise la butée d’une approche oblique puis libère la Terre pendant la rafale', () => {
    const camera = new THREE.PerspectiveCamera(48, 2_304 / 1_041, 0.025, 1_200_000);
    const controller = new CameraController(camera, document.createElement('canvas'), vi.fn());
    // État enregistré juste avant la séquence 642 ; il s’agit de données d’interaction, pas de
    // coordonnées astronomiques de référence.
    const beforeCamera = new THREE.Vector3(
      665.566_766_218_926_8,
      -116.346_904_487_614_35,
      40.556_020_815_934_4,
    );
    const beforePivot = new THREE.Vector3(
      665.732_824_002_692_7,
      -116.363_127_854_895_67,
      40.429_553_248_031_674,
    );
    const recordedMinimumDistance = 0.207_340_055_207_307_36;
    const objectMinimumDistance = getMinimumNavigationDistance(EARTH);
    const approachDistance =
      beforeCamera.distanceTo(beforePivot) * (objectMinimumDistance / recordedMinimumDistance);
    const earthPosition = beforePivot
      .clone()
      .sub(beforeCamera)
      .setLength(approachDistance)
      .add(beforeCamera);
    const setNavigationTarget = vi.fn();
    const runtime = new UniverseNavigationRuntime({
      hasPrimaryRegistry: () => true,
      getDefinition: (objectId) => (objectId === EARTH.id ? EARTH : undefined),
      getWorldPosition: (objectId, target = new THREE.Vector3()) =>
        objectId === EARTH.id ? target.copy(earthPosition) : null,
      setNavigationTarget,
      selectLodLevel: () => 0,
      emitTargetChanged: vi.fn(),
    });
    const pointer = {
      x: -0.131_944_444_444_444_42,
      y: 0.266_090_297_790_586,
    };

    camera.position.copy(beforeCamera);
    controller.controls.target.copy(beforePivot);
    controller.controls.minDistance = recordedMinimumDistance;
    camera.lookAt(beforePivot);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    controller.controls.update();
    controller.trackTarget(earthPosition, EARTH);
    runtime.restoreTarget(EARTH.id);

    expect(controller.controls.minDistance).toBeCloseTo(recordedMinimumDistance, 12);
    expect(controller.atMinimumNavigationDistance).toBe(false);
    expect(
      runtime.handleSemanticZoomIntent(controller, null, -18.631_796_212_211_885, pointer),
    ).toBe('zoom-pointer');
    expect(controller.lastZoomDiagnostics?.status).toBe('minimum');
    expect(controller.controls.minDistance).toBeLessThan(recordedMinimumDistance);
    expect(controller.atMinimumNavigationDistance).toBe(false);
    const firstClampedDistance = controller.distanceToTarget;

    expect(
      runtime.handleSemanticZoomIntent(controller, null, -7.070_101_241_711_442, pointer),
    ).toBe('zoom-pointer');
    expect(controller.distanceToTarget).toBeLessThan(firstClampedDistance);

    let decision: NavigationZoomDecision = 'zoom-pointer';

    for (let index = 0; index < 42 && decision !== 'release-target'; index += 1) {
      decision = runtime.handleSemanticZoomIntent(
        controller,
        null,
        -18.631_796_212_211_885,
        pointer,
      );
    }

    expect(decision).toBe('release-target');
    expect(runtime.targetId).toBeNull();
    expect(controller.minimumTraversalActive).toBe(true);
    expect(setNavigationTarget).toHaveBeenLastCalledWith(null);

    controller.dispose();
  });
});

interface EarthTraceReplay {
  readonly cameraPosition: THREE.Vector3;
  readonly cameraTarget: THREE.Vector3;
  readonly decisions: NavigationZoomDecision[];
  readonly distance: number;
  readonly maximumDistanceError: number;
  readonly maximumDistanceErrorActual: number;
  readonly maximumDistanceErrorRecorded: number;
  readonly maximumDistanceErrorSequence: number;
  readonly targetId: string | null;
  readonly traversalEndSequence: number | null;
  readonly traversalStartSequence: number | null;
}

function replayEarthTrace(): EarthTraceReplay {
  const camera = new THREE.PerspectiveCamera(
    48,
    earthTrace.viewport.width / earthTrace.viewport.height,
    0.025,
    earthTrace.initial.maximumDistance * 2,
  );
  const controller = new CameraController(camera, document.createElement('canvas'), vi.fn());
  const earthPosition = new THREE.Vector3();
  const runtime = new UniverseNavigationRuntime({
    hasPrimaryRegistry: () => true,
    getDefinition: (objectId) => (objectId === EARTH.id ? EARTH : undefined),
    getWorldPosition: (objectId, target = new THREE.Vector3()) =>
      objectId === EARTH.id ? target.copy(earthPosition) : null,
    setNavigationTarget: vi.fn(),
    selectLodLevel: () => 0,
    emitTargetChanged: vi.fn(),
  });
  const decisions: NavigationZoomDecision[] = [];
  const shiftsBySequence = new Map(
    earthTrace.originShifts.map((originShift) => [originShift.beforeSequence, originShift.shift]),
  );
  let maximumDistanceError = 0;
  let maximumDistanceErrorActual = earthTrace.initial.distance;
  let maximumDistanceErrorRecorded = earthTrace.initial.distance;
  let maximumDistanceErrorSequence = earthTrace.events[0]!.sequence;
  let traversalStartSequence: number | null = null;
  let traversalEndSequence: number | null = null;

  controller.controls.target.copy(vector(earthTrace.initial.cameraTarget));
  camera.position
    .copy(vector(earthTrace.initial.cameraPosition))
    .sub(controller.controls.target)
    .setLength(earthTrace.initial.minimumDistance)
    .add(controller.controls.target);
  controller.setNavigationConstraints(EARTH);
  controller.releaseTarget(true);
  camera.position.copy(vector(earthTrace.initial.cameraPosition));
  camera.lookAt(controller.controls.target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  controller.controls.update();

  expect(runtime.targetId).toBe(earthTrace.initial.targetId);
  expect(controller.distanceToTarget).toBeCloseTo(earthTrace.initial.distance, 12);
  expect(controller.controls.minDistance).toBeCloseTo(earthTrace.initial.minimumDistance, 12);
  expect(getMinimumNavigationDistance(EARTH)).toBeCloseTo(earthTrace.initial.minimumDistance, 12);

  for (const event of earthTrace.events) {
    const originShift = shiftsBySequence.get(event.sequence);

    if (originShift) {
      const shift = vector(originShift);

      camera.position.sub(shift);
      controller.controls.target.sub(shift);
      earthPosition.sub(shift);
      controller.shiftTrackedPosition(shift);
    }
    const traversalWasActive = controller.minimumTraversalActive;

    decisions.push(
      runtime.handleSemanticZoomIntent(controller, null, event.deltaY, earthTrace.pointer),
    );
    if (!traversalWasActive && controller.minimumTraversalActive) {
      traversalStartSequence = event.sequence;
    }
    if (traversalWasActive && !controller.minimumTraversalActive) {
      traversalEndSequence = event.sequence;
    }
    const distanceError = Math.abs(controller.distanceToTarget - event.recordedAfterDistance);

    if (distanceError > maximumDistanceError) {
      maximumDistanceError = distanceError;
      maximumDistanceErrorActual = controller.distanceToTarget;
      maximumDistanceErrorRecorded = event.recordedAfterDistance;
      maximumDistanceErrorSequence = event.sequence;
    }
  }

  const replay = {
    cameraPosition: camera.position.clone(),
    cameraTarget: controller.controls.target.clone(),
    decisions,
    distance: controller.distanceToTarget,
    maximumDistanceError,
    maximumDistanceErrorActual,
    maximumDistanceErrorRecorded,
    maximumDistanceErrorSequence,
    targetId: runtime.targetId,
    traversalEndSequence,
    traversalStartSequence,
  };

  controller.dispose();

  return replay;
}

function vector(value: {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}): THREE.Vector3 {
  return new THREE.Vector3(value.x, value.y, value.z);
}
