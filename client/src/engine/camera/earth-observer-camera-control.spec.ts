import * as THREE from 'three';
import { createEarthSkyProjector } from '../coordinates/earth-sky-perspective';
import type { EarthObserverOrientation } from './earth-observer-orientation';
import {
  EARTH_OBSERVER_LOOK_AT_EVENT,
  EARTH_OBSERVER_LOOK_AT_SETTLED_EVENT,
  EARTH_OBSERVER_VIEW_EVENT,
  EARTH_OBSERVER_ZOOM_AT_EVENT,
  EarthObserverCameraControl,
  type EarthObserverLookAtDetail,
  type EarthObserverViewState,
  type EarthObserverZoomAtDetail,
} from './earth-observer-camera-control';

describe('EarthObserverCameraControl', () => {
  let camera: THREE.PerspectiveCamera;
  let canvas: HTMLCanvasElement;
  let control: EarthObserverCameraControl;

  beforeEach(() => {
    camera = new THREE.PerspectiveCamera(48, 1, 0.025, 1_000_000);
    camera.position.set(12, 3, -4);
    canvas = document.createElement('canvas');
    Object.defineProperties(canvas, {
      setPointerCapture: { configurable: true, value: vi.fn() },
      hasPointerCapture: { configurable: true, value: vi.fn(() => true) },
      releasePointerCapture: { configurable: true, value: vi.fn() },
    });
    control = new EarthObserverCameraControl(camera, canvas);
  });

  afterEach(() => control.dispose());

  it('active la vue observateur sans modifier le cadrage atteint par la transition', () => {
    const position = camera.position.clone();
    const target = new THREE.Vector3(120, 18, -80);
    const published: EarthObserverViewState[] = [];

    camera.lookAt(target);
    const directionBefore = camera.getWorldDirection(new THREE.Vector3());

    canvas.addEventListener(EARTH_OBSERVER_VIEW_EVENT, (event) =>
      published.push((event as CustomEvent<EarthObserverViewState>).detail),
    );

    control.activate(position, target);

    expect(control.active).toBe(true);
    expect(camera.position).toEqual(position);
    expect(camera.getWorldDirection(new THREE.Vector3()).distanceTo(directionBefore)).toBeLessThan(
      1e-12,
    );
    expect(published.at(-1)).toMatchObject({
      active: true,
      pitchOffsetDegrees: 0,
      azimuthOffsetDegrees: 0,
      verticalFieldOfViewDegrees: 48,
    });
  });

  it('conserve la direction courante quand le point visé se confond avec l’observateur', () => {
    const position = camera.position.clone();
    const expectedDirection = new THREE.Vector3(-3, 2, -5).normalize();

    camera.lookAt(position.clone().add(expectedDirection));
    camera.updateMatrixWorld();
    control.activate(position, position);

    expect(camera.position).toEqual(position);
    expect(
      camera.getWorldDirection(new THREE.Vector3()).distanceTo(expectedDirection),
    ).toBeLessThan(1e-12);
  });

  it('relève le cadrage initial tout en publiant le décalage réellement appliqué', () => {
    const position = camera.position.clone();
    const published: EarthObserverViewState[] = [];

    canvas.addEventListener(EARTH_OBSERVER_VIEW_EVENT, (event) =>
      published.push((event as CustomEvent<EarthObserverViewState>).detail),
    );
    control.activate(position, new THREE.Vector3(120, 3, -4), framing(30));

    expect(camera.getWorldDirection(new THREE.Vector3()).y).toBeCloseTo(0.5, 5);
    expect(published.at(-1)?.pitchOffsetDegrees).toBeCloseTo(30, 5);
  });

  it('regarde autour depuis un point fixe au lieu d’orbiter autour de l’étoile', () => {
    const position = camera.position.clone();
    const published: EarthObserverViewState[] = [];

    canvas.addEventListener(EARTH_OBSERVER_VIEW_EVENT, (event) =>
      published.push((event as CustomEvent<EarthObserverViewState>).detail),
    );
    control.activate(position, new THREE.Vector3(120, 18, -80));
    const directionBefore = camera.getWorldDirection(new THREE.Vector3());

    canvas.dispatchEvent(pointerEvent('pointerdown', 1, 400, 300));
    canvas.dispatchEvent(pointerEvent('pointermove', 1, 520, 340));
    canvas.dispatchEvent(pointerEvent('pointerup', 1, 520, 340));

    expect(camera.position).toEqual(position);
    expect(
      camera.getWorldDirection(new THREE.Vector3()).distanceTo(directionBefore),
    ).toBeGreaterThan(0.1);
    expect(canvas.setPointerCapture).toHaveBeenCalledWith(1);
    expect(canvas.releasePointerCapture).toHaveBeenCalledWith(1);
    expect(Math.abs(published.at(-1)?.pitchOffsetDegrees ?? 0)).toBeGreaterThan(1);
    expect(Math.abs(published.at(-1)?.azimuthOffsetDegrees ?? 0)).toBeGreaterThan(1);
  });

  it('limite un glisser horizontal au regard gauche-droite', () => {
    const position = camera.position.clone();
    const published: EarthObserverViewState[] = [];

    canvas.addEventListener(EARTH_OBSERVER_VIEW_EVENT, (event) =>
      published.push((event as CustomEvent<EarthObserverViewState>).detail),
    );
    control.activate(position, new THREE.Vector3(120, 18, -80));
    const directionBefore = camera.getWorldDirection(new THREE.Vector3());

    canvas.dispatchEvent(pointerEvent('pointerdown', 1, 400, 300));
    canvas.dispatchEvent(pointerEvent('pointermove', 1, 520, 300));
    canvas.dispatchEvent(pointerEvent('pointerup', 1, 520, 300));

    expect(camera.position).toEqual(position);
    expect(
      camera.getWorldDirection(new THREE.Vector3()).distanceTo(directionBefore),
    ).toBeGreaterThan(0.1);
    expect(published.at(-1)?.pitchOffsetDegrees).toBeCloseTo(0, 10);
    expect(Math.abs(published.at(-1)?.azimuthOffsetDegrees ?? 0)).toBeGreaterThan(1);
  });

  it('réduit la sensibilité du regard avec le champ de vision sans accélérer au grand angle', () => {
    const position = camera.position.clone();
    const target = new THREE.Vector3(120, 18, -80);
    const published: EarthObserverViewState[] = [];
    const dragHorizontally = (pointerId: number): number => {
      canvas.dispatchEvent(pointerEvent('pointerdown', pointerId, 400, 300));
      canvas.dispatchEvent(pointerEvent('pointermove', pointerId, 500, 300));
      canvas.dispatchEvent(pointerEvent('pointerup', pointerId, 500, 300));

      return Math.abs(published.at(-1)?.azimuthOffsetDegrees ?? 0);
    };

    canvas.addEventListener(EARTH_OBSERVER_VIEW_EVENT, (event) =>
      published.push((event as CustomEvent<EarthObserverViewState>).detail),
    );
    camera.fov = 82;
    control.activate(position, target);
    const standardFieldMovement = dragHorizontally(1);

    control.activate(position, target);
    control.zoomBy(2 / 82);
    const telescopicMovement = dragHorizontally(2);

    control.activate(position, target);
    control.zoomBy(100);
    const maximumFieldMovement = dragHorizontally(3);

    expect(telescopicMovement).toBeCloseTo(standardFieldMovement * (2 / 82), 10);
    expect(maximumFieldMovement).toBeCloseTo(standardFieldMovement, 10);
  });

  it('limite un glisser vertical au regard haut-bas', () => {
    const position = camera.position.clone();
    const published: EarthObserverViewState[] = [];

    canvas.addEventListener(EARTH_OBSERVER_VIEW_EVENT, (event) =>
      published.push((event as CustomEvent<EarthObserverViewState>).detail),
    );
    control.activate(position, new THREE.Vector3(120, 18, -80));
    const directionBefore = camera.getWorldDirection(new THREE.Vector3());

    canvas.dispatchEvent(pointerEvent('pointerdown', 1, 400, 300));
    canvas.dispatchEvent(pointerEvent('pointermove', 1, 400, 380));
    canvas.dispatchEvent(pointerEvent('pointerup', 1, 400, 380));

    expect(camera.position).toEqual(position);
    expect(
      camera.getWorldDirection(new THREE.Vector3()).distanceTo(directionBefore),
    ).toBeGreaterThan(0.1);
    expect(Math.abs(published.at(-1)?.pitchOffsetDegrees ?? 0)).toBeGreaterThan(1);
    expect(published.at(-1)?.azimuthOffsetDegrees).toBeCloseTo(0, 10);
  });

  it('recentre le regard sur des coordonnées horizontales demandées par l’interface', () => {
    const position = camera.position.clone();
    const published: EarthObserverViewState[] = [];
    const settled: EarthObserverLookAtDetail[] = [];
    const handleSettled = (event: Event): void => {
      settled.push((event as CustomEvent<EarthObserverLookAtDetail>).detail);
    };
    const inactive = new CustomEvent<EarthObserverLookAtDetail>(EARTH_OBSERVER_LOOK_AT_EVENT, {
      cancelable: true,
      detail: { altitudeDegrees: 35, azimuthDegrees: 125 },
    });

    window.dispatchEvent(inactive);
    expect(inactive.defaultPrevented).toBe(false);

    canvas.addEventListener(EARTH_OBSERVER_VIEW_EVENT, (event) =>
      published.push((event as CustomEvent<EarthObserverViewState>).detail),
    );
    window.addEventListener(EARTH_OBSERVER_LOOK_AT_SETTLED_EVENT, handleSettled);
    control.activate(position, position.clone().add(new THREE.Vector3(0, 0, -1)), {
      ...framing(0),
      northDirection: { x: 0, y: 0, z: -1 },
      zenithDirection: { x: 0, y: 1, z: 0 },
    });
    const lookAt = new CustomEvent<EarthObserverLookAtDetail>(EARTH_OBSERVER_LOOK_AT_EVENT, {
      cancelable: true,
      detail: { altitudeDegrees: 35, azimuthDegrees: 125 },
    });

    window.dispatchEvent(lookAt);

    expect(lookAt.defaultPrevented).toBe(true);
    expect(control.transitioning).toBe(true);
    expect(published.at(-1)?.centerAltitudeDegrees).toBeCloseTo(0, 10);
    expect(settled).toEqual([]);

    control.update(0.2);

    expect(published.at(-1)?.centerAltitudeDegrees).toBeGreaterThan(0);
    expect(published.at(-1)?.centerAltitudeDegrees).toBeLessThan(35);
    expect(published.at(-1)?.centerAzimuthDegrees).toBeGreaterThan(0);
    expect(published.at(-1)?.centerAzimuthDegrees).toBeLessThan(125);
    expect(control.transitioning).toBe(true);

    control.update(1);

    expect(published.at(-1)?.centerAltitudeDegrees).toBeCloseTo(35, 10);
    expect(published.at(-1)?.centerAzimuthDegrees).toBeCloseTo(125, 10);
    expect(control.transitioning).toBe(false);
    expect(settled).toEqual([{ altitudeDegrees: 35, azimuthDegrees: 125 }]);
    expect(camera.position).toEqual(position);

    const invalid = new CustomEvent<EarthObserverLookAtDetail>(EARTH_OBSERVER_LOOK_AT_EVENT, {
      cancelable: true,
      detail: { altitudeDegrees: 95, azimuthDegrees: 0 },
    });

    window.dispatchEvent(invalid);
    expect(invalid.defaultPrevented).toBe(false);
    window.removeEventListener(EARTH_OBSERVER_LOOK_AT_SETTLED_EVENT, handleSettled);
  });

  it('conserve le cadrage si une direction devient momentanément indisponible pendant le recentrage', () => {
    const position = camera.position.clone();

    control.activate(position, position.clone().add(new THREE.Vector3(0, 0, -1)), {
      ...framing(0),
      northDirection: { x: 0, y: 0, z: -1 },
      zenithDirection: { x: 0, y: 1, z: 0 },
    });
    window.dispatchEvent(
      new CustomEvent<EarthObserverLookAtDetail>(EARTH_OBSERVER_LOOK_AT_EVENT, {
        cancelable: true,
        detail: { altitudeDegrees: 35, azimuthDegrees: 125 },
      }),
    );
    const orientation = (control as unknown as { readonly orientation: EarthObserverOrientation })
      .orientation;

    vi.spyOn(orientation, 'copyHorizontalDirection').mockReturnValueOnce(null);
    control.update(0.2);

    expect(control.transitioning).toBe(true);
    expect(camera.position).toEqual(position);
  });

  it('emprunte le trajet azimutal le plus court autour du nord', () => {
    const position = camera.position.clone();
    const published: EarthObserverViewState[] = [];

    canvas.addEventListener(EARTH_OBSERVER_VIEW_EVENT, (event) =>
      published.push((event as CustomEvent<EarthObserverViewState>).detail),
    );
    control.activate(position, position.clone().add(horizontalDirection(20, 350)), {
      ...framing(0),
      northDirection: { x: 0, y: 0, z: -1 },
      zenithDirection: { x: 0, y: 1, z: 0 },
    });
    window.dispatchEvent(
      new CustomEvent<EarthObserverLookAtDetail>(EARTH_OBSERVER_LOOK_AT_EVENT, {
        cancelable: true,
        detail: { altitudeDegrees: 20, azimuthDegrees: 10 },
      }),
    );

    control.update(0.2);

    const intermediateAzimuth = published.at(-1)?.centerAzimuthDegrees ?? 180;

    expect(Math.min(intermediateAzimuth, 360 - intermediateAzimuth)).toBeLessThan(10);

    control.update(1);
    expect(published.at(-1)?.centerAzimuthDegrees).toBeCloseTo(10, 10);
  });

  it('interrompt le recentrage dès le premier geste utilisateur', () => {
    const position = camera.position.clone();
    const settled: EarthObserverLookAtDetail[] = [];
    const handleSettled = (event: Event): void => {
      settled.push((event as CustomEvent<EarthObserverLookAtDetail>).detail);
    };

    window.addEventListener(EARTH_OBSERVER_LOOK_AT_SETTLED_EVENT, handleSettled);
    control.activate(position, position.clone().add(new THREE.Vector3(0, 0, -1)), {
      ...framing(0),
      northDirection: { x: 0, y: 0, z: -1 },
      zenithDirection: { x: 0, y: 1, z: 0 },
    });
    window.dispatchEvent(
      new CustomEvent<EarthObserverLookAtDetail>(EARTH_OBSERVER_LOOK_AT_EVENT, {
        cancelable: true,
        detail: { altitudeDegrees: 45, azimuthDegrees: 120 },
      }),
    );
    expect(control.transitioning).toBe(true);

    canvas.dispatchEvent(pointerEvent('pointerdown', 1, 400, 300));
    canvas.dispatchEvent(pointerEvent('pointerup', 1, 400, 300));
    const directionAfterInterruption = camera.getWorldDirection(new THREE.Vector3());

    expect(control.transitioning).toBe(false);
    control.update(1);
    expect(camera.getWorldDirection(new THREE.Vector3())).toEqual(directionAfterInterruption);
    expect(settled).toEqual([]);
    window.removeEventListener(EARTH_OBSERVER_LOOK_AT_SETTLED_EVENT, handleSettled);
  });

  it('utilise la verticale terrestre locale pour séparer gauche-droite et haut-bas', () => {
    const position = camera.position.clone();
    const zenith = new THREE.Vector3(1, 0, 0);
    const horizonDirection = new THREE.Vector3(0, 0, -1);
    const targetAltitudeDegrees = -55;
    const targetDirection = horizonDirection
      .multiplyScalar(Math.cos(THREE.MathUtils.degToRad(targetAltitudeDegrees)))
      .addScaledVector(zenith, Math.sin(THREE.MathUtils.degToRad(targetAltitudeDegrees)));

    control.activate(position, position.clone().add(targetDirection), {
      initialPitchOffsetDegrees: 73,
      pitchLimits: {
        minimumPitchOffsetDegrees: 47,
        maximumPitchOffsetDegrees: 143,
      },
      zenithDirection: zenith,
    });
    const initialDirection = camera.getWorldDirection(new THREE.Vector3());

    expect(altitudeDegrees(initialDirection, zenith)).toBeCloseTo(18, 8);

    canvas.dispatchEvent(pointerEvent('pointerdown', 1, 400, 300));
    canvas.dispatchEvent(pointerEvent('pointermove', 1, 520, 300));
    canvas.dispatchEvent(pointerEvent('pointerup', 1, 520, 300));
    const afterHorizontalDrag = camera.getWorldDirection(new THREE.Vector3());

    expect(altitudeDegrees(afterHorizontalDrag, zenith)).toBeCloseTo(18, 8);
    expect(afterHorizontalDrag.distanceTo(initialDirection)).toBeGreaterThan(0.1);

    canvas.dispatchEvent(pointerEvent('pointerdown', 2, 520, 300));
    canvas.dispatchEvent(pointerEvent('pointermove', 2, 520, 380));
    canvas.dispatchEvent(pointerEvent('pointerup', 2, 520, 380));

    expect(altitudeDegrees(camera.getWorldDirection(new THREE.Vector3()), zenith)).toBeLessThan(10);
  });

  it('bloque le regard au-dessus du sol sans rebondir quand le geste continue', () => {
    const position = camera.position.clone();
    const published: EarthObserverViewState[] = [];

    canvas.addEventListener(EARTH_OBSERVER_VIEW_EVENT, (event) =>
      published.push((event as CustomEvent<EarthObserverViewState>).detail),
    );
    control.activate(
      position,
      new THREE.Vector3(120, 3, -4),
      framing(24, {
        minimumPitchOffsetDegrees: -8,
        maximumPitchOffsetDegrees: 80,
      }),
    );

    canvas.dispatchEvent(pointerEvent('pointerdown', 1, 400, 300));
    canvas.dispatchEvent(pointerEvent('pointermove', 1, 400, 30_000));
    const directionAtLimit = camera.getWorldDirection(new THREE.Vector3());
    const pitchAtLimit = published.at(-1)?.pitchOffsetDegrees;

    canvas.dispatchEvent(pointerEvent('pointermove', 1, 400, 60_000));
    canvas.dispatchEvent(pointerEvent('pointerup', 1, 400, 60_000));

    expect(pitchAtLimit).toBeCloseTo(-8, 10);
    expect(published.at(-1)?.pitchOffsetDegrees).toBeCloseTo(-8, 10);
    expect(camera.getWorldDirection(new THREE.Vector3()).distanceTo(directionAtLimit)).toBeLessThan(
      1e-12,
    );
  });

  it('zoome par le champ de vision sans déplacer le point d’observation', () => {
    const position = camera.position.clone();

    control.activate(position, new THREE.Vector3(120, 18, -80));
    const wheel = new WheelEvent('wheel', { cancelable: true, deltaY: -420 });

    canvas.dispatchEvent(wheel);

    expect(camera.position).toEqual(position);
    expect(camera.fov).toBeLessThan(48);
    expect(wheel.defaultPrevented).toBe(true);
  });

  it('conserve sous le pointeur une étoile proche du bord pendant un zoom télescopique', () => {
    const position = camera.position.clone();

    Object.defineProperty(canvas, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        bottom: 600,
        height: 600,
        left: 0,
        right: 800,
        top: 0,
        width: 800,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    });
    camera.aspect = 4 / 3;
    camera.updateProjectionMatrix();
    control.activate(position, new THREE.Vector3(12, 3, -100), {
      ...framing(0),
      northDirection: { x: 0, y: 0, z: -1 },
      zenithDirection: { x: 0, y: 1, z: 0 },
    });
    const pointer = { x: 640, y: 90 };
    const rayBefore = pointerRay(camera, pointer.x, pointer.y, 800, 600);

    canvas.dispatchEvent(
      new WheelEvent('wheel', {
        cancelable: true,
        clientX: pointer.x,
        clientY: pointer.y,
        deltaY: -1_200,
      }),
    );
    const rayAfter = pointerRay(camera, pointer.x, pointer.y, 800, 600);

    expect(camera.fov).toBeLessThan(48);
    expect(rayAfter.angleTo(rayBefore)).toBeLessThan(0.000_1);

    control.zoomBy(0.000_001);
    expect(camera.fov).toBe(2);
  });

  it('applique le même zoom ancré quand un marqueur HTML recouvre le canvas', () => {
    const position = camera.position.clone();
    const published: EarthObserverViewState[] = [];

    Object.defineProperty(canvas, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        bottom: 600,
        height: 600,
        left: 0,
        right: 800,
        top: 0,
        width: 800,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    });
    camera.aspect = 4 / 3;
    camera.updateProjectionMatrix();
    canvas.addEventListener(EARTH_OBSERVER_VIEW_EVENT, (event) =>
      published.push((event as CustomEvent<EarthObserverViewState>).detail),
    );
    control.activate(position, position.clone().add(new THREE.Vector3(0, 0, -1)), {
      ...framing(0),
      northDirection: { x: 0, y: 0, z: -1 },
      zenithDirection: { x: 0, y: 1, z: 0 },
    });
    const anchorAltitudeDegrees = 12;
    const anchorAzimuthDegrees = 20;
    const anchorDirection = horizontalDirection(anchorAltitudeDegrees, anchorAzimuthDegrees);
    const anchorNdc = position.clone().add(anchorDirection).project(camera);
    const pointer = {
      x: ((anchorNdc.x + 1) * 800) / 2,
      y: ((1 - anchorNdc.y) * 600) / 2,
    };
    let forwarded = forwardedWheel(pointer, 100, anchorAltitudeDegrees, anchorAzimuthDegrees);

    for (let impulse = 0; impulse < 12; impulse += 1) {
      forwarded = forwardedWheel(
        pointer,
        100 + impulse * 200,
        anchorAltitudeDegrees,
        anchorAzimuthDegrees,
      );
      window.dispatchEvent(forwarded);
    }

    expect(forwarded.defaultPrevented).toBe(true);
    expect(camera.fov).toBeLessThan(20);
    expect(
      pointerRay(camera, pointer.x, pointer.y, 800, 600).angleTo(anchorDirection),
    ).toBeLessThan(0.000_1);
    const view = published.at(-1)!;
    const projectedAnchor = createEarthSkyProjector({
      centerAltitudeDegrees: view.centerAltitudeDegrees!,
      centerAzimuthDegrees: view.centerAzimuthDegrees!,
      verticalFieldOfViewDegrees: view.verticalFieldOfViewDegrees,
      width: 800,
      height: 600,
    })(anchorAltitudeDegrees, anchorAzimuthDegrees);

    expect(projectedAnchor?.x).toBeCloseTo(pointer.x, 3);
    expect(projectedAnchor?.y).toBeCloseTo(pointer.y, 3);
  });

  it('ignore un marqueur hors vue inactive et replie une ancre invalide sur le pointeur', () => {
    const position = camera.position.clone();

    Object.defineProperty(canvas, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        bottom: 600,
        height: 600,
        left: 0,
        right: 800,
        top: 0,
        width: 800,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    });
    camera.aspect = 4 / 3;
    camera.updateProjectionMatrix();
    control.activate(position, position.clone().add(new THREE.Vector3(0, 0, -1)), {
      ...framing(0),
      northDirection: { x: 0, y: 0, z: -1 },
      zenithDirection: { x: 0, y: 1, z: 0 },
    });
    const invalidAnchor = forwardedWheel({ x: 400, y: 300 }, 100, Number.NaN, 0);

    window.dispatchEvent(invalidAnchor);

    expect(invalidAnchor.defaultPrevented).toBe(true);
    expect(camera.fov).toBeLessThan(48);

    control.deactivate();
    const inactiveWheel = forwardedWheel({ x: 400, y: 300 }, 300, 0, 0);

    window.dispatchEvent(inactiveWheel);

    expect(inactiveWheel.defaultPrevented).toBe(false);
  });

  it('synchronise le regard avec le référentiel terrestre pendant la lecture temporelle', () => {
    const position = camera.position.clone();
    const published: EarthObserverViewState[] = [];
    const resolveReferenceFrame = vi.fn((time: { julianDay: number }) =>
      time.julianDay === 3
        ? null
        : {
            northDirection: new THREE.Vector3(0, 0, -1).applyAxisAngle(
              new THREE.Vector3(0, 1, 0),
              time.julianDay / 4,
            ),
            zenithDirection: new THREE.Vector3(0, 1, 0),
          },
    );

    canvas.addEventListener(EARTH_OBSERVER_VIEW_EVENT, (event) =>
      published.push((event as CustomEvent<EarthObserverViewState>).detail),
    );
    control.activate(position, new THREE.Vector3(12, 8, -40), {
      ...framing(10),
      northDirection: { x: 0, y: 0, z: -1 },
      zenithDirection: { x: 0, y: 1, z: 0 },
      resolveReferenceFrame,
    });
    const directionBefore = camera.getWorldDirection(new THREE.Vector3());
    const centerAltitude = published.at(-1)?.centerAltitudeDegrees;
    const centerAzimuth = published.at(-1)?.centerAzimuthDegrees;

    control.update(0, { julianDay: 1 });
    const directionAfter = camera.getWorldDirection(new THREE.Vector3());

    expect(directionAfter.distanceTo(directionBefore)).toBeGreaterThan(0.1);
    expect(published.at(-1)?.centerAltitudeDegrees).toBeCloseTo(centerAltitude!, 10);
    expect(published.at(-1)?.centerAzimuthDegrees).toBeCloseTo(centerAzimuth!, 10);
    control.update(0, { julianDay: 1 });
    expect(resolveReferenceFrame).toHaveBeenCalledOnce();

    control.update(0, { julianDay: 3 });
    expect(resolveReferenceFrame).toHaveBeenCalledTimes(2);
    expect(camera.position).toEqual(position);
  });

  it('suit le floating origin sans déplacer le point d’observation relatif', () => {
    const position = camera.position.clone();
    const originShift = new THREE.Vector3(8, -2, 3);

    control.activate(position, new THREE.Vector3(120, 18, -80));
    control.shiftOrigin(originShift);
    control.update(0);

    expect(camera.position).toEqual(position.sub(originShift));
  });

  it('ignore les gestes hors session et restaure le champ initial à la sortie', () => {
    const directionBefore = camera.getWorldDirection(new THREE.Vector3());

    control.update(0);
    canvas.dispatchEvent(pointerEvent('pointerdown', 1, 100, 100));
    canvas.dispatchEvent(pointerEvent('pointermove', 1, 520, 340));
    expect(camera.getWorldDirection(new THREE.Vector3())).toEqual(directionBefore);
    expect(canvas.setPointerCapture).not.toHaveBeenCalled();

    control.activate(camera.position, new THREE.Vector3(120, 18, -80));
    canvas.dispatchEvent(new WheelEvent('wheel', { cancelable: true, deltaY: -420 }));
    control.deactivate();

    expect(control.active).toBe(false);
    expect(camera.fov).toBeLessThan(48);
    canvas.dispatchEvent(pointerEvent('pointercancel', 1, 0, 0));
    const inactiveWheel = new WheelEvent('wheel', { cancelable: true, deltaY: -420 });

    canvas.dispatchEvent(inactiveWheel);
    expect(inactiveWheel.defaultPrevented).toBe(false);
  });
});

