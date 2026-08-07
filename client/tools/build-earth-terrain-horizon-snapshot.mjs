import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fromFile, fromUrl } from 'geotiff';
import { format } from 'prettier';
import { parseEarthObserverLocationSource } from './build-earth-landmark-snapshot.mjs';

const DEFAULT_LOCATION_INPUT = resolve('src/engine/simulation/earth-observer-locations.data.ts');
const DEFAULT_MANIFEST_OUTPUT = resolve('public/data/earth-terrain-horizons/etopo-2022-60s.json');
const DEFAULT_BINARY_OUTPUT = resolve('public/data/earth-terrain-horizons/etopo-2022-60s.bin');
const DEFAULT_SOURCE_URL =
  'https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO2022/data/60s/60s_surface_elev_gtif/ETOPO_2022_v1_60s_N90W180_surface.tif';
const SOURCE_DOI = 'https://doi.org/10.25921/fd45-gt74';
const SOURCE_PAGE = 'https://www.ncei.noaa.gov/products/etopo-global-relief-model';
const SCHEMA = 'universe-map/earth-terrain-horizons@2';
const BINARY_ENCODING = 'int16-le-centidegrees-distance-band-major';
const AZIMUTH_STEP_DEGREES = 1;
const OBSERVER_EYE_HEIGHT_METERS = 2;
const MAXIMUM_DISTANCE_METERS = 300_000;
const SAMPLE_STEP_METERS = 1_852;

export const TERRAIN_DISTANCE_BANDS = Object.freeze([
  { id: 'near', minimumDistanceMeters: 0, maximumDistanceMeters: 30_000 },
  { id: 'mid', minimumDistanceMeters: 30_000, maximumDistanceMeters: 100_000 },
  { id: 'far', minimumDistanceMeters: 100_000, maximumDistanceMeters: 300_000 },
]);

// IUGG mean Earth radius. The horizon calculation is geometric and deliberately excludes
// atmospheric refraction; ETOPO elevations use the EGM2008 vertical datum.
export const MEAN_EARTH_RADIUS_METERS = 6_371_008.8;

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  await main();
}

export function terrainElevationAngleDegrees(
  observerElevationMeters,
  terrainElevationMeters,
  distanceMeters,
  earthRadiusMeters = MEAN_EARTH_RADIUS_METERS,
) {
  assertFiniteNumber(observerElevationMeters, 'observerElevationMeters');
  assertFiniteNumber(terrainElevationMeters, 'terrainElevationMeters');
  assertPositiveNumber(distanceMeters, 'distanceMeters');
  assertPositiveNumber(earthRadiusMeters, 'earthRadiusMeters');

  const centralAngleRadians = distanceMeters / earthRadiusMeters;
  const observerRadius = earthRadiusMeters + observerElevationMeters;
  const terrainRadius = earthRadiusMeters + terrainElevationMeters;
  const tangentDistance = terrainRadius * Math.sin(centralAngleRadians);
  const verticalDistance = terrainRadius * Math.cos(centralAngleRadians) - observerRadius;

  return radiansToDegrees(Math.atan2(verticalDistance, tangentDistance));
}

export function sphericalDestination(origin, bearingDegrees, distanceMeters) {
  assertLatitude(origin.latitude);
  assertLongitude(origin.longitude);
  assertFiniteNumber(bearingDegrees, 'bearingDegrees');
  assertPositiveNumber(distanceMeters, 'distanceMeters');

  const angularDistance = distanceMeters / MEAN_EARTH_RADIUS_METERS;
  const bearingRadians = degreesToRadians(bearingDegrees);
  const latitudeRadians = degreesToRadians(origin.latitude);
  const longitudeRadians = degreesToRadians(origin.longitude);
  const destinationLatitude = Math.asin(
    Math.sin(latitudeRadians) * Math.cos(angularDistance) +
      Math.cos(latitudeRadians) * Math.sin(angularDistance) * Math.cos(bearingRadians),
  );
  const destinationLongitude =
    longitudeRadians +
    Math.atan2(
      Math.sin(bearingRadians) * Math.sin(angularDistance) * Math.cos(latitudeRadians),
      Math.cos(angularDistance) - Math.sin(latitudeRadians) * Math.sin(destinationLatitude),
    );

  return {
    latitude: radiansToDegrees(destinationLatitude),
    longitude: normalizeLongitude(radiansToDegrees(destinationLongitude)),
  };
}

