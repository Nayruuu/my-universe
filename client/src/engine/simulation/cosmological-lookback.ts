export const HOGG_COSMOLOGICAL_DISTANCE_SOURCE_URL = 'https://arxiv.org/abs/astro-ph/9905116';

export const FLAT_LAMBDA_CDM_PARAMETERS = {
  hubbleConstantKmPerSecondPerMpc: 70,
  matterDensity: 0.3,
  darkEnergyDensity: 0.7,
} as const;

export const RECEIVED_LIGHT_DISTANCE_MODEL_METADATA_KEY = 'receivedLightDistanceModel';
export const COSMOLOGICAL_REDSHIFT_METADATA_KEY = 'cosmologicalRedshift';
export const COSMOLOGICAL_REDSHIFT_ORIGIN_METADATA_KEY = 'cosmologicalRedshiftOrigin';

export const RECEIVED_LIGHT_DISTANCE_MODELS = {
  catalogGeometric: 'catalog-distance-geometric',
  flatLambdaCdmComoving: 'flat-lambda-cdm-comoving-distance',
  flatLambdaCdmLuminosity: 'flat-lambda-cdm-luminosity-distance',
} as const;

export type CosmologicalRedshiftOrigin =
  'inferred-from-comoving-distance' | 'inferred-from-luminosity-distance';

const SPEED_OF_LIGHT_KM_PER_SECOND = 299_792.458;
const KILOMETERS_PER_MEGAPARSEC = 3.085_677_581_491_367e19;
const SECONDS_PER_JULIAN_YEAR = 31_557_600;
const COMOVING_INTEGRATION_INTERVALS = 2_048;
const REDSHIFT_BISECTION_ITERATIONS = 52;
const MAXIMUM_INVERTIBLE_REDSHIFT = 10;

/**
 * Flat matter + cosmological-constant lookback time, following Hogg (1999), equation 30.
 * Radiation is intentionally omitted to match the H0=70, Ωm=0.3, ΩΛ=0.7 catalogue import.
 */
export function calculateFlatLambdaCdmLookbackJulianYears(redshift: number): number {
  assertNonNegativeFinite(redshift, 'Redshift cosmologique');

  if (redshift === 0) {
    return 0;
  }
  const hubbleTimeJulianYears =
    KILOMETERS_PER_MEGAPARSEC /
    FLAT_LAMBDA_CDM_PARAMETERS.hubbleConstantKmPerSecondPerMpc /
    SECONDS_PER_JULIAN_YEAR;
  const densityRatio =
    FLAT_LAMBDA_CDM_PARAMETERS.darkEnergyDensity / FLAT_LAMBDA_CDM_PARAMETERS.matterDensity;
  const ageScale =
    (2 * hubbleTimeJulianYears) / (3 * Math.sqrt(FLAT_LAMBDA_CDM_PARAMETERS.darkEnergyDensity));
  const ageAtScaleFactor = (scaleFactor: number): number =>
    ageScale * Math.asinh(Math.sqrt(densityRatio) * scaleFactor ** 1.5);

  return ageAtScaleFactor(1) - ageAtScaleFactor(1 / (1 + redshift));
}

/** Comoving radial distance in the catalogue's documented flat ΛCDM model. */
export function calculateFlatLambdaCdmComovingDistanceMpc(redshift: number): number {
  assertNonNegativeFinite(redshift, 'Redshift cosmologique');

  if (redshift === 0) {
    return 0;
  }
  const intervalWidth = redshift / COMOVING_INTEGRATION_INTERVALS;
  let weightedIntegral = 0;

  for (let index = 0; index <= COMOVING_INTEGRATION_INTERVALS; index += 1) {
    const sampleRedshift = index * intervalWidth;
    const endpoint = index === 0 || index === COMOVING_INTEGRATION_INTERVALS;
    const weight = endpoint ? 1 : index % 2 === 0 ? 2 : 4;

    weightedIntegral += weight / expansionRate(sampleRedshift);
  }

  return (
    (SPEED_OF_LIGHT_KM_PER_SECOND / FLAT_LAMBDA_CDM_PARAMETERS.hubbleConstantKmPerSecondPerMpc) *
    ((weightedIntegral * intervalWidth) / 3)
  );
}

/** Luminosity distance for a spatially flat model: D_L = (1 + z) D_C. */
export function calculateFlatLambdaCdmLuminosityDistanceMpc(redshift: number): number {
  return (1 + redshift) * calculateFlatLambdaCdmComovingDistanceMpc(redshift);
}

export function inferFlatLambdaCdmRedshiftFromComovingDistanceMpc(distanceMpc: number): number {
  return inferRedshift(distanceMpc, calculateFlatLambdaCdmComovingDistanceMpc, 'comobile');
}

export function inferFlatLambdaCdmRedshiftFromLuminosityDistanceMpc(distanceMpc: number): number {
  return inferRedshift(distanceMpc, calculateFlatLambdaCdmLuminosityDistanceMpc, 'de luminosité');
}

function inferRedshift(
  distanceMpc: number,
  distanceAtRedshift: (redshift: number) => number,
  distanceKind: string,
): number {
  assertNonNegativeFinite(distanceMpc, 'Distance cosmologique');

  if (distanceMpc === 0) {
    return 0;
  }
  if (distanceMpc > distanceAtRedshift(MAXIMUM_INVERTIBLE_REDSHIFT)) {
    throw new Error(
      `Distance ${distanceKind} hors du domaine ΛCDM borné à z=${MAXIMUM_INVERTIBLE_REDSHIFT}.`,
    );
  }
  let lowerRedshift = 0;
  let upperRedshift = 1;

  while (
    upperRedshift < MAXIMUM_INVERTIBLE_REDSHIFT &&
    distanceAtRedshift(upperRedshift) < distanceMpc
  ) {
    lowerRedshift = upperRedshift;
    upperRedshift = Math.min(MAXIMUM_INVERTIBLE_REDSHIFT, upperRedshift * 2);
  }

  for (let iteration = 0; iteration < REDSHIFT_BISECTION_ITERATIONS; iteration += 1) {
    const middleRedshift = (lowerRedshift + upperRedshift) / 2;

    if (distanceAtRedshift(middleRedshift) < distanceMpc) {
      lowerRedshift = middleRedshift;
    } else {
      upperRedshift = middleRedshift;
    }
  }

  return (lowerRedshift + upperRedshift) / 2;
}

function expansionRate(redshift: number): number {
  return Math.sqrt(
    FLAT_LAMBDA_CDM_PARAMETERS.matterDensity * (1 + redshift) ** 3 +
      FLAT_LAMBDA_CDM_PARAMETERS.darkEnergyDensity,
  );
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} invalide : ${value}.`);
  }
}
