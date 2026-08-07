import {
  type EarthLandmarkCategory,
  type EarthLandmarkDefinition,
  type EarthLandmarkHeightConfidence,
  type EarthLandmarkManifest,
  type EarthLandmarkPack,
  type EarthLandmarkScientificConfidence,
  type EarthLandmarkSelectionMethod,
} from './earth-landmark-catalog.types';
import { createEarthLandmarkSilhouette } from './earth-landmark-silhouette';
import { earthLandmarkSilhouetteProfile } from './earth-landmark-silhouette-profile';

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const LANDMARK_ID_PATTERN = /^[a-z0-9]+(?:(?:-|:)[a-z0-9]+)*$/u;
const WIKIDATA_ID_PATTERN = /^Q\d+$/u;
const HTTPS_PATTERN = /^https:\/\/[^\s]+$/u;
const SAME_ORIGIN_JSON_PATTERN = /^\/(?!\/)[^\s]+\.json(?:\?[^\s]*)?$/u;
const SCIENTIFIC_CONFIDENCES: readonly EarthLandmarkScientificConfidence[] = [
  'observed',
  'illustrative',
];
const CATEGORIES: readonly EarthLandmarkCategory[] = [
  'architecture',
  'palace',
  'tower',
  'monument',
  'religious',
  'museum',
  'bridge',
  'fortification',
  'civic',
  'venue',
  'transport',
  'public-space',
  'illustrative-cityscape-anchor',
];
const HEIGHT_CONFIDENCES: readonly EarthLandmarkHeightConfidence[] = [
  'documented',
  'unknown',
  'illustrative',
];
const SELECTION_METHODS: readonly EarthLandmarkSelectionMethod[] = [
  'wikimedia-geosearch',
  'geonames-illustrative-fallback',
];

export function parseEarthLandmarkManifest(value: unknown): EarthLandmarkManifest {
  const manifest = requiredRecord(value, 'manifest must be an object');

  if (manifest['version'] !== 1) {
    throw new Error('manifest.version must be 1');
  }
  const locationCount = manifest['locationCount'];

  if (!Number.isInteger(locationCount) || Number(locationCount) < 0) {
    throw new Error('manifest.locationCount must be a non-negative integer');
  }
  const packUrlByRegion = parseManifestPacks(manifest['packs']);
  const { locationRegionById, locationIdsByRegion } = parseManifestLocations(
    manifest['locations'],
    packUrlByRegion,
  );

  if (locationRegionById.size !== locationCount) {
    throw new Error(
      `manifest.locationCount is ${String(locationCount)} but ${locationRegionById.size} locations are indexed`,
    );
  }

  return {
    version: 1,
    locationCount,
    packUrlByRegion,
    locationRegionById,
    locationIdsByRegion,
  };
}

export function parseEarthLandmarkPack(
  value: unknown,
  expectedRegionId: string,
  expectedLocationIds: readonly string[],
): EarthLandmarkPack {
  const pack = requiredRecord(value, 'pack must be an object');

  if (pack['version'] !== 1) {
    throw new Error('pack.version must be 1');
  }
  if (pack['regionId'] !== expectedRegionId) {
    throw new Error(
      `pack.regionId must be ${expectedRegionId}; received ${String(pack['regionId'])}`,
    );
  }
  const locationRecords = pack['locations'];

  if (!Array.isArray(locationRecords)) {
    throw new Error('pack.locations must be an array');
  }
  const expectedLocations = new Set(expectedLocationIds);
  const landmarksByLocationId = new Map<string, readonly EarthLandmarkDefinition[]>();

  for (const locationRecord of locationRecords) {
    const [locationId, landmarkRecords] = requiredTuple(locationRecord, 2, 'location record');

    if (!isValidId(locationId)) {
      throw new Error('pack location id must be a lowercase slug');
    }
    if (!expectedLocations.has(locationId)) {
      throw new Error(`pack contains unexpected location ${locationId}`);
    }
    if (landmarksByLocationId.has(locationId)) {
      throw new Error(`pack contains duplicate location ${locationId}`);
    }
    if (!Array.isArray(landmarkRecords)) {
      throw new Error(`landmarks for ${locationId} must be an array`);
    }
    landmarksByLocationId.set(locationId, parseLandmarks(landmarkRecords, locationId));
  }
  for (const locationId of expectedLocationIds) {
    if (!landmarksByLocationId.has(locationId)) {
      throw new Error(`pack is missing location ${locationId}`);
    }
  }

  return landmarksByLocationId;
}

