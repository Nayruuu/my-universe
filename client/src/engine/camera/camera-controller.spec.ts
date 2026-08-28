import * as THREE from 'three';
import { SpaceObject } from '../../data/models/universe.models';
import { CameraController } from './camera-controller';
import {
  EARTH_OBSERVER_LOOK_AT_EVENT,
  EARTH_OBSERVER_VIEW_EVENT,
  type EarthObserverLookAtDetail,
  type EarthObserverViewState,
} from './earth-observer-camera-control';
import {
  ACTIVE_TARGET_POINTER_ZOOM_MAXIMUM_MULTIPLIER,
  CAMERA_FAR_DISTANCE,
  FREE_NAVIGATION_MIN_DISTANCE,
  getMinimumNavigationDistance,
  MAX_NAVIGATION_DISTANCE,
} from './navigation-policy';
import { MILKY_WAY_NAVIGATION_DISTANCE } from './navigation-scales';
import { LOG_DISTANCE_PER_WHEEL_PIXEL } from './zoom-physics';

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

  it('garde un pivot de carte orientable même sans cible astronomique', () => {
    expect(controller.hasActiveTarget).toBe(false);
    expect(controller.controls.enableRotate).toBe(true);
    expect(controller.controls.enablePan).toBe(true);
    expect(controller.controls.mouseButtons.LEFT).toBe(THREE.MOUSE.ROTATE);
    expect(controller.controls.touches.ONE).toBe(THREE.TOUCH.ROTATE);

    controller.focusOn(new THREE.Vector3(4, 0, 0), earth);

    expect(controller.hasActiveTarget).toBe(true);
    expect(controller.controls.enableRotate).toBe(true);
    expect(controller.controls.enablePan).toBe(true);
    expect(controller.controls.mouseButtons.LEFT).toBe(THREE.MOUSE.ROTATE);
    expect(controller.controls.touches.ONE).toBe(THREE.TOUCH.ROTATE);
    expect(controller.controls.minDistance).toBe(getMinimumNavigationDistance(earth));

    const distanceBeforeRelease = controller.distanceToTarget;

    controller.releaseTarget();

    expect(controller.hasActiveTarget).toBe(false);
    expect(controller.controls.enableRotate).toBe(true);
    expect(controller.controls.enablePan).toBe(true);
    expect(controller.controls.mouseButtons.LEFT).toBe(THREE.MOUSE.ROTATE);
    expect(controller.controls.touches.ONE).toBe(THREE.TOUCH.ROTATE);
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

  it('expose le rapprochement réversible d’une cible', () => {
    controller.setNavigationConstraints(earth);

    expect(controller.inwardZoomActive).toBe(false);
    controller.zoomSemantically(-120);
    expect(controller.inwardZoomActive).toBe(true);

    controller.cancelInwardZoom();
    expect(controller.inwardZoomActive).toBe(false);
    controller.zoomSemantically(-120);
    controller.transitionReferenceFrame(new THREE.Vector3(100, 20, -8), earth);
    expect(controller.inwardZoomActive).toBe(false);
  });

  it('relaie le rythme accéléré tout en conservant un aller-retour exact', () => {
    const initialCamera = camera.position.clone();
    const initialTarget = controller.controls.target.clone();
    const deltaY = 12.393_471_593_369_597;

    controller.setNavigationConstraints(earth);
    controller.adoptZoomPointer(-0.034_722_222_222_222_21, 0.104_707_012_487_992_3);
    controller.zoomSemantically(-deltaY, ACTIVE_TARGET_POINTER_ZOOM_MAXIMUM_MULTIPLIER);

    expect(controller.distanceToTarget).toBeCloseTo(
      initialCamera.distanceTo(initialTarget) *
        Math.exp(
          -deltaY * LOG_DISTANCE_PER_WHEEL_PIXEL * ACTIVE_TARGET_POINTER_ZOOM_MAXIMUM_MULTIPLIER,
        ),
      12,
    );

    controller.adoptZoomPointer(-0.034_722_222_222_222_21, 0.104_707_012_487_992_3);
    controller.zoomSemantically(deltaY, ACTIVE_TARGET_POINTER_ZOOM_MAXIMUM_MULTIPLIER);

    expect(camera.position.distanceTo(initialCamera)).toBeLessThan(1e-11);
    expect(controller.controls.target.distanceTo(initialTarget)).toBeLessThan(1e-11);
  });

  it('effectue un aller-retour sémantique sans perdre la cible caméra', () => {
    camera.position.set(0, 0, 4.8);

    for (const expected of [520, 1_400, 3_600, 17_000, 120_000]) {
      controller.zoomSemantically(480);
      expect(controller.distanceToTarget).toBeCloseTo(expected, 6);
    }
    expect(controller.semanticZoomActive).toBe(true);
    expect(controller.hasActiveTarget).toBe(false);

    for (const expected of [17_000, 3_600, 1_400, 520, 4.8]) {
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

  it('préserve le décalage du pointeur quand la cible du nouveau référentiel se déplace', () => {
    const target = new THREE.Vector3(100, 20, -8);

    controller.transitionReferenceFrame(target, earth);
    controller.update(1);
    controller.adoptZoomPointer(0.45, -0.2);
    controller.zoomSemantically(-120);
    const pivotOffset = controller.controls.target.clone().sub(target);
    const cameraBeforeFollow = camera.position.clone();
    const displacement = new THREE.Vector3(3, -2, 5);

    expect(pivotOffset.length()).toBeGreaterThan(0.01);
    controller.follow(target.clone().add(displacement));

    expect(controller.controls.target).toEqual(target.clone().add(displacement).add(pivotOffset));
    expect(camera.position).toEqual(cameraBeforeFollow.add(displacement));
  });

  it('adopte un référentiel logique sans recentrer le pivot géométrique', () => {
    controller.adoptZoomPointer(0.4, -0.3);
    controller.zoomSemantically(-120);
    const cameraBeforeAdoption = camera.position.clone();
    const pivotBeforeAdoption = controller.controls.target.clone();
    const distanceBeforeAdoption = controller.distanceToTarget;
    const target = new THREE.Vector3(100, 20, -8);

    controller.adoptReferenceFrame(target, earth);

    expect(camera.position).toEqual(cameraBeforeAdoption);
    expect(controller.controls.target).toEqual(pivotBeforeAdoption);
    expect(controller.distanceToTarget).toBeCloseTo(distanceBeforeAdoption, 12);
    expect(controller.controls.minDistance).toBe(getMinimumNavigationDistance(earth));
    expect(controller.hasActiveTarget).toBe(true);
    expect(controller.isTransitioning).toBe(false);

    const displacement = new THREE.Vector3(3, -2, 5);

    controller.follow(target.clone().add(displacement));

    expect(camera.position).toEqual(cameraBeforeAdoption.clone().add(displacement));
    expect(controller.controls.target).toEqual(pivotBeforeAdoption.clone().add(displacement));
  });

  it('guide doucement l’inclinaison galactique tout en donnant la priorité au geste manuel', () => {
    const target = new THREE.Vector3();
    const initialDistance = controller.distanceToTarget;

    controller.follow(target, 0.82);
    controller.update(1);

    expect(Math.abs(camera.position.clone().sub(target).normalize().y)).toBeGreaterThan(0.7);
    expect(controller.distanceToTarget).toBeCloseTo(initialDistance, 10);

    camera.position.set(0, 0, initialDistance);
    controller.controls.target.copy(target);
    controller.controls.dispatchEvent({ type: 'start' });
    controller.follow(target, 0.82);
    controller.update(1);

    expect(Math.abs(camera.position.clone().sub(target).normalize().y)).toBeLessThan(0.01);

    controller.zoomSemantically(-1);
    controller.follow(target, 0.82);
    controller.update(1);

    expect(Math.abs(camera.position.clone().sub(target).normalize().y)).toBeLessThan(0.01);

    controller.controls.dispatchEvent({ type: 'end' });
    controller.zoomSemantically(-1);
    controller.follow(target, 0.82);
    controller.update(1);

    expect(Math.abs(camera.position.clone().sub(target).normalize().y)).toBeGreaterThan(0.7);
  });

  it('ne mélange pas pivot guidé, ancre de roulette et rotation simultanée', () => {
    const target = new THREE.Vector3(20, 0, 0);
    const initialDistance = controller.distanceToTarget;

    controller.controls.dispatchEvent({ type: 'start' });
    const manualPivot = controller.controls.target.clone();
    const manualDirection = camera.position.clone().sub(manualPivot).normalize();

    controller.adoptZoomPointer(0.6, -0.4);
    controller.zoomSemantically(-1);

    expect(controller.controls.target).toEqual(manualPivot);

    controller.adoptZoomAnchor(target);
    controller.zoomSemantically(-120);
    controller.follow(target, 0.45, 'distance');
    controller.update(1 / 60);

    expect(controller.distanceToTarget).toBeLessThan(initialDistance);
    expect(controller.controls.target).toEqual(manualPivot);
    expect(
      camera.position.clone().sub(manualPivot).normalize().angleTo(manualDirection),
    ).toBeLessThan(1e-12);

    controller.adoptReferenceFrame(target, earth);
    controller.follow(target, 0.45, 'distance');
    controller.update(1 / 60);

    expect(controller.controls.target).toEqual(manualPivot);
    expect(
      camera.position.clone().sub(manualPivot).normalize().angleTo(manualDirection),
    ).toBeLessThan(1e-12);

    controller.controls.dispatchEvent({ type: 'end' });
    controller.follow(target, 0.45, 'distance');
    controller.adoptZoomAnchor(target);
    controller.adoptReferenceFrame(target, earth);
    controller.update(1 / 60);

    const resumedPivotAngle = Math.atan2(
      controller.controls.target.distanceTo(manualPivot),
      controller.distanceToTarget,
    );

    expect(resumedPivotAngle).toBeGreaterThan(0);
    expect(resumedPivotAngle).toBeLessThanOrEqual(THREE.MathUtils.degToRad(8 / 60) + 1e-12);

    for (let frame = 0; frame < 1_000; frame += 1) {
      controller.update(1 / 60);
    }

    expect(controller.controls.target.distanceTo(target)).toBeLessThan(1e-12);
    expect(
      Math.abs(camera.position.clone().sub(controller.controls.target).normalize().y),
    ).toBeCloseTo(0.45, 6);

    const nextTarget = target.clone().add(new THREE.Vector3(5, 0, 0));

    controller.controls.dispatchEvent({ type: 'start' });
    controller.zoomSemantically(-1);
    controller.follow(nextTarget, 0.18, 'distance');
    controller.controls.dispatchEvent({ type: 'end' });
    controller.follow(nextTarget);
    for (let frame = 0; frame < 400; frame += 1) {
      controller.update(1 / 60);
    }

    expect(controller.controls.target.distanceTo(nextTarget)).toBeLessThan(1e-12);
  });

  it('conserve une rotation manuelle sans molette comme override du guide de distance', () => {
    const target = new THREE.Vector3(20, 0, 0);

    controller.controls.dispatchEvent({ type: 'start' });
    const manualPivot = controller.controls.target.clone();

    controller.follow(target, 0.45, 'distance');
    controller.update(1 / 60);
    controller.controls.dispatchEvent({ type: 'end' });
    controller.update(1);

    expect(controller.controls.target).toEqual(manualPivot);
  });

  it('lie la pose galactique à la distance sans rattrapage temporel', () => {
    const target = new THREE.Vector3();

    controller.follow(target, 0.45, 'distance');
    controller.update(1 / 60);

    expect(Math.abs(camera.position.clone().sub(target).normalize().y)).toBeCloseTo(0.45, 12);
    expect(controller.distanceToTarget).toBeCloseTo(24, 12);
    const guidedCameraPosition = camera.position.clone();

    controller.update(0.5);

    expect(camera.position.distanceTo(guidedCameraPosition)).toBeLessThan(1e-12);

    controller.follow(target, 0.18, 'distance');
    controller.update(1 / 60);

    expect(Math.abs(camera.position.clone().sub(target).normalize().y)).toBeCloseTo(0.18, 12);
    expect(controller.distanceToTarget).toBeCloseTo(24, 12);
  });

  it('lie aussi le pivot galactique à la distance sans dérive après la molette', () => {
    const target = new THREE.Vector3(20, 0, 0);
    const initialDistance = controller.distanceToTarget;

    controller.follow(target, 0.18, 'distance');
    controller.update(1 / 60);

    expect(controller.controls.target.distanceTo(target)).toBeLessThan(1e-12);
    expect(controller.distanceToTarget).toBeCloseTo(initialDistance, 12);
    const guidedCameraPosition = camera.position.clone();
    const guidedTarget = controller.controls.target.clone();

    controller.update(0.5);

    expect(controller.controls.target.distanceTo(guidedTarget)).toBeLessThan(1e-12);
    expect(camera.position.distanceTo(guidedCameraPosition)).toBeLessThan(1e-12);
    expect(controller.distanceToTarget).toBeCloseTo(initialDistance, 12);
  });

  it('rend la main au suivi ordinaire sans correction galactique résiduelle', () => {
    const target = new THREE.Vector3(20, 0, 0);

    controller.follow(target, 0.18, 'distance');
    controller.update(0.1);
    const guidedTarget = controller.controls.target.clone();
    const guidedCameraPosition = camera.position.clone();

    controller.follow(target);
    expect(controller.controls.target).toEqual(guidedTarget);
    controller.update(0.5);
    expect(controller.controls.target.distanceTo(guidedTarget)).toBeLessThan(1e-12);
    expect(camera.position.distanceTo(guidedCameraPosition)).toBeLessThan(1e-12);

    const movedTarget = target.clone().add(new THREE.Vector3(1, -2, 3));
    const cameraBeforeOrdinaryFollow = camera.position.clone();

    controller.follow(movedTarget);

    expect(controller.controls.target.distanceTo(movedTarget)).toBeLessThan(1e-12);
    expect(
      camera.position.distanceTo(cameraBeforeOrdinaryFollow.add(movedTarget.clone().sub(target))),
    ).toBeLessThan(1e-12);
  });

  it('abandonne le guide galactique avant de suivre une nouvelle étoile', () => {
    const galacticGuide = new THREE.Vector3(20, 0, 0);
    const starPosition = new THREE.Vector3(-104, 151, 716);

    controller.follow(galacticGuide, 0.18, 'distance');
    controller.update(0.1);
    const cameraBeforeHandoff = camera.position.clone();
    const targetBeforeHandoff = controller.controls.target.clone();

    controller.trackTarget(starPosition, objectOfType('star'));
    controller.adoptZoomAnchor(starPosition);
    controller.zoomSemantically(-120);
    const cameraAfterHandoff = camera.position.clone();
    const targetAfterHandoff = controller.controls.target.clone();

    controller.follow(starPosition);
    controller.update(1 / 60);

    expect(camera.position.distanceTo(cameraAfterHandoff)).toBeLessThan(1e-10);
    expect(controller.controls.target.distanceTo(targetAfterHandoff)).toBeLessThan(1e-10);

    controller.adoptZoomPointer(0.18, 0.06);
    controller.zoomSemantically(120);

    expect(camera.position.distanceTo(cameraBeforeHandoff)).toBeLessThan(1e-10);
    expect(controller.controls.target.distanceTo(targetBeforeHandoff)).toBeLessThan(1e-10);
  });

  it('stabilise le guide pour une caméra confondue avec son pivot ou strictement verticale', () => {
    const target = new THREE.Vector3();

    controller.controls.minDistance = 0;
    camera.position.copy(target);
    controller.controls.target.copy(target);
    controller.follow(target, 0.82);
    controller.update(1);

    expect(camera.position).toEqual(target);

    camera.position.set(0, -24, 0);
    controller.follow(target, 0.82);
    controller.update(1);

    expect(camera.position.y).toBeLessThan(0);
    expect(camera.position.z).toBeGreaterThan(0);
    expect(controller.distanceToTarget).toBeCloseTo(24, 10);
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

  it('laisse respirer les référentiels traversés par une recherche directe vers une planète', () => {
    camera.position.set(0, 0, 17_000);
    controller.controls.target.set(0, 0, 0);
    controller.controls.update();

    controller.focusOn(new THREE.Vector3(), earth, 4.8);
    controller.update(2.2);

    expect(controller.isTransitioning).toBe(true);
    expect(controller.distanceToTarget).toBeGreaterThan(MILKY_WAY_NAVIGATION_DISTANCE);

    controller.update(4.8);

    expect(controller.isTransitioning).toBe(false);
    expect(controller.distanceToTarget).toBeCloseTo(4.8, 8);
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
    expect(controller.observerSkyContentActive).toBe(false);
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
    expect(controller.observerSkyContentActive).toBe(true);
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
    expect(controller.observerSkyContentActive).toBe(false);
    expect(controller.hasActiveTarget).toBe(false);
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
    expect(controller.observerSkyContentActive).toBe(true);
    expect(controller.controls.enabled).toBe(false);
    expect(controller.controls.enableRotate).toBe(false);
    expect(controller.controls.enablePan).toBe(false);

    controller.update(2.4);

    expect(controller.isTransitioning).toBe(false);
    expect(controller.observerModeActive).toBe(true);
    expect(controller.observerSkyContentActive).toBe(true);
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

  it('expose le recentrage animé du regard comme une transition de caméra', () => {
    controller.observeFrom(new THREE.Vector3(15, 0, 0), new THREE.Vector3(), {
      ...observerFraming(0),
      northDirection: { x: 0, y: 0, z: -1 },
      zenithDirection: { x: 0, y: 1, z: 0 },
    });
    controller.update(2.4);
    const lookAt = new CustomEvent<EarthObserverLookAtDetail>(EARTH_OBSERVER_LOOK_AT_EVENT, {
      cancelable: true,
      detail: { altitudeDegrees: 35, azimuthDegrees: 125 },
    });

    window.dispatchEvent(lookAt);

    expect(lookAt.defaultPrevented).toBe(true);
    expect(controller.isTransitioning).toBe(true);
    controller.update(0.2);
    expect(controller.isTransitioning).toBe(true);
    controller.update(1);
    expect(controller.isTransitioning).toBe(false);
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

  it('élargit le champ vertical pour garder une cible haute et son horizon', () => {
    controller.observeFrom(new THREE.Vector3(15, 0, 0), new THREE.Vector3(), {
      ...observerFraming(-42),
      verticalFieldOfViewDegrees: 96,
    });

    controller.update(2.4);

    expect(camera.fov).toBeCloseTo(96, 10);
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

  it('traverse la butée de distance uniquement après la libération de la cible', () => {
    controller.releaseTarget();
    camera.position.set(0, 0, FREE_NAVIGATION_MIN_DISTANCE);
    controller.controls.target.set(0, 0, 0);
    camera.lookAt(controller.controls.target);
    camera.updateMatrixWorld();
    const freePosition = camera.position.clone();

    controller.adoptZoomPointer(0, 0);
    controller.zoomSemantically(-120);

    expect(controller.hasActiveTarget).toBe(false);
    expect(camera.position.distanceTo(freePosition)).toBeGreaterThan(0.1);
    expect(controller.distanceToTarget).toBeCloseTo(FREE_NAVIGATION_MIN_DISTANCE, 12);
    const positionBeforeButtonZoom = camera.position.clone();

    controller.zoomBy(0.5);

    expect(camera.position.distanceTo(positionBeforeButtonZoom)).toBeGreaterThan(0.3);
    expect(controller.distanceToTarget).toBeCloseTo(FREE_NAVIGATION_MIN_DISTANCE, 12);

    controller.setNavigationConstraints(earth);
    camera.position.set(0, 0, controller.controls.minDistance);
    controller.controls.target.set(0, 0, 0);
    camera.lookAt(controller.controls.target);
    camera.updateMatrixWorld();
    const focusedPosition = camera.position.clone();

    controller.adoptZoomPointer(0, 0);
    controller.zoomSemantically(-120);

    expect(controller.hasActiveTarget).toBe(true);
    expect(camera.position.distanceTo(focusedPosition)).toBeLessThan(1e-12);
    expect(controller.lastZoomDiagnostics?.status).toBe('minimum');
  });

  it('peut terminer une rafale libre à la butée sans engager sa traversée', () => {
    controller.releaseTarget();
    camera.position.set(0, 0, FREE_NAVIGATION_MIN_DISTANCE);
    controller.controls.target.set(0, 0, 0);
    camera.lookAt(controller.controls.target);
    camera.updateMatrixWorld();
    const initialCameraPosition = camera.position.clone();
    const initialTarget = controller.controls.target.clone();

    controller.adoptZoomPointer(0.109_375, 0.265_384_615_384_615_33);
    controller.zoomSemantically(-18.714_973_875_118_524, 1, false);

    expect(camera.position.distanceTo(initialCameraPosition)).toBeLessThan(1e-12);
    expect(controller.controls.target.distanceTo(initialTarget)).toBeLessThan(1e-12);
    expect(controller.distanceToTarget).toBeCloseTo(FREE_NAVIGATION_MIN_DISTANCE, 12);
    expect(controller.minimumTraversalActive).toBe(false);
    expect(controller.lastZoomDiagnostics?.status).toBe('minimum');

    controller.adoptZoomPointer(0.109_375, 0.265_384_615_384_615_33);
    controller.zoomSemantically(-18.714_973_875_118_524);

    expect(camera.position.distanceTo(initialCameraPosition)).toBeGreaterThan(1);
    expect(controller.minimumTraversalActive).toBe(true);
  });

  it('oublie une traversée libre lorsqu’une nouvelle cible est suivie', () => {
    const nearbyStar = {
      ...objectOfType('star'),
      visual: { visualRadius: 0.1 },
    } as SpaceObject;

    controller.releaseTarget();
    camera.position.set(0, 0, FREE_NAVIGATION_MIN_DISTANCE);
    controller.controls.target.set(0, 0, 0);
    camera.lookAt(controller.controls.target);
    camera.updateMatrixWorld();
    for (let index = 0; index < 12; index += 1) {
      controller.adoptZoomPointer(0, 0);
      controller.zoomSemantically(-360);
    }

    controller.trackTarget(controller.controls.target.clone(), nearbyStar);
    const trackedDistance = controller.distanceToTarget;

    controller.adoptZoomAnchor(controller.controls.target);
    controller.zoomSemantically(120);

    expect(controller.distanceToTarget).toBeGreaterThan(trackedDistance * 1.05);
  });

  it('approche une cible dont la butée dépasse le pivot courant sans repartir à son opposé', () => {
    const nearbyStar = {
      ...objectOfType('star'),
      visual: { visualRadius: 0.1 },
    } as SpaceObject;
    const jupiter = {
      ...objectOfType('planet'),
      id: 'jupiter',
      visual: { visualRadius: 1.25 },
    } as SpaceObject;
    const jupiterPosition = new THREE.Vector3(1_414, 610, 2_718);

    controller.setNavigationConstraints(nearbyStar);
    camera.position.set(0, 0, getMinimumNavigationDistance(nearbyStar));
    controller.controls.target.set(0, 0, 0);
    controller.releaseTarget();

    let previousDistanceToJupiter = camera.position.distanceTo(jupiterPosition);
    const initialOrbitDistance = controller.distanceToTarget;
    const jupiterMinimumDistance = getMinimumNavigationDistance(jupiter);
    const expectedApproachMinimum =
      (initialOrbitDistance * jupiterMinimumDistance) / previousDistanceToJupiter;

    controller.adoptZoomAnchor(jupiterPosition);
    controller.trackTarget(jupiterPosition, jupiter);

    expect(controller.controls.minDistance).toBeCloseTo(expectedApproachMinimum, 12);
    controller.zoomSemantically(-120);

    expect(camera.position.distanceTo(jupiterPosition)).toBeLessThan(previousDistanceToJupiter);
    expect(controller.atMinimumNavigationDistance).toBe(false);
    controller.follow(jupiterPosition.clone());

    const floatingOriginShift = controller.controls.target.clone();

    camera.position.sub(floatingOriginShift);
    controller.controls.target.sub(floatingOriginShift);
    jupiterPosition.sub(floatingOriginShift);
    controller.shiftTrackedPosition(floatingOriginShift);

    for (let index = 0; index < 24 && !controller.atMinimumNavigationDistance; index += 1) {
      previousDistanceToJupiter = camera.position.distanceTo(jupiterPosition);
      controller.adoptZoomAnchor(jupiterPosition);
      controller.zoomSemantically(-360);
      expect(camera.position.distanceTo(jupiterPosition)).toBeLessThanOrEqual(
        previousDistanceToJupiter,
      );
      expect(camera.position.distanceTo(jupiterPosition)).toBeGreaterThanOrEqual(
        jupiterMinimumDistance - 1e-9,
      );
    }

    expect(controller.atMinimumNavigationDistance).toBe(true);
    expect(controller.targetApproachReachedPrecisionLimit).toBe(false);
    expect(controller.controls.target.distanceTo(jupiterPosition)).toBeLessThan(1e-9);
    expect(camera.position.distanceTo(jupiterPosition)).toBeCloseTo(jupiterMinimumDistance, 9);
    const stoppedPosition = camera.position.clone();

    controller.adoptZoomAnchor(jupiterPosition);
    controller.zoomSemantically(-360);
    expect(camera.position.distanceTo(stoppedPosition)).toBeLessThan(1e-12);
  });

  it('rend libérable une approche vide avant de perdre la précision locale du pivot', () => {
    const sagittariusDwarf = {
      ...objectOfType('galaxy'),
      id: 'sagittarius-dwarf-spheroidal',
      visual: { visualRadius: 118 },
    } as SpaceObject;
    const pivot = new THREE.Vector3(
      -74.087_073_114_102_32,
      -6.541_954_954_360_619,
      7.717_960_990_843_548,
    );
    const sagittariusPosition = pivot.clone().add(new THREE.Vector3(2_160, 0, 0));

    controller.controls.target.copy(pivot);
    camera.position.copy(pivot).add(new THREE.Vector3(0, 0, 2.151_792_995_559_855_8e-11));
    controller.controls.minDistance = Number.EPSILON;
    camera.lookAt(controller.controls.target);
    camera.updateMatrixWorld();
    controller.controls.update();
    controller.trackTarget(sagittariusPosition, sagittariusDwarf);
    expect(controller.atMinimumNavigationDistance).toBe(false);

    for (let index = 0; index < 96 && !controller.atMinimumNavigationDistance; index += 1) {
      controller.adoptZoomPointer(-0.416_666_666_666_666_63, 0.045_148_895_292_987_49);
      controller.zoomSemantically(-24, ACTIVE_TARGET_POINTER_ZOOM_MAXIMUM_MULTIPLIER);
    }

    expect(camera.position.distanceTo(sagittariusPosition)).toBeGreaterThan(
      getMinimumNavigationDistance(sagittariusDwarf),
    );
    expect(controller.atMinimumNavigationDistance).toBe(true);
    expect(controller.targetApproachReachedPrecisionLimit).toBe(true);
    expect(controller.distanceToTarget).toBeGreaterThan(Number.EPSILON);
    expect(controller.controls.minDistance).toBe(controller.distanceToTarget);
  });

  it('reste à la butée après la dérive locale observée pendant le trajet libre', () => {
    camera.position.set(1_006.929_874_991_339_8, -622.326_440_754_568_4, -842.814_659_919_010_6);
    controller.controls.target.set(
      1_006.929_874_991_342_3,
      -622.326_440_754_570_2,
      -842.814_659_919_013_4,
    );
    controller.controls.minDistance = 4.031_076_207_750_493e-12;
    controller.controls.update();

    expect(controller.distanceToTarget).toBeGreaterThan(controller.controls.minDistance);
    expect(controller.atMinimumNavigationDistance).toBe(true);
  });

  it('choisit un recul déterministe quand une approche commence exactement sur sa cible', () => {
    const object = {
      ...objectOfType('planet'),
      visual: { visualRadius: 1.25 },
    } as SpaceObject;
    const firstPosition = new THREE.Vector3(4, 2, -3);

    camera.position.copy(firstPosition);
    controller.controls.target.copy(firstPosition).add(new THREE.Vector3(0, 0, -1));
    controller.trackTarget(firstPosition, object);
    expect(camera.position.distanceTo(firstPosition)).toBeCloseTo(
      getMinimumNavigationDistance(object),
      12,
    );

    const degeneratePosition = new THREE.Vector3(-2, 5, 7);

    camera.position.copy(degeneratePosition);
    controller.controls.target.copy(degeneratePosition);
    controller.trackTarget(degeneratePosition, object);

    expect(camera.position).toEqual(
      degeneratePosition.clone().add(new THREE.Vector3(0, 0, getMinimumNavigationDistance(object))),
    );
  });

  it('ne recule pas en libérant une cible plus proche que le pivot libre par défaut', () => {
    const nearbyStar = {
      ...objectOfType('star'),
      visual: { visualRadius: 0.1 },
    } as SpaceObject;
    const focusedMinimum = getMinimumNavigationDistance(nearbyStar);

    controller.setNavigationConstraints(nearbyStar);
    camera.position.set(0, 0, focusedMinimum);
    controller.controls.target.set(0, 0, 0);
    camera.lookAt(controller.controls.target);
    camera.updateMatrixWorld();
    const positionBeforeRelease = camera.position.clone();

    controller.releaseTarget();

    expect(focusedMinimum).toBeLessThan(FREE_NAVIGATION_MIN_DISTANCE);
    expect(controller.controls.minDistance).toBeCloseTo(focusedMinimum, 12);
    controller.adoptZoomPointer(0, 0);
    controller.zoomSemantically(-120);

    expect(controller.distanceToTarget).toBeCloseTo(focusedMinimum, 12);
    expect(camera.position.z).toBeLessThan(positionBeforeRelease.z);
    expect(controller.lastZoomDiagnostics?.status).toBe('applied');
  });

  it('conserve le seuil contextuel lors de la libération automatique vers la navigation libre', () => {
    const largeStar = {
      ...objectOfType('star'),
      visual: { visualRadius: 2.35 },
    } as SpaceObject;

    controller.setNavigationConstraints(largeStar);
    camera.position.set(0, 0, controller.controls.minDistance);
    controller.controls.target.set(0, 0, 0);
    camera.lookAt(controller.controls.target);
    camera.updateMatrixWorld();
    const releasedDistance = controller.distanceToTarget;
    const cameraBeforeTraversal = camera.position.clone();

    controller.releaseTarget(true);

    expect(releasedDistance).toBeGreaterThan(FREE_NAVIGATION_MIN_DISTANCE);
    expect(controller.controls.minDistance).toBeCloseTo(releasedDistance, 12);
    controller.adoptZoomPointer(0.2, -0.1);
    controller.zoomSemantically(-120);

    expect(controller.distanceToTarget).toBeCloseTo(releasedDistance, 12);
    expect(camera.position.distanceTo(cameraBeforeTraversal)).toBeGreaterThan(0.01);
    expect(controller.minimumTraversalActive).toBe(true);
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
    expect(controller.atMinimumNavigationDistance).toBe(false);
    controller.setNavigationConstraints(earth);
    camera.position.set(0, 0, controller.controls.minDistance);
    controller.controls.target.set(0, 0, 0);
    controller.controls.update();

    expect(controller.atMinimumNavigationDistance).toBe(true);
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
