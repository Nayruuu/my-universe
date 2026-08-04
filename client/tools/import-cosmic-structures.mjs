import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { gunzip } from 'node:zlib';

export const COSMIC_STRUCTURE_CATALOG_VERSION = 1;
export const COSMIC_STRUCTURE_CATALOG_HEADER_BYTES = 48;
export const COSMIC_STRUCTURE_CATALOG_RECORD_BYTES = 48;

const gunzipAsync = promisify(gunzip);
const REFERENCE_EPOCH_JULIAN_DAY = 2_451_545;
const EQUATORIAL_CARTESIAN_FRAME = 1;
const SPEED_OF_LIGHT_KM_PER_SECOND = 299_792.458;
const HUBBLE_CONSTANT_KM_PER_SECOND_PER_MPC = 70;
const HUBBLE_REDUCED_PARAMETER = 0.7;
const MATTER_DENSITY = 0.3;
const DARK_ENERGY_DENSITY = 0.7;
const INTEGRATION_INTERVALS = 512;

const DEFAULT_OUTPUT = resolve('public/data/structures/cosmic-structures.bin');
const DEFAULT_METADATA_OUTPUT = resolve('public/data/structures/cosmic-structures.json');

const SOURCE_DEFINITIONS = [
  {
    id: 'sdss-dr7-main50',
    input: resolve('data-sources/sdss-dr7-superclusters-main50.dat.gz'),
    layout: 'main50',
    name: 'SDSS DR7 Main D=5.0 superclusters',
    citation: 'Liivamägi, Tempel & Saar (2012), A&A 539, A80',
    sourceUrl: 'https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/539/A80',
    structureType: 'supercluster',
    method: 'B3-spline luminosity-density field with a fixed 5.0 mean-density threshold',
    objectNamePrefix: 'Superamas SDSS',
  },
  {
    id: 'sdss-dr7-main-adaptive',
    input: resolve('data-sources/sdss-dr7-superclusters-mainadap.dat.gz'),
    layout: 'mainadap',
    name: 'SDSS DR7 Main adaptive superclusters',
    citation: 'Liivamägi, Tempel & Saar (2012), A&A 539, A80',
    sourceUrl: 'https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/539/A80',
    structureType: 'supercluster',
    method: 'B3-spline luminosity-density field with adaptive local thresholds',
    objectNamePrefix: 'Superamas SDSS adaptatif',
  },
  {
    id: 'sdss-dr7-lrg44',
    input: resolve('data-sources/sdss-dr7-superclusters-lrg44.dat.gz'),
    layout: 'lrg44',
    name: 'SDSS DR7 LRG D=4.4 superclusters',
    citation: 'Liivamägi, Tempel & Saar (2012), A&A 539, A80',
    sourceUrl: 'https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/539/A80',
    structureType: 'supercluster',
    method: 'LRG B3-spline luminosity-density field with a fixed 4.4 threshold',
    objectNamePrefix: 'Superamas SDSS LRG',
  },
  {
    id: 'sdss-dr7-lrg-adaptive',
    input: resolve('data-sources/sdss-dr7-superclusters-lrgadap.dat.gz'),
    layout: 'lrgadap',
    name: 'SDSS DR7 LRG adaptive superclusters',
    citation: 'Liivamägi, Tempel & Saar (2012), A&A 539, A80',
    sourceUrl: 'https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/539/A80',
    structureType: 'supercluster',
    method: 'LRG B3-spline luminosity-density field with adaptive local thresholds',
    objectNamePrefix: 'Superamas SDSS LRG adaptatif',
  },
  {
    id: 'boss-dr12-voids',
    input: resolve('data-sources/boss-dr12-voids-table1.dat.gz'),
    layout: 'boss-void',
    name: 'BOSS DR12 robust cosmic voids',
    citation: 'Mao et al. (2017), ApJ 835, 161',
    sourceUrl: 'https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/835/161',
    structureType: 'void',
    method: 'ZOBOV watershed void finder after published robustness quality cuts',
    objectNamePrefix: 'Vide cosmique BOSS',
  },
  {
    id: 'sdss-dr8-tempel-filaments',
    input: resolve('data-sources/sdss-dr8-filaments-table1.dat.gz'),
    layout: 'tempel-filament',
    name: 'SDSS DR8 Bisous cosmic filaments',
    citation: 'Tempel et al. (2014), MNRAS 438, 3465',
    sourceUrl: 'https://cdsarc.cds.unistra.fr/viz-bin/cat/J/MNRAS/438/3465',
    structureType: 'filament',
    method: 'Three-dimensional Bisous marked point-process filament finder',
    objectNamePrefix: 'Filament SDSS',
  },
  {
    id: 'planck-psz2-clusters',
    input: resolve('data-sources/planck-psz2.dat.gz'),
    layout: 'planck-psz2',
    name: 'Planck PSZ2 redshift-positioned galaxy clusters',
    citation: 'Planck Collaboration (2016), A&A 594, A27',
    sourceUrl: 'https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/594/A27',
    structureType: 'cluster',
    method: 'Multi-pipeline Sunyaev-Zeldovich detection with an external redshift counterpart',
    objectNamePrefix: 'Amas Planck',
  },
];

