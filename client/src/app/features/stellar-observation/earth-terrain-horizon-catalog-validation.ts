import {
  EARTH_TERRAIN_HORIZON_BINARY_ENCODING,
  EARTH_TERRAIN_HORIZON_SCHEMA,
  type EarthTerrainHorizonCalculation,
  type EarthTerrainHorizonDistanceBand,
  type EarthTerrainHorizonDistanceBandId,
  type EarthTerrainHorizonManifest,
  type EarthTerrainHorizonManifestProfile,
  type EarthTerrainHorizonSource,
} from './earth-terrain-horizon-catalog.types';

export function parseEarthTerrainHorizonManifest(value: unknown): EarthTerrainHorizonManifest {
  const manifest = record(value, 'manifest');
  const source = parseSource(manifest['source']);
  const calculation = parseCalculation(manifest['calculation']);
  const binary = record(manifest['binary'], 'binary');
  const profiles = array(manifest['profiles'], 'profiles').map((profile, index) =>
    parseProfile(profile, index, calculation.azimuthStepDegrees),
  );
  const profileCount = positiveInteger(manifest['profileCount'], 'profileCount');

  if (manifest['schema'] !== EARTH_TERRAIN_HORIZON_SCHEMA) {
    throw new Error('Unsupported Earth terrain horizon schema.');
  }
  if (manifest['dataClassification'] !== 'calculated-from-measured-global-relief-model') {
    throw new Error('Invalid Earth terrain horizon data classification.');
  }
  if (profileCount !== profiles.length) {
    throw new Error('Earth terrain horizon profile count does not match the manifest.');
  }
  const locationIds = new Set<string>();

  for (const [index, profile] of profiles.entries()) {
    if (locationIds.has(profile.locationId)) {
      throw new Error(`Duplicate Earth terrain horizon location: ${profile.locationId}.`);
    }
    if (profile.sampleOffset !== index * profile.sampleCount * calculation.distanceBands.length) {
      throw new Error(`Non-contiguous Earth terrain horizon samples for ${profile.locationId}.`);
    }
    locationIds.add(profile.locationId);
  }

  return {
    schema: EARTH_TERRAIN_HORIZON_SCHEMA,
    generatedAt: isoDate(manifest['generatedAt'], 'generatedAt'),
    dataClassification: 'calculated-from-measured-global-relief-model',
    source,
    calculation,
    binary: {
      file: nonEmptyString(binary['file'], 'binary.file'),
      byteLength: positiveInteger(binary['byteLength'], 'binary.byteLength'),
      sha256: sha256(binary['sha256']),
      encoding: literal(
        binary['encoding'],
        EARTH_TERRAIN_HORIZON_BINARY_ENCODING,
        'binary.encoding',
      ),
    },
    profileCount,
    profiles,
  };
}

export function parseEarthTerrainHorizonBinary(
  manifest: EarthTerrainHorizonManifest,
  buffer: ArrayBuffer,
): Int16Array<ArrayBuffer> {
  if (buffer.byteLength !== manifest.binary.byteLength || buffer.byteLength % 2 !== 0) {
    throw new Error('Earth terrain horizon binary length is invalid.');
  }
  const expectedSamples = manifest.profiles.reduce(
    (total, profile) => total + profile.sampleCount * manifest.calculation.distanceBands.length,
    0,
  );

  if (expectedSamples * Int16Array.BYTES_PER_ELEMENT !== buffer.byteLength) {
    throw new Error('Earth terrain horizon binary does not match its profiles.');
  }
  const view = new DataView(buffer);
  const samples = new Int16Array(expectedSamples);

  for (let index = 0; index < expectedSamples; index += 1) {
    const value = view.getInt16(index * Int16Array.BYTES_PER_ELEMENT, true);

    if (value < 0 || value > 9_000) {
      throw new Error(`Invalid Earth terrain obstruction sample at index ${index}.`);
    }
    samples[index] = value;
  }

  return samples;
}

