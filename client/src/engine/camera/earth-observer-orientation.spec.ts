import * as THREE from 'three';
import {
  DEFAULT_EARTH_OBSERVER_FRAMING,
  EarthObserverOrientation,
} from './earth-observer-orientation';

describe('EarthObserverOrientation', () => {
  it('conserve l’altitude locale pendant un regard gauche-droite', () => {
    const orientation = new EarthObserverOrientation();
    const zenith = new THREE.Vector3(1, 0, 0);
    const targetDirection = directionAtAltitude(-55, zenith, new THREE.Vector3(0, 0, -1));

    orientation.configure(targetDirection, new THREE.Vector3(0, 1, 0), {
      initialPitchOffsetDegrees: 73,
      pitchLimits: {
        minimumPitchOffsetDegrees: 47,
        maximumPitchOffsetDegrees: 143,
      },
      zenithDirection: zenith,
    });
    const initial = orientation.copyDirection(new THREE.Vector3());

    expect(altitudeDegrees(initial, zenith)).toBeCloseTo(18, 10);

    orientation.rotate(0.5, 0);
    const afterYaw = orientation.copyDirection(new THREE.Vector3());

    expect(altitudeDegrees(afterYaw, zenith)).toBeCloseTo(18, 10);
    expect(afterYaw.distanceTo(initial)).toBeGreaterThan(0.1);
    expect(orientation.azimuthOffsetDegrees).toBeCloseTo(THREE.MathUtils.radToDeg(0.5), 10);
  });

  it('borne le regard vertical et produit une orientation sans roulis', () => {
    const orientation = new EarthObserverOrientation();
    const zenith = new THREE.Vector3(0.3, 0.8, -0.5).normalize();
    const targetDirection = directionAtAltitude(20, zenith, new THREE.Vector3(1, 0, 0));

    orientation.configure(targetDirection, new THREE.Vector3(0, 1, 0), {
      initialPitchOffsetDegrees: 0,
      pitchLimits: {
        minimumPitchOffsetDegrees: -5,
        maximumPitchOffsetDegrees: 30,
      },
      zenithDirection: zenith,
    });
    orientation.rotate(0, -10);
    expect(orientation.pitchOffsetDegrees).toBeCloseTo(-5, 10);

    orientation.rotate(0, 20);
    expect(orientation.pitchOffsetDegrees).toBeCloseTo(30, 10);

    const quaternion = orientation.copyQuaternion(new THREE.Quaternion());
    const screenUp = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
    const direction = orientation.copyDirection(new THREE.Vector3());
    const projectedZenith = zenith.clone().projectOnPlane(direction).normalize();

    expect(screenUp.distanceTo(projectedZenith)).toBeLessThan(1e-12);
    expect(orientation.copyZenith(new THREE.Vector3()).distanceTo(zenith)).toBeLessThan(1e-12);
  });

  it('recentre une direction absolue sans perdre le référentiel horizontal local', () => {
    const orientation = new EarthObserverOrientation();
    const zenith = new THREE.Vector3(0, 1, 0);
    const north = new THREE.Vector3(0, 0, -1);
    const targetDirection = directionAtAltitude(12, zenith, north);
    const requestedDirection = directionAtAltitude(34, zenith, new THREE.Vector3(1, 0, -1));

    orientation.configure(targetDirection, zenith, {
      initialPitchOffsetDegrees: 0,
      pitchLimits: {
        minimumPitchOffsetDegrees: -40,
        maximumPitchOffsetDegrees: 60,
      },
      northDirection: north,
      zenithDirection: zenith,
    });

    expect(orientation.centerOnDirection(requestedDirection)).toBe(true);
    expect(
      orientation.copyDirection(new THREE.Vector3()).distanceTo(requestedDirection),
    ).toBeLessThan(1e-12);
    expect(orientation.centerAltitudeDegrees).toBeCloseTo(34, 10);
    expect(orientation.centerOnDirection(zenith)).toBe(true);
    expect(orientation.centerAltitudeDegrees).toBeCloseTo(72, 10);
    expect(orientation.centerOnDirection(new THREE.Vector3(Number.NaN, 0, 0))).toBe(false);
  });

  it('convertit une direction horizontale apparente dans le référentiel 3D courant', () => {
    const orientation = new EarthObserverOrientation();

    orientation.configure(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0), {
      initialPitchOffsetDegrees: 0,
      pitchLimits: {
        minimumPitchOffsetDegrees: -80,
        maximumPitchOffsetDegrees: 80,
      },
      northDirection: { x: 0, y: 0, z: -1 },
      zenithDirection: { x: 0, y: 1, z: 0 },
    });
    const direction = orientation.copyHorizontalDirection(30, 90, new THREE.Vector3());

    expect(direction).not.toBeNull();
    expect(direction!.x).toBeCloseTo(Math.cos(Math.PI / 6), 10);
    expect(direction!.y).toBeCloseTo(0.5, 10);
    expect(direction!.z).toBeCloseTo(0, 10);
    expect(orientation.copyHorizontalDirection(Number.NaN, 0, new THREE.Vector3())).toBeNull();
    expect(orientation.copyHorizontalDirection(-91, 0, new THREE.Vector3())).toBeNull();
    expect(orientation.copyHorizontalDirection(91, 0, new THREE.Vector3())).toBeNull();
    expect(orientation.copyHorizontalDirection(0, Number.NaN, new THREE.Vector3())).toBeNull();
  });

  it('conserve une altitude centrale absolue malgré un écart dans la direction catalogue', () => {
    const orientation = new EarthObserverOrientation();
    const zenith = new THREE.Vector3(0, 1, 0);
    const targetDirection = directionAtAltitude(31, zenith, new THREE.Vector3(0, 0, -1));

    orientation.configure(targetDirection, zenith, {
      initialCenterAltitudeDegrees: 24,
      initialPitchOffsetDegrees: 0,
      pitchLimits: {
        minimumPitchOffsetDegrees: -30,
        maximumPitchOffsetDegrees: 30,
      },
      zenithDirection: zenith,
    });

    expect(orientation.centerAltitudeDegrees).toBeCloseTo(24, 10);
    expect(orientation.pitchOffsetDegrees).toBeCloseTo(-7, 10);

    orientation.configure(targetDirection, zenith, {
      initialCenterAltitudeDegrees: Number.NaN,
      initialPitchOffsetDegrees: 5,
      pitchLimits: {
        minimumPitchOffsetDegrees: -30,
        maximumPitchOffsetDegrees: 30,
      },
      zenithDirection: zenith,
    });

    expect(orientation.pitchOffsetDegrees).toBeCloseTo(5, 10);
  });

  it('conserve le regard horizontal local quand la Terre tourne sous le ciel', () => {
    const orientation = new EarthObserverOrientation();
    const zenith = new THREE.Vector3(0, 1, 0);
    const north = new THREE.Vector3(0, 0, -1);
    const targetDirection = directionAtAltitude(24, zenith, new THREE.Vector3(1, 0, -1));

    orientation.configure(targetDirection, new THREE.Vector3(0, 1, 0), {
      initialPitchOffsetDegrees: 8,
      pitchLimits: {
        minimumPitchOffsetDegrees: -20,
        maximumPitchOffsetDegrees: 50,
      },
      northDirection: north,
      zenithDirection: zenith,
    });
    orientation.rotate(0.24, -0.1);
    const directionBefore = orientation.copyDirection(new THREE.Vector3());
    const centerAltitudeBefore = orientation.centerAltitudeDegrees;
    const centerAzimuthBefore = orientation.centerAzimuthDegrees;
    const earthRotation = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0.2, 0.8, -0.3).normalize(),
      0.65,
    );
    const rotatedNorth = north.clone().applyQuaternion(earthRotation);
    const rotatedZenith = zenith.clone().applyQuaternion(earthRotation);

    expect(
      orientation.updateReferenceFrame({
        northDirection: rotatedNorth,
        zenithDirection: rotatedZenith,
      }),
    ).toBe(true);
    expect(
      orientation
        .copyDirection(new THREE.Vector3())
        .distanceTo(directionBefore.applyQuaternion(earthRotation)),
    ).toBeLessThan(1e-12);
    expect(orientation.centerAltitudeDegrees).toBeCloseTo(centerAltitudeBefore, 10);
    expect(orientation.centerAzimuthDegrees).toBeCloseTo(centerAzimuthBefore, 10);
    expect(
      orientation.updateReferenceFrame({
        northDirection: { x: Number.NaN, y: 0, z: 0 },
        zenithDirection: rotatedZenith,
      }),
    ).toBe(false);
    expect(
      orientation.updateReferenceFrame({
        northDirection: rotatedZenith,
        zenithDirection: rotatedZenith,
      }),
    ).toBe(false);
  });

  it('construit des axes stables sans verticale scientifique exploitable', () => {
    const orientation = new EarthObserverOrientation();

    orientation.configure(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 1, 0),
      DEFAULT_EARTH_OBSERVER_FRAMING,
    );
    expect(orientation.copyDirection(new THREE.Vector3()).length()).toBeCloseTo(1, 10);

    orientation.configure(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0), {
      ...DEFAULT_EARTH_OBSERVER_FRAMING,
      zenithDirection: { x: Number.NaN, y: 0, z: 0 },
    });
    expect(orientation.copyZenith(new THREE.Vector3())).toEqual(new THREE.Vector3(0, 1, 0));

    orientation.configure(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), {
      ...DEFAULT_EARTH_OBSERVER_FRAMING,
      zenithDirection: { x: 1, y: 0, z: 0 },
    });
    expect(orientation.copyDirection(new THREE.Vector3()).length()).toBeCloseTo(1, 10);

    orientation.configure(new THREE.Vector3(1, 0, 0), new THREE.Vector3(1, 0, 0), {
      ...DEFAULT_EARTH_OBSERVER_FRAMING,
      zenithDirection: { x: 1, y: 0, z: 0 },
    });
    expect(orientation.copyDirection(new THREE.Vector3()).length()).toBeCloseTo(1, 10);

    orientation.configure(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, 0), {
      ...DEFAULT_EARTH_OBSERVER_FRAMING,
      zenithDirection: { x: 0, y: 1, z: 0 },
    });
    expect(orientation.copyDirection(new THREE.Vector3()).length()).toBeCloseTo(1, 10);

    orientation.configure(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(1, 0, 0),
      DEFAULT_EARTH_OBSERVER_FRAMING,
    );
    expect(orientation.copyZenith(new THREE.Vector3()).length()).toBeCloseTo(1, 10);
  });
});

function directionAtAltitude(
  altitudeDegrees: number,
  zenith: THREE.Vector3,
  approximateHorizonDirection: THREE.Vector3,
): THREE.Vector3 {
  const horizon = approximateHorizonDirection.clone().projectOnPlane(zenith).normalize();
  const altitude = THREE.MathUtils.degToRad(altitudeDegrees);

  return horizon.multiplyScalar(Math.cos(altitude)).addScaledVector(zenith, Math.sin(altitude));
}

function altitudeDegrees(direction: THREE.Vector3, zenith: THREE.Vector3): number {
  return THREE.MathUtils.radToDeg(Math.asin(direction.dot(zenith)));
}
