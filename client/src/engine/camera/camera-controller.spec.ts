import * as THREE from 'three';
import { SpaceObject } from '../../data/models/universe.models';
import { CameraController } from './camera-controller';
import {
  CAMERA_FAR_DISTANCE,
  FREE_NAVIGATION_MIN_DISTANCE,
  getFreeNavigationMinimumDistance,
  getMinimumNavigationDistance,
  MAX_NAVIGATION_DISTANCE,
} from './navigation-policy';

const earth = {
  id: 'earth',
  type: 'planet',
  visual: { visualRadius: 0.62 },
} as SpaceObject;

describe('CameraController', () => {
  let controller: CameraController;
  let camera: THREE.PerspectiveCamera;
  const settled = vi.fn();

  beforeEach(() => {
    camera = new THREE.PerspectiveCamera(48, 1, 0.025, CAMERA_FAR_DISTANCE);
    camera.position.set(0, 0, 24);
    controller = new CameraController(camera, document.createElement('canvas'), settled);
  });

  afterEach(() => {
    controller.dispose();
    vi.clearAllMocks();
  });

  it('active les gestes orbitaux uniquement autour d’une cible', () => {
    expect(controller.hasActiveTarget).toBe(false);
    expect(controller.controls.enableRotate).toBe(false);
    expect(controller.controls.enablePan).toBe(false);

    controller.focusOn(new THREE.Vector3(4, 0, 0), earth);

    expect(controller.hasActiveTarget).toBe(true);
    expect(controller.controls.minDistance).toBe(getMinimumNavigationDistance(earth));

    const distanceBeforeRelease = controller.distanceToTarget;

    controller.releaseTarget();

    expect(controller.hasActiveTarget).toBe(false);
    expect(controller.controls.enableRotate).toBe(false);
    expect(controller.controls.enablePan).toBe(false);
    expect(controller.controls.minDistance).toBe(
      getFreeNavigationMinimumDistance(distanceBeforeRelease),
    );
    expect(controller.isTransitioning).toBe(false);
  });

  it('un zoom explicite interrompt la transition et reste appliqué', () => {
    controller.focusOn(new THREE.Vector3(4, 0, 0), earth);
    const distanceBeforeZoom = controller.distanceToTarget;

    controller.zoomBy(0.5);
    const distanceAfterZoom = controller.distanceToTarget;

    controller.update(1);

    expect(controller.isTransitioning).toBe(false);
    expect(distanceAfterZoom).toBeLessThan(distanceBeforeZoom);
    expect(controller.distanceToTarget).toBeCloseTo(distanceAfterZoom);
    expect(settled).toHaveBeenCalledWith(distanceAfterZoom);
  });

  it('effectue un aller-retour sémantique sans perdre la cible caméra', () => {
    camera.position.set(0, 0, 4.8);

    for (const expected of [520, 1_400, 5_200, 17_000]) {
      controller.zoomSemantically(480);
      expect(controller.distanceToTarget).toBeCloseTo(expected, 6);
    }
    expect(controller.semanticZoomActive).toBe(true);
    expect(controller.hasActiveTarget).toBe(false);

    for (const expected of [5_200, 1_400, 520, 4.8]) {
      controller.zoomSemantically(-480);
      expect(controller.distanceToTarget).toBeCloseTo(expected, 6);
    }
    expect(controller.semanticZoomActive).toBe(false);
    expect(controller.controls.target).toEqual(new THREE.Vector3());
  });

  it('réinitialise le trajet sémantique lors d’un cadrage explicite', () => {
    controller.zoomSemantically(480);
    expect(controller.semanticZoomActive).toBe(true);

    controller.focusOn(new THREE.Vector3(4, 0, 0), earth);

    expect(controller.semanticZoomActive).toBe(false);
    controller.update(3);
    const focusedDistance = controller.distanceToTarget;

    controller.zoomSemantically(-120);
    expect(controller.distanceToTarget).toBeLessThan(focusedDistance);
  });

  it('ignore les deltas sémantiques nuls ou invalides', () => {
    const initialDistance = controller.distanceToTarget;

    controller.zoomSemantically(0);
    controller.zoomSemantically(Number.NaN);

    expect(controller.distanceToTarget).toBe(initialDistance);
    expect(controller.semanticZoomActive).toBe(false);
  });

  it('termine une transition douce et signale la distance finale', () => {
    controller.focusOn(new THREE.Vector3(12, 0, 0), earth);
    controller.update(3);

    expect(controller.isTransitioning).toBe(false);
    expect(settled).toHaveBeenCalledWith(controller.distanceToTarget);
  });

  it('interpole les grands changements d’échelle de façon logarithmique', () => {
    controller.focusOnFromDirection(new THREE.Vector3(), earth, new THREE.Vector3(0, 0, 1), 2_400);
    controller.update(0.425);

    expect(controller.distanceToTarget).toBeCloseTo(240, 1);
    expect(controller.isTransitioning).toBe(true);
  });

  it('oriente une cible depuis la direction imposée par une ombre', () => {
    controller.focusOnFromDirection(
      new THREE.Vector3(4, 2, 1),
      earth,
      new THREE.Vector3(0, 1, 0),
      5,
    );
    controller.update(3);

    expect(controller.controls.target).toEqual(new THREE.Vector3(4, 2, 1));
    expect(camera.position.x).toBeCloseTo(4, 4);
    expect(camera.position.y).toBeCloseTo(7, 4);
    expect(camera.position.z).toBeCloseTo(1, 4);
  });

  it('place la caméra à un point d’observation et regarde une autre cible', () => {
    controller.observeFrom(new THREE.Vector3(15, 0, 0), new THREE.Vector3(0, 0, 0));
    controller.update(3);

    expect(controller.hasActiveTarget).toBe(true);
    expect(camera.position.x).toBeCloseTo(15, 5);
    expect(camera.position.y).toBeCloseTo(0, 5);
    expect(camera.position.z).toBeCloseTo(0, 5);
    expect(controller.controls.target).toEqual(new THREE.Vector3(0, 0, 0));
    expect(controller.controls.minDistance).toBe(FREE_NAVIGATION_MIN_DISTANCE);
  });

  it('borne le rapprochement en navigation libre au contexte récemment quitté', () => {
    controller.focusOn(new THREE.Vector3(4, 0, 0), earth);
    controller.update(3);
    controller.releaseTarget();
    const minimumDistance = controller.controls.minDistance;

    for (let index = 0; index < 20; index += 1) {
      controller.zoomBy(0.5);
    }

    expect(controller.distanceToTarget).toBeCloseTo(minimumDistance);
  });

  it('borne le recul à l’échelle utile de la carte', () => {
    for (let index = 0; index < 20; index += 1) {
      controller.zoomBy(2);
    }

    expect(controller.distanceToTarget).toBe(MAX_NAVIGATION_DISTANCE);
  });

  it('choisit une direction sûre lorsque caméra, cible ou direction sont dégénérées', () => {
    controller.controls.target.set(0, 0, 0);
    camera.position.set(0, 0, 0);
    controller.focusOn(new THREE.Vector3(10, 0, 0), earth, Number.POSITIVE_INFINITY);
    controller.update(0.1);
    expect(controller.isTransitioning).toBe(true);

    controller.focusOnFromDirection(
      new THREE.Vector3(2, 0, 0),
      earth,
      new THREE.Vector3(),
      Number.NaN,
    );
    controller.update(3);
    expect(Number.isFinite(controller.distanceToTarget)).toBe(true);
  });

  it.each([
    ['planète naine', objectOfType('dwarf-planet')],
    ['lune', objectOfType('moon')],
    ['étoile', objectOfType('star')],
  ])('cadre aussi une %s en tenant compte de sa géométrie', (_label, object) => {
    camera.position.set(20, 0, 0);
    controller.focusOn(new THREE.Vector3(10, 0, 0), object, 4);
    controller.update(0.2);
    controller.focusOn(new THREE.Vector3(0, 10, 0), object, 0);
    controller.update(3);

    expect(Number.isFinite(controller.distanceToTarget)).toBe(true);
  });

  it('suit une cible pendant une transition, une ancre de zoom et en navigation stable', () => {
    controller.focusOn(new THREE.Vector3(4, 0, 0), earth);
    controller.follow(new THREE.Vector3(8, 1, 0));
    controller.update(3);
    expect(controller.controls.target).toEqual(new THREE.Vector3(8, 1, 0));

    controller.adoptZoomTarget(new THREE.Vector3(12, 2, 0), earth);
    controller.follow(new THREE.Vector3(14, 3, 0));
    expect(controller.isTransitioning).toBe(true);
    controller.cancelFocus();

    const stableTarget = controller.controls.target.clone();

    controller.follow(stableTarget);
    controller.follow(stableTarget.clone().add(new THREE.Vector3(1, 2, 3)));
    expect(controller.controls.target).toEqual(stableTarget.add(new THREE.Vector3(1, 2, 3)));
  });

  it('rejoint progressivement une ancre de zoom puis publie sa stabilisation', () => {
    controller.adoptZoomTarget(new THREE.Vector3(10, 0, 0), earth);
    controller.update(0.001);
    expect(controller.isTransitioning).toBe(true);
    controller.update(3);
    controller.update(0.001);

    expect(controller.isTransitioning).toBe(false);
    expect(settled).toHaveBeenCalled();
  });

  it('annule une transition au début d’un geste et publie la fin du geste', () => {
    controller.focusOn(new THREE.Vector3(4, 0, 0), earth);
    controller.controls.dispatchEvent({ type: 'start' });
    expect(controller.isTransitioning).toBe(false);

    controller.controls.dispatchEvent({ type: 'end' });
    expect(settled).toHaveBeenCalledWith(controller.distanceToTarget);
  });
});

function objectOfType(type: SpaceObject['type']): SpaceObject {
  return {
    ...earth,
    id: `test-${type}`,
    type,
  };
}