function parseSource(value: unknown): EarthTerrainHorizonSource {
  const source = record(value, 'source');

  return {
    id: nonEmptyString(source['id'], 'source.id'),
    title: nonEmptyString(source['title'], 'source.title'),
    productUrl: absoluteUrl(source['productUrl'], 'source.productUrl'),
    dataUrl: nonEmptyString(source['dataUrl'], 'source.dataUrl'),
    doi: absoluteUrl(source['doi'], 'source.doi'),
    horizontalDatum: nonEmptyString(source['horizontalDatum'], 'source.horizontalDatum'),
    verticalDatum: nonEmptyString(source['verticalDatum'], 'source.verticalDatum'),
    resolutionArcSeconds: positiveNumber(
      source['resolutionArcSeconds'],
      'source.resolutionArcSeconds',
    ),
  };
}

function parseCalculation(value: unknown): EarthTerrainHorizonCalculation {
  const calculation = record(value, 'calculation');
  const azimuthStepDegrees = positiveInteger(
    calculation['azimuthStepDegrees'],
    'calculation.azimuthStepDegrees',
  );

  if (360 % azimuthStepDegrees !== 0) {
    throw new Error('Earth terrain azimuth step must divide 360 degrees.');
  }
  const maximumDistanceMeters = positiveNumber(
    calculation['maximumDistanceMeters'],
    'calculation.maximumDistanceMeters',
  );
  const distanceBands = parseDistanceBands(calculation['distanceBands'], maximumDistanceMeters);

  return {
    model: literal(calculation['model'], 'spherical-geometric-line-of-sight', 'calculation.model'),
    earthRadiusMeters: positiveNumber(
      calculation['earthRadiusMeters'],
      'calculation.earthRadiusMeters',
    ),
    observerEyeHeightMeters: finiteNumber(
      calculation['observerEyeHeightMeters'],
      'calculation.observerEyeHeightMeters',
    ),
    maximumDistanceMeters,
    sampleStepMeters: positiveNumber(
      calculation['sampleStepMeters'],
      'calculation.sampleStepMeters',
    ),
    azimuthStepDegrees,
    distanceBands,
    atmosphericRefraction: literal(
      calculation['atmosphericRefraction'],
      'excluded',
      'calculation.atmosphericRefraction',
    ),
    terrainInterpolation: literal(
      calculation['terrainInterpolation'],
      'bilinear',
      'calculation.terrainInterpolation',
    ),
    locationAnchor: literal(
      calculation['locationAnchor'],
      'catalogued-city-center',
      'calculation.locationAnchor',
    ),
  };
}

function parseDistanceBands(
  value: unknown,
  maximumDistanceMeters: number,
): readonly EarthTerrainHorizonDistanceBand[] {
  const expectedIds: readonly EarthTerrainHorizonDistanceBandId[] = ['near', 'mid', 'far'];
  const bands = array(value, 'calculation.distanceBands');

  if (bands.length !== expectedIds.length) {
    throw new Error('Earth terrain distance bands are incomplete.');
  }
  let previousMaximum = 0;
  const parsed = bands.map((value_, index) => {
    const band = record(value_, `calculation.distanceBands[${index}]`);
    const minimumDistanceMeters = nonNegativeNumber(
      band['minimumDistanceMeters'],
      `calculation.distanceBands[${index}].minimumDistanceMeters`,
    );
    const maximumBandDistanceMeters = positiveNumber(
      band['maximumDistanceMeters'],
      `calculation.distanceBands[${index}].maximumDistanceMeters`,
    );

    if (
      band['id'] !== expectedIds[index] ||
      minimumDistanceMeters !== previousMaximum ||
      maximumBandDistanceMeters <= minimumDistanceMeters
    ) {
      throw new Error(`Invalid Earth terrain distance band at index ${index}.`);
    }
    previousMaximum = maximumBandDistanceMeters;

    return {
      id: band['id'],
      minimumDistanceMeters,
      maximumDistanceMeters: maximumBandDistanceMeters,
    } as EarthTerrainHorizonDistanceBand;
  });

  if (previousMaximum !== maximumDistanceMeters) {
    throw new Error('Earth terrain distance bands do not cover the calculation range.');
  }

  return parsed;
}