const SUPERCLUSTER_LAYOUTS = {
  main50: {
    minimumLength: 274,
    galaxyCount: [27, 30],
    rightAscension: [160, 166],
    declination: [173, 178],
    distance: [184, 190],
    diameter: [195, 202],
    confidence: [256, 262],
    edge: [268, 268],
  },
  mainadap: {
    minimumLength: 284,
    galaxyCount: [37, 40],
    rightAscension: [170, 176],
    declination: [183, 188],
    distance: [194, 200],
    diameter: [205, 212],
    confidence: [266, 272],
    edge: [278, 278],
  },
  lrg44: {
    minimumLength: 264,
    galaxyCount: [27, 30],
    rightAscension: [150, 156],
    declination: [163, 168],
    distance: [173, 180],
    diameter: [185, 192],
    confidence: [246, 252],
    edge: [258, 258],
  },
  lrgadap: {
    minimumLength: 274,
    galaxyCount: [37, 40],
    rightAscension: [160, 166],
    declination: [173, 178],
    distance: [183, 190],
    diameter: [195, 202],
    confidence: [256, 262],
    edge: [268, 268],
  },
};

const STRUCTURE_TYPE_CODES = {
  cluster: 0,
  supercluster: 1,
  wall: 2,
  filament: 3,
  void: 4,
  basin: 5,
  attractor: 6,
  repeller: 7,
};

export function parseSuperclusterLine(line, layoutId, lineNumber) {
  if (!line.trim()) {
    return null;
  }
  const layout = SUPERCLUSTER_LAYOUTS[layoutId];

  if (!layout) {
    throw new Error(`Unknown SDSS supercluster layout: ${layoutId}.`);
  }
  if (line.length < layout.minimumLength) {
    throw new Error(`SDSS supercluster row ${lineNumber} is truncated.`);
  }
  const record = {
    identifier: field(line, 1, 12),
    catalogNumericId: integerField(line, 16, 20),
    galaxyCount: integerField(line, ...layout.galaxyCount),
    rightAscensionDegrees: numberField(line, ...layout.rightAscension),
    declinationDegrees: numberField(line, ...layout.declination),
    distanceMpcPerH: numberField(line, ...layout.distance),
    diameterMpcPerH: numberField(line, ...layout.diameter),
    confidence: numberField(line, ...layout.confidence),
    surveyEdge: integerField(line, ...layout.edge) === 1,
  };

  if (
    !record.identifier ||
    !Number.isInteger(record.catalogNumericId) ||
    record.catalogNumericId <= 0 ||
    !Number.isInteger(record.galaxyCount) ||
    record.galaxyCount <= 0 ||
    !validSkyPosition(record.rightAscensionDegrees, record.declinationDegrees) ||
    !positiveFinite(record.distanceMpcPerH) ||
    !nonNegativeFinite(record.diameterMpcPerH) ||
    !Number.isFinite(record.confidence) ||
    record.confidence < 0
  ) {
    throw new Error(`SDSS supercluster row ${lineNumber} has invalid numeric fields.`);
  }

  return record;
}

