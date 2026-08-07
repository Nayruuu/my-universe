import * as THREE from 'three';
import { CameraViewportVisibility } from './camera-viewport-visibility';

describe('CameraViewportVisibility', () => {
  const visibility = new CameraViewportVisibility();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);

  beforeEach(() => {
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  });

  it('reconnaît un point projeté dans le viewport', () => {
    expect(visibility.contains(new THREE.Vector3(0, 0, 0), camera)).toBe(true);
  });

  it('rejette les points au-delà des bords et accepte la marge demandée', () => {
    const nearRightEdge = new THREE.Vector3(6, 0, 0);

    expect(visibility.contains(nearRightEdge, camera)).toBe(false);
    expect(visibility.contains(nearRightEdge, camera, 0.05)).toBe(true);
  });

  it('rejette un point derrière la caméra ou hors de sa profondeur visible', () => {
    expect(visibility.contains(new THREE.Vector3(0, 0, 20), camera)).toBe(false);
    expect(visibility.contains(new THREE.Vector3(0, 0, 9.95), camera)).toBe(false);
    expect(visibility.contains(new THREE.Vector3(0, 0, -200), camera)).toBe(false);
  });

  it('rejette une projection non finie', () => {
    expect(visibility.contains(new THREE.Vector3(Number.NaN, 0, 0), camera)).toBe(false);
    expect(visibility.contains(new THREE.Vector3(0, Number.NaN, 0), camera)).toBe(false);
    expect(visibility.contains(new THREE.Vector3(0, 0, Number.NaN), camera)).toBe(false);
  });
});
