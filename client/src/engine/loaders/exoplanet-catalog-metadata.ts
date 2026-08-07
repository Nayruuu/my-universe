import type { ExoplanetCatalogMetadata } from './exoplanet-catalog-types';

export function parseExoplanetCatalogMetadata(
  value: unknown,
  source: string,
): ExoplanetCatalogMetadata {
  if (!isRecord(value)) {
    throw invalidMetadata(source);
  }
  const provenance = value['source'];
  const counts = value['counts'];
  const fallback = value['missingDistanceFallbackParsec'];
  const validCounts =
    isRecord(counts) &&
    isPositiveInteger(counts['hosts']) &&
    isPositiveInteger(counts['planets']) &&
    isNonNegativeInteger(counts['positionedHosts']) &&
    isNonNegativeInteger(counts['positionedPlanets']) &&
    counts['positionedHosts'] <= counts['hosts'] &&
    counts['positionedPlanets'] <= counts['planets'];
  const validSource =
    isRecord(provenance) &&
    isNonEmptyString(provenance['name']) &&
    isNonEmptyString(provenance['url']) &&
    isNonEmptyString(provenance['tapUrl']) &&
    provenance['table'] === 'PSCompPars' &&
    isNonEmptyString(provenance['query']) &&
    typeof provenance['snapshotDate'] === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/u.test(provenance['snapshotDate']) &&
    typeof provenance['sha256'] === 'string' &&
    /^[a-f0-9]{64}$/u.test(provenance['sha256']);

  if (
    !isNonEmptyString(value['version']) ||
    value['format'] !== 'exoplanet-catalog-v1' ||
    !validSource ||
    !validCounts ||
    typeof fallback !== 'number' ||
    !Number.isFinite(fallback) ||
    fallback <= 0
  ) {
    throw invalidMetadata(source);
  }

  return value as unknown as ExoplanetCatalogMetadata;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function invalidMetadata(source: string): Error {
  return new Error(`Métadonnées du catalogue d’exoplanètes invalides (${source}).`);
}