export function parseBossVoidLine(line, lineNumber) {
  if (!line.trim()) {
    return null;
  }
  if (line.length < 104) {
    throw new Error(`BOSS void row ${lineNumber} is truncated.`);
  }
  const sample = field(line, 1, 11);
  const catalogNumericId = integerField(line, 13, 17);
  const record = {
    identifier: `${sample.replaceAll(' ', '-')}-${catalogNumericId}`,
    sample,
    catalogNumericId,
    rightAscensionDegrees: numberField(line, 19, 25),
    declinationDegrees: numberField(line, 27, 32),
    redshift: numberField(line, 34, 38),
    galaxyCount: integerField(line, 40, 45),
    radiusMpcPerH: numberField(line, 57, 63),
    densityContrast: numberField(line, 75, 80),
    poissonProbability: numberField(line, 88, 96),
    boundaryDistanceMpcPerH: numberField(line, 98, 104),
  };

  if (
    !sample ||
    !Number.isInteger(record.catalogNumericId) ||
    record.catalogNumericId <= 0 ||
    !validSkyPosition(record.rightAscensionDegrees, record.declinationDegrees) ||
    !Number.isFinite(record.redshift) ||
    record.redshift <= 0 ||
    !Number.isInteger(record.galaxyCount) ||
    record.galaxyCount <= 0 ||
    !positiveFinite(record.radiusMpcPerH) ||
    !Number.isFinite(record.densityContrast) ||
    record.densityContrast >= 0 ||
    !Number.isFinite(record.poissonProbability) ||
    record.poissonProbability < 0 ||
    record.poissonProbability > 1 ||
    !positiveFinite(record.boundaryDistanceMpcPerH)
  ) {
    throw new Error(`BOSS void row ${lineNumber} has invalid numeric fields.`);
  }

  return record;
}

export function parseTempelFilamentLine(line, lineNumber) {
  if (!line.trim()) {
    return null;
  }
  if (line.length < 93) {
    throw new Error(`Tempel filament row ${lineNumber} is truncated.`);
  }
  const record = {
    identifier: `F${integerField(line, 1, 5)}`,
    catalogNumericId: integerField(line, 1, 5),
    pointCount: integerField(line, 7, 9),
    lengthMpcPerH: numberField(line, 11, 18),
    galaxyCountHalfMpc: integerField(line, 20, 22),
    galaxyCountOneMpc: integerField(line, 24, 26),
    minimumMpcPerH: [
      numberField(line, 48, 56),
      numberField(line, 58, 65),
      numberField(line, 67, 75),
    ],
    extentMpcPerH: [
      numberField(line, 77, 83),
      numberField(line, 85, 91),
      numberField(line, 93, 99),
    ],
  };

  if (
    !Number.isInteger(record.catalogNumericId) ||
    record.catalogNumericId <= 0 ||
    !Number.isInteger(record.pointCount) ||
    record.pointCount < 2 ||
    !positiveFinite(record.lengthMpcPerH) ||
    !Number.isInteger(record.galaxyCountHalfMpc) ||
    record.galaxyCountHalfMpc <= 0 ||
    !Number.isInteger(record.galaxyCountOneMpc) ||
    record.galaxyCountOneMpc < record.galaxyCountHalfMpc ||
    !record.minimumMpcPerH.every(Number.isFinite) ||
    !record.extentMpcPerH.every(positiveFinite)
  ) {
    throw new Error(`Tempel filament row ${lineNumber} has invalid numeric fields.`);
  }

  return record;
}

export function parsePlanckPsz2Line(line, lineNumber) {
  if (!line.trim()) {
    return null;
  }
  if (line.length < 204) {
    throw new Error(`Planck PSZ2 row ${lineNumber} is truncated.`);
  }
  const redshift = numberField(line, 168, 176);

  if (!positiveFinite(redshift)) {
    return null;
  }
  const record = {
    identifier: field(line, 6, 23),
    catalogNumericId: integerField(line, 1, 4),
    rightAscensionDegrees: numberField(line, 49, 59),
    declinationDegrees: numberField(line, 61, 71),
    positionUncertaintyArcminutes: numberField(line, 73, 81),
    signalToNoise: numberField(line, 83, 90),
    neuralQuality: numberField(line, 108, 115),
    validationStatus: integerField(line, 138, 140),
    redshift,
    massProxySolarMasses: numberField(line, 178, 186) * 1e14,
  };

  if (
    !record.identifier ||
    !Number.isInteger(record.catalogNumericId) ||
    record.catalogNumericId <= 0 ||
    !validSkyPosition(record.rightAscensionDegrees, record.declinationDegrees) ||
    !positiveFinite(record.positionUncertaintyArcminutes) ||
    !positiveFinite(record.signalToNoise) ||
    !Number.isFinite(record.neuralQuality) ||
    record.neuralQuality < 0 ||
    record.neuralQuality > 1 ||
    !Number.isInteger(record.validationStatus) ||
    record.validationStatus < 0 ||
    !nonNegativeFinite(record.massProxySolarMasses)
  ) {
    throw new Error(`Planck PSZ2 row ${lineNumber} has invalid numeric fields.`);
  }

  return record;
}

