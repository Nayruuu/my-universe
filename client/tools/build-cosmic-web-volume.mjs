import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const COSMIC_WEB_VOLUME_VERSION = 1;
export const COSMIC_WEB_VOLUME_HEADER_BYTES = 64;

const COSMIC_GROUP_HEADER_BYTES = 40;
const COSMIC_GROUP_RECORD_BYTES = 32;
const COSMIC_GROUP_EDGE_BYTES = 8;
const DEFAULT_INPUT = resolve('public/data/galaxies/cosmicflows4-groups.bin');
const DEFAULT_OUTPUT = resolve('public/data/structures/cosmic-web-density.bin');
const DEFAULT_OPTIONS = Object.freeze({ resolution: 128, halfExtentMpc: 800, blurPasses: 1 });
const EQUATORIAL_CARTESIAN_FRAME = 1;
const VOLUME_EDGE_FRACTION = 0.22;
const ILLUSTRATIVE_CELL_COUNT = 6;
const MINIMUM_SCAFFOLD_RESOLUTION = 16;

export function buildCosmicWebDensityVolume(source, options = DEFAULT_OPTIONS) {
  assertSource(source);
  assertOptions(options);
  const resolution = options.resolution;
  const voxelCount = resolution ** 3;
  const density = new Float32Array(voxelCount);
  const groupCount = source.distanceModulusErrors.length;

  for (let index = 0; index < groupCount; index += 1) {
    const offset = index * 3;
    const gridPosition = toGridPosition(
      source.positionsMpc[offset],
      source.positionsMpc[offset + 1],
      source.positionsMpc[offset + 2],
      resolution,
      options.halfExtentMpc,
    );

    if (!gridPosition) {
      continue;
    }
    const uncertainty = source.distanceModulusErrors[index];
    const catalogueWeight = Math.max(0.035, Math.min(0.14, 0.11 / (0.35 + uncertainty)));
    const weight =
      catalogueWeight *
      getRadialSelectionCompensation(
        source.positionsMpc[offset],
        source.positionsMpc[offset + 1],
        source.positionsMpc[offset + 2],
        options.halfExtentMpc,
      );

    splatTrilinear(density, resolution, gridPosition, weight);
  }

  const sourceEdgeCount = source.filamentPairs.length / 2;
  const sampledEdgeCount =
    sourceEdgeCount === 0 ? 0 : Math.max(1, Math.ceil(sourceEdgeCount * VOLUME_EDGE_FRACTION));

  for (let sampleIndex = 0; sampleIndex < sampledEdgeCount; sampleIndex += 1) {
    const edgeIndex = Math.floor((sampleIndex * sourceEdgeCount) / sampledEdgeCount);
    const offset = edgeIndex * 2;
    const fromIndex = source.filamentPairs[offset];
    const toIndex = source.filamentPairs[offset + 1];

    if (fromIndex >= toIndex || toIndex >= groupCount) {
      throw new Error(`Cosmic web volume has an invalid filament pair at offset ${offset}.`);
    }
    splatFilament(density, resolution, options.halfExtentMpc, source, fromIndex, toIndex);
  }

  const illustrativeField =
    resolution >= MINIMUM_SCAFFOLD_RESOLUTION
      ? createIllustrativeCellularField(resolution, ILLUSTRATIVE_CELL_COUNT)
      : new Float32Array(voxelCount);
  let illustrativeVoxelCount = 0;

  for (let index = 0; index < illustrativeField.length; index += 1) {
    const value = illustrativeField[index];

    if (value <= 0) {
      continue;
    }
    density[index] += value * 0.58;
    illustrativeVoxelCount += 1;
  }

  const anchors = density.slice();
  const smoothed = blurDensity(density, resolution, options.blurPasses);

  if (options.blurPasses > 0) {
    for (let index = 0; index < smoothed.length; index += 1) {
      smoothed[index] += anchors[index] * 0.22;
    }
  }

  return {
    resolution,
    halfExtentMpc: options.halfExtentMpc,
    referenceEpochJulianDay: source.referenceEpochJulianDay,
    sourceGroupCount: groupCount,
    sourceEdgeCount,
    sampledEdgeCount,
    illustrativeCellCount: ILLUSTRATIVE_CELL_COUNT,
    illustrativeVoxelCount,
    density: encodeDensity(smoothed),
  };
}

