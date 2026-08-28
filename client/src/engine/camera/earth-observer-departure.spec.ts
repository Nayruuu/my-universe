import * as THREE from 'three';
import { EarthObserverDeparture } from './earth-observer-departure';

describe('EarthObserverDeparture', () => {
  it.each([
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ])('quitte la surface sans saut ni traversée du globe depuis %s %s %s', (x, y, z) => {
    const camera = new THREE.PerspectiveCamera(82, 1.6, 0.025, 100_000);
    const center = new THREE.Vector3(744, 2, 13);
    const normal = new THREE.Vector3(x, y, z);
    const target = center.clone();
    const publish = vi.fn();
    const departure = new EarthObserverDeparture(camera, target, publish);

    camera.position.copy(center).addScaledVector(normal, 0.7);
    camera.lookAt(camera.position.clone().add(normal));
    const startPosition = camera.position.clone();
    const startOrientation = camera.quaternion.clone();

    departure.start(center, 4.96, 48);
    expect(camera.position.distanceTo(startPosition)).toBeLessThan(1e-12);
    expect(camera.quaternion.angleTo(startOrientation)).toBeLessThan(1e-7);
    expect(departure.active).toBe(true);
    expect(publish).toHaveBeenLastCalledWith({ active: true, progress: 0 });
    let previousRadius = 0.7;
    const previousOrientation = startOrientation.clone();

    for (let frame = 0; frame < 288; frame += 1) {
      departure.update(1 / 120);
      const radius = camera.position.distanceTo(center);

      expect(radius).toBeGreaterThanOrEqual(previousRadius - 1e-10);
      expect(radius).toBeLessThanOrEqual(4.96 + 1e-10);
      expect(camera.quaternion.toArray().every(Number.isFinite)).toBe(true);
      expect(camera.quaternion.angleTo(previousOrientation)).toBeLessThan(0.04);
      expect(camera.fov).toBeGreaterThanOrEqual(48);
      previousRadius = radius;
      previousOrientation.copy(camera.quaternion);
    }
    departure.update(0.001);
    expect(departure.active).toBe(false);
    expect(target.distanceTo(center)).toBeLessThan(1e-10);
    expect(camera.position.distanceTo(center)).toBeCloseTo(4.96, 10);
    expect(camera.fov).toBe(48);
    expect(camera.up).toEqual(new THREE.Vector3(0, 1, 0));
    expect(center.clone().project(camera).lengthSq()).toBeLessThan(1);
    expect(publish).toHaveBeenLastCalledWith({ active: false, progress: 1 });
  });

  it('garde le regard initial avant de révéler la Terre et suit son déplacement', () => {
    const camera = new THREE.PerspectiveCamera(2);
    const center = new THREE.Vector3(10, 3, 4);
    const target = new THREE.Vector3();
    const departure = new EarthObserverDeparture(camera, target, vi.fn());

    camera.position.copy(center).add(new THREE.Vector3(0, 0.7, 0));
    camera.lookAt(camera.position.clone().add(new THREE.Vector3(1, 0.2, 0)));
    const orientation = camera.quaternion.clone();

    departure.start(center, 5, 48);
    departure.update(0.2);
    expect(camera.quaternion.angleTo(orientation)).toBeLessThan(1e-7);
    const position = camera.position.clone();
    const shift = new THREE.Vector3(4, -2, 7);

    departure.retarget(center.clone().add(shift));
    departure.update(-1);
    expect(camera.position.distanceTo(position.clone().add(shift))).toBeLessThan(1e-10);
    departure.shiftOrigin(shift);
    departure.update(0);
    expect(camera.position.distanceTo(position)).toBeLessThan(1e-10);
    departure.update(3);
    expect(target.distanceTo(center)).toBeLessThan(1e-10);
    expect(camera.fov).toBe(48);
  });

  it('interrompt au cadrage courant et ne continue plus à déplacer la caméra', () => {
    const camera = new THREE.PerspectiveCamera(96);
    const target = new THREE.Vector3();
    const publish = vi.fn();
    const departure = new EarthObserverDeparture(camera, target, publish);

    expect(departure.update(1)).toBe(false);
    departure.cancel();
    departure.retarget(target);
    departure.shiftOrigin(target);
    expect(publish).not.toHaveBeenCalled();
    camera.position.set(0.7, 0, 0);
    camera.lookAt(new THREE.Vector3(2, 1, 0));
    departure.start(new THREE.Vector3(), 5, 48);
    departure.update(0.8);
    const position = camera.position.clone();
    const orientation = camera.quaternion.clone();
    const pivot = target.clone();
    const fieldOfView = camera.fov;

    departure.cancel();
    expect(departure.active).toBe(false);
    expect(departure.update(3)).toBe(false);
    expect(camera.position).toEqual(position);
    expect(camera.quaternion.toArray()).toEqual(orientation.toArray());
    expect(target).toEqual(pivot);
    expect(camera.fov).toBe(fieldOfView);
    expect(
      camera.up.distanceTo(new THREE.Vector3(0, 1, 0).applyQuaternion(orientation)),
    ).toBeLessThan(1e-10);
    expect(publish).toHaveBeenLastCalledWith({ active: false, progress: 1 });
  });

  it('accepte une sortie immédiate et un départ dégénéré sans produire de NaN', () => {
    const camera = new THREE.PerspectiveCamera();
    const target = new THREE.Vector3();
    const departure = new EarthObserverDeparture(camera, target, vi.fn());

    departure.start(new THREE.Vector3(), 4.5, 48, 0);
    expect(departure.active).toBe(false);
    expect(camera.position.length()).toBeCloseTo(4.5);
    expect(camera.quaternion.toArray().every(Number.isFinite)).toBe(true);
    expect(target).toEqual(new THREE.Vector3());
  });
});