export function buildTerrainHorizonRecord(location, sampleElevationMeters, options = {}) {
  const azimuthStepDegrees = options.azimuthStepDegrees ?? AZIMUTH_STEP_DEGREES;
  const observerEyeHeightMeters = options.observerEyeHeightMeters ?? OBSERVER_EYE_HEIGHT_METERS;
  const maximumDistanceMeters = options.maximumDistanceMeters ?? MAXIMUM_DISTANCE_METERS;
  const sampleStepMeters = options.sampleStepMeters ?? SAMPLE_STEP_METERS;
  const earthRadiusMeters = options.earthRadiusMeters ?? MEAN_EARTH_RADIUS_METERS;
  const distanceBands = options.distanceBands ?? TERRAIN_DISTANCE_BANDS;

  assertLocation(location);
  assertAzimuthStep(azimuthStepDegrees);
  assertFiniteNumber(observerEyeHeightMeters, 'observerEyeHeightMeters');
  assertPositiveNumber(maximumDistanceMeters, 'maximumDistanceMeters');
  assertPositiveNumber(sampleStepMeters, 'sampleStepMeters');
  assertPositiveNumber(earthRadiusMeters, 'earthRadiusMeters');
  assertDistanceBands(distanceBands, maximumDistanceMeters);

  const sampledSurfaceElevationMeters = sampleElevationMeters(
    location.latitude,
    location.longitude,
  );
  assertFiniteNumber(sampledSurfaceElevationMeters, 'sampledSurfaceElevationMeters');
  const observerElevationMeters = sampledSurfaceElevationMeters + observerEyeHeightMeters;
  const sampleCount = 360 / azimuthStepDegrees;
  const obstructionAnglesCentidegrees = new Int16Array(sampleCount);
  const distanceLayers = distanceBands.map((band) => ({
    ...band,
    obstructionAnglesCentidegrees: new Int16Array(sampleCount),
  }));

  for (let azimuthIndex = 0; azimuthIndex < sampleCount; azimuthIndex += 1) {
    const bearingDegrees = azimuthIndex * azimuthStepDegrees;
    const maximumAnglesByDistanceBand = new Float64Array(distanceBands.length);

    for (
      let distanceMeters = sampleStepMeters;
      distanceMeters <= maximumDistanceMeters;
      distanceMeters += sampleStepMeters
    ) {
      const sampleLocation = sphericalDestination(location, bearingDegrees, distanceMeters);
      const terrainElevationMeters = sampleElevationMeters(
        sampleLocation.latitude,
        sampleLocation.longitude,
      );

      if (!Number.isFinite(terrainElevationMeters)) {
        continue;
      }
      const distanceBandIndex = terrainDistanceBandIndex(distanceMeters, distanceBands);

      if (distanceBandIndex < 0) {
        continue;
      }
      maximumAnglesByDistanceBand[distanceBandIndex] = Math.max(
        maximumAnglesByDistanceBand[distanceBandIndex],
        terrainElevationAngleDegrees(
          observerElevationMeters,
          terrainElevationMeters,
          distanceMeters,
          earthRadiusMeters,
        ),
      );
    }

    let maximumAngleCentidegrees = 0;

    for (const [distanceBandIndex, maximumAngleDegrees] of maximumAnglesByDistanceBand.entries()) {
      const angleCentidegrees = clampedAngleCentidegrees(maximumAngleDegrees);

      distanceLayers[distanceBandIndex].obstructionAnglesCentidegrees[azimuthIndex] =
        angleCentidegrees;
      maximumAngleCentidegrees = Math.max(maximumAngleCentidegrees, angleCentidegrees);
    }
    obstructionAnglesCentidegrees[azimuthIndex] = maximumAngleCentidegrees;
  }

  return {
    locationId: location.id,
    latitude: location.latitude,
    longitude: location.longitude,
    observerElevationMeters: round(sampledSurfaceElevationMeters + observerEyeHeightMeters, 1),
    distanceLayers,
    obstructionAnglesCentidegrees,
  };
}

