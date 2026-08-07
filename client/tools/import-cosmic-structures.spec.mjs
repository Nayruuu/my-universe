import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  COSMIC_STRUCTURE_CATALOG_HEADER_BYTES,
  COSMIC_STRUCTURE_CATALOG_RECORD_BYTES,
  COSMIC_STRUCTURE_CATALOG_VERSION,
  buildCosmicStructureCatalog,
  comovingDistanceMpc,
  encodeCosmicStructureCatalog,
  galacticToEquatorialSkyPosition,
  parseBossVoidLine,
  parseNamedCosmicLandmarks,
  parsePlanckPsz2Line,
  parseSuperclusterLine,
  parseTempelFilamentLine,
} from './import-cosmic-structures.mjs';

const SUPERCLUSTER_ROW =
  '239+027+0091       1      1038       114        8435.0      1098.055     1039.6157     1591.5995        21.635       0     239.631      27.187     264.525     240.250      25.849     262.579     50.2594      532367     239.583      27.233    0.091088     15.2205     0     0';
const VOID_ROW =
  'CMASS North    60 114.782 37.641 0.648     35 1.411e+05  32.298 2.486e-05 -0.717 3.922 3.220e-14  52.504';
const FILAMENT_ROW =
  '    1  50 24.79233  17  22  24.57267  40.0727  -129.6424 270.9492 -158.419  17.973  13.9086  6.473';
const PLANCK_ROW =
  '   1 PSZ2 G000.04+45.13   0.0405432  45.1351750 229.1905120  -1.0172220  4.107310  6.75319 2 111 0     1 0 0.938825   5.481591  1.899500  20 RXC J1516.5-0056           0.119800  3.962411 0.393290 0.370242 J1516.5-0056 RMJ151653.9-010506.3                                      -10 -1.00000e+03 1                                                                  ';

test('decodes documented SDSS DR7 supercluster fields and converts Mpc/h explicitly', () => {
  const record = parseSuperclusterLine(SUPERCLUSTER_ROW, 'main50', 1);

  assert.deepEqual(record, {
    identifier: '239+027+0091',
    catalogNumericId: 1,
    galaxyCount: 1038,
    rightAscensionDegrees: 240.25,
    declinationDegrees: 25.849,
    distanceMpcPerH: 262.579,
    diameterMpcPerH: 50.2594,
    confidence: 15.2205,
    surveyEdge: false,
  });
});

test('decodes documented BOSS DR12 robust void fields', () => {
  const record = parseBossVoidLine(VOID_ROW, 1);

  assert.deepEqual(record, {
    identifier: 'CMASS-North-60',
    sample: 'CMASS North',
    catalogNumericId: 60,
    rightAscensionDegrees: 114.782,
    declinationDegrees: 37.641,
    redshift: 0.648,
    galaxyCount: 35,
    radiusMpcPerH: 32.298,
    densityContrast: -0.717,
    poissonProbability: 3.22e-14,
    boundaryDistanceMpcPerH: 52.504,
  });
});

test('decodes the documented Tempel SDSS DR8 filament bounds', () => {
  const record = parseTempelFilamentLine(FILAMENT_ROW, 1);

  assert.deepEqual(record, {
    identifier: 'F1',
    catalogNumericId: 1,
    pointCount: 50,
    lengthMpcPerH: 24.79233,
    galaxyCountHalfMpc: 17,
    galaxyCountOneMpc: 22,
    minimumMpcPerH: [-129.6424, 270.9492, -158.419],
    extentMpcPerH: [17.973, 13.9086, 6.473],
  });
});

test('decodes a positionable Planck PSZ2 cluster detection', () => {
  const record = parsePlanckPsz2Line(PLANCK_ROW, 1);

  assert.deepEqual(record, {
    identifier: 'PSZ2 G000.04+45.13',
    catalogNumericId: 1,
    rightAscensionDegrees: 229.190512,
    declinationDegrees: -1.017222,
    positionUncertaintyArcminutes: 4.10731,
    signalToNoise: 6.75319,
    neuralQuality: 0.938825,
    validationStatus: 20,
    redshift: 0.1198,
    massProxySolarMasses: 3.962411e14,
  });
  assert.equal(parsePlanckPsz2Line(replaceField(PLANCK_ROW, 168, 176, '0'), 2), null);
});

test('rejects blank, truncated, unknown, and non-physical source records', () => {
  assert.equal(parseSuperclusterLine('  ', 'main50', 2), null);
  assert.equal(parseBossVoidLine(' ', 2), null);
  assert.equal(parseTempelFilamentLine(' ', 2), null);
  assert.equal(parsePlanckPsz2Line(' ', 2), null);
  assert.throws(() => parseSuperclusterLine('short', 'main50', 3), /truncated/);
  assert.throws(() => parseSuperclusterLine(SUPERCLUSTER_ROW, 'unknown', 4), /Unknown/);
  assert.throws(() => parseBossVoidLine('short', 5), /truncated/);
  assert.throws(() => parseTempelFilamentLine('short', 5), /truncated/);
  assert.throws(() => parsePlanckPsz2Line('short', 5), /truncated/);
  assert.throws(
    () => parseBossVoidLine(replaceField(VOID_ROW, 34, 38, '-1'), 6),
    /invalid numeric fields/,
  );
});