export function createIllustrativeCellularField(resolution, cellCount = 6) {
  if (!Number.isInteger(resolution) || resolution < 4 || resolution > 256) {
    throw new Error('Illustrative cellular field resolution is invalid.');
  }
  if (!Number.isInteger(cellCount) || cellCount < 2 || cellCount > 16) {
    throw new Error('Illustrative cellular field cell count is invalid.');
  }
  const field = new Float32Array(resolution ** 3);
  const maximumIndex = resolution - 1;

  for (let z = 0; z < resolution; z += 1) {
    const positionZ = (z / maximumIndex) * cellCount;
    const baseZ = Math.floor(positionZ);

    for (let y = 0; y < resolution; y += 1) {
      const positionY = (y / maximumIndex) * cellCount;
      const baseY = Math.floor(positionY);

      for (let x = 0; x < resolution; x += 1) {
        const positionX = (x / maximumIndex) * cellCount;
        const baseX = Math.floor(positionX);
        const nearest = [
          Number.POSITIVE_INFINITY,
          Number.POSITIVE_INFINITY,
          Number.POSITIVE_INFINITY,
          Number.POSITIVE_INFINITY,
        ];

        for (let deltaZ = -1; deltaZ <= 1; deltaZ += 1) {
          const cellZ = baseZ + deltaZ;

          for (let deltaY = -1; deltaY <= 1; deltaY += 1) {
            const cellY = baseY + deltaY;

            for (let deltaX = -1; deltaX <= 1; deltaX += 1) {
              const cellX = baseX + deltaX;
              const featureX = cellX + 0.12 + scaffoldHash(cellX, cellY, cellZ, 1) * 0.76;
              const featureY = cellY + 0.12 + scaffoldHash(cellX, cellY, cellZ, 2) * 0.76;
              const featureZ = cellZ + 0.12 + scaffoldHash(cellX, cellY, cellZ, 3) * 0.76;
              const distanceSquared =
                (featureX - positionX) ** 2 +
                (featureY - positionY) ** 2 +
                (featureZ - positionZ) ** 2;

              insertNearestDistance(nearest, distanceSquared);
            }
          }
        }
        const firstDistance = Math.sqrt(nearest[0]);
        const filament = Math.exp(-(Math.sqrt(nearest[2]) - firstDistance) * 15);
        const node = Math.exp(-(Math.sqrt(nearest[3]) - firstDistance) * 18);
        const filamentDensity = Math.max(0, (filament - 0.09) / 0.91);
        const nodeDensity = Math.max(0, (node - 0.14) / 0.86);
        const cellStrength = 0.58 + scaffoldHash(baseX, baseY, baseZ, 4) * 0.42;
        const density = Math.min(1, (filamentDensity * 0.78 + nodeDensity * 0.44) * cellStrength);

        if (density >= 0.035) {
          field[x + y * resolution + z * resolution * resolution] = density;
        }
      }
    }
  }

  return field;
}