export function terrainDistanceBandIndex(distanceMeters, distanceBands = TERRAIN_DISTANCE_BANDS) {
  assertPositiveNumber(distanceMeters, 'distanceMeters');

  return distanceBands.findIndex(
    (band, index) =>
      distanceMeters >= band.minimumDistanceMeters &&
      (distanceMeters < band.maximumDistanceMeters ||
        (index === distanceBands.length - 1 && distanceMeters <= band.maximumDistanceMeters)),
  );
}

export function createTerrainHorizonArtifacts(locations, records, options = {}) {
  if (locations.length !== records.length) {
    throw new Error('Every Earth observer location must have one terrain horizon record.');
  }
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const sourceUrl = options.sourceUrl ?? DEFAULT_SOURCE_URL;
  const distanceBands = options.distanceBands ?? TERRAIN_DISTANCE_BANDS;
  const sampleCount = 360 / AZIMUTH_STEP_DEGREES;
  assertDistanceBands(distanceBands, MAXIMUM_DISTANCE_METERS);
  const samplesPerProfile = sampleCount * distanceBands.length;
  const binary = Buffer.alloc(records.length * samplesPerProfile * Int16Array.BYTES_PER_ELEMENT);
  const profiles = records.map((record, index) => {
    const location = locations[index];

    if (!location || record.locationId !== location.id) {
      throw new Error(`Terrain horizon record order mismatch at index ${index}.`);
    }
    if (
      record.obstructionAnglesCentidegrees.length !== sampleCount ||
      record.distanceLayers?.length !== distanceBands.length
    ) {
      throw new Error(`Invalid terrain horizon sample count for ${record.locationId}.`);
    }
    const sampleOffset = index * samplesPerProfile;

    for (const [distanceBandIndex, distanceBand] of distanceBands.entries()) {
      const layer = record.distanceLayers[distanceBandIndex];

      if (
        layer.id !== distanceBand.id ||
        layer.minimumDistanceMeters !== distanceBand.minimumDistanceMeters ||
        layer.maximumDistanceMeters !== distanceBand.maximumDistanceMeters ||
        layer.obstructionAnglesCentidegrees.length !== sampleCount
      ) {
        throw new Error(`Invalid terrain distance layer for ${record.locationId}.`);
      }
      for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
        const layerSample = layer.obstructionAnglesCentidegrees[sampleIndex];

        if (record.obstructionAnglesCentidegrees[sampleIndex] < layerSample) {
          throw new Error(`Invalid terrain obstruction envelope for ${record.locationId}.`);
        }
        binary.writeInt16LE(
          layerSample,
          (sampleOffset + distanceBandIndex * sampleCount + sampleIndex) *
            Int16Array.BYTES_PER_ELEMENT,
        );
      }
    }

    return {
      locationId: record.locationId,
      latitude: record.latitude,
      longitude: record.longitude,
      observerElevationMeters: record.observerElevationMeters,
      sampleOffset,
      sampleCount,
    };
  });
  const binaryFile = 'etopo-2022-60s.bin';
  const manifest = {
    schema: SCHEMA,
    generatedAt,
    dataClassification: 'calculated-from-measured-global-relief-model',
    source: {
      id: 'noaa-ncei-etopo-2022-v1-60s-surface',
      title: 'NOAA/NCEI ETOPO 2022 v1 60 arc-second surface elevation',
      productUrl: SOURCE_PAGE,
      dataUrl: sourceUrl,
      doi: SOURCE_DOI,
      horizontalDatum: 'WGS 84 geographic coordinates',
      verticalDatum: 'EGM2008',
      resolutionArcSeconds: 60,
    },
    calculation: {
      model: 'spherical-geometric-line-of-sight',
      earthRadiusMeters: MEAN_EARTH_RADIUS_METERS,
      observerEyeHeightMeters: OBSERVER_EYE_HEIGHT_METERS,
      maximumDistanceMeters: MAXIMUM_DISTANCE_METERS,
      sampleStepMeters: SAMPLE_STEP_METERS,
      azimuthStepDegrees: AZIMUTH_STEP_DEGREES,
      distanceBands,
      atmosphericRefraction: 'excluded',
      terrainInterpolation: 'bilinear',
      locationAnchor: 'catalogued-city-center',
    },
    binary: {
      file: binaryFile,
      byteLength: binary.byteLength,
      sha256: createHash('sha256').update(binary).digest('hex'),
      encoding: BINARY_ENCODING,
    },
    profileCount: profiles.length,
    profiles,
  };

  validateTerrainHorizonArtifacts(manifest, binary, locations);

  return { manifest, binary };
}