test('matches an independent flat-Lambda-CDM comoving-distance reference', () => {
  // Ned Wright/NED-style calculator, H0=70 km/s/Mpc, Omega_m=0.3, Omega_Lambda=0.7.
  assert.ok(Math.abs(comovingDistanceMpc(0.5) - 1888.625) < 0.01);
  assert.equal(comovingDistanceMpc(0), 0);
  assert.throws(() => comovingDistanceMpc(-0.1), /redshift/);
});

test('matches the independent IAU J2000 galactic-to-equatorial reference', () => {
  const galacticCenter = galacticToEquatorialSkyPosition(0, 0);

  // IAU Galactic-centre direction in the ICRS/J2000 system.
  assert.ok(Math.abs(galacticCenter.rightAscensionDegrees - 266.404995) < 0.000001);
  assert.ok(Math.abs(galacticCenter.declinationDegrees - -28.936174) < 0.000001);
  assert.throws(() => galacticToEquatorialSkyPosition(361, 0), /galactic longitude/);
  assert.throws(() => galacticToEquatorialSkyPosition(0, 91), /galactic latitude/);
});

test('normalizes documented named landmarks without turning them into Tempel filaments', () => {
  const catalog = parseNamedCosmicLandmarks({
    version: '1.0.0',
    cosmology: {
      hubbleConstantKmPerSecondPerMpc: 70,
      reducedHubbleParameter: 0.7,
    },
    sources: [
      {
        id: 'reference-basins',
        name: 'Reference basins',
        citation: 'Reference et al. (2026)',
        sourceUrl: 'https://example.org/reference',
        structureType: 'basin',
        scientificConfidence: 'calculated',
        method: 'Probabilistic basin reconstruction',
        objectNamePrefix: 'Bassin',
        confidenceMeaning: 'Intrinsic basin-existence probability',
        extentMeaning: 'Equivalent spherical radius derived from the published volume',
        mapPriority: 'landmark',
        records: [
          {
            identifier: 'reference-basin',
            name: 'Reference Basin',
            aliases: ['RB'],
            catalogNumericId: 1,
            rightAscensionDegrees: 195.9,
            declinationDegrees: -0.4,
            recessionVelocityKmPerSecond: 24_909,
            volumeMillionCubicMpcPerH3: 15.51,
            confidence: 0.99,
          },
        ],
      },
    ],
  });
  const [record] = catalog.records;
  const [source] = catalog.sources;

  assert.equal(record.structureType, 'basin');
  assert.equal(record.distanceMpc, 24_909 / 70);
  assert.ok(Math.abs(record.radiusMpc - 221.008862581) < 0.000001);
  assert.ok(Math.abs(Math.hypot(...record.positionMpc) - record.distanceMpc) < 1e-9);
  assert.equal(record.flags, 128);
  assert.equal(source.recordNames['reference-basin'], 'Reference Basin');
  assert.deepEqual(source.recordAliases['reference-basin'], ['RB']);
  assert.equal(source.recordCount, 1);
  assert.equal(source.layout, 'named-landmark');
});

test('ships published walls, basins, attractors, and repellers with explicit provenance', async () => {
  const sourceDocument = JSON.parse(
    await readFile(resolve('data-sources/named-cosmic-landmarks.json'), 'utf8'),
  );
  const catalog = parseNamedCosmicLandmarks(sourceDocument);
  const counts = Object.groupBy(catalog.records, ({ structureType }) => structureType);
  const valadeSource = sourceDocument.sources.find(({ id }) => id === 'valade-2024-pboa');
  const sloanBasin = valadeSource.records.find(
    ({ identifier }) => identifier === 'sloan-great-wall-basin',
  );

  assert.deepEqual(
    Object.fromEntries(
      Object.entries(counts).map(([structureType, records]) => [structureType, records.length]),
    ),
    { wall: 2, basin: 15, attractor: 1, repeller: 2 },
  );
  // Valade et al. (2024), Table 2: core sky position, cz, volume and p-BoA probability.
  assert.deepEqual(
    {
      rightAscensionDegrees: sloanBasin.rightAscensionDegrees,
      declinationDegrees: sloanBasin.declinationDegrees,
      recessionVelocityKmPerSecond: sloanBasin.recessionVelocityKmPerSecond,
      volumeMillionCubicMpcPerH3: sloanBasin.volumeMillionCubicMpcPerH3,
      confidence: sloanBasin.confidence,
    },
    {
      rightAscensionDegrees: 195.9,
      declinationDegrees: -0.4,
      recessionVelocityKmPerSecond: 24_909,
      volumeMillionCubicMpcPerH3: 15.51,
      confidence: 0.99,
    },
  );
  assert.ok(catalog.sources.every(({ sourceUrl }) => sourceUrl.startsWith('https://')));
  assert.ok(catalog.sources.every(({ mapPriority }) => mapPriority === 'landmark'));
});