function parseProfile(
  value: unknown,
  index: number,
  azimuthStepDegrees: number,
): EarthTerrainHorizonManifestProfile {
  const profile = record(value, `profiles[${index}]`);
  const sampleCount = positiveInteger(profile['sampleCount'], `profiles[${index}].sampleCount`);

  if (sampleCount !== 360 / azimuthStepDegrees) {
    throw new Error(`Invalid Earth terrain horizon sample count at profile ${index}.`);
  }

  return {
    locationId: nonEmptyString(profile['locationId'], `profiles[${index}].locationId`),
    latitude: rangeNumber(profile['latitude'], -90, 90, `profiles[${index}].latitude`),
    longitude: rangeNumber(profile['longitude'], -180, 180, `profiles[${index}].longitude`),
    observerElevationMeters: finiteNumber(
      profile['observerElevationMeters'],
      `profiles[${index}].observerElevationMeters`,
    ),
    sampleOffset: nonNegativeInteger(profile['sampleOffset'], `profiles[${index}].sampleOffset`),
    sampleCount,
  };
}

function record(value: unknown, name: string): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid Earth terrain horizon ${name}.`);
  }

  return value as Readonly<Record<string, unknown>>;
}

function array(value: unknown, name: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid Earth terrain horizon ${name}.`);
  }

  return value;
}

function nonEmptyString(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Invalid Earth terrain horizon ${name}.`);
  }

  return value;
}

function finiteNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid Earth terrain horizon ${name}.`);
  }

  return value;
}

function positiveNumber(value: unknown, name: string): number {
  const parsed = finiteNumber(value, name);

  if (parsed <= 0) {
    throw new Error(`Invalid Earth terrain horizon ${name}.`);
  }

  return parsed;
}

function nonNegativeNumber(value: unknown, name: string): number {
  const parsed = finiteNumber(value, name);

  if (parsed < 0) {
    throw new Error(`Invalid Earth terrain horizon ${name}.`);
  }

  return parsed;
}

function rangeNumber(value: unknown, minimum: number, maximum: number, name: string): number {
  const parsed = finiteNumber(value, name);

  if (parsed < minimum || parsed > maximum) {
    throw new Error(`Invalid Earth terrain horizon ${name}.`);
  }

  return parsed;
}

function positiveInteger(value: unknown, name: string): number {
  const parsed = nonNegativeInteger(value, name);

  if (parsed === 0) {
    throw new Error(`Invalid Earth terrain horizon ${name}.`);
  }

  return parsed;
}

function nonNegativeInteger(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid Earth terrain horizon ${name}.`);
  }

  return value;
}

function literal<const Value extends string>(value: unknown, expected: Value, name: string): Value {
  if (value !== expected) {
    throw new Error(`Invalid Earth terrain horizon ${name}.`);
  }

  return expected;
}

function absoluteUrl(value: unknown, name: string): string {
  const parsed = nonEmptyString(value, name);

  try {
    const url = new URL(parsed);

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('unsupported protocol');
    }
  } catch {
    throw new Error(`Invalid Earth terrain horizon ${name}.`);
  }

  return parsed;
}

function isoDate(value: unknown, name: string): string {
  const parsed = nonEmptyString(value, name);

  if (!Number.isFinite(Date.parse(parsed))) {
    throw new Error(`Invalid Earth terrain horizon ${name}.`);
  }

  return parsed;
}

function sha256(value: unknown): string {
  const parsed = nonEmptyString(value, 'binary.sha256');

  if (!/^[\da-f]{64}$/u.test(parsed)) {
    throw new Error('Invalid Earth terrain horizon binary.sha256.');
  }

  return parsed;
}