export function validateTerrainHorizonArtifacts(manifest, binary, locations) {
  if (manifest?.schema !== SCHEMA) {
    throw new Error('Unsupported Earth terrain horizon manifest schema.');
  }
  if (
    manifest.binary?.encoding !== BINARY_ENCODING ||
    manifest.binary.byteLength !== binary.byteLength ||
    manifest.binary.sha256 !== createHash('sha256').update(binary).digest('hex')
  ) {
    throw new Error('Earth terrain horizon binary metadata is invalid.');
  }
  if (
    manifest.profileCount !== locations.length ||
    manifest.profiles?.length !== locations.length
  ) {
    throw new Error('Earth terrain horizon coverage is incomplete.');
  }
  const expectedSampleCount = 360 / manifest.calculation.azimuthStepDegrees;
  const distanceBands = manifest.calculation.distanceBands;
  assertDistanceBands(distanceBands, manifest.calculation.maximumDistanceMeters);
  const samplesPerProfile = expectedSampleCount * distanceBands.length;
  const seenLocationIds = new Set();

  for (const [index, profile] of manifest.profiles.entries()) {
    const location = locations[index];

    if (
      !location ||
      profile.locationId !== location.id ||
      profile.latitude !== location.latitude ||
      profile.longitude !== location.longitude ||
      profile.sampleOffset !== index * samplesPerProfile ||
      profile.sampleCount !== expectedSampleCount ||
      !Number.isFinite(profile.observerElevationMeters) ||
      seenLocationIds.has(profile.locationId)
    ) {
      throw new Error(`Invalid Earth terrain horizon profile at index ${index}.`);
    }
    seenLocationIds.add(profile.locationId);
  }
  if (manifest.profiles.length * samplesPerProfile * 2 !== binary.byteLength) {
    throw new Error('Earth terrain horizon binary length does not match its profiles.');
  }
  for (let byteOffset = 0; byteOffset < binary.byteLength; byteOffset += 2) {
    const value = binary.readInt16LE(byteOffset);

    if (value < 0 || value > 9_000) {
      throw new Error(`Invalid obstruction angle at byte offset ${byteOffset}.`);
    }
  }

  return true;
}

export async function formatTerrainHorizonManifest(manifest) {
  return format(`${JSON.stringify(manifest)}\n`, { parser: 'json', printWidth: 100 });
}

export function sourceDataUrlForInput(input) {
  return /^https?:\/\//u.test(input) ? input : DEFAULT_SOURCE_URL;
}

export function pixelCoordinateForGeographicPoint(imageMetadata, latitude, longitude) {
  assertLatitude(latitude);
  assertLongitude(longitude);
  const normalizedLongitude = normalizeLongitude(longitude);
  const x = (normalizedLongitude - imageMetadata.originX) / imageMetadata.resolutionX - 0.5;
  const y = (latitude - imageMetadata.originY) / imageMetadata.resolutionY - 0.5;

  return { x, y };
}