function pointerEvent(
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
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

function altitudeDegrees(direction: THREE.Vector3, zenith: THREE.Vector3): number {
  return THREE.MathUtils.radToDeg(Math.asin(direction.dot(zenith)));
}

function pointerRay(
  camera: THREE.PerspectiveCamera,
  clientX: number,
  clientY: number,
  width: number,
  height: number,
): THREE.Vector3 {
  return new THREE.Vector3((clientX / width) * 2 - 1, 1 - (clientY / height) * 2, 0.5)
    .unproject(camera)
    .sub(camera.position)
    .normalize();
}

function horizontalDirection(altitudeDegrees: number, azimuthDegrees: number): THREE.Vector3 {
  const altitude = THREE.MathUtils.degToRad(altitudeDegrees);
  const azimuth = THREE.MathUtils.degToRad(azimuthDegrees);

  return new THREE.Vector3(
    Math.sin(azimuth) * Math.cos(altitude),
    Math.sin(altitude),
    -Math.cos(azimuth) * Math.cos(altitude),
  );
}

function forwardedWheel(
  pointer: { readonly x: number; readonly y: number },
  timeStamp: number,
  anchorAltitudeDegrees: number,
  anchorAzimuthDegrees: number,
): CustomEvent<EarthObserverZoomAtDetail> {
  return new CustomEvent<EarthObserverZoomAtDetail>(EARTH_OBSERVER_ZOOM_AT_EVENT, {
    cancelable: true,
    detail: {
      anchorAltitudeDegrees,
      anchorAzimuthDegrees,
      clientX: pointer.x,
      clientY: pointer.y,
      deltaMode: WheelEvent.DOM_DELTA_PIXEL,
      deltaY: -1_200,
      timeStamp,
    },
  });
}

function framing(
  initialPitchOffsetDegrees: number,
  pitchLimits = {
    minimumPitchOffsetDegrees: -180,
    maximumPitchOffsetDegrees: 180,
  },
) {
  return { initialPitchOffsetDegrees, pitchLimits };
}
