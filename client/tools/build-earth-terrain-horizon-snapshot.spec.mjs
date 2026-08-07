import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parseEarthObserverLocationSource } from './build-earth-landmark-snapshot.mjs';
import {
  MEAN_EARTH_RADIUS_METERS,
  TERRAIN_DISTANCE_BANDS,
  bilinearSample,
  buildTerrainHorizonRecord,
  createTerrainHorizonArtifacts,
  formatTerrainHorizonManifest,
  pixelCoordinateForGeographicPoint,
  sourceDataUrlForInput,
  sphericalDestination,
  terrainDistanceBandIndex,
  terrainElevationAngleDegrees,
  validateTerrainHorizonArtifacts,
  wrappedPixelSegments,
} from './build-earth-terrain-horizon-snapshot.mjs';

const PARIS = {
  id: 'paris',
  name: 'Paris',
  countryCode: 'FR',
  latitude: 48.8566,
  longitude: 2.3522,
  timeZone: 'Europe/Paris',
  population: 2_138_551,
  capital: true,
};
const FIVE_KILOMETRE_DISTANCE_BANDS = [
  { id: 'near', minimumDistanceMeters: 0, maximumDistanceMeters: 2_000 },
  { id: 'mid', minimumDistanceMeters: 2_000, maximumDistanceMeters: 4_000 },
  { id: 'far', minimumDistanceMeters: 4_000, maximumDistanceMeters: 5_000 },
];

test('uses the spherical line of sight including Earth curvature', () => {
  const distanceMeters = 100_000;
  const exactAngle = terrainElevationAngleDegrees(0, 0, distanceMeters);
  const independentSmallAngleApproximationRadians =
    -distanceMeters / (2 * MEAN_EARTH_RADIUS_METERS);

  assert.ok(exactAngle < 0);
  assert.ok(
    Math.abs(exactAngle - radiansToDegrees(independentSmallAngleApproximationRadians)) < 0.001,
  );
  assert.ok(terrainElevationAngleDegrees(2, 1_000, 10_000) > 5.6);
  assert.throws(() => terrainElevationAngleDegrees(0, 0, 0), /positive/u);
});

test('moves one angular degree north and wraps longitude on the sphere', () => {
  const oneDegreeDistance = (Math.PI * MEAN_EARTH_RADIUS_METERS) / 180;
  const north = sphericalDestination({ latitude: 0, longitude: 0 }, 0, oneDegreeDistance);
  const dateline = sphericalDestination({ latitude: 0, longitude: 179.5 }, 90, oneDegreeDistance);

  assert.ok(Math.abs(north.latitude - 1) < 1e-10);
  assert.ok(Math.abs(north.longitude) < 1e-10);
  assert.ok(Math.abs(dateline.longitude + 179.5) < 1e-10);
  assert.throws(
    () => sphericalDestination({ latitude: 91, longitude: 0 }, 0, oneDegreeDistance),
    /Latitude/u,
  );
});

test('builds deterministic non-negative terrain obstruction samples', () => {
  const record = buildTerrainHorizonRecord(
    PARIS,
    (latitude, longitude) => (latitude > PARIS.latitude && longitude > 2 ? 500 : 35),
    {
      azimuthStepDegrees: 90,
      maximumDistanceMeters: 5_000,
      sampleStepMeters: 1_000,
      observerEyeHeightMeters: 2,
      distanceBands: FIVE_KILOMETRE_DISTANCE_BANDS,
    },
  );

  assert.equal(record.observerElevationMeters, 37);
  assert.deepEqual([...record.obstructionAnglesCentidegrees], [2_484, 0, 0, 0]);
  assert.equal(record.distanceLayers.length, 3);
  assert.equal(record.distanceLayers[0].obstructionAnglesCentidegrees[0], 2_484);
  assert.ok(
    record.distanceLayers[0].obstructionAnglesCentidegrees[0] >
      record.distanceLayers[1].obstructionAnglesCentidegrees[0],
  );
  assert.ok(
    record.distanceLayers[1].obstructionAnglesCentidegrees[0] >
      record.distanceLayers[2].obstructionAnglesCentidegrees[0],
  );
  assert.throws(
    () =>
      buildTerrainHorizonRecord(PARIS, () => 0, {
        azimuthStepDegrees: 7,
        maximumDistanceMeters: 1_000,
        distanceBands: FIVE_KILOMETRE_DISTANCE_BANDS,
      }),
    /divisor/u,
  );
});

test('assigns every sampled distance to one contiguous rendering band', () => {
  assert.equal(terrainDistanceBandIndex(1, TERRAIN_DISTANCE_BANDS), 0);
  assert.equal(terrainDistanceBandIndex(29_999, TERRAIN_DISTANCE_BANDS), 0);
  assert.equal(terrainDistanceBandIndex(30_000, TERRAIN_DISTANCE_BANDS), 1);
  assert.equal(terrainDistanceBandIndex(100_000, TERRAIN_DISTANCE_BANDS), 2);
  assert.equal(terrainDistanceBandIndex(300_000, TERRAIN_DISTANCE_BANDS), 2);
  assert.equal(terrainDistanceBandIndex(300_001, TERRAIN_DISTANCE_BANDS), -1);
});