function parseManifestPacks(value: unknown): ReadonlyMap<string, string> {
  if (!Array.isArray(value)) {
    throw new Error('manifest.packs must be an array');
  }
  const packUrlByRegion = new Map<string, string>();

  for (const record of value) {
    const [regionId, url] = requiredTuple(record, 2, 'manifest pack');

    if (!isValidId(regionId)) {
      throw new Error('manifest pack id must be a lowercase slug');
    }
    if (typeof url !== 'string' || !SAME_ORIGIN_JSON_PATTERN.test(url)) {
      throw new Error(`manifest pack ${regionId} must use a same-origin JSON URL`);
    }
    if (packUrlByRegion.has(regionId)) {
      throw new Error(`manifest contains duplicate pack ${regionId}`);
    }
    packUrlByRegion.set(regionId, url);
  }

  return packUrlByRegion;
}

function parseManifestLocations(
  value: unknown,
  packUrlByRegion: ReadonlyMap<string, string>,
): {
  readonly locationRegionById: ReadonlyMap<string, string>;
  readonly locationIdsByRegion: ReadonlyMap<string, readonly string[]>;
} {
  if (!Array.isArray(value)) {
    throw new Error('manifest.locations must be an array');
  }
  const locationRegionById = new Map<string, string>();
  const mutableLocationIdsByRegion = new Map<string, string[]>();

  for (const record of value) {
    const [locationId, regionId] = requiredTuple(record, 2, 'manifest location');

    if (!isValidId(locationId)) {
      throw new Error('manifest location id must be a lowercase slug');
    }
    if (typeof regionId !== 'string' || !packUrlByRegion.has(regionId)) {
      throw new Error(
        `manifest location ${locationId} references unknown pack ${String(regionId)}`,
      );
    }
    if (locationRegionById.has(locationId)) {
      throw new Error(`manifest contains duplicate location ${locationId}`);
    }
    locationRegionById.set(locationId, regionId);
    const locationIds = mutableLocationIdsByRegion.get(regionId) ?? [];

    locationIds.push(locationId);
    mutableLocationIdsByRegion.set(regionId, locationIds);
  }

  return {
    locationRegionById,
    locationIdsByRegion: mutableLocationIdsByRegion,
  };
}

function parseLandmarks(
  records: readonly unknown[],
  locationId: string,
): readonly EarthLandmarkDefinition[] {
  if (records.length !== 4) {
    throw new Error(`${locationId} must contain exactly 4 landmarks; received ${records.length}`);
  }
  const landmarkIds = new Set<string>();

  return records.map((record) => {
    const landmark = parseLandmark(record);

    if (landmarkIds.has(landmark.id)) {
      throw new Error(`pack contains duplicate landmark ${landmark.id} for ${locationId}`);
    }
    landmarkIds.add(landmark.id);

    return landmark;
  });
}

