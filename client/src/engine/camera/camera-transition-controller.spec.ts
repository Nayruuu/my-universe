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
    camera.fov = 48;
    controller.start(new THREE.Vector3(10, 10, 0), new THREE.Vector3(10, 0, 0), {
      duration: 2,
      logarithmicDistance: false,
      endFieldOfView: 80,
    });
    expect(controller.easedProgress).toBe(0);

    controller.update(1);

    expect(controller.active).toBe(true);
    expect(controls.target).toEqual(new THREE.Vector3(5, 0, 0));
    expect(camera.position).toEqual(new THREE.Vector3(5, 5, 5));
    expect(camera.fov).toBe(64);
    expect(controller.easedProgress).toBe(0.5);
    expect(completed).not.toHaveBeenCalled();

    controller.update(1);

    expect(controller.active).toBe(false);
    expect(controls.target).toEqual(new THREE.Vector3(10, 0, 0));
    expect(camera.position).toEqual(new THREE.Vector3(10, 10, 0));
    expect(camera.fov).toBe(80);
    expect(controller.easedProgress).toBe(1);
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

  it('tourne sur place avant de rapprocher une destination lointaine', () => {
    const startCamera = camera.position.clone();
    const target = new THREE.Vector3(100, 20, -30);

    controller.start(target.clone().add(new THREE.Vector3(0, 0, 2)), target, {
      duration: 4,
      logarithmicDistance: true,
      acquireTarget: true,
    });
    controller.update(0);
    expect(camera.position).toEqual(startCamera);
    expect(controls.target.length()).toBeCloseTo(0, 12);

    controller.update(0.5);
    expect(camera.position).toEqual(startCamera);
    expect(controls.target.distanceTo(target)).toBeGreaterThan(1);

    controller.update(0.5);
    expect(camera.position.distanceTo(startCamera)).toBeLessThan(1e-12);
    expect(controls.target).toEqual(target);

    controller.update(0.001);
    expect(camera.position.distanceTo(startCamera)).toBeLessThan(0.0001);
    expect(controls.target).toEqual(target);
    controller.update(3);
    expect(camera.position.distanceTo(target)).toBeCloseTo(2, 12);
    expect(completed).toHaveBeenCalledOnce();
  });

  it('reste centré et à distance finie entre deux orientations opposées', () => {
    const target = new THREE.Vector3(0, 0, 20);

    controller.start(new THREE.Vector3(0, 0, 22), target, {
      duration: 4,
      logarithmicDistance: true,
      acquireTarget: true,
    });
    controller.update(1);
    let previousDistance = camera.position.distanceTo(target);

    for (let frame = 0; frame < 360; frame += 1) {
      controller.update(1 / 120);
      camera.lookAt(controls.target);
      camera.updateMatrixWorld();
      const distance = camera.position.distanceTo(target);
      const screen = target.clone().project(camera);

      expect(distance).toBeGreaterThanOrEqual(2 - 1e-10);
      expect(distance).toBeLessThanOrEqual(previousDistance + 1e-10);
      expect(Math.hypot(screen.x, screen.y)).toBeLessThan(1e-10);
      expect(screen.z).toBeLessThan(1);
      previousDistance = distance;
    }
  });

  it('suit une destination mobile pendant son acquisition puis son approche', () => {
    const target = new THREE.Vector3(100, 20, -30);
    const offset = new THREE.Vector3(2, 0, 0);

    controller.start(target.clone().add(offset), target, {
      duration: 4,
      logarithmicDistance: true,
      acquireTarget: true,
    });
    controller.update(0.3);
    target.x += 5;
    expect(controller.retarget(target)).toBe(true);
    controller.update(0.3);
    controller.update(0.4);
    expect(controls.target).toEqual(target);

    target.y += 8;
    expect(controller.retarget(target)).toBe(true);
    controller.update(1);
    expect(controls.target).toEqual(target);
    controller.update(2);
    expect(camera.position).toEqual(target.clone().add(offset));
    expect(completed).toHaveBeenCalledOnce();
  });

  it('garde une approche finie si la destination revient sur la position de départ', () => {
    controller.start(new THREE.Vector3(100, 0, 12), new THREE.Vector3(100, 0, 10), {
      duration: 4,
      logarithmicDistance: true,
      acquireTarget: true,
    });
    controller.retarget(camera.position.clone());
    controller.update(0.5);
    controller.update(1.5);
    expect(Number.isFinite(camera.position.length())).toBe(true);
    controller.update(2);
    expect(camera.position).toEqual(new THREE.Vector3(0, 0, 12));
  });

  it.each([0.5, 2])('rend la main sans saut à une interruption après %s secondes', (elapsed) => {
    controller.start(new THREE.Vector3(100, 0, 2), new THREE.Vector3(100, 0, 0), {
      duration: 4,
      logarithmicDistance: true,
      acquireTarget: true,
    });
    controller.update(elapsed);
    const position = camera.position.clone();
    const target = controls.target.clone();

    controller.cancel();
    controller.update(10);
    expect(camera.position).toEqual(position);
    expect(controls.target).toEqual(target);
    expect(completed).not.toHaveBeenCalled();
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