export async function createEtopoLocationSampler(image, location, radiusMeters) {
  const metadata = imageMetadata(image);
  validateEtopoImageMetadata(metadata);
  const angularRadiusDegrees = radiansToDegrees(radiusMeters / MEAN_EARTH_RADIUS_METERS);
  const maximumAbsoluteLatitude = Math.min(
    89.9,
    Math.abs(location.latitude) + angularRadiusDegrees,
  );
  const longitudeRadiusDegrees = Math.min(
    180,
    angularRadiusDegrees / Math.max(0.01, Math.cos(degreesToRadians(maximumAbsoluteLatitude))),
  );
  const centerPixel = pixelCoordinateForGeographicPoint(
    metadata,
    location.latitude,
    location.longitude,
  );
  const horizontalRadiusPixels = Math.ceil(longitudeRadiusDegrees / metadata.resolutionX) + 2;
  const verticalRadiusPixels = Math.ceil(angularRadiusDegrees / Math.abs(metadata.resolutionY)) + 2;
  const minimumUnwrappedX = Math.floor(centerPixel.x) - horizontalRadiusPixels;
  const maximumUnwrappedX = Math.ceil(centerPixel.x) + horizontalRadiusPixels + 1;
  const minimumY = Math.max(0, Math.floor(centerPixel.y) - verticalRadiusPixels);
  const maximumY = Math.min(metadata.height, Math.ceil(centerPixel.y) + verticalRadiusPixels + 1);
  const localWidth = maximumUnwrappedX - minimumUnwrappedX;
  const localHeight = maximumY - minimumY;
  const values = new Float64Array(localWidth * localHeight);
  const segments = wrappedPixelSegments(minimumUnwrappedX, maximumUnwrappedX, metadata.width);

  for (const segment of segments) {
    const raster = await image.readRasters({
      window: [segment.sourceStartX, minimumY, segment.sourceEndX, maximumY],
      interleave: true,
    });
    const sourceWidth = segment.sourceEndX - segment.sourceStartX;

    for (let row = 0; row < localHeight; row += 1) {
      const sourceOffset = row * sourceWidth;
      const destinationOffset = row * localWidth + segment.destinationStartX;

      values.set(raster.subarray(sourceOffset, sourceOffset + sourceWidth), destinationOffset);
    }
  }

  return (latitude, longitude) => {
    const globalPixel = pixelCoordinateForGeographicPoint(metadata, latitude, longitude);
    const unwrappedX = unwrapPixelXNear(globalPixel.x, centerPixel.x, metadata.width);
    const localX = unwrappedX - minimumUnwrappedX;
    const localY = globalPixel.y - minimumY;

    return bilinearSample(values, localWidth, localHeight, localX, localY);
  };
}

export function wrappedPixelSegments(minimumUnwrappedX, maximumUnwrappedX, width) {
  const segments = [];
  let cursor = minimumUnwrappedX;

  while (cursor < maximumUnwrappedX) {
    const wrappedStart = modulo(cursor, width);
    const segmentWidth = Math.min(maximumUnwrappedX - cursor, width - wrappedStart);

    segments.push({
      sourceStartX: wrappedStart,
      sourceEndX: wrappedStart + segmentWidth,
      destinationStartX: cursor - minimumUnwrappedX,
    });
    cursor += segmentWidth;
  }

  return segments;
}

export function bilinearSample(values, width, height, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || width < 2 || height < 2) {
    return Number.NaN;
  }
  const clampedX = Math.min(width - 1, Math.max(0, x));
  const clampedY = Math.min(height - 1, Math.max(0, y));
  const x0 = Math.floor(clampedX);
  const y0 = Math.floor(clampedY);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const horizontalMix = clampedX - x0;
  const verticalMix = clampedY - y0;
  const top = mix(values[y0 * width + x0], values[y0 * width + x1], horizontalMix);
  const bottom = mix(values[y1 * width + x0], values[y1 * width + x1], horizontalMix);

  return mix(top, bottom, verticalMix);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const locationSource = await readFile(options.locationInput, 'utf8');
  const locations = parseEarthObserverLocationSource(locationSource);
  const tiff = /^https?:\/\//u.test(options.input)
    ? await fromUrl(options.input)
    : await fromFile(options.input);
  const image = await tiff.getImage();
  const records = [];

  for (const [index, location] of locations.entries()) {
    const sampleElevation = await createEtopoLocationSampler(
      image,
      location,
      MAXIMUM_DISTANCE_METERS + SAMPLE_STEP_METERS,
    );

    records.push(buildTerrainHorizonRecord(location, sampleElevation));
    if ((index + 1) % 10 === 0 || index + 1 === locations.length) {
      console.log(`Terrain horizons: ${index + 1}/${locations.length}`);
    }
  }

  const { manifest, binary } = createTerrainHorizonArtifacts(locations, records, {
    generatedAt: options.generatedAt,
    sourceUrl: sourceDataUrlForInput(options.input),
  });

  await mkdir(dirname(options.manifestOutput), { recursive: true });
  await mkdir(dirname(options.binaryOutput), { recursive: true });
  await writeFile(options.manifestOutput, await formatTerrainHorizonManifest(manifest));
  await writeFile(options.binaryOutput, binary);
  console.log(
    `Wrote ${manifest.profileCount} ETOPO terrain horizons (${binary.byteLength} bytes).`,
  );
}