test('packs profiles as little-endian centidegrees with a verified checksum', async () => {
  const samples = new Int16Array(360);
  samples[0] = 123;
  samples[359] = 456;
  const { manifest, binary } = createTerrainHorizonArtifacts(
    [PARIS],
    [
      {
        locationId: PARIS.id,
        latitude: PARIS.latitude,
        longitude: PARIS.longitude,
        observerElevationMeters: 37,
        distanceLayers: distanceLayers(samples),
        obstructionAnglesCentidegrees: samples,
      },
    ],
    { generatedAt: '2026-08-26T00:00:00.000Z', sourceUrl: 'fixture.tif' },
  );

  assert.equal(manifest.profileCount, 1);
  assert.equal(manifest.profiles[0].sampleOffset, 0);
  assert.equal(manifest.profiles[0].sampleCount, 360);
  assert.deepEqual(manifest.calculation.distanceBands, TERRAIN_DISTANCE_BANDS);
  assert.equal(binary.readInt16LE(0), 123);
  assert.equal(binary.readInt16LE(718), 456);
  assert.equal(binary.byteLength, 2_160);
  assert.equal(validateTerrainHorizonArtifacts(manifest, binary, [PARIS]), true);
  assert.match(
    await formatTerrainHorizonManifest(manifest),
    /universe-map\/earth-terrain-horizons/u,
  );

  const corrupt = Buffer.from(binary);
  corrupt.writeInt16LE(-1, 0);
  assert.throws(
    () => validateTerrainHorizonArtifacts(manifest, corrupt, [PARIS]),
    /metadata|obstruction/u,
  );
  assert.throws(() => createTerrainHorizonArtifacts([PARIS], [], {}), /one terrain horizon/u);
});

test('keeps the public NOAA source URL when generation uses a local cache', () => {
  const remote = 'https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO2022/data/60s/example.tif';

  assert.equal(sourceDataUrlForInput(remote), remote);
  assert.match(
    sourceDataUrlForInput('/private/tmp/etopo.tif'),
    /^https:\/\/www\.ngdc\.noaa\.gov\//u,
  );
});

test('validates the committed 461-location ETOPO snapshot', async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL('../public/data/earth-terrain-horizons/etopo-2022-60s.json', import.meta.url),
      'utf8',
    ),
  );
  const binary = await readFile(
    new URL('../public/data/earth-terrain-horizons/etopo-2022-60s.bin', import.meta.url),
  );
  const locationSource = await readFile(
    new URL('../src/engine/simulation/earth-observer-locations.data.ts', import.meta.url),
    'utf8',
  );
  const locations = parseEarthObserverLocationSource(locationSource);

  assert.equal(locations.length, 461);
  assert.equal(manifest.profileCount, locations.length);
  assert.match(manifest.source.dataUrl, /^https:\/\/www\.ngdc\.noaa\.gov\//u);
  assert.equal(validateTerrainHorizonArtifacts(manifest, binary, locations), true);
});

test('maps geographic coordinates to pixel centers and splits dateline windows', () => {
  const metadata = {
    width: 21_600,
    height: 10_800,
    originX: -180,
    originY: 90,
    resolutionX: 1 / 60,
    resolutionY: -1 / 60,
  };

  const firstPixel = pixelCoordinateForGeographicPoint(
    metadata,
    89.99166666666666,
    -179.99166666666667,
  );

  assert.ok(Math.abs(firstPixel.x) < 1e-10);
  assert.ok(Math.abs(firstPixel.y) < 1e-10);
  assert.deepEqual(wrappedPixelSegments(-2, 3, 21_600), [
    { sourceStartX: 21_598, sourceEndX: 21_600, destinationStartX: 0 },
    { sourceStartX: 0, sourceEndX: 3, destinationStartX: 2 },
  ]);
  assert.deepEqual(wrappedPixelSegments(21_598, 21_603, 21_600), [
    { sourceStartX: 21_598, sourceEndX: 21_600, destinationStartX: 0 },
    { sourceStartX: 0, sourceEndX: 3, destinationStartX: 2 },
  ]);
});

test('bilinearly interpolates a raster and rejects unusable grids', () => {
  const raster = new Float64Array([0, 10, 20, 30]);

  assert.equal(bilinearSample(raster, 2, 2, 0.5, 0.5), 15);
  assert.equal(bilinearSample(raster, 2, 2, -2, 3), 20);
  assert.equal(Number.isNaN(bilinearSample(raster, 1, 4, 0, 0)), true);
});

function radiansToDegrees(value) {
  return (value * 180) / Math.PI;
}

function distanceLayers(samples) {
  return TERRAIN_DISTANCE_BANDS.map((band, index) => ({
    ...band,
    obstructionAnglesCentidegrees: index === 0 ? samples : new Int16Array(samples.length),
  }));
}
