import * as THREE from 'three';
import {
  EARTH_OBSERVER_VIEW_EVENT,
  EarthObserverCameraControl,
  type EarthObserverViewState,
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

    control.update({ julianDay: 1 });
    const directionAfter = camera.getWorldDirection(new THREE.Vector3());

    expect(directionAfter.distanceTo(directionBefore)).toBeGreaterThan(0.1);
    expect(published.at(-1)?.centerAltitudeDegrees).toBeCloseTo(centerAltitude!, 10);
    expect(published.at(-1)?.centerAzimuthDegrees).toBeCloseTo(centerAzimuth!, 10);
    control.update({ julianDay: 1 });
    expect(resolveReferenceFrame).toHaveBeenCalledOnce();

    control.update({ julianDay: 3 });
    expect(resolveReferenceFrame).toHaveBeenCalledTimes(2);
    expect(camera.position).toEqual(position);
  });

  it('suit le floating origin sans déplacer le point d’observation relatif', () => {
    const position = camera.position.clone();
    const originShift = new THREE.Vector3(8, -2, 3);

    control.activate(position, new THREE.Vector3(120, 18, -80));
    control.shiftOrigin(originShift);
    control.update();

    expect(camera.position).toEqual(position.sub(originShift));
  });

  it('ignore les gestes hors session et restaure le champ initial à la sortie', () => {
    const directionBefore = camera.getWorldDirection(new THREE.Vector3());

    control.update();
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

function framing(
  initialPitchOffsetDegrees: number,
  pitchLimits = {
    minimumPitchOffsetDegrees: -180,
    maximumPitchOffsetDegrees: 180,
  },
) {
  return { initialPitchOffsetDegrees, pitchLimits };
}
