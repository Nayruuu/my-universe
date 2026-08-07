import type { Vector3Like } from '../../data/models/universe.models';
import { convertDistance } from '../coordinates/unit-conversion';

export const JULIAN_DAYS_PER_YEAR = 365.25;

// A light-year is the distance travelled by light during one Julian year (365.25 days).
// Expressing c in parsec / Julian year keeps the HYG Cartesian model in its native units.
export const LIGHT_SPEED_PARSEC_PER_JULIAN_YEAR = convertDistance(1, 'light-year', 'parsec');

// The catalogue velocities support uniform rectilinear propagation, but not Galactic acceleration,
// unresolved binaries, or growing catalogue uncertainty. Keep the extrapolation visibly bounded.
export const STELLAR_MOTION_MAX_ABSOLUTE_YEARS = 10_000;

export const HYG_STELLAR_VELOCITY_SOURCE_URL =
  'https://github.com/astronexus/HYG-Database/tree/main/hyg';
export const UNIFORM_RECTILINEAR_MOTION_SOURCE_URL =
  'https://gea.esac.esa.int/archive/documentation/GEDR3/Data_processing/chap_cu3ast/sec_cu3ast_intro/ssec_cu3ast_intro_tansforms.html';

export type StellarMotionDomainStatus =
  'within-model-domain' | 'clamped-to-past-boundary' | 'clamped-to-future-boundary';

export interface StellarMotionEpoch {
  readonly requestedJulianDay: number;
  readonly appliedJulianDay: number;
  readonly requestedElapsedYears: number;
  readonly appliedElapsedYears: number;
  readonly status: StellarMotionDomainStatus;
}

export interface ReceivedStellarMotion {
  readonly positionParsec: Vector3Like;
  readonly lightTravelYears: number;
  readonly requestedEmissionElapsedYears: number;
  readonly appliedEmissionElapsedYears: number;
  readonly status: StellarMotionDomainStatus;
}

export interface ReceivedStellarCatalogPropagation {
  readonly clampedStarCount: number;
}

export function resolveStellarMotionEpoch(
  requestedJulianDay: number,
  referenceEpochJulianDay: number,
): StellarMotionEpoch {
  if (!Number.isFinite(requestedJulianDay) || !Number.isFinite(referenceEpochJulianDay)) {
    throw new Error('Époque stellaire non finie.');
  }
  const requestedElapsedYears =
    (requestedJulianDay - referenceEpochJulianDay) / JULIAN_DAYS_PER_YEAR;
  const appliedElapsedYears = Math.max(
    -STELLAR_MOTION_MAX_ABSOLUTE_YEARS,
    Math.min(STELLAR_MOTION_MAX_ABSOLUTE_YEARS, requestedElapsedYears),
  );
  const status = resolveDomainStatus(requestedElapsedYears);

  return {
    requestedJulianDay,
    appliedJulianDay: referenceEpochJulianDay + appliedElapsedYears * JULIAN_DAYS_PER_YEAR,
    requestedElapsedYears,
    appliedElapsedYears,
    status,
  };
}

export function propagateStellarCatalogPositions(
  referencePositionsParsec: Float32Array,
  velocitiesParsecPerYear: Float32Array,
  elapsedYears: number,
  targetPositionsParsec: Float64Array,
): void {
  if (!Number.isFinite(elapsedYears)) {
    throw new Error('Durée de propagation stellaire non finie.');
  }
  if (referencePositionsParsec.length !== velocitiesParsecPerYear.length) {
    throw new Error('Positions et vitesses stellaires de tailles différentes.');
  }
  if (referencePositionsParsec.length % 3 !== 0) {
    throw new Error('Vecteurs stellaires incomplets.');
  }
  if (targetPositionsParsec.length !== referencePositionsParsec.length) {
    throw new Error('Tampon de propagation stellaire incompatible.');
  }

  for (let index = 0; index < referencePositionsParsec.length; index += 1) {
    targetPositionsParsec[index] =
      referencePositionsParsec[index]! + velocitiesParsecPerYear[index]! * elapsedYears;
  }
}

/**
 * Solves the retarded position of one uniformly moving HYG star for a receiver fixed at the
 * solar-system barycentre. The analytic solution satisfies |r(t_emit)| = c(t_receive - t_emit).
 */
export function resolveReceivedStellarMotion(
  referencePositionParsec: Vector3Like,
  velocityParsecPerYear: Vector3Like,
  receptionElapsedYears: number,
): ReceivedStellarMotion {
  validateReceivedStellarInputs(
    referencePositionParsec,
    velocityParsecPerYear,
    receptionElapsedYears,
  );
  const lightTravelYears = calculateStellarLightTravelYears(
    referencePositionParsec.x,
    referencePositionParsec.y,
    referencePositionParsec.z,
    velocityParsecPerYear.x,
    velocityParsecPerYear.y,
    velocityParsecPerYear.z,
    receptionElapsedYears,
  );
  const requestedEmissionElapsedYears = receptionElapsedYears - lightTravelYears;
  const appliedEmissionElapsedYears = clampStellarElapsedYears(requestedEmissionElapsedYears);

  return {
    positionParsec: {
      x: referencePositionParsec.x + velocityParsecPerYear.x * appliedEmissionElapsedYears,
      y: referencePositionParsec.y + velocityParsecPerYear.y * appliedEmissionElapsedYears,
      z: referencePositionParsec.z + velocityParsecPerYear.z * appliedEmissionElapsedYears,
    },
    lightTravelYears,
    requestedEmissionElapsedYears,
    appliedEmissionElapsedYears,
    status: resolveDomainStatus(requestedEmissionElapsedYears),
  };
}

