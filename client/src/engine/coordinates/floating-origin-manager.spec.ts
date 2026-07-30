import * as THREE from 'three';
import { FloatingOriginManager } from './floating-origin-manager';

describe('FloatingOriginManager', () => {
  it('recentre la scène, la caméra et la cible au-delà du seuil', () => {
    const manager = new FloatingOriginManager(100);
    const root = new THREE.Group();
    const camera = new THREE.PerspectiveCamera();

    camera.position.set(140, 5, -2);
    const target = new THREE.Vector3(120, 0, 0);

    expect(manager.update(root, camera, target, false)).toBe(true);
    expect(root.position.toArray()).toEqual([-120, 0, 0]);
    expect(camera.position.toArray()).toEqual([20, 5, -2]);
    expect(target.toArray()).toEqual([0, 0, 0]);
    expect(manager.accumulatedOrigin.toArray()).toEqual([120, 0, 0]);
  });

  it('attend la fin d’une transition et respecte le seuil', () => {
    const manager = new FloatingOriginManager(100);
    const root = new THREE.Group();
    const camera = new THREE.PerspectiveCamera();
    const nearbyTarget = new THREE.Vector3(99, 0, 0);
    const distantTarget = new THREE.Vector3(120, 0, 0);

    expect(manager.update(root, camera, nearbyTarget, false)).toBe(false);
    expect(manager.update(root, camera, distantTarget, true)).toBe(false);
    expect(manager.accumulatedOrigin.length()).toBe(0);
  });
});