export function comovingDistanceMpc(redshift) {
  if (!Number.isFinite(redshift) || redshift < 0) {
    throw new Error(`Invalid cosmological redshift: ${redshift}.`);
  }
  if (redshift === 0) {
    return 0;
  }
  const intervalWidth = redshift / INTEGRATION_INTERVALS;
  let weightedSum = 0;

  for (let index = 0; index <= INTEGRATION_INTERVALS; index += 1) {
    const sampleRedshift = index * intervalWidth;
    const expansionRate = Math.sqrt(
      MATTER_DENSITY * (1 + sampleRedshift) ** 3 + DARK_ENERGY_DENSITY,
    );
    const weight = index === 0 || index === INTEGRATION_INTERVALS ? 1 : index % 2 === 0 ? 2 : 4;

    weightedSum += weight / expansionRate;
  }

  return (
    (SPEED_OF_LIGHT_KM_PER_SECOND / HUBBLE_CONSTANT_KM_PER_SECOND_PER_MPC) *
    ((weightedSum * intervalWidth) / 3)
  );
}

export function buildCosmicStructureCatalog(catalogInputs) {
  const records = [];
  const sources = [];

  for (const input of catalogInputs) {
    const source = SOURCE_DEFINITIONS.find(({ id }) => id === input.sourceId);

    if (!source || source.layout !== input.layout) {
      throw new Error(`Unknown or mismatched cosmic-structure source: ${input.sourceId}.`);
    }
    const sourceIndex = sources.length;
    const seenIdentifiers = new Set();

    sources.push({ ...source });
    for (let index = 0; index < input.lines.length; index += 1) {
      const parsed = parseCatalogLine(input.layout, input.lines[index], index + 1);

      if (!parsed) {
        continue;
      }
      if (seenIdentifiers.has(parsed.identifier)) {
        throw new Error(`Duplicate ${input.sourceId} identifier: ${parsed.identifier}.`);
      }
      seenIdentifiers.add(parsed.identifier);
      records.push(createCatalogRecord(input.layout, parsed, sourceIndex));
    }
  }
  if (records.length === 0) {
    throw new Error('Cosmic-structure catalogue contains no records.');
  }

  return { records, sources };
}

