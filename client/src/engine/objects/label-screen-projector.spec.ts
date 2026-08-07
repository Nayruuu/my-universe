import * as THREE from 'three';
import { LabelScreenProjector, getLabelViewportLayout } from './label-screen-projector';

describe('LabelScreenProjector', () => {
  it('projette un objet visible dans les coordonnées du calque de labels', () => {
    const projector = new LabelScreenProjector();
    const camera = cameraForLabels();

    expect(
      projector.project(
        new THREE.Vector3(0.5, -0.5, 0),
        camera,
        {
          viewportWidth: 800,
          viewportHeight: 300,
          safeTop: 76,
          safeBottom: 88,
        },
        false,
      ),
    ).toEqual({ x: 600, y: 207 });
  });

  it('écarte les objets ordinaires hors du volume caméra ou des marges sûres', () => {
    const projector = new LabelScreenProjector();
    const camera = cameraForLabels();
    const options = {
      viewportWidth: 800,
      viewportHeight: 300,
      safeTop: 76,
      safeBottom: 88,
    };

    expect(projector.project(new THREE.Vector3(0, 0, 20), camera, options, false)).toBeNull();
    expect(projector.project(new THREE.Vector3(3, 0, 0), camera, options, false)).toBeNull();
    expect(projector.project(new THREE.Vector3(0, 1, 0), camera, options, false)).toBeNull();
  });

  it('inverse puis conserve un repère cartographique situé derrière la caméra', () => {
    const projector = new LabelScreenProjector();
    const camera = cameraForLabels();
    const options = {
      viewportWidth: 800,
      viewportHeight: 300,
      safeTop: 76,
      safeBottom: 88,
    };

    expect(projector.project(new THREE.Vector3(0, 0, 20), camera, options, true)).toEqual({
      x: 400,
      y: -18,
    });
    expect(projector.project(new THREE.Vector3(0.5, 0.25, 20), camera, options, true)).toEqual({
      x: 200,
      y: 169.5,
    });
  });
});

describe('marges du calque de labels', () => {
  it('réserve les contrôles mobiles sans condamner les côtés', () => {
    expect(getLabelViewportLayout(720, false)).toEqual({
      safeTop: 112,
      safeBottom: 124,
      landmarkSafeLeft: 8,
      landmarkSafeRight: 8,
    });
  });

  it('réserve la fiche et les contrôles latéraux sur desktop', () => {
    expect(getLabelViewportLayout(1_440, true)).toEqual({
      safeTop: 76,
      safeBottom: 88,
      landmarkSafeLeft: 390,
      landmarkSafeRight: 72,
    });
    expect(getLabelViewportLayout(1_440, false).landmarkSafeLeft).toBe(8);
  });
});

function cameraForLabels(): THREE.OrthographicCamera {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);

  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();

  return camera;
}