export function encodeCosmicWebVolume(volume) {
  const voxelCount = volume.resolution ** 3;

  if (!(volume.density instanceof Uint8Array) || volume.density.length !== voxelCount) {
    throw new Error('Cosmic web volume density dimensions are inconsistent.');
  }
  const buffer = Buffer.alloc(COSMIC_WEB_VOLUME_HEADER_BYTES + voxelCount);

  buffer.write('UMCV', 0, 'ascii');
  buffer.writeUInt16LE(COSMIC_WEB_VOLUME_VERSION, 4);
  buffer.writeUInt16LE(COSMIC_WEB_VOLUME_HEADER_BYTES, 6);
  buffer.writeUInt16LE(volume.resolution, 8);
  buffer.writeUInt16LE(1, 10);
  buffer.writeUInt32LE(voxelCount, 12);
  buffer.writeFloatLE(volume.halfExtentMpc, 16);
  buffer.writeUInt32LE(EQUATORIAL_CARTESIAN_FRAME, 20);
  buffer.writeDoubleLE(volume.referenceEpochJulianDay, 24);
  buffer.writeUInt32LE(volume.sourceGroupCount, 32);
  buffer.writeUInt32LE(volume.sourceEdgeCount, 36);
  buffer.writeUInt32LE(0, 40);
  Buffer.from(volume.density).copy(buffer, COSMIC_WEB_VOLUME_HEADER_BYTES);

  return buffer;
}

export function decodeCosmicGroupCatalogForVolume(buffer) {
  if (buffer.length < COSMIC_GROUP_HEADER_BYTES || buffer.toString('ascii', 0, 4) !== 'UMCG') {
    throw new Error('Cosmicflows-4 source catalogue has an invalid header.');
  }
  const version = buffer.readUInt16LE(4);
  const headerBytes = buffer.readUInt16LE(6);
  const recordBytes = buffer.readUInt16LE(8);
  const count = buffer.readUInt32LE(12);
  const referenceEpochJulianDay = buffer.readDoubleLE(16);
  const coordinateFrame = buffer.readUInt32LE(24);
  const edgeCount = buffer.readUInt32LE(36);
  const expectedBytes = headerBytes + count * recordBytes + edgeCount * COSMIC_GROUP_EDGE_BYTES;

  if (
    version !== 2 ||
    headerBytes !== COSMIC_GROUP_HEADER_BYTES ||
    recordBytes !== COSMIC_GROUP_RECORD_BYTES ||
    coordinateFrame !== EQUATORIAL_CARTESIAN_FRAME ||
    count === 0 ||
    !Number.isFinite(referenceEpochJulianDay) ||
    buffer.length !== expectedBytes
  ) {
    throw new Error('Cosmicflows-4 source catalogue is incompatible with volume generation.');
  }
  const positionsMpc = new Float32Array(count * 3);
  const distanceModulusErrors = new Float32Array(count);

  for (let index = 0; index < count; index += 1) {
    const inputOffset = headerBytes + index * recordBytes;
    const outputOffset = index * 3;

    positionsMpc[outputOffset] = buffer.readFloatLE(inputOffset);
    positionsMpc[outputOffset + 1] = buffer.readFloatLE(inputOffset + 4);
    positionsMpc[outputOffset + 2] = buffer.readFloatLE(inputOffset + 8);
    distanceModulusErrors[index] = buffer.readFloatLE(inputOffset + 16);
  }
  const filamentPairs = new Uint32Array(edgeCount * 2);
  const edgeOffset = headerBytes + count * recordBytes;

  for (let index = 0; index < filamentPairs.length; index += 1) {
    filamentPairs[index] = buffer.readUInt32LE(edgeOffset + index * 4);
  }

  return { referenceEpochJulianDay, positionsMpc, distanceModulusErrors, filamentPairs };
}

function assertSource(source) {
  if (!(source.positionsMpc instanceof Float32Array) || source.positionsMpc.length % 3 !== 0) {
    throw new Error('Cosmic web volume source positions are inconsistent.');
  }
  const groupCount = source.positionsMpc.length / 3;

  if (
    !(source.distanceModulusErrors instanceof Float32Array) ||
    source.distanceModulusErrors.length !== groupCount
  ) {
    throw new Error('Cosmic web volume source uncertainties are inconsistent.');
  }
  if (!(source.filamentPairs instanceof Uint32Array) || source.filamentPairs.length % 2 !== 0) {
    throw new Error('Cosmic web volume source filament pairs are inconsistent.');
  }
  if (!Number.isFinite(source.referenceEpochJulianDay)) {
    throw new Error('Cosmic web volume source epoch is invalid.');
  }
  for (const value of source.positionsMpc) {
    if (!Number.isFinite(value)) {
      throw new Error('Cosmic web volume source positions contain a non-finite value.');
    }
  }
  for (const value of source.distanceModulusErrors) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error('Cosmic web volume source uncertainties contain an invalid value.');
    }
  }
}

