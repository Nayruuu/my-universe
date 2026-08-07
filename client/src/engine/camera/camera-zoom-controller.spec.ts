import * as THREE from 'three';
import type { Mock } from 'vitest';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import { convertDistance } from '../coordinates/unit-conversion';
import { CameraZoomController, type CameraZoomControls } from './camera-zoom-controller';
import {
  FREE_NAVIGATION_MIN_DISTANCE,
  getLocalNavigationDistanceTolerance,
  isAtMinimumNavigationDistance,
  MAX_NAVIGATION_DISTANCE,
} from './navigation-policy';
import { WheelZoomNormalizer } from './wheel-zoom-normalizer';
import { LOG_DISTANCE_PER_WHEEL_PIXEL } from './zoom-physics';

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

  it('annule un rapprochement récent avant de commencer le trajet des échelles', () => {
    const initialDistance = controller.distanceToTarget;

    expect(controller.inwardZoomActive).toBe(false);
    controller.zoomSemantically(-137);
    controller.zoomSemantically(-137);
    expect(controller.distanceToTarget).toBeLessThan(initialDistance);
    expect(controller.inwardZoomActive).toBe(true);

    controller.zoomSemantically(137);
    controller.zoomSemantically(137);
    expect(controller.distanceToTarget).toBeCloseTo(initialDistance, 12);
    expect(controller.semanticActive).toBe(false);
    expect(controller.inwardZoomActive).toBe(false);

    controller.reset();
    camera.position.set(0, 0, initialDistance);
    controller.zoomSemantically(-120);
    controller.zoomSemantically(119.9);
    expect(controller.inwardZoomActive).toBe(false);

    controller.reset();
    camera.position.set(0, 0, initialDistance);
    controller.zoomSemantically(-0.1);
    expect(controller.inwardZoomActive).toBe(false);

    controller.zoomSemantically(480);
    expect(controller.distanceToTarget).toBeCloseTo(520, 8);
    expect(controller.semanticActive).toBe(true);

    controller.reset();
    camera.position.set(0, 0, initialDistance);
    controller.zoomSemantically(-137);
    controller.zoomSemantically(274);
    expect(controller.distanceToTarget).toBeGreaterThan(initialDistance);
    expect(controller.semanticActive).toBe(true);

    controller.reset();
    camera.position.set(0, 0, initialDistance);
    controller.zoomSemantically(-120);
    controller.zoomSemantically(120.1);
    controller.zoomSemantically(-120.1);
    expect(controller.distanceToTarget).toBeCloseTo(
      initialDistance * Math.exp(-120 * LOG_DISTANCE_PER_WHEEL_PIXEL),
      12,
    );
  });

  it('applique un rythme logarithmique accéléré sans perdre la réciprocité ni les diagnostics', () => {
    const initialCamera = camera.position.clone();
    const initialTarget = controls.target.clone();
    const traceDeltaY = 12.393_471_593_369_597;
    const logarithmicRateMultiplier = 3;

    controller.adoptPointer(-0.034_722_222_222_222_21, 0.104_707_012_487_992_3);
    controller.zoomSemantically(-traceDeltaY, { logarithmicRateMultiplier });

    expect(controller.distanceToTarget).toBeCloseTo(
      initialCamera.distanceTo(initialTarget) *
        Math.exp(-traceDeltaY * LOG_DISTANCE_PER_WHEEL_PIXEL * logarithmicRateMultiplier),
      12,
    );
    expect(controller.diagnostics?.deltaY).toBe(-traceDeltaY);

    controller.adoptPointer(-0.034_722_222_222_222_21, 0.104_707_012_487_992_3);
    controller.zoomSemantically(traceDeltaY, { logarithmicRateMultiplier });

    expect(camera.position.distanceTo(initialCamera)).toBeLessThan(1e-11);
    expect(controls.target.distanceTo(initialTarget)).toBeLessThan(1e-11);
    expect(controller.diagnostics?.deltaY).toBe(traceDeltaY);
    expect(controller.inwardZoomActive).toBe(false);
  });

  it('rembobine un rapprochement avec sa cadence enregistrée si la cadence courante change', () => {
    const initialCamera = camera.position.clone();
    const initialTarget = controls.target.clone();

    controller.adoptAnchor(new THREE.Vector3(-4, 1, 0));
    controller.zoomSemantically(-120);
    controller.adoptPointer(0.45, -0.2);
    controller.zoomSemantically(120, { logarithmicRateMultiplier: 3 });

    expect(camera.position.distanceTo(initialCamera)).toBeLessThan(1e-11);
    expect(controls.target.distanceTo(initialTarget)).toBeLessThan(1e-11);
    expect(controller.inwardZoomActive).toBe(false);
    expect(controller.semanticActive).toBe(false);
  });

  it('conserve le rythme des jalons sémantiques malgré l’accélération locale', () => {
    const options = { logarithmicRateMultiplier: 3 };

    controller.zoomSemantically(480, options);

    expect(controller.distanceToTarget).toBeCloseTo(520, 8);
    expect(controller.semanticActive).toBe(true);

    controller.zoomSemantically(-480, options);

    expect(controller.distanceToTarget).toBeCloseTo(24, 8);
    expect(controller.semanticActive).toBe(false);
  });

  it('défait les ancres de rapprochement dans leur ordre inverse', () => {
    const initialCamera = camera.position.clone();
    const initialTarget = controls.target.clone();
    const leftAnchor = new THREE.Vector3(-7, 2, 0);
    const rightAnchor = new THREE.Vector3(8, -1, 1);

    controller.adoptAnchor(leftAnchor);
    controller.zoomSemantically(-120);
    controller.adoptAnchor(rightAnchor);
    controller.zoomSemantically(-120);

    // Les ancres fournies au retour sont volontairement fausses : le contrôleur doit
    // réutiliser l'historique exact des transformations entrantes.
    controller.adoptAnchor(new THREE.Vector3(50, 20, -10));
    controller.zoomSemantically(120);
    controller.adoptAnchor(new THREE.Vector3(-40, -30, 12));
    controller.zoomSemantically(120);

    expect(camera.position.distanceTo(initialCamera)).toBeLessThan(1e-11);
    expect(controls.target.distanceTo(initialTarget)).toBeLessThan(1e-11);
    expect(controller.inwardZoomActive).toBe(false);
  });

  it('reprend l’ancre demandée lorsqu’un dézoom dépasse le rapprochement mémorisé', () => {
    const initialDistance = controller.distanceToTarget;
    const inwardAnchor = new THREE.Vector3(-6, 1, 0);
    const outwardAnchor = new THREE.Vector3(9, -2, 1);

    controller.adoptAnchor(inwardAnchor);
    controller.zoomSemantically(-120);
    controller.adoptAnchor(outwardAnchor);
    controller.zoomSemantically(240);

    expect(controller.inwardZoomActive).toBe(false);
    expect(controller.semanticActive).toBe(true);
    expect(
      controls.target.distanceTo(
        outwardAnchor.clone().multiplyScalar(1 - controller.distanceToTarget / initialDistance),
      ),
    ).toBeLessThan(1e-11);
  });

  it('translate aussi les ancres mémorisées lors d’un changement d’origine', () => {
    const initialCamera = camera.position.clone();
    const initialTarget = controls.target.clone();
    const originShift = new THREE.Vector3(100, -50, 25);

    controller.adoptAnchor(new THREE.Vector3(5, 1, -2));
    controller.zoomSemantically(-120);
    controller.adoptAnchor(new THREE.Vector3(8, -3, 4));
    camera.position.sub(originShift);
    controls.target.sub(originShift);
    controller.shiftOrigin(originShift);
    controller.adoptAnchor(new THREE.Vector3());
    controller.zoomSemantically(120);

    expect(camera.position.distanceTo(initialCamera.clone().sub(originShift))).toBeLessThan(1e-11);
    expect(controls.target.distanceTo(initialTarget.clone().sub(originShift))).toBeLessThan(1e-11);
  });

  it('borne le zoom aux limites de navigation', () => {
    controls.minDistance = 2;
    camera.position.set(0, 0, 2);
    controller.zoomSemantically(-120);
    expect(controller.diagnostics).toMatchObject({ status: 'minimum', appliedDistance: 2 });
    controller.zoomBy(0, { traverseMinimum: true });
    expect(controller.distanceToTarget).toBe(2);

    camera.position.set(0, 0, 420_000);
    controller.resetJourney();
    controller.zoomSemantically(480);
    expect(controller.diagnostics).toMatchObject({
      requestedDistance: MAX_NAVIGATION_DISTANCE,
      status: 'maximum',
    });
    expect(controller.diagnostics?.appliedDistance).toBeCloseTo(MAX_NAVIGATION_DISTANCE, 8);

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

  it('avance le long du regard libre quand l’ancien pivot est hors de l’axe caméra', () => {
    camera.lookAt(new THREE.Vector3(1, 0, 24));
    camera.updateMatrixWorld();
    const initialPosition = camera.position.clone();

    controller.adoptPointer(0, 0);
    controller.zoomSemantically(-120);

    expect(camera.position.distanceTo(initialPosition)).toBeGreaterThan(1);
    expect(camera.position.x).toBeGreaterThan(initialPosition.x + 1);
    expect(controller.distanceToTarget).toBeLessThan(24);
  });

  it('continue d’avancer en navigation libre après avoir atteint la distance minimale', () => {
    camera.position.set(0, 0, FREE_NAVIGATION_MIN_DISTANCE);
    camera.lookAt(controls.target);
    camera.updateMatrixWorld();
    const initialCameraPosition = camera.position.clone();
    const initialTarget = controls.target.clone();

    controller.adoptPointer(0, 0);
    controller.zoomSemantically(-120, { traverseMinimum: true });

    const cameraTranslation = camera.position.clone().sub(initialCameraPosition);
    const targetTranslation = controls.target.clone().sub(initialTarget);

    expect(cameraTranslation.length()).toBeGreaterThan(0.1);
    expect(targetTranslation).toEqual(cameraTranslation);
    expect(controller.distanceToTarget).toBeCloseTo(FREE_NAVIGATION_MIN_DISTANCE, 12);
    expect(controller.diagnostics?.status).toBe('applied');
  });

  it('parcourt environ trois cent quarante millions de kilomètres dès la première impulsion', () => {
    const coordinates = new CoordinateSystem();

    controls.minDistance = 0.18;
    camera.position.set(0, 0, controls.minDistance);
    camera.lookAt(controls.target);
    camera.updateMatrixWorld();
    const initialCameraPosition = camera.position.clone();

    controller.adoptPointer(0, 0);
    controller.zoomSemantically(-12, { traverseMinimum: true });

    const sceneDistance = camera.position.distanceTo(initialCameraPosition);
    const astronomicalUnits = coordinates.sceneUnitsToAstronomicalUnits(sceneDistance);
    const kilometers = convertDistance(astronomicalUnits, 'astronomical-unit', 'kilometer');

    expect(kilometers).toBeGreaterThan(340_000_000);
    expect(kilometers).toBeLessThan(342_000_000);
    expect(controller.distanceToTarget).toBeCloseTo(controls.minDistance, 12);
  });

  it('franchit la distance Soleil-Saturne dès une forte impulsion brute de molette', () => {
    const coordinates = new CoordinateSystem();
    const normalizer = new WheelZoomNormalizer();
    const normalizedDeltaY = normalizer.normalize(-160, 0, 1_000, 600);

    controls.minDistance = 0.18;
    camera.position.set(0, 0, controls.minDistance);
    camera.lookAt(controls.target);
    camera.updateMatrixWorld();
    const initialCameraPosition = camera.position.clone();

    controller.adoptPointer(0, 0);
    controller.zoomSemantically(normalizedDeltaY, { traverseMinimum: true });

    const sceneDistance = camera.position.distanceTo(initialCameraPosition);
    const astronomicalUnits = coordinates.sceneUnitsToAstronomicalUnits(sceneDistance);

    expect(astronomicalUnits).toBeGreaterThan(13);
    expect(astronomicalUnits).toBeLessThan(13.2);
    expect(controller.distanceToTarget).toBeCloseTo(controls.minDistance, 12);
  });

  it('accélère une rafale soutenue dans le vide sans modifier la distance caméra-pivot', () => {
    camera.position.set(0, 0, FREE_NAVIGATION_MIN_DISTANCE);
    camera.lookAt(controls.target);
    camera.updateMatrixWorld();
    let previousPosition = camera.position.clone();
    const translations: number[] = [];

    for (let index = 0; index < 4; index += 1) {
      controller.adoptPointer(0, 0);
      controller.zoomSemantically(-120, { traverseMinimum: true });
      translations.push(camera.position.distanceTo(previousPosition));
      previousPosition = camera.position.clone();
    }

    expect(translations[3]!).toBeGreaterThan(translations[0]! * 2.5);
    expect(translations[3]!).toBeLessThan(translations[0]! * 2.7);
    expect(controller.distanceToTarget).toBeCloseTo(FREE_NAVIGATION_MIN_DISTANCE, 12);
  });

  it('ne perd pas une impulsion dans la tolérance flottante de la distance minimale', () => {
    camera.position.set(0, 0, FREE_NAVIGATION_MIN_DISTANCE + 8e-13);
    camera.lookAt(controls.target);
    camera.updateMatrixWorld();
    const initialCameraPosition = camera.position.clone();

    controller.adoptPointer(0.017, 0.009);
    controller.zoomSemantically(-10, { traverseMinimum: true });

    expect(camera.position.distanceTo(initialCameraPosition)).toBeGreaterThan(0.005);
    expect(controller.distanceToTarget).toBeCloseTo(FREE_NAVIGATION_MIN_DISTANCE, 11);
    expect(controller.diagnostics?.status).toBe('applied');
  });

  it('préserve un écart quantifié au lieu de le replaquer pendant le trajet libre', () => {
    const localUlp = 2 ** -43;
    const representedDistance = localUlp * 34;

    controls.minDistance = localUlp * 32;
    controls.target.set(512, 0, 0);
    camera.position.set(512 + representedDistance, 0, 0);
    camera.lookAt(controls.target);
    camera.updateMatrixWorld();

    controller.adoptPointer(0, 0);
    controller.zoomSemantically(-60, { traverseMinimum: true });

    expect(Math.abs(controller.distanceToTarget - representedDistance)).toBeLessThanOrEqual(
      localUlp,
    );
    expect(controller.distanceToTarget).toBeGreaterThan(controls.minDistance + localUlp);
    expect(controller.minimumTraversalActive).toBe(true);
  });

  it('stabilise la butée de la trace HYG au travers des changements d’origine', () => {
    const traceDeltas = [
      -12.643_004_575_892_29, -12.559_826_906_788_434, -18.548_618_549_305_25,
      -7.985_055_527_487_233, -17.051_420_641_774_655, -12.476_649_250_079_015,
      -18.714_973_875_118_524, -12.310_293_924_265_741, -12.559_826_906_788_434,
      -9.898_141_743_353_793, -14.306_557_809_236_159, -12.809_359_901_705_564,
      -6.931_471_805_599_454, -24.953_298_500_158_03, -12.559_826_906_788_434,
      -12.643_004_575_892_29, -6.931_471_805_599_454, -18.798_151_531_827_94,
      -13.724_314_175_086_917, -17.300_953_624_297_346, -9.399_075_778_308_408,
      -9.482_253_422_623_389, -18.548_618_549_305_25, -13.557_958_861_668_08,
      -17.716_841_932_633_315, -18.714_973_875_118_524, -12.393_471_580_975_16,
      -6.931_471_805_599_454, -14.057_024_814_319_028, -13.973_847_157_609_61,
      -9.315_898_109_204_552, -12.643_004_575_892_29, -24.953_298_500_158_03,
    ];
    const pointer = { x: 0.157_986_111_111_111_16, y: 0.054_755_043_227_665_67 };

    controls.minDistance = 4.031_076_207_750_493e-12;
    camera.position.set(903.288_027_315_930_1, -320.480_071_201_877_14, -766.873_717_232_857_1);
    controls.target.set(903.288_027_315_932_5, -320.480_071_201_878_9, -766.873_717_232_859_8);
    camera.lookAt(controls.target);
    camera.updateMatrixWorld();
    let originShiftCount = 0;

    for (const deltaY of traceDeltas) {
      controller.adoptPointer(pointer.x, pointer.y);
      controller.zoomSemantically(deltaY, { traverseMinimum: true });

      expect(
        isAtMinimumNavigationDistance(
          controller.distanceToTarget,
          controls.minDistance,
          getLocalNavigationDistanceTolerance(camera.position, controls.target),
        ),
      ).toBe(true);

      if (controls.target.length() >= 1_600) {
        const originShift = controls.target.clone();

        camera.position.sub(originShift);
        controls.target.sub(originShift);
        controller.shiftOrigin(originShift);
        originShiftCount += 1;

        expect(controller.distanceToTarget).toBeCloseTo(controls.minDistance, 24);
      }
    }

    expect(originShiftCount).toBeGreaterThan(0);
    expect(controller.minimumTraversalActive).toBe(true);
  });

  it('compose la traversée minimale indépendamment du découpage des événements', () => {
    const resetAtMinimum = (): void => {
      camera.position.set(0, 0, FREE_NAVIGATION_MIN_DISTANCE);
      controls.target.set(0, 0, 0);
      camera.lookAt(controls.target);
      camera.updateMatrixWorld();
      controller.reset();
    };
    const zoomAtPointer = (deltaY: number): void => {
      controller.adoptPointer(0.35, -0.2);
      controller.zoomSemantically(deltaY, { traverseMinimum: true });
    };

    resetAtMinimum();
    zoomAtPointer(-120);
    const singleEventCamera = camera.position.clone();
    const singleEventTarget = controls.target.clone();

    resetAtMinimum();
    for (let index = 0; index < 4; index += 1) {
      zoomAtPointer(-30);
    }

    expect(camera.position.distanceTo(singleEventCamera)).toBeLessThan(1e-10);
    expect(controls.target.distanceTo(singleEventTarget)).toBeLessThan(1e-10);
  });

  it('conserve le surplus de traversée lors du franchissement de la distance minimale', () => {
    const initialDistance = 0.8;
    const totalDeltaY = -120;
    const pointer = { x: 0.25, y: -0.15 };
    const resetAboveMinimum = (): void => {
      camera.position.set(0, 0, initialDistance);
      controls.target.set(0, 0, 0);
      camera.lookAt(controls.target);
      camera.updateMatrixWorld();
      controller.reset();
    };
    const zoomAtPointer = (deltaY: number): void => {
      controller.adoptPointer(pointer.x, pointer.y);
      controller.zoomSemantically(deltaY, { traverseMinimum: true });
    };

    resetAboveMinimum();
    zoomAtPointer(totalDeltaY);
    const singleEventCamera = camera.position.clone();
    const singleEventTarget = controls.target.clone();
    const singleEventStatus = controller.diagnostics?.status;

    resetAboveMinimum();
    const deltaToMinimum =
      Math.log(FREE_NAVIGATION_MIN_DISTANCE / initialDistance) / LOG_DISTANCE_PER_WHEEL_PIXEL;

    zoomAtPointer(deltaToMinimum);
    expect(controller.distanceToTarget).toBeCloseTo(FREE_NAVIGATION_MIN_DISTANCE, 12);
    zoomAtPointer(totalDeltaY - deltaToMinimum);

    expect(camera.position.distanceTo(singleEventCamera)).toBeLessThan(1e-12);
    expect(controls.target.distanceTo(singleEventTarget)).toBeLessThan(1e-12);
    expect(singleEventStatus).toBe('applied');
  });

  it('compose aussi un franchissement direct sans ancre explicite', () => {
    const initialDistance = 0.8;
    const totalFactor = 0.5;
    const resetAboveMinimum = (): void => {
      camera.position.set(0, 0, initialDistance);
      controls.target.set(0, 0, 0);
      camera.lookAt(controls.target);
      camera.updateMatrixWorld();
      controller.reset();
    };

    resetAboveMinimum();
    controller.zoomBy(totalFactor, { traverseMinimum: true });
    const singleEventCamera = camera.position.clone();
    const singleEventTarget = controls.target.clone();

    resetAboveMinimum();
    const factorToMinimum = FREE_NAVIGATION_MIN_DISTANCE / initialDistance;

    controller.zoomBy(factorToMinimum, { traverseMinimum: true });
    controller.zoomBy(totalFactor / factorToMinimum, { traverseMinimum: true });

    expect(camera.position.distanceTo(singleEventCamera)).toBeLessThan(1e-12);
    expect(controls.target.distanceTo(singleEventTarget)).toBeLessThan(1e-12);
  });

  it('rembobine progressivement le trajet de la trace 715–729 avant tout dézoom', () => {
    const traceInwardDeltas = [
      -18.548618313810938, -12.143938524085842, -7.818700276040583, -17.051420641774655,
      -18.049552819754176, -13.05889272310057, -12.476649250079015, -9.066365201048484,
      -15.72057813442396, -18.798151457461316, -12.393471667736222, -12.559826832421809,
      -12.476649250079015, -18.714973875118524,
    ];
    const tracePartialReverseDelta = 38.614766615553584;

    controls.minDistance = 0.3584;
    camera.position.set(0, 0, controls.minDistance);
    camera.lookAt(controls.target);
    camera.updateMatrixWorld();
    const initialCameraPosition = camera.position.clone();
    const initialTarget = controls.target.clone();

    for (const deltaY of traceInwardDeltas) {
      controller.adoptPointer(-0.17795138888888884, 0.17771373679154656);
      controller.zoomSemantically(deltaY, { traverseMinimum: true });
    }
    const traversedCameraPosition = camera.position.clone();
    const traversedTarget = controls.target.clone();
    const totalTravel = traversedCameraPosition.distanceTo(initialCameraPosition);

    controller.adoptPointer(-0.17881944444444442, 0.1738712776176753);
    controller.zoomSemantically(tracePartialReverseDelta, { traverseMinimum: true });

    const partialReverseDistance = camera.position.distanceTo(traversedCameraPosition);

    expect(totalTravel).toBeGreaterThan(1_000);
    expect(partialReverseDistance).toBeGreaterThan(270);
    expect(partialReverseDistance).toBeLessThan(275);
    expect(controls.target.distanceTo(traversedTarget)).toBeCloseTo(partialReverseDistance, 12);
    expect(camera.position.distanceTo(initialCameraPosition)).toBeLessThan(totalTravel);
    expect(controller.distanceToTarget).toBeCloseTo(controls.minDistance, 12);
    expect(controller.semanticActive).toBe(false);
    expect(controller.diagnostics?.status).toBe('applied');

    const totalInwardDelta = traceInwardDeltas.reduce((total, deltaY) => total - deltaY, 0);

    controller.adoptPointer(-0.17881944444444442, 0.1738712776176753);
    controller.zoomSemantically(totalInwardDelta - tracePartialReverseDelta, {
      traverseMinimum: true,
    });

    expect(camera.position.distanceTo(initialCameraPosition)).toBeLessThan(1e-10);
    expect(controls.target.distanceTo(initialTarget)).toBeLessThan(1e-10);
    expect(controller.distanceToTarget).toBeCloseTo(controls.minDistance, 12);
    expect(controller.semanticActive).toBe(false);
  });

  it('rembobine une traversée minimale avant de poursuivre un zoom arrière direct', () => {
    camera.position.set(0, 0, FREE_NAVIGATION_MIN_DISTANCE);
    camera.lookAt(controls.target);
    camera.updateMatrixWorld();
    const initialCameraPosition = camera.position.clone();
    const initialTarget = controls.target.clone();

    controller.zoomBy(0.5, { traverseMinimum: true });
    const traversedCameraPosition = camera.position.clone();

    controller.zoomBy(1 + Number.EPSILON);
    expect(camera.position.distanceTo(traversedCameraPosition)).toBeLessThan(1e-12);

    controller.zoomBy(1.1);
    expect(controller.distanceToTarget).toBeCloseTo(FREE_NAVIGATION_MIN_DISTANCE, 12);
    expect(camera.position.distanceTo(initialCameraPosition)).toBeLessThan(
      traversedCameraPosition.distanceTo(initialCameraPosition),
    );

    controller.zoomBy(4);
    expect(controller.distanceToTarget).toBeGreaterThan(FREE_NAVIGATION_MIN_DISTANCE);
    expect(controls.target.distanceTo(initialTarget)).toBeLessThan(1e-12);
    expect(controller.semanticActive).toBe(false);
  });

  it('consomme une traversée puis applique le surplus d’un zoom arrière sémantique', () => {
    camera.position.set(0, 0, FREE_NAVIGATION_MIN_DISTANCE);
    camera.lookAt(controls.target);
    camera.updateMatrixWorld();

    controller.zoomSemantically(-120, { traverseMinimum: true });
    controller.zoomSemantically(480, { traverseMinimum: true });

    expect(controller.distanceToTarget).toBeGreaterThan(FREE_NAVIGATION_MIN_DISTANCE);
    expect(controller.diagnostics).toMatchObject({ deltaY: 480, status: 'applied' });
  });

  it('restaure l’ancre demandée après avoir rembobiné une traversée avec surplus', () => {
    camera.position.set(0, 0, FREE_NAVIGATION_MIN_DISTANCE);
    camera.lookAt(controls.target);
    camera.updateMatrixWorld();

    controller.zoomSemantically(-120, { traverseMinimum: true });
    controller.adoptAnchor(new THREE.Vector3(5, 0, 0));
    controller.zoomSemantically(480, { traverseMinimum: true });

    expect(controller.distanceToTarget).toBeGreaterThan(FREE_NAVIGATION_MIN_DISTANCE);
    expect(controls.target.x).toBeLessThan(0);
    expect(controller.semanticActive).toBe(true);
  });

  it('reprojette le pointeur après un rembobinage terminé avec un surplus', () => {
    const pointer = { x: -0.07986111111111116, y: 0.43515850144092216 };
    const resetAtMinimum = (): void => {
      camera.position.set(0, 0, FREE_NAVIGATION_MIN_DISTANCE);
      controls.target.set(0, 0, 0);
      camera.lookAt(controls.target);
      camera.updateMatrixWorld();
      controller.reset();
    };
    const zoomAtPointer = (deltaY: number): void => {
      controller.adoptPointer(pointer.x, pointer.y);
      controller.zoomSemantically(deltaY, { traverseMinimum: true });
    };

    resetAtMinimum();
    zoomAtPointer(-12);
    expect(controller.minimumTraversalActive).toBe(true);
    zoomAtPointer(24);
    const combinedCameraPosition = camera.position.clone();
    const combinedTarget = controls.target.clone();

    expect(controller.minimumTraversalActive).toBe(false);

    resetAtMinimum();
    zoomAtPointer(-12);
    zoomAtPointer(12);
    zoomAtPointer(12);

    expect(camera.position.distanceTo(combinedCameraPosition)).toBeLessThan(1e-11);
    expect(controls.target.distanceTo(combinedTarget)).toBeLessThan(1e-11);
  });

  it('continue de rembobiner à distance constante après une longue traversée minimale', () => {
    camera.position.set(0, 0, FREE_NAVIGATION_MIN_DISTANCE);
    camera.lookAt(controls.target);
    camera.updateMatrixWorld();

    for (let index = 0; index < 80; index += 1) {
      controller.adoptPointer(0.2, -0.1);
      controller.zoomSemantically(-360, { traverseMinimum: true });
    }

    const minimumDistance = controller.distanceToTarget;
    const traversedCameraPosition = camera.position.clone();

    controller.adoptPointer(0.2, -0.1);
    controller.zoomSemantically(120, { traverseMinimum: true });

    expect(controller.distanceToTarget).toBeCloseTo(minimumDistance, 12);
    expect(camera.position.distanceTo(traversedCameraPosition)).toBeGreaterThan(300);
    expect(controller.semanticActive).toBe(false);
    expect(controller.diagnostics).toMatchObject({ deltaY: 120, status: 'applied' });
  });

  it('avance dans l’axe caméra à la distance minimale quand aucune ancre n’est fournie', () => {
    camera.position.set(0, 0, FREE_NAVIGATION_MIN_DISTANCE);
    camera.lookAt(controls.target);
    camera.updateMatrixWorld();
    const initialCameraPosition = camera.position.clone();
    const initialTarget = controls.target.clone();

    controller.zoomBy(0.5, { traverseMinimum: true });

    expect(camera.position.z).toBeLessThan(initialCameraPosition.z - 0.3);
    expect(controls.target.z).toBeLessThan(initialTarget.z - 0.3);
    expect(controller.distanceToTarget).toBeCloseTo(FREE_NAVIGATION_MIN_DISTANCE, 12);
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