function parseLandmark(value: unknown): EarthLandmarkDefinition {
  const [
    id,
    name,
    wikidataId,
    category,
    latitude,
    longitude,
    distanceMeters,
    heightMeters,
    heightConfidence,
    confidence,
    visualConfidence,
    selectionMethod,
    sourceTitle,
    sourceUrl,
    wikipediaUrl,
  ] = requiredTuple(value, 15, 'landmark');

  if (typeof id !== 'string' || !LANDMARK_ID_PATTERN.test(id)) {
    throw new Error('landmark id must be a lowercase slug');
  }
  if (!isNonEmptyString(name)) {
    throw new Error(`landmark name is required for ${id}`);
  }
  if (
    wikidataId !== null &&
    (typeof wikidataId !== 'string' || !WIKIDATA_ID_PATTERN.test(wikidataId))
  ) {
    throw new Error(`landmark Wikidata id is invalid for ${id}`);
  }
  if (!CATEGORIES.includes(category as EarthLandmarkCategory)) {
    throw new Error(`landmark category is invalid for ${id}`);
  }
  if (!isFiniteNumber(latitude) || latitude < -90 || latitude > 90) {
    throw new Error(`landmark latitude is invalid for ${id}`);
  }
  if (!isFiniteNumber(longitude) || longitude < -180 || longitude > 180) {
    throw new Error(`landmark longitude is invalid for ${id}`);
  }
  if (!isFiniteNumber(distanceMeters) || distanceMeters < 0) {
    throw new Error(`landmark distance must be non-negative for ${id}`);
  }
  if (heightMeters !== null && (!isFiniteNumber(heightMeters) || heightMeters <= 0)) {
    throw new Error(`landmark height must be positive or null for ${id}`);
  }
  if (!HEIGHT_CONFIDENCES.includes(heightConfidence as EarthLandmarkHeightConfidence)) {
    throw new Error(`landmark height confidence is invalid for ${id}`);
  }
  if ((heightConfidence === 'documented') !== (heightMeters !== null)) {
    throw new Error(`landmark height and confidence are inconsistent for ${id}`);
  }
  if (!isScientificConfidence(confidence)) {
    throw new Error(`landmark scientific confidence is invalid for ${id}`);
  }
  if (visualConfidence !== 'illustrative') {
    throw new Error(`landmark visual confidence is invalid for ${id}`);
  }
  if (!SELECTION_METHODS.includes(selectionMethod as EarthLandmarkSelectionMethod)) {
    throw new Error(`landmark selection method is invalid for ${id}`);
  }
  if (!isNonEmptyString(sourceTitle)) {
    throw new Error(`landmark source title is required for ${id}`);
  }
  if (typeof sourceUrl !== 'string' || !HTTPS_PATTERN.test(sourceUrl)) {
    throw new Error(`landmark requires an HTTPS source for ${id}`);
  }
  if (
    wikipediaUrl !== null &&
    (typeof wikipediaUrl !== 'string' || !HTTPS_PATTERN.test(wikipediaUrl))
  ) {
    throw new Error(`landmark Wikipedia URL is invalid for ${id}`);
  }
  const validCategory = category as EarthLandmarkCategory;
  const silhouetteProfile = earthLandmarkSilhouetteProfile(validCategory, name);
  const silhouette = createEarthLandmarkSilhouette({
    aspectRatio: silhouetteProfile.aspectRatio,
    family: silhouetteProfile.family,
    id,
  });

  return {
    id,
    name: name.trim(),
    wikidataId,
    category: validCategory,
    latitude,
    longitude,
    distanceMeters,
    heightMeters,
    heightConfidence: heightConfidence as EarthLandmarkHeightConfidence,
    scientificConfidence: confidence,
    visualConfidence,
    selectionMethod: selectionMethod as EarthLandmarkSelectionMethod,
    sourceTitle: sourceTitle.trim(),
    sourceUrl,
    wikipediaUrl,
    sourceAspectRatio: silhouette.width / silhouette.height,
    sourceViewBox: silhouette.viewBox,
    silhouettePath: silhouette.path,
  };
}

function requiredRecord(value: unknown, message: string): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(message);
  }

  return value as Readonly<Record<string, unknown>>;
}

function requiredTuple(value: unknown, length: number, label: string): readonly unknown[] {
  if (!Array.isArray(value) || value.length !== length) {
    throw new Error(`${label} must be a tuple of ${length} values`);
  }

  return value;
}

function isValidId(value: unknown): value is string {
  return typeof value === 'string' && ID_PATTERN.test(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isScientificConfidence(value: unknown): value is EarthLandmarkScientificConfidence {
  return SCIENTIFIC_CONFIDENCES.includes(value as EarthLandmarkScientificConfidence);
}