function assertOptions(options) {
  if (!Number.isInteger(options.resolution) || options.resolution < 4 || options.resolution > 256) {
    throw new Error('Cosmic web volume resolution is invalid.');
  }
  if (!Number.isFinite(options.halfExtentMpc) || options.halfExtentMpc <= 0) {
    throw new Error('Cosmic web volume half extent is invalid.');
  }
  if (!Number.isInteger(options.blurPasses) || options.blurPasses < 0 || options.blurPasses > 8) {
    throw new Error('Cosmic web volume blur pass count is invalid.');
  }
}

function toGridPosition(x, y, z, resolution, halfExtentMpc) {
  const maximumIndex = resolution - 1;
  const gridPosition = [x, y, z].map((value) => ((value / halfExtentMpc + 1) * maximumIndex) / 2);

  return gridPosition.some((value) => value < 0 || value > maximumIndex) ? null : gridPosition;
}

function scaffoldHash(x, y, z, channel) {
  let value =
    Math.imul(x + 1, 73_856_093) ^
    Math.imul(y + 1, 19_349_663) ^
    Math.imul(z + 1, 83_492_791) ^
    Math.imul(channel + 1, 1_597_334_677);

  value = Math.imul(value ^ (value >>> 13), 1_274_126_177);
  value ^= value >>> 16;

  return (value >>> 0) / 4_294_967_295;
}

function insertNearestDistance(nearest, distanceSquared) {
  for (let index = 0; index < nearest.length; index += 1) {
    if (distanceSquared >= nearest[index]) {
      continue;
    }
    for (let shiftIndex = nearest.length - 1; shiftIndex > index; shiftIndex -= 1) {
      nearest[shiftIndex] = nearest[shiftIndex - 1];
    }
    nearest[index] = distanceSquared;

    return;
  }
}

function getRadialSelectionCompensation(x, y, z, halfExtentMpc) {
  const normalizedRadius = Math.min(1, Math.hypot(x, y, z) / halfExtentMpc);
  const easedRadius = normalizedRadius ** 2.2;

  return 0.008 + easedRadius * 0.992;
}

function splatFilament(density, resolution, halfExtentMpc, source, fromIndex, toIndex) {
  const fromOffset = fromIndex * 3;
  const toOffset = toIndex * 3;
  const reliability =
    1 /
    (1 + (source.distanceModulusErrors[fromIndex] + source.distanceModulusErrors[toIndex]) * 0.5);
  const midpointX = (source.positionsMpc[fromOffset] + source.positionsMpc[toOffset]) * 0.5;
  const midpointY = (source.positionsMpc[fromOffset + 1] + source.positionsMpc[toOffset + 1]) * 0.5;
  const midpointZ = (source.positionsMpc[fromOffset + 2] + source.positionsMpc[toOffset + 2]) * 0.5;
  const weight =
    1.08 *
    reliability *
    getRadialSelectionCompensation(midpointX, midpointY, midpointZ, halfExtentMpc);

  splatSegment(
    density,
    resolution,
    halfExtentMpc,
    [
      source.positionsMpc[fromOffset],
      source.positionsMpc[fromOffset + 1],
      source.positionsMpc[fromOffset + 2],
    ],
    [
      source.positionsMpc[toOffset],
      source.positionsMpc[toOffset + 1],
      source.positionsMpc[toOffset + 2],
    ],
    weight,
  );
}

