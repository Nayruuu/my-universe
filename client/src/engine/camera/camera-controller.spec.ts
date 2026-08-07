import * as THREE from 'three';
import { SpaceObject } from '../../data/models/universe.models';
import { CameraController } from './camera-controller';
import {
  EARTH_OBSERVER_VIEW_EVENT,
  type EarthObserverViewState,
} from './earth-observer-camera-control';
import {
  CAMERA_FAR_DISTANCE,
  FREE_NAVIGATION_MIN_DISTANCE,
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
  let canvas: HTMLCanvasElement;
  const settled = vi.fn();

  beforeEach(() => {
    camera = new THREE.PerspectiveCamera(48, 1, 0.025, CAMERA_FAR_DISTANCE);
    camera.position.set(0, 0, 24);
    canvas = document.createElement('canvas');
    controller = new CameraController(camera, canvas, settled);
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
    expect(controller.controls.minDistance).toBe(FREE_NAVIGATION_MIN_DISTANCE);
    expect(controller.controls.minDistance).toBeLessThan(distanceBeforeRelease);
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
    expect(settled).toHaveBeenCalledWith(distanceAfterZoom, 'zoom');
  });

  it('effectue un aller-retour sémantique sans perdre la cible caméra', () => {
    camera.position.set(0, 0, 4.8);

    for (const expected of [520, 1_400, 9_600, 17_000, 120_000]) {
      controller.zoomSemantically(480);
      expect(controller.distanceToTarget).toBeCloseTo(expected, 6);
    }
    expect(controller.semanticZoomActive).toBe(true);
    expect(controller.hasActiveTarget).toBe(false);

    for (const expected of [17_000, 9_600, 1_400, 520, 4.8]) {
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

  it('garde le point visé sous le même pixel pendant le zoom', () => {
    const anchor = new THREE.Vector3(6, 2, 0);

    camera.updateMatrixWorld();
    const screenPosition = anchor.clone().project(camera);

    controller.adoptZoomTarget(anchor, earth);
    controller.zoomSemantically(-120);
    camera.updateMatrixWorld();
    const zoomedScreenPosition = anchor.clone().project(camera);

    expect(zoomedScreenPosition.x).toBeCloseTo(screenPosition.x, 8);
    expect(zoomedScreenPosition.y).toBeCloseTo(screenPosition.y, 8);
    expect(controller.controls.target).not.toEqual(anchor);
    expect(controller.controls.target.x).toBeGreaterThan(0);
    expect(controller.distanceToTarget).toBeLessThan(24);
    expect(controller.isTransitioning).toBe(false);
  });

  it('projette le curseur vide sur le plan de navigation avant de zoomer', () => {
    expect(controller.lastZoomDiagnostics).toBeNull();

    controller.adoptZoomPointer(0.5, 0.25);
    controller.zoomSemantically(-120);

    expect(controller.controls.target.x).toBeGreaterThan(0);
    expect(controller.controls.target.y).toBeGreaterThan(0);
    expect(controller.distanceToTarget).toBeLessThan(24);
    expect(controller.isTransitioning).toBe(false);
    expect(controller.lastZoomDiagnostics).toMatchObject({
      deltaY: -120,
      beforeDistance: 24,
      status: 'applied',
    });
    expect(controller.lastZoomDiagnostics?.requestedDistance).toBeCloseTo(24 * Math.exp(-0.18));
    expect(controller.lastZoomDiagnostics?.appliedDistance).toBeCloseTo(
      controller.distanceToTarget,
    );
  });

  it('change de référentiel sans perdre la distance ni le trajet sémantique', () => {
    controller.zoomSemantically(480);
    const distance = controller.distanceToTarget;
    const target = new THREE.Vector3(12, 3, -2);

    controller.rebaseTarget(target, earth);

    expect(controller.controls.target).toEqual(target);
    expect(controller.distanceToTarget).toBeCloseTo(distance, 8);
    expect(controller.semanticZoomActive).toBe(true);
    expect(controller.hasActiveTarget).toBe(true);
  });

  it('interpole un changement de référentiel sans saut de distance ou de direction', () => {
    controller.zoomSemantically(480);
    const distance = controller.distanceToTarget;
    const direction = camera.position.clone().sub(controller.controls.target).normalize();
    const target = new THREE.Vector3(100, 20, -8);

    controller.transitionReferenceFrame(target, earth);

    expect(controller.isTransitioning).toBe(true);
    controller.update(0.16);
    expect(controller.controls.target.x).toBeGreaterThan(0);
    expect(controller.controls.target.x).toBeLessThan(target.x);
    expect(controller.distanceToTarget).toBeCloseTo(distance, 8);

    controller.update(1);
    expect(controller.controls.target).toEqual(target);
    expect(controller.distanceToTarget).toBeCloseTo(distance, 8);
    const finalDirection = camera.position.clone().sub(controller.controls.target).normalize();

    expect(finalDirection.x).toBeCloseTo(direction.x, 12);
    expect(finalDirection.y).toBeCloseTo(direction.y, 12);
    expect(finalDirection.z).toBeCloseTo(direction.z, 12);
    expect(controller.semanticZoomActive).toBe(true);
  });

  it('termine le référentiel précédent avant un nouveau zoom ou geste', () => {
    const firstTarget = new THREE.Vector3(100, 20, -8);

    controller.transitionReferenceFrame(firstTarget, earth);
    controller.zoomSemantically(-120);

    expect(controller.controls.target).toEqual(firstTarget);
    expect(controller.isTransitioning).toBe(false);

    const secondTarget = new THREE.Vector3(-50, 8, 12);

    controller.transitionReferenceFrame(secondTarget, earth);
    controller.controls.dispatchEvent({ type: 'start' });

    expect(controller.controls.target).toEqual(secondTarget);
    expect(controller.isTransitioning).toBe(false);
  });

  it('finalise le référentiel avant de projeter une nouvelle ancre de curseur', () => {
    const target = new THREE.Vector3(100, 20, -8);

    controller.transitionReferenceFrame(target, earth);
    controller.adoptZoomPointer(0, 0);

    expect(controller.controls.target).toEqual(target);
    controller.zoomSemantically(-120);
    expect(controller.controls.target).toEqual(target);
  });

  it('choisit une direction stable pour un changement de référentiel dégénéré', () => {
    camera.position.copy(controller.controls.target);

    controller.transitionReferenceFrame(new THREE.Vector3(8, 3, -2), earth);
    controller.update(1);

    expect(Number.isFinite(controller.distanceToTarget)).toBe(true);
    expect(controller.distanceToTarget).toBeGreaterThan(0);
  });

  it('ignore les deltas sémantiques nuls ou invalides', () => {
    const initialDistance = controller.distanceToTarget;

    controller.zoomSemantically(0);
    controller.zoomSemantically(Number.NaN);

    expect(controller.distanceToTarget).toBe(initialDistance);
    expect(controller.semanticZoomActive).toBe(false);
    expect(controller.lastZoomDiagnostics).toMatchObject({
      status: 'ignored',
      beforeDistance: initialDistance,
      appliedDistance: initialDistance,
    });

    controller.zoomSemantically(-Number.MIN_VALUE);
    expect(controller.lastZoomDiagnostics?.status).toBe('unchanged');
  });

  it('termine une transition douce et signale la distance finale', () => {
    controller.focusOn(new THREE.Vector3(12, 0, 0), earth);
    controller.update(3);

    expect(controller.isTransitioning).toBe(false);
    expect(settled).toHaveBeenCalledWith(controller.distanceToTarget, 'transition');
  });

  it('garde le cadrage de sécurité planétaire assez bas pour révéler le plan galactique', () => {
    camera.position.set(20, 0, 0);
    controller.focusOn(new THREE.Vector3(10, 0, 0), earth, 4.8);
    controller.update(3);

    const viewDirection = controller.controls.target.clone().sub(camera.position).normalize();
    const galacticLatitude = THREE.MathUtils.radToDeg(Math.asin(viewDirection.y));

    expect(Math.abs(galacticLatitude)).toBeLessThan(15);
  });

  it('peut finaliser le cadrage initial avant la première frame', () => {
    const target = new THREE.Vector3(120, -30, 8);

    controller.focusOn(target, earth, 17_000);
    expect(controller.isTransitioning).toBe(true);

    controller.completeFocusTransition();

    expect(controller.isTransitioning).toBe(false);
    expect(controller.controls.target).toEqual(target);
    expect(controller.distanceToTarget).toBeCloseTo(17_000, 8);
    expect(settled).toHaveBeenCalledWith(17_000, 'transition');

    controller.completeFocusTransition();
    expect(settled).toHaveBeenCalledOnce();
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
    const observerPosition = new THREE.Vector3(15, 0, 0);
    const observedTarget = new THREE.Vector3(0, 0, 0);

    controller.observeFrom(observerPosition, observedTarget, observerFraming(30));
    expect(controller.observerModeActive).toBe(false);
    expect(controller.observerPresentationActive).toBe(true);
    controller.update(0.6);

    expect(camera.fov).toBeGreaterThan(48);
    expect(camera.fov).toBeLessThan(82);
    expect(camera.getWorldDirection(new THREE.Vector3()).y).toBeGreaterThan(0);
    expect(camera.getWorldDirection(new THREE.Vector3()).y).toBeLessThan(0.5);
    controller.update(1.79);
    expect(controller.isTransitioning).toBe(true);
    controller.update(0.01);

    expect(controller.hasActiveTarget).toBe(true);
    expect(controller.isTransitioning).toBe(false);
    expect(controller.observerModeActive).toBe(true);
    expect(controller.observerPresentationActive).toBe(true);
    expect(controller.controls.enableRotate).toBe(false);
    expect(controller.controls.enablePan).toBe(false);
    expect(controller.controls.enabled).toBe(false);
    expect(camera.position.x).toBeCloseTo(15, 5);
    expect(camera.position.y).toBeCloseTo(0, 5);
    expect(camera.position.z).toBeCloseTo(0, 5);
    expect(controller.controls.target).toEqual(new THREE.Vector3(0, 0, 0));
    expect(controller.controls.minDistance).toBe(FREE_NAVIGATION_MIN_DISTANCE);
    expect(camera.getWorldDirection(new THREE.Vector3()).y).toBeCloseTo(0.5, 5);

    const directionBefore = camera.getWorldDirection(new THREE.Vector3());

    canvas.dispatchEvent(pointerEvent('pointerdown', 1, 300, 220));
    canvas.dispatchEvent(pointerEvent('pointermove', 1, 420, 260));
    canvas.dispatchEvent(pointerEvent('pointerup', 1, 420, 260));
    controller.update(1 / 60);

    expect(camera.position.distanceTo(observerPosition)).toBeLessThan(1e-12);
    expect(
      camera.getWorldDirection(new THREE.Vector3()).distanceTo(directionBefore),
    ).toBeGreaterThan(0.1);

    const observerTarget = controller.controls.target.clone();

    controller.follow(new THREE.Vector3(90, 12, -6));
    expect(controller.controls.target).toEqual(observerTarget);

    const fieldOfViewBeforeZoom = camera.fov;

    controller.zoomBy(0.75);
    expect(camera.fov).toBeLessThan(fieldOfViewBeforeZoom);
    controller.zoomSemantically(240);
    expect(camera.fov).toBeGreaterThan(fieldOfViewBeforeZoom * 0.75);

    controller.releaseTarget();
    expect(controller.observerModeActive).toBe(false);
    expect(controller.observerPresentationActive).toBe(false);
    expect(controller.controls.enabled).toBe(true);
    expect(controller.controls.enableRotate).toBe(true);
    expect(controller.controls.enablePan).toBe(true);
    expect(camera.fov).toBe(82);
  });

  it('ne réactive jamais les contrôles orbitaux en recentrant le ciel terrestre', () => {
    const observerPosition = new THREE.Vector3(15, 0, 0);

    controller.observeFrom(observerPosition, new THREE.Vector3(0, 0, 0), observerFraming(30));
    controller.update(2.4);
    expect(controller.observerModeActive).toBe(true);

    controller.observeFrom(observerPosition, new THREE.Vector3(0, 8, -4), observerFraming(12));

    expect(controller.isTransitioning).toBe(true);
    expect(controller.observerModeActive).toBe(false);
    expect(controller.observerPresentationActive).toBe(true);
    expect(controller.controls.enabled).toBe(false);
    expect(controller.controls.enableRotate).toBe(false);
    expect(controller.controls.enablePan).toBe(false);

    controller.update(2.4);

    expect(controller.isTransitioning).toBe(false);
    expect(controller.observerModeActive).toBe(true);
    expect(controller.controls.enabled).toBe(false);
    expect(controller.controls.enableRotate).toBe(false);
    expect(controller.controls.enablePan).toBe(false);
  });

  it('recule continûment de l’étoile vers le point d’observation terrestre', () => {
    camera.position.set(0, 0, 10);
    controller.controls.target.set(0, 0, 0);
    controller.controls.update();
    controller.observeFrom(new THREE.Vector3(-30, 0, 0), new THREE.Vector3());
    const distances = [controller.distanceToTarget];

    for (let frame = 0; frame < 17; frame += 1) {
      controller.update(0.15);
      distances.push(controller.distanceToTarget);
    }

    for (let index = 1; index < distances.length; index += 1) {
      expect(distances[index]).toBeGreaterThanOrEqual(distances[index - 1]! - 1e-10);
    }
    expect(distances.at(-1)).toBeCloseTo(30, 10);
    expect(controller.observerModeActive).toBe(true);
  });

  it('conserve une orientation valide si le point observé coïncide avec l’observateur', () => {
    const observerPosition = new THREE.Vector3(4, 2, -3);

    controller.observeFrom(observerPosition, observerPosition);
    controller.update(2.4);

    const direction = camera.getWorldDirection(new THREE.Vector3());

    expect(controller.observerModeActive).toBe(true);
    expect(camera.position.distanceTo(observerPosition)).toBeCloseTo(
      FREE_NAVIGATION_MIN_DISTANCE,
      10,
    );
    expect(direction.length()).toBeCloseTo(1, 10);
    expect(Number.isFinite(direction.x)).toBe(true);
    expect(Number.isFinite(direction.y)).toBe(true);
    expect(Number.isFinite(direction.z)).toBe(true);
  });

  it('conserve les limites verticales pendant le voyage vers la vue terrestre', () => {
    const published: EarthObserverViewState[] = [];

    canvas.addEventListener(EARTH_OBSERVER_VIEW_EVENT, (event) =>
      published.push((event as CustomEvent<EarthObserverViewState>).detail),
    );
    controller.observeFrom(
      new THREE.Vector3(15, 0, 0),
      new THREE.Vector3(),
      observerFraming(24, {
        minimumPitchOffsetDegrees: -8,
        maximumPitchOffsetDegrees: 80,
      }),
    );
    controller.update(2.4);

    canvas.dispatchEvent(pointerEvent('pointerdown', 1, 400, 300));
    canvas.dispatchEvent(pointerEvent('pointermove', 1, 400, 30_000));
    canvas.dispatchEvent(pointerEvent('pointerup', 1, 400, 30_000));

    expect(published.at(-1)?.pitchOffsetDegrees).toBeCloseTo(-8, 10);
  });

  it('laisse plusieurs zooms avant progresser après la libération de la cible', () => {
    controller.focusOn(new THREE.Vector3(4, 0, 0), earth);
    controller.update(3);
    const releasedDistance = controller.distanceToTarget;

    controller.releaseTarget();

    for (let index = 0; index < 8; index += 1) {
      controller.zoomSemantically(-120);
    }

    expect(controller.hasActiveTarget).toBe(false);
    expect(controller.distanceToTarget).toBeLessThan(releasedDistance * 0.5);
    expect(controller.lastZoomDiagnostics?.status).toBe('applied');
  });

  it('borne le recul à l’échelle utile de la carte', () => {
    for (let index = 0; index < 20; index += 1) {
      controller.zoomBy(2);
    }

    expect(controller.distanceToTarget).toBe(MAX_NAVIGATION_DISTANCE);

    controller.zoomSemantically(480);
    expect(controller.lastZoomDiagnostics).toMatchObject({
      status: 'maximum',
      appliedDistance: MAX_NAVIGATION_DISTANCE,
    });
  });

  it('explique lorsqu’une collision de cible borne le rapprochement', () => {
    controller.setNavigationConstraints(earth);
    camera.position.set(0, 0, controller.controls.minDistance);
    controller.controls.target.set(0, 0, 0);
    controller.controls.update();

    controller.zoomSemantically(-120);

    expect(controller.lastZoomDiagnostics).toMatchObject({
      status: 'minimum',
      appliedDistance: getMinimumNavigationDistance(earth),
      minimumDistance: getMinimumNavigationDistance(earth),
    });
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

    const trackedTarget = new THREE.Vector3(14, 3, 0);
    const navigationOffset = controller.controls.target.clone().sub(trackedTarget);
    const movement = new THREE.Vector3(1, 2, 3);

    controller.follow(trackedTarget);
    controller.follow(trackedTarget.clone().add(movement));
    expect(controller.controls.target).toEqual(trackedTarget.add(movement).add(navigationOffset));
  });

  it('rejoint directement une cible suivie sans ancrage préservé', () => {
    const target = new THREE.Vector3(8, 1, -2);
    const cameraOffset = camera.position.clone().sub(controller.controls.target);

    controller.follow(target);

    expect(controller.controls.target).toEqual(target);
    expect(camera.position).toEqual(target.clone().add(cameraOffset));
  });

  it('préserve le cadrage décentré pendant le suivi et un changement d’origine', () => {
    const anchor = new THREE.Vector3(10, 2, -1);

    controller.adoptZoomTarget(anchor, earth);
    controller.zoomSemantically(-120);
    const cameraAfterZoom = camera.position.clone();
    const targetAfterZoom = controller.controls.target.clone();

    controller.follow(anchor);
    expect(camera.position).toEqual(cameraAfterZoom);
    expect(controller.controls.target).toEqual(targetAfterZoom);

    const movement = new THREE.Vector3(1, -0.5, 2);

    controller.follow(anchor.clone().add(movement));
    expect(camera.position).toEqual(cameraAfterZoom.clone().add(movement));
    expect(controller.controls.target).toEqual(targetAfterZoom.clone().add(movement));

    const originShift = new THREE.Vector3(6, 1, -3);

    camera.position.sub(originShift);
    controller.controls.target.sub(originShift);
    controller.shiftTrackedPosition(originShift);
    const cameraAfterShift = camera.position.clone();
    const targetAfterShift = controller.controls.target.clone();

    controller.follow(anchor.clone().add(movement).sub(originShift));
    expect(camera.position).toEqual(cameraAfterShift);
    expect(controller.controls.target).toEqual(targetAfterShift);
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
    expect(settled).toHaveBeenCalledWith(controller.distanceToTarget, 'interaction');
  });

  it('identifie uniquement un geste tactile à deux doigts comme un pincement', () => {
    const touchStart = (touchCount: number): void => {
      const event = new Event('touchstart');

      Object.defineProperty(event, 'touches', { value: { length: touchCount } });
      canvas.dispatchEvent(event);
    };

    touchStart(1);
    controller.controls.dispatchEvent({ type: 'end' });
    expect(settled).toHaveBeenLastCalledWith(controller.distanceToTarget, 'interaction');

    touchStart(2);
    controller.controls.dispatchEvent({ type: 'end' });
    expect(settled).toHaveBeenLastCalledWith(controller.distanceToTarget, 'pinch');
  });
});

function objectOfType(type: SpaceObject['type']): SpaceObject {
  return {
    ...earth,
    id: `test-${type}`,
    type,
  };
}

function pointerEvent(
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  pointerId: number,
  clientX: number,
  clientY: number,
): PointerEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;

  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    clientX: { value: clientX },
    clientY: { value: clientY },
    button: { value: 0 },
  });

  return event;
}

function observerFraming(
  initialPitchOffsetDegrees: number,
  pitchLimits = {
    minimumPitchOffsetDegrees: -180,
    maximumPitchOffsetDegrees: 180,
  },
) {
  return { initialPitchOffsetDegrees, pitchLimits };
}