export function encodeCosmicStructureCatalog(records, sourceCount) {
  if (records.length === 0 || sourceCount <= 0 || sourceCount > 65_535) {
    throw new Error('Cosmic-structure catalogue dimensions are invalid.');
  }
  const encodedIdentifiers = records.map((record) => Buffer.from(record.identifier, 'utf8'));
  const stringTableBytes = encodedIdentifiers.reduce(
    (total, identifier) => total + identifier.length,
    0,
  );
  const buffer = Buffer.allocUnsafe(
    COSMIC_STRUCTURE_CATALOG_HEADER_BYTES +
      records.length * COSMIC_STRUCTURE_CATALOG_RECORD_BYTES +
      stringTableBytes,
  );
  const minimumDistanceMpc = Math.min(...records.map(({ distanceMpc }) => distanceMpc));
  const maximumDistanceMpc = Math.max(...records.map(({ distanceMpc }) => distanceMpc));

  buffer.write('UMCS', 0, 'ascii');
  buffer.writeUInt16LE(COSMIC_STRUCTURE_CATALOG_VERSION, 4);
  buffer.writeUInt16LE(COSMIC_STRUCTURE_CATALOG_HEADER_BYTES, 6);
  buffer.writeUInt16LE(COSMIC_STRUCTURE_CATALOG_RECORD_BYTES, 8);
  buffer.writeUInt16LE(0, 10);
  buffer.writeUInt32LE(records.length, 12);
  buffer.writeUInt16LE(sourceCount, 16);
  buffer.writeUInt16LE(EQUATORIAL_CARTESIAN_FRAME, 18);
  buffer.writeDoubleLE(REFERENCE_EPOCH_JULIAN_DAY, 20);
  buffer.writeFloatLE(minimumDistanceMpc, 28);
  buffer.writeFloatLE(maximumDistanceMpc, 32);
  buffer.writeUInt32LE(stringTableBytes, 36);
  buffer.writeUInt32LE(0xff, 40);
  buffer.writeUInt32LE(0, 44);

  let identifierOffset = 0;

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const identifier = encodedIdentifiers[index];
    const offset =
      COSMIC_STRUCTURE_CATALOG_HEADER_BYTES + index * COSMIC_STRUCTURE_CATALOG_RECORD_BYTES;

    assertEncodableRecord(record, identifier.length, sourceCount);
    buffer.writeFloatLE(record.positionMpc[0], offset);
    buffer.writeFloatLE(record.positionMpc[1], offset + 4);
    buffer.writeFloatLE(record.positionMpc[2], offset + 8);
    buffer.writeFloatLE(record.distanceMpc, offset + 12);
    buffer.writeFloatLE(record.radiusMpc, offset + 16);
    buffer.writeFloatLE(record.confidence, offset + 20);
    buffer.writeFloatLE(record.densityContrast, offset + 24);
    buffer.writeFloatLE(record.boundaryDistanceMpc, offset + 28);
    buffer.writeUInt32LE(record.galaxyCount, offset + 32);
    buffer.writeUInt32LE(identifierOffset, offset + 36);
    buffer.writeUInt16LE(identifier.length, offset + 40);
    buffer.writeUInt16LE(record.sourceIndex, offset + 42);
    buffer.writeUInt8(STRUCTURE_TYPE_CODES[record.structureType], offset + 44);
    buffer.writeUInt8(record.flags, offset + 45);
    buffer.writeUInt16LE(record.catalogNumericId, offset + 46);
    identifierOffset += identifier.length;
  }
  const stringTableOffset =
    COSMIC_STRUCTURE_CATALOG_HEADER_BYTES + records.length * COSMIC_STRUCTURE_CATALOG_RECORD_BYTES;

  let stringWriteOffset = stringTableOffset;

  for (const identifier of encodedIdentifiers) {
    identifier.copy(buffer, stringWriteOffset);
    stringWriteOffset += identifier.length;
  }

  return buffer;
}

async function main() {
  const sourcePayloads = await Promise.all(
    SOURCE_DEFINITIONS.map(async (source) => {
      const compressed = await readFile(source.input);
      const decompressed = await gunzipAsync(compressed);

      return {
        source,
        compressed,
        lines: decompressed.toString('utf8').split(/\r?\n/),
      };
    }),
  );
  const catalog = buildCosmicStructureCatalog(
    sourcePayloads.map(({ source, lines }) => ({
      sourceId: source.id,
      layout: source.layout,
      lines,
    })),
  );
  const binary = encodeCosmicStructureCatalog(catalog.records, catalog.sources.length);
  const structureTypes = [...new Set(catalog.sources.map(({ structureType }) => structureType))];
  const structureCounts = Object.fromEntries(
    structureTypes.map((structureType) => [
      structureType,
      catalog.records.filter((record) => record.structureType === structureType).length,
    ]),
  );
  const metadata = {
    version: '1.1.0',
    recordCount: catalog.records.length,
    referenceEpochJulianDay: REFERENCE_EPOCH_JULIAN_DAY,
    referenceFrame: 'equatorial-j2000',
    distanceUnit: 'megaparsec',
    scientificConfidence: 'calculated',
    structureCounts,
    cosmology: {
      model: 'flat-lambda-cdm',
      hubbleConstantKmPerSecondPerMpc: HUBBLE_CONSTANT_KM_PER_SECOND_PER_MPC,
      reducedHubbleParameter: HUBBLE_REDUCED_PARAMETER,
      matterDensity: MATTER_DENSITY,
      darkEnergyDensity: DARK_ENERGY_DENSITY,
      usage: 'Mpc/h conversion and BOSS redshift-to-comoving-distance display coordinates',
    },
    sources: catalog.sources.map((source, sourceIndex) => {
      const payload = sourcePayloads[sourceIndex];

      return {
        id: source.id,
        name: source.name,
        citation: source.citation,
        sourceUrl: source.sourceUrl,
        structureType: source.structureType,
        method: source.method,
        objectNamePrefix: source.objectNamePrefix,
        scientificConfidence: 'calculated',
        recordCount: catalog.records.filter((record) => record.sourceIndex === sourceIndex).length,
        sourceSha256: createHash('sha256').update(payload.compressed).digest('hex'),
      };
    }),
    representation: 'gpu-symbol-catalog-with-lazy-object-definitions',
  };

  await mkdir(dirname(DEFAULT_OUTPUT), { recursive: true });
  await writeFile(DEFAULT_OUTPUT, binary);
  await writeFile(DEFAULT_METADATA_OUTPUT, `${JSON.stringify(metadata, null, 2)}\n`);
  console.log(
    `Cosmic structures generated: ${catalog.records.length.toLocaleString('en-US')} detections from ${catalog.sources.length} public catalogues (${DEFAULT_OUTPUT}).`,
  );
}