function splatSegment(density, resolution, halfExtentMpc, fromPosition, toPosition, weight) {
  const from = toGridPosition(
    fromPosition[0],
    fromPosition[1],
    fromPosition[2],
    resolution,
    halfExtentMpc,
  );
  const to = toGridPosition(toPosition[0], toPosition[1], toPosition[2], resolution, halfExtentMpc);

  if (!from || !to) {
    return;
  }
  const maximumDelta = Math.max(
    Math.abs(to[0] - from[0]),
    Math.abs(to[1] - from[1]),
    Math.abs(to[2] - from[2]),
  );
  const sampleCount = Math.max(1, Math.ceil(maximumDelta * 1.5));

  for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
    const progress = sampleIndex / sampleCount;

    splatTrilinear(
      density,
      resolution,
      [
        from[0] + (to[0] - from[0]) * progress,
        from[1] + (to[1] - from[1]) * progress,
        from[2] + (to[2] - from[2]) * progress,
      ],
      weight,
    );
  }
}

function splatTrilinear(density, resolution, position, weight) {
  const baseX = Math.floor(position[0]);
  const baseY = Math.floor(position[1]);
  const baseZ = Math.floor(position[2]);
  const fractionX = position[0] - baseX;
  const fractionY = position[1] - baseY;
  const fractionZ = position[2] - baseZ;

  for (let deltaZ = 0; deltaZ <= 1; deltaZ += 1) {
    const z = Math.min(resolution - 1, baseZ + deltaZ);
    const zWeight = deltaZ === 0 ? 1 - fractionZ : fractionZ;

    for (let deltaY = 0; deltaY <= 1; deltaY += 1) {
      const y = Math.min(resolution - 1, baseY + deltaY);
      const yWeight = deltaY === 0 ? 1 - fractionY : fractionY;

      for (let deltaX = 0; deltaX <= 1; deltaX += 1) {
        const x = Math.min(resolution - 1, baseX + deltaX);
        const xWeight = deltaX === 0 ? 1 - fractionX : fractionX;
        const index = x + y * resolution + z * resolution * resolution;

        density[index] += weight * xWeight * yWeight * zWeight;
      }
    }
  }
}

function blurDensity(input, resolution, passCount) {
  let current = input;
  let scratch = new Float32Array(input.length);

  for (let pass = 0; pass < passCount; pass += 1) {
    for (let axis = 0; axis < 3; axis += 1) {
      blurAxis(current, scratch, resolution, axis);
      [current, scratch] = [scratch, current];
    }
  }

  return current;
}

function blurAxis(input, output, resolution, axis) {
  const plane = resolution * resolution;

  for (let z = 0; z < resolution; z += 1) {
    for (let y = 0; y < resolution; y += 1) {
      for (let x = 0; x < resolution; x += 1) {
        const coordinate = axis === 0 ? x : axis === 1 ? y : z;
        const previousCoordinate = Math.max(0, coordinate - 1);
        const nextCoordinate = Math.min(resolution - 1, coordinate + 1);
        const previousIndex =
          axis === 0
            ? previousCoordinate + y * resolution + z * plane
            : axis === 1
              ? x + previousCoordinate * resolution + z * plane
              : x + y * resolution + previousCoordinate * plane;
        const currentIndex = x + y * resolution + z * plane;
        const nextIndex =
          axis === 0
            ? nextCoordinate + y * resolution + z * plane
            : axis === 1
              ? x + nextCoordinate * resolution + z * plane
              : x + y * resolution + nextCoordinate * plane;

        output[currentIndex] =
          input[previousIndex] * 0.25 + input[currentIndex] * 0.5 + input[nextIndex] * 0.25;
      }
    }
  }
}

