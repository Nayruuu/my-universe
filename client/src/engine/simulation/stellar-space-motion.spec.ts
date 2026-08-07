import { equatorialCoordinatesFromCartesian } from './stellar-observation';
import {
  JULIAN_DAYS_PER_YEAR,
  LIGHT_SPEED_PARSEC_PER_JULIAN_YEAR,
  STELLAR_MOTION_MAX_ABSOLUTE_YEARS,
  propagateReceivedStellarCatalogPositions,
  propagateStellarCatalogPositions,
  resolveReceivedStellarMotion,
  resolveStellarMotionEpoch,
} from './stellar-space-motion';

describe('mouvement spatial stellaire', () => {
  it('propage le mouvement rectiligne uniforme de l’étoile de Barnard sur 50 ans', () => {
    // HYG v4.1, HYG 87665: J2000 Cartesian position and velocity in parsec/year.
    const reference = new Float32Array([-0.017_373, -1.816_613, 0.149_123]);
    const velocity = new Float32Array([-0.000_005_91, 0.000_120_4, 0.000_078_88]);
    const propagated = new Float64Array(3);

    propagateStellarCatalogPositions(reference, velocity, 50, propagated);

    expect([...propagated]).toEqual([
      expect.closeTo(-0.017_668_5, 7),
      expect.closeTo(-1.810_593, 7),
      expect.closeTo(0.153_067, 7),
    ]);
    const coordinates = equatorialCoordinatesFromCartesian({
      x: propagated[0]!,
      y: propagated[1]!,
      z: propagated[2]!,
    });

    expect(coordinates.rightAscensionDegrees).toBeCloseTo(269.440_9, 4);
    expect(coordinates.declinationDegrees).toBeCloseTo(4.832_05, 4);

    // Independent HYG pmRA/pmDec fields imply 501.59 arcsec over 50 Julian years.
    // The Cartesian result includes radial velocity, hence the small perspective difference.
    const angularTravelArcseconds = angularSeparationArcseconds(reference, propagated);
    const properMotionReferenceArcseconds = Math.hypot(-797.84, 9_999.99) * 50 * 0.001;

    expect(Math.abs(angularTravelArcseconds - properMotionReferenceArcseconds)).toBeLessThan(3);
  });

  it('borne symétriquement le domaine du modèle autour de J2000', () => {
    const referenceEpoch = 2_451_545;
    const within = resolveStellarMotionEpoch(
      referenceEpoch + 25 * JULIAN_DAYS_PER_YEAR,
      referenceEpoch,
    );
    const past = resolveStellarMotionEpoch(
      referenceEpoch - 20_000 * JULIAN_DAYS_PER_YEAR,
      referenceEpoch,
    );
    const future = resolveStellarMotionEpoch(
      referenceEpoch + 20_000 * JULIAN_DAYS_PER_YEAR,
      referenceEpoch,
    );

    expect(within).toMatchObject({
      requestedElapsedYears: 25,
      appliedElapsedYears: 25,
      status: 'within-model-domain',
    });
    expect(past).toMatchObject({
      appliedElapsedYears: -STELLAR_MOTION_MAX_ABSOLUTE_YEARS,
      status: 'clamped-to-past-boundary',
    });
    expect(future).toMatchObject({
      appliedElapsedYears: STELLAR_MOTION_MAX_ABSOLUTE_YEARS,
      status: 'clamped-to-future-boundary',
    });
    expect(past.appliedJulianDay).toBe(
      referenceEpoch - STELLAR_MOTION_MAX_ABSOLUTE_YEARS * JULIAN_DAYS_PER_YEAR,
    );
    expect(future.appliedJulianDay).toBe(
      referenceEpoch + STELLAR_MOTION_MAX_ABSOLUTE_YEARS * JULIAN_DAYS_PER_YEAR,
    );
  });

  it('résout analytiquement le temps de regard d’une étoile immobile à un parsec', () => {
    const received = resolveReceivedStellarMotion({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 0);

    // One parsec = 3.261563777... light-years (IAU 2015 Resolution B2 constants).
    expect(received.lightTravelYears).toBeCloseTo(3.261_563_777, 8);
    expect(received.requestedEmissionElapsedYears).toBeCloseTo(-3.261_563_777, 8);
    expect(received.appliedEmissionElapsedYears).toBe(received.requestedEmissionElapsedYears);
    expect(received.positionParsec).toEqual({ x: 1, y: 0, z: 0 });
    expect(received.status).toBe('within-model-domain');
  });

  it('satisfait l’équation causale pour une étoile en mouvement radial', () => {
    const reference = { x: 1, y: 0.2, z: -0.1 };
    const velocity = { x: 0.001, y: -0.000_2, z: 0.000_1 };
    const receptionElapsedYears = 20;
    const received = resolveReceivedStellarMotion(reference, velocity, receptionElapsedYears);
    const emittedDistance = Math.hypot(
      reference.x + velocity.x * received.requestedEmissionElapsedYears,
      reference.y + velocity.y * received.requestedEmissionElapsedYears,
      reference.z + velocity.z * received.requestedEmissionElapsedYears,
    );

    expect(emittedDistance).toBeCloseTo(
      LIGHT_SPEED_PARSEC_PER_JULIAN_YEAR * received.lightTravelYears,
      12,
    );
  });

  it('propage chaque étoile à sa propre époque d’émission et compte les limites du modèle', () => {
    const reference = new Float32Array([1, 0, 0, 4_000, 0, 0]);
    const velocity = new Float32Array([0.001, 0, 0, 0.001, 0, 0]);
    const target = new Float64Array(6);
    const propagation = propagateReceivedStellarCatalogPositions(reference, velocity, 0, target);
    const nearby = resolveReceivedStellarMotion({ x: 1, y: 0, z: 0 }, { x: 0.001, y: 0, z: 0 }, 0);

    expect(target[0]).toBeCloseTo(nearby.positionParsec.x, 9);
    expect(target[3]).toBeCloseTo(4_000 - 10, 6);
    expect(propagation.clampedStarCount).toBe(1);
  });

  it('rejette les paramètres non finis, supraluminiques et les tampons reçus invalides', () => {
    const position = { x: 1, y: 0, z: 0 };
    const velocity = { x: 0, y: 0, z: 0 };
    const vector = new Float32Array(3);

    expect(() => resolveReceivedStellarMotion({ ...position, x: Number.NaN }, velocity, 0)).toThrow(
      'non finis',
    );
    expect(() =>
      resolveReceivedStellarMotion(
        position,
        { x: LIGHT_SPEED_PARSEC_PER_JULIAN_YEAR, y: 0, z: 0 },
        0,
      ),
    ).toThrow('causal');
    expect(() =>
      propagateReceivedStellarCatalogPositions(vector, vector, Number.NaN, new Float64Array(3)),
    ).toThrow('réception');
    expect(() =>
      propagateReceivedStellarCatalogPositions(vector, new Float32Array(6), 0, new Float64Array(3)),
    ).toThrow('tailles différentes');
    expect(() =>
      propagateReceivedStellarCatalogPositions(
        new Float32Array(2),
        new Float32Array(2),
        0,
        new Float64Array(2),
      ),
    ).toThrow('incomplets');
    expect(() =>
      propagateReceivedStellarCatalogPositions(vector, vector, 0, new Float64Array(6)),
    ).toThrow('incompatible');
  });

  it('rejette les époques et tampons incompatibles', () => {
    const vector = new Float32Array(3);

    expect(() => resolveStellarMotionEpoch(Number.NaN, 2_451_545)).toThrow('non finie');
    expect(() => resolveStellarMotionEpoch(2_451_545, Number.POSITIVE_INFINITY)).toThrow(
      'non finie',
    );
    expect(() =>
      propagateStellarCatalogPositions(vector, vector, Number.NaN, new Float64Array(3)),
    ).toThrow('non finie');
    expect(() =>
      propagateStellarCatalogPositions(vector, new Float32Array(6), 1, new Float64Array(3)),
    ).toThrow('tailles différentes');
    expect(() =>
      propagateStellarCatalogPositions(
        new Float32Array(2),
        new Float32Array(2),
        1,
        new Float64Array(2),
      ),
    ).toThrow('incomplets');
    expect(() => propagateStellarCatalogPositions(vector, vector, 1, new Float64Array(6))).toThrow(
      'incompatible',
    );
  });
});

function angularSeparationArcseconds(left: ArrayLike<number>, right: ArrayLike<number>): number {
  const leftLength = Math.hypot(left[0]!, left[1]!, left[2]!);
  const rightLength = Math.hypot(right[0]!, right[1]!, right[2]!);
  const normalizedDot =
    (left[0]! * right[0]! + left[1]! * right[1]! + left[2]! * right[2]!) /
    (leftLength * rightLength);

  return (Math.acos(normalizedDot) * 180 * 3_600) / Math.PI;
}