function parseArguments(arguments_) {
  const options = {
    input: DEFAULT_SOURCE_URL,
    locationInput: DEFAULT_LOCATION_INPUT,
    manifestOutput: DEFAULT_MANIFEST_OUTPUT,
    binaryOutput: DEFAULT_BINARY_OUTPUT,
    generatedAt: undefined,
  };

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    const value = arguments_[index + 1];

    if (argument === '--input' && value) {
      options.input = value;
      index += 1;
    } else if (argument === '--locations' && value) {
      options.locationInput = resolve(value);
      index += 1;
    } else if (argument === '--manifest' && value) {
      options.manifestOutput = resolve(value);
      index += 1;
    } else if (argument === '--binary' && value) {
      options.binaryOutput = resolve(value);
      index += 1;
    } else if (argument === '--generated-at' && value) {
      options.generatedAt = value;
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete argument: ${argument}`);
    }
  }

  return options;
}

function imageMetadata(image) {
  const [originX, originY] = image.getOrigin();
  const [resolutionX, resolutionY] = image.getResolution();

  return {
    width: image.getWidth(),
    height: image.getHeight(),
    originX,
    originY,
    resolutionX,
    resolutionY,
  };
}

function validateEtopoImageMetadata(metadata) {
  if (
    metadata.width !== 21_600 ||
    metadata.height !== 10_800 ||
    Math.abs(metadata.originX + 180) > 1e-8 ||
    Math.abs(metadata.originY - 90) > 1e-8 ||
    Math.abs(metadata.resolutionX - 1 / 60) > 1e-8 ||
    Math.abs(metadata.resolutionY + 1 / 60) > 1e-8
  ) {
    throw new Error('The input is not the expected global ETOPO 2022 60 arc-second grid.');
  }
}

function unwrapPixelXNear(pixelX, centerPixelX, width) {
  const turns = Math.round((centerPixelX - pixelX) / width);

  return pixelX + turns * width;
}

function mix(first, second, amount) {
  return first + (second - first) * amount;
}

function round(value, fractionDigits) {
  const factor = 10 ** fractionDigits;

  return Math.round(value * factor) / factor;
}

function assertLocation(location) {
  if (!location || typeof location.id !== 'string' || !location.id) {
    throw new Error('Terrain horizon location id is required.');
  }
  assertLatitude(location.latitude);
  assertLongitude(location.longitude);
}

function assertLatitude(value) {
  if (!Number.isFinite(value) || value < -90 || value > 90) {
    throw new RangeError('Latitude must be between -90 and 90 degrees.');
  }
}

function assertLongitude(value) {
  if (!Number.isFinite(value) || value < -180 || value > 180) {
    throw new RangeError('Longitude must be between -180 and 180 degrees.');
  }
}

function assertAzimuthStep(value) {
  if (!Number.isInteger(value) || value <= 0 || 360 % value !== 0) {
    throw new RangeError('azimuthStepDegrees must be a positive integer divisor of 360.');
  }
}

function assertDistanceBands(distanceBands, maximumDistanceMeters) {
  const expectedIds = ['near', 'mid', 'far'];

  if (!Array.isArray(distanceBands) || distanceBands.length !== expectedIds.length) {
    throw new RangeError('Terrain distance bands must contain near, mid, and far ranges.');
  }
  let previousMaximum = 0;

  for (const [index, band] of distanceBands.entries()) {
    if (
      band?.id !== expectedIds[index] ||
      !Number.isFinite(band.minimumDistanceMeters) ||
      !Number.isFinite(band.maximumDistanceMeters) ||
      band.minimumDistanceMeters !== previousMaximum ||
      band.maximumDistanceMeters <= band.minimumDistanceMeters
    ) {
      throw new RangeError(`Invalid terrain distance band at index ${index}.`);
    }
    previousMaximum = band.maximumDistanceMeters;
  }
  if (previousMaximum !== maximumDistanceMeters) {
    throw new RangeError('Terrain distance bands must cover the maximum sampling distance.');
  }
}

function assertPositiveNumber(value, name) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number.`);
  }
}

function assertFiniteNumber(value, name) {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be a finite number.`);
  }
}

function clampedAngleCentidegrees(angleDegrees) {
  return Math.min(9_000, Math.max(0, Math.round(angleDegrees * 100)));
}

function normalizeLongitude(value) {
  const normalized = modulo(value + 180, 360) - 180;

  return normalized === -180 && value > 0 ? 180 : normalized;
}

function modulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function degreesToRadians(value) {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value) {
  return (value * 180) / Math.PI;
}