test('preserves catalogue detections, source identity, and scientific radii', () => {
  const catalog = buildCosmicStructureCatalog([
    { sourceId: 'sdss-dr7-main50', layout: 'main50', lines: [SUPERCLUSTER_ROW] },
    { sourceId: 'boss-dr12-voids', layout: 'boss-void', lines: [VOID_ROW] },
    { sourceId: 'sdss-dr8-tempel-filaments', layout: 'tempel-filament', lines: [FILAMENT_ROW] },
    { sourceId: 'planck-psz2-clusters', layout: 'planck-psz2', lines: [PLANCK_ROW] },
  ]);

  assert.equal(catalog.records.length, 4);
  assert.equal(catalog.sources.length, 4);
  assert.deepEqual(
    catalog.records.map(({ structureType, sourceIndex, identifier }) => ({
      structureType,
      sourceIndex,
      identifier,
    })),
    [
      { structureType: 'supercluster', sourceIndex: 0, identifier: '239+027+0091' },
      { structureType: 'void', sourceIndex: 1, identifier: 'CMASS-North-60' },
      { structureType: 'filament', sourceIndex: 2, identifier: 'F1' },
      { structureType: 'cluster', sourceIndex: 3, identifier: 'PSZ2 G000.04+45.13' },
    ],
  );
  assert.ok(Math.abs(Math.hypot(...catalog.records[0].positionMpc) - 375.112857) < 0.001);
  assert.ok(Math.abs(catalog.records[0].radiusMpc - 35.899571) < 0.001);
  assert.ok(Math.abs(Math.hypot(...catalog.records[1].positionMpc) - 2352.287) < 0.02);
  assert.ok(Math.abs(Math.hypot(...catalog.records[2].positionMpc) - 486.281) < 0.02);
  assert.ok(Math.abs(catalog.records[2].radiusMpc - 17.7088) < 0.001);
  assert.ok(Math.abs(Math.hypot(...catalog.records[3].positionMpc) - 498.935) < 0.02);
  assert.equal(catalog.records[3].radiusMpc, 0);
  assert.equal(catalog.records[3].galaxyCount, 0);
});

test('encodes a deterministic self-describing catalogue with a UTF-8 identifier table', () => {
  const catalog = buildCosmicStructureCatalog([
    { sourceId: 'sdss-dr7-main50', layout: 'main50', lines: [SUPERCLUSTER_ROW] },
    { sourceId: 'boss-dr12-voids', layout: 'boss-void', lines: [VOID_ROW] },
  ]);
  const binary = encodeCosmicStructureCatalog(catalog.records, catalog.sources.length);
  const firstRecordOffset = COSMIC_STRUCTURE_CATALOG_HEADER_BYTES;
  const stringTableOffset =
    COSMIC_STRUCTURE_CATALOG_HEADER_BYTES +
    catalog.records.length * COSMIC_STRUCTURE_CATALOG_RECORD_BYTES;

  assert.equal(binary.toString('ascii', 0, 4), 'UMCS');
  assert.equal(binary.readUInt16LE(4), COSMIC_STRUCTURE_CATALOG_VERSION);
  assert.equal(binary.readUInt16LE(6), COSMIC_STRUCTURE_CATALOG_HEADER_BYTES);
  assert.equal(binary.readUInt16LE(8), COSMIC_STRUCTURE_CATALOG_RECORD_BYTES);
  assert.equal(binary.readUInt32LE(12), 2);
  assert.equal(binary.readUInt16LE(16), 2);
  assert.equal(binary.readDoubleLE(20), 2_451_545);
  assert.equal(binary.readUInt16LE(firstRecordOffset + 42), 0);
  assert.equal(binary.readUInt8(firstRecordOffset + 44), 1);
  assert.equal(
    binary.toString(
      'utf8',
      stringTableOffset,
      stringTableOffset + binary.readUInt16LE(firstRecordOffset + 40),
    ),
    '239+027+0091',
  );
});

test('ships every record from the selected public catalogues', async () => {
  const binary = await readFile(resolve('public/data/structures/cosmic-structures.bin'));
  const metadata = JSON.parse(
    await readFile(resolve('public/data/structures/cosmic-structures.json'), 'utf8'),
  );

  assert.equal(binary.toString('ascii', 0, 4), 'UMCS');
  assert.equal(metadata.version, '1.1.0');
  assert.equal(binary.readUInt32LE(12), 26_520);
  assert.equal(metadata.recordCount, 26_520);
  assert.equal(metadata.sources.length, 13);
  assert.equal(
    metadata.sources.reduce((count, source) => count + source.recordCount, 0),
    26_520,
  );
  assert.deepEqual(metadata.structureCounts, {
    supercluster: 8_757,
    void: 1_228,
    filament: 15_421,
    cluster: 1_094,
    wall: 2,
    basin: 15,
    attractor: 1,
    repeller: 2,
  });
});

function replaceField(line, start, end, replacement) {
  return `${line.slice(0, start - 1)}${replacement.padStart(end - start + 1)}${line.slice(end)}`;
}