function parseCatalogLine(layout, line, lineNumber) {
  if (layout === 'boss-void') {
    return parseBossVoidLine(line, lineNumber);
  }
  if (layout === 'tempel-filament') {
    return parseTempelFilamentLine(line, lineNumber);
  }
  if (layout === 'planck-psz2') {
    return parsePlanckPsz2Line(line, lineNumber);
  }

  return parseSuperclusterLine(line, layout, lineNumber);
}

function createCatalogRecord(layout, record, sourceIndex) {
  if (layout === 'boss-void') {
    return createVoidRecord(record, sourceIndex);
  }
  if (layout === 'tempel-filament') {
    return createFilamentRecord(record, sourceIndex);
  }
  if (layout === 'planck-psz2') {
    return createClusterRecord(record, sourceIndex);
  }

  return createSuperclusterRecord(record, sourceIndex, layout);
}

function createSuperclusterRecord(record, sourceIndex, layout) {
  const distanceMpc = record.distanceMpcPerH / HUBBLE_REDUCED_PARAMETER;

  return {
    identifier: record.identifier,
    catalogNumericId: record.catalogNumericId,
    sourceIndex,
    structureType: 'supercluster',
    positionMpc: equatorialToCartesian(
      record.rightAscensionDegrees,
      record.declinationDegrees,
      distanceMpc,
    ),
    distanceMpc,
    radiusMpc: record.diameterMpcPerH / (2 * HUBBLE_REDUCED_PARAMETER),
    confidence: 1 - Math.exp(-record.confidence),
    densityContrast: Number.NaN,
    boundaryDistanceMpc: Number.NaN,
    galaxyCount: record.galaxyCount,
    flags:
      Number(record.surveyEdge) |
      (layout.includes('adap') ? 2 : 0) |
      (layout.startsWith('lrg') ? 4 : 0),
  };
}

function createVoidRecord(record, sourceIndex) {
  const distanceMpc = comovingDistanceMpc(record.redshift);

  return {
    identifier: record.identifier,
    catalogNumericId: record.catalogNumericId,
    sourceIndex,
    structureType: 'void',
    positionMpc: equatorialToCartesian(
      record.rightAscensionDegrees,
      record.declinationDegrees,
      distanceMpc,
    ),
    distanceMpc,
    radiusMpc: record.radiusMpcPerH / HUBBLE_REDUCED_PARAMETER,
    confidence: 1 - record.poissonProbability,
    densityContrast: record.densityContrast,
    boundaryDistanceMpc: record.boundaryDistanceMpcPerH / HUBBLE_REDUCED_PARAMETER,
    galaxyCount: record.galaxyCount,
    flags: (record.sample.includes('South') ? 8 : 0) | (record.sample.startsWith('LOWZ') ? 16 : 0),
  };
}

