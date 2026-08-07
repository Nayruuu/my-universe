import * as THREE from 'three';
import type { Mock } from 'vitest';
import { CameraZoomController, type CameraZoomControls } from './camera-zoom-controller';
import { FREE_NAVIGATION_MIN_DISTANCE, MAX_NAVIGATION_DISTANCE } from './navigation-policy';

describe('CameraZoomController', () => {
  let camera: THREE.PerspectiveCamera;
  let controls: CameraZoomControls;
  let updateControls: Mock<() => void>;
  let settled: Mock<(distance: number) => void>;
  let controller: CameraZoomController;

  beforeEach(() => {
    camera = new THREE.PerspectiveCamera(48, 1, 0.025, MAX_NAVIGATION_DISTANCE * 2);
    camera.position.set(0, 0, 24);
    updateControls = vi.fn();
    controls = {
      target: new THREE.Vector3(),
      minDistance: FREE_NAVIGATION_MIN_DISTANCE,
      maxDistance: MAX_NAVIGATION_DISTANCE,
      update: updateControls,
    };
    settled = vi.fn();
    controller = new CameraZoomController(camera, controls, settled);
  });

  it('pilote le trajet sémantique et qualifie chaque résultat de zoom', () => {
    controller.zoomSemantically(480);

    expect(controller.distanceToTarget).toBeCloseTo(520, 8);
    expect(controller.semanticActive).toBe(true);
    expect(controller.diagnostics).toMatchObject({
      deltaY: 480,
      beforeDistance: 24,
      appliedDistance: 520,
      status: 'applied',
    });

    controller.reset();
    controller.zoomSemantically(0);
    expect(controller.diagnostics?.status).toBe('ignored');
    controller.zoomSemantically(Number.NaN);
    expect(controller.diagnostics?.status).toBe('ignored');
    controller.zoomSemantically(-Number.MIN_VALUE);
    expect(controller.diagnostics?.status).toBe('unchanged');
  });

  it('borne le zoom aux limites de navigation', () => {
    controls.minDistance = 2;
    camera.position.set(0, 0, 2);
    controller.zoomSemantically(-120);
    expect(controller.diagnostics).toMatchObject({ status: 'minimum', appliedDistance: 2 });

    camera.position.set(0, 0, MAX_NAVIGATION_DISTANCE);
    controller.resetJourney();
    controller.zoomSemantically(480);
    expect(controller.diagnostics).toMatchObject({
      status: 'maximum',
      appliedDistance: MAX_NAVIGATION_DISTANCE,
    });

    controller.zoomBy(0);
    expect(controller.distanceToTarget).toBe(2);
    controller.zoomBy(Number.POSITIVE_INFINITY);
    expect(controller.distanceToTarget).toBe(MAX_NAVIGATION_DISTANCE);
  });

  it('conserve sous le même pixel une ancre suivie pendant le zoom', () => {
    const anchor = new THREE.Vector3(6, 2, 0);
    const movedAnchor = new THREE.Vector3(8, 3, 0);

    camera.updateMatrixWorld();
    const initialScreenPosition = movedAnchor.clone().project(camera);

    controller.adoptAnchor(anchor);
    expect(controller.active).toBe(true);
    expect(controller.retargetAnchor(movedAnchor)).toBe(true);
    controller.zoomSemantically(-120);
    camera.updateMatrixWorld();
    const zoomedScreenPosition = movedAnchor.clone().project(camera);

    expect(controller.active).toBe(false);
    expect(controller.retargetAnchor(anchor)).toBe(false);
    expect(zoomedScreenPosition.x).toBeCloseTo(initialScreenPosition.x, 8);
    expect(zoomedScreenPosition.y).toBeCloseTo(initialScreenPosition.y, 8);
    expect(controls.target.x).toBeGreaterThan(0);
    expect(controls.target.y).toBeGreaterThan(0);
  });

  it('projette le curseur sur le plan de navigation', () => {
    controller.adoptPointer(0.5, 0.25);
    controller.zoomSemantically(-120);

    expect(controls.target.x).toBeGreaterThan(0);
    expect(controls.target.y).toBeGreaterThan(0);
    expect(controller.distanceToTarget).toBeLessThan(24);
  });

  it('rejoint progressivement une ancre quand aucune transition ne la bloque', () => {
    controller.update(0.1, false);
    controller.adoptAnchor(new THREE.Vector3(10, 0, 0));

    controller.update(0.001, true);
    expect(controls.target).toEqual(new THREE.Vector3());
    controller.update(0.001, false);
    expect(controller.active).toBe(true);
    controller.update(3, false);
    controller.update(0.001, false);

    expect(controller.active).toBe(false);
    expect(controls.target).toEqual(new THREE.Vector3(10, 0, 0));
    expect(settled).toHaveBeenCalledWith(controller.distanceToTarget);

    controller.adoptAnchor(new THREE.Vector3(4, 0, 0));
    controller.cancelAnchor();
    expect(controller.active).toBe(false);
  });
});