export function propagateReceivedStellarCatalogPositions(
  referencePositionsParsec: Float32Array,
  velocitiesParsecPerYear: Float32Array,
  receptionElapsedYears: number,
  targetPositionsParsec: Float64Array,
): ReceivedStellarCatalogPropagation {
  validateCatalogPropagationInputs(
    referencePositionsParsec,
    velocitiesParsecPerYear,
    receptionElapsedYears,
    targetPositionsParsec,
  );
  let clampedStarCount = 0;

  for (let offset = 0; offset < referencePositionsParsec.length; offset += 3) {
    const referenceX = referencePositionsParsec[offset]!;
    const referenceY = referencePositionsParsec[offset + 1]!;
    const referenceZ = referencePositionsParsec[offset + 2]!;
    const velocityX = velocitiesParsecPerYear[offset]!;
    const velocityY = velocitiesParsecPerYear[offset + 1]!;
    const velocityZ = velocitiesParsecPerYear[offset + 2]!;
    const lightTravelYears = calculateStellarLightTravelYears(
      referenceX,
      referenceY,
      referenceZ,
      velocityX,
      velocityY,
      velocityZ,
      receptionElapsedYears,
    );
    const requestedEmissionElapsedYears = receptionElapsedYears - lightTravelYears;
    const appliedEmissionElapsedYears = clampStellarElapsedYears(requestedEmissionElapsedYears);

    if (appliedEmissionElapsedYears !== requestedEmissionElapsedYears) {
      clampedStarCount += 1;
    }
    targetPositionsParsec[offset] = referenceX + velocityX * appliedEmissionElapsedYears;
    targetPositionsParsec[offset + 1] = referenceY + velocityY * appliedEmissionElapsedYears;
    targetPositionsParsec[offset + 2] = referenceZ + velocityZ * appliedEmissionElapsedYears;
  }

  return { clampedStarCount };
}

function calculateStellarLightTravelYears(
  referenceX: number,
  referenceY: number,
  referenceZ: number,
  velocityX: number,
  velocityY: number,
  velocityZ: number,
  receptionElapsedYears: number,
): number {
  const receptionX = referenceX + velocityX * receptionElapsedYears;
  const receptionY = referenceY + velocityY * receptionElapsedYears;
  const receptionZ = referenceZ + velocityZ * receptionElapsedYears;
  const speedSquared = velocityX * velocityX + velocityY * velocityY + velocityZ * velocityZ;
  const causalDenominator = LIGHT_SPEED_PARSEC_PER_JULIAN_YEAR ** 2 - speedSquared;

  if (causalDenominator <= 0) {
    throw new Error('Vitesse stellaire incompatible avec un retard lumineux causal.');
  }
  const positionVelocityDot =
    receptionX * velocityX + receptionY * velocityY + receptionZ * velocityZ;
  const distanceSquared =
    receptionX * receptionX + receptionY * receptionY + receptionZ * receptionZ;

  return (
    (-positionVelocityDot +
      Math.sqrt(positionVelocityDot * positionVelocityDot + causalDenominator * distanceSquared)) /
    causalDenominator
  );
}

function validateReceivedStellarInputs(
  referencePositionParsec: Vector3Like,
  velocityParsecPerYear: Vector3Like,
  receptionElapsedYears: number,
): void {
  const values = [
    referencePositionParsec.x,
    referencePositionParsec.y,
    referencePositionParsec.z,
    velocityParsecPerYear.x,
    velocityParsecPerYear.y,
    velocityParsecPerYear.z,
    receptionElapsedYears,
  ];

  if (!values.every(Number.isFinite)) {
    throw new Error('Paramètres de retard lumineux stellaire non finis.');
  }
}

function validateCatalogPropagationInputs(
  referencePositionsParsec: Float32Array,
  velocitiesParsecPerYear: Float32Array,
  receptionElapsedYears: number,
  targetPositionsParsec: Float64Array,
): void {
  if (!Number.isFinite(receptionElapsedYears)) {
    throw new Error('Époque de réception stellaire non finie.');
  }
  if (referencePositionsParsec.length !== velocitiesParsecPerYear.length) {
    throw new Error('Positions et vitesses stellaires de tailles différentes.');
  }
  if (referencePositionsParsec.length % 3 !== 0) {
    throw new Error('Vecteurs stellaires incomplets.');
  }
  if (targetPositionsParsec.length !== referencePositionsParsec.length) {
    throw new Error('Tampon de propagation stellaire incompatible.');
  }
}

function clampStellarElapsedYears(elapsedYears: number): number {
  return Math.max(
    -STELLAR_MOTION_MAX_ABSOLUTE_YEARS,
    Math.min(STELLAR_MOTION_MAX_ABSOLUTE_YEARS, elapsedYears),
  );
}

function resolveDomainStatus(elapsedYears: number): StellarMotionDomainStatus {
  if (elapsedYears < -STELLAR_MOTION_MAX_ABSOLUTE_YEARS) {
    return 'clamped-to-past-boundary';
  }
  if (elapsedYears > STELLAR_MOTION_MAX_ABSOLUTE_YEARS) {
    return 'clamped-to-future-boundary';
  }

  return 'within-model-domain';
}