function createFilamentRecord(record, sourceIndex) {
  const centerMpcPerH = record.minimumMpcPerH.map(
    (minimum, axis) => minimum + record.extentMpcPerH[axis] / 2,
  );

  return {
    identifier: record.identifier,
    catalogNumericId: record.catalogNumericId,
    sourceIndex,
    structureType: 'filament',
    // Tempel's (x, y, z) convention stores declination on z. The renderer's
    // equatorial basis stores declination on y, hence this explicit axis swap.
    positionMpc: [
      centerMpcPerH[0] / HUBBLE_REDUCED_PARAMETER,
      centerMpcPerH[2] / HUBBLE_REDUCED_PARAMETER,
      centerMpcPerH[1] / HUBBLE_REDUCED_PARAMETER,
    ],
    distanceMpc: Math.hypot(...centerMpcPerH) / HUBBLE_REDUCED_PARAMETER,
    radiusMpc: record.lengthMpcPerH / (2 * HUBBLE_REDUCED_PARAMETER),
    confidence: 0.8,
    densityContrast: Number.NaN,
    boundaryDistanceMpc: Number.NaN,
    galaxyCount: record.galaxyCountOneMpc,
    flags: 32,
  };
}

function createClusterRecord(record, sourceIndex) {
  const distanceMpc = comovingDistanceMpc(record.redshift);

  return {
    identifier: record.identifier,
    catalogNumericId: record.catalogNumericId,
    sourceIndex,
    structureType: 'cluster',
    positionMpc: equatorialToCartesian(
      record.rightAscensionDegrees,
      record.declinationDegrees,
      distanceMpc,
    ),
    distanceMpc,
    radiusMpc: 0,
    confidence: record.neuralQuality,
    densityContrast: Number.NaN,
    boundaryDistanceMpc: Number.NaN,
    galaxyCount: 0,
    flags: 64,
  };
}

function equatorialToCartesian(rightAscensionDegrees, declinationDegrees, distanceMpc) {
  const rightAscension = (rightAscensionDegrees * Math.PI) / 180;
  const declination = (declinationDegrees * Math.PI) / 180;
  const projectedDistance = distanceMpc * Math.cos(declination);

  return [
    projectedDistance * Math.cos(rightAscension),
    distanceMpc * Math.sin(declination),
    projectedDistance * Math.sin(rightAscension),
  ];
}

function assertEncodableRecord(record, identifierLength, sourceCount) {
  if (
    identifierLength === 0 ||
    identifierLength > 65_535 ||
    record.sourceIndex < 0 ||
    record.sourceIndex >= sourceCount ||
    !Object.hasOwn(STRUCTURE_TYPE_CODES, record.structureType) ||
    !record.positionMpc.every(Number.isFinite) ||
    !positiveFinite(record.distanceMpc) ||
    !nonNegativeFinite(record.radiusMpc) ||
    !Number.isFinite(record.confidence) ||
    record.confidence < 0 ||
    record.confidence > 1 ||
    (!Number.isNaN(record.densityContrast) && !Number.isFinite(record.densityContrast)) ||
    (!Number.isNaN(record.boundaryDistanceMpc) && !positiveFinite(record.boundaryDistanceMpc)) ||
    !Number.isInteger(record.galaxyCount) ||
    record.galaxyCount < 0 ||
    !Number.isInteger(record.catalogNumericId) ||
    record.catalogNumericId <= 0 ||
    record.catalogNumericId > 65_535
  ) {
    throw new Error(`Cosmic-structure record cannot be encoded: ${record.identifier}.`);
  }
}

function field(line, start, end) {
  return line.slice(start - 1, end).trim();
}

function numberField(line, start, end) {
  return Number(field(line, start, end));
}

function integerField(line, start, end) {
  return Number.parseInt(field(line, start, end), 10);
}

function positiveFinite(value) {
  return Number.isFinite(value) && value > 0;
}

function nonNegativeFinite(value) {
  return Number.isFinite(value) && value >= 0;
}

function validSkyPosition(rightAscensionDegrees, declinationDegrees) {
  return (
    Number.isFinite(rightAscensionDegrees) &&
    rightAscensionDegrees >= 0 &&
    rightAscensionDegrees < 360 &&
    Number.isFinite(declinationDegrees) &&
    declinationDegrees >= -90 &&
    declinationDegrees <= 90
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