function encodeDensity(density) {
  let maximum = 0;

  for (const value of density) {
    maximum = Math.max(maximum, value);
  }
  if (maximum === 0) {
    return new Uint8Array(density.length);
  }
  const histogram = new Uint32Array(2_048);
  let positiveCount = 0;

  for (const value of density) {
    if (value <= 0) {
      continue;
    }
    const bin = Math.min(histogram.length - 1, Math.floor((value / maximum) * histogram.length));

    histogram[bin] += 1;
    positiveCount += 1;
  }
  const targetCount = Math.ceil(positiveCount * 0.995);
  let accumulated = 0;
  let clipBin = histogram.length - 1;

  for (let index = 0; index < histogram.length; index += 1) {
    accumulated += histogram[index];
    if (accumulated >= targetCount) {
      clipBin = index;
      break;
    }
  }
  const clipDensity = Math.max(
    maximum / histogram.length,
    ((clipBin + 1) / histogram.length) * maximum,
  );
  const logarithmicMaximum = Math.log1p(clipDensity * 4);
  const encoded = new Uint8Array(density.length);

  for (let index = 0; index < density.length; index += 1) {
    const normalized = Math.log1p(Math.min(clipDensity, density[index]) * 4) / logarithmicMaximum;
    const enhanced = normalized < 0.012 ? 0 : normalized ** 0.72;

    encoded[index] = Math.round(enhanced * 255);
  }

  return encoded;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const sourceBuffer = await readFile(options.input);
  const source = decodeCosmicGroupCatalogForVolume(sourceBuffer);
  const volume = buildCosmicWebDensityVolume(source, options);
  const binary = encodeCosmicWebVolume(volume);
  const metadata = {
    version: '1.0.0',
    source: 'Cosmicflows-4 galaxy groups and derived proximity scaffold',
    sourceUrl: 'https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/944/94',
    sourceSha256: createHash('sha256').update(sourceBuffer).digest('hex'),
    scientificConfidence: 'simulated',
    representation: 'catalogue-aligned-cellular-density-volume',
    referenceFrame: 'equatorial-j2000',
    resolution: volume.resolution,
    halfExtentMpc: volume.halfExtentMpc,
    sourceGroupCount: volume.sourceGroupCount,
    sourceEdgeCount: volume.sourceEdgeCount,
    sampledEdgeCount: volume.sampledEdgeCount,
    illustrativeCellCount: volume.illustrativeCellCount,
    illustrativeVoxelCount: volume.illustrativeVoxelCount,
    radialSelectionCompensation: 'distance-weighted-for-visual-continuity',
    blurPasses: options.blurPasses,
    warning:
      'Continuous density and the cellular scaffold are reconstructed for visualization. They are not an observed matter-density field.',
  };

  await mkdir(dirname(options.output), { recursive: true });
  await writeFile(options.output, binary);
  await writeFile(
    options.output.replace(/\.bin$/u, '.json'),
    `${JSON.stringify(metadata, null, 2)}\n`,
  );
  console.log(
    `Cosmic web volume generated: ${volume.resolution}³ voxels from ${volume.sourceGroupCount.toLocaleString('en-US')} groups, ${volume.sampledEdgeCount.toLocaleString('en-US')} of ${volume.sourceEdgeCount.toLocaleString('en-US')} links, and a ${volume.illustrativeCellCount}³ cellular scaffold (${options.output}).`,
  );
}

function parseArguments(argumentsList) {
  const options = { input: DEFAULT_INPUT, output: DEFAULT_OUTPUT, ...DEFAULT_OPTIONS };

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    const value = argumentsList[index + 1];

    if (!value) {
      throw new Error(`Unknown or incomplete argument: ${argument}.`);
    }
    if (argument === '--input') {
      options.input = resolve(value);
    } else if (argument === '--output') {
      options.output = resolve(value);
    } else if (argument === '--resolution') {
      options.resolution = Number(value);
    } else if (argument === '--half-extent') {
      options.halfExtentMpc = Number(value);
    } else if (argument === '--blur-passes') {
      options.blurPasses = Number(value);
    } else {
      throw new Error(`Unknown or incomplete argument: ${argument}.`);
    }
    index += 1;
  }
  assertOptions(options);

  return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
