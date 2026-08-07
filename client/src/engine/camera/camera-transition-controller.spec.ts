import * as THREE from 'three';
import type { Mock } from 'vitest';
import {
  CameraTransitionController,
  type CameraTransitionControls,
} from './camera-transition-controller';

describe('CameraTransitionController', () => {
  let camera: THREE.PerspectiveCamera;
  let controls: CameraTransitionControls;
  let updateControls: Mock<() => void>;
  let completed: Mock<() => void>;
  let controller: CameraTransitionController;

  beforeEach(() => {
    camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 10);
    updateControls = vi.fn();
    controls = {
      target: new THREE.Vector3(),
      update: updateControls,
    };
    completed = vi.fn();
    controller = new CameraTransitionController(camera, controls, completed);
  });

  it('interpole une transition linéaire puis publie sa fin', () => {
    controller.start(new THREE.Vector3(10, 10, 0), new THREE.Vector3(10, 0, 0), {
      duration: 2,
      logarithmicDistance: false,
    });

    controller.update(1);

    expect(controller.active).toBe(true);
    expect(controls.target).toEqual(new THREE.Vector3(5, 0, 0));
    expect(camera.position).toEqual(new THREE.Vector3(5, 5, 5));
    expect(completed).not.toHaveBeenCalled();

    controller.update(1);

    expect(controller.active).toBe(false);
    expect(controls.target).toEqual(new THREE.Vector3(10, 0, 0));
    expect(camera.position).toEqual(new THREE.Vector3(10, 10, 0));
    expect(updateControls).toHaveBeenCalledOnce();
    expect(completed).toHaveBeenCalledOnce();
  });

  it('interpole les grandes distances logarithmiquement', () => {
    camera.position.set(0, 0, 100);
    controller.start(new THREE.Vector3(10, 0, 1), new THREE.Vector3(10, 0, 0), {
      duration: 2,
      logarithmicDistance: true,
    });

    controller.update(1);

    expect(controls.target.x).toBeCloseTo(5, 12);
    expect(camera.position.x).toBeCloseTo(5, 12);
    expect(camera.position.z).toBeCloseTo(10, 12);
    expect(camera.position.distanceTo(controls.target)).toBeCloseTo(10, 12);
  });

  it('déplace la destination avec une cible suivie en conservant le cadrage', () => {
    controller.start(new THREE.Vector3(5, 0, 10), new THREE.Vector3(5, 0, 0), {
      duration: 1,
      logarithmicDistance: true,
    });

    expect(controller.retarget(new THREE.Vector3(8, 2, 1))).toBe(true);
    expect(controller.complete()).toBe(true);

    expect(controls.target).toEqual(new THREE.Vector3(8, 2, 1));
    expect(camera.position).toEqual(new THREE.Vector3(8, 2, 11));
    expect(completed).toHaveBeenCalledOnce();
  });

  it('finalise seulement un changement de référentiel avant interaction', () => {
    controller.start(new THREE.Vector3(5, 3, 12), new THREE.Vector3(5, 3, 2), {
      duration: 1,
      logarithmicDistance: false,
      completeBeforeInteraction: true,
    });

    expect(controller.completePendingReferenceFrame()).toBe(true);
    expect(controller.active).toBe(false);
    expect(controls.target).toEqual(new THREE.Vector3(5, 3, 2));
    expect(camera.position).toEqual(new THREE.Vector3(5, 3, 12));
    expect(completed).not.toHaveBeenCalled();
    expect(controller.completePendingReferenceFrame()).toBe(false);

    controller.start(new THREE.Vector3(2, 0, 4), new THREE.Vector3(2, 0, 0), {
      duration: 1,
      logarithmicDistance: false,
    });

    expect(controller.completePendingReferenceFrame()).toBe(false);
    expect(controller.active).toBe(true);
    controller.cancel();
    expect(controller.active).toBe(false);
    expect(controller.complete()).toBe(false);
    expect(controller.retarget(new THREE.Vector3())).toBe(false);
  });

  it('reste fini avec des positions dégénérées', () => {
    camera.position.copy(controls.target);
    controller.start(new THREE.Vector3(), new THREE.Vector3(), {
      duration: 1,
      logarithmicDistance: true,
    });

    controller.update(0.25);
    controller.update(1);

    expect(Number.isFinite(camera.position.length())).toBe(true);
    expect(controller.active).toBe(false);
    expect(completed).toHaveBeenCalledOnce();
  });
});
