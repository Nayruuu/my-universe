import { stableUnitInterval } from '../materials/visual-random';
import type {
  TempelFilamentSpineCatalog,
  TempelFilamentSpineRenderData,
  TempelFilamentSpineTileRenderData,
} from './tempel-filament-spine-catalog';

const TILE_COUNT = 8;
const FILAMENT_SPINE_REVEAL_RANGE = 0.64;
const TEMPEL_OBJECT_ID_PREFIX = 'lss-sdss-dr8-tempel-filaments-f';

interface SegmentCounts {
  readonly byTile: Uint32Array;
  readonly byTileAndFilament: Uint32Array;
}

export function prepareTempelFilamentSpineRenderData(
  catalog: TempelFilamentSpineCatalog,
  sceneUnitsPerMpc: number,
): TempelFilamentSpineRenderData {
  if (!Number.isFinite(sceneUnitsPerMpc) || sceneUnitsPerMpc <= 0) {
    throw new Error('Catalogue Tempel : échelle de rendu invalide.');
  }
  const counts = countSegments(catalog);
  const thresholds = createFilamentRevealThresholds(catalog);
  const tiles = Array.from({ length: TILE_COUNT }, (_, tileIndex) =>
    counts.byTile[tileIndex] === 0
      ? null
      : createTileRenderData(catalog, sceneUnitsPerMpc, tileIndex, counts, thresholds),
  ).filter((tile): tile is TempelFilamentSpineTileRenderData => tile !== null);

  return {
    sceneUnitsPerMpc,
    segmentCount: catalog.segmentCount,
    tiles,
  };
}

export function tempelFilamentSpineRenderDataTransferables(
  renderData: TempelFilamentSpineRenderData,
): ArrayBuffer[] {
  return renderData.tiles.flatMap((tile) => [
    tile.positions.buffer,
    tile.alphas.buffer,
    tile.revealThresholds.buffer,
    tile.vertexFilamentIndices.buffer,
  ]);
}

function countSegments(catalog: TempelFilamentSpineCatalog): SegmentCounts {
  const byTile = new Uint32Array(TILE_COUNT);
  const byTileAndFilament = new Uint32Array(TILE_COUNT * catalog.filamentCount);

  for (let filamentIndex = 0; filamentIndex < catalog.filamentCount; filamentIndex += 1) {
    const startPoint = catalog.pointOffsets[filamentIndex]!;
    const endPoint = catalog.pointOffsets[filamentIndex + 1]!;

    for (let pointIndex = startPoint; pointIndex < endPoint - 1; pointIndex += 1) {
      const tileIndex = getSegmentTile(catalog.positionsMpc, pointIndex);

      byTile[tileIndex] += 1;
      byTileAndFilament[tileIndex * catalog.filamentCount + filamentIndex] += 1;
    }
  }

  return { byTile, byTileAndFilament };
}

function createTileRenderData(
  catalog: TempelFilamentSpineCatalog,
  sceneUnitsPerMpc: number,
  tileIndex: number,
  counts: SegmentCounts,
  thresholds: Float32Array,
): TempelFilamentSpineTileRenderData {
  const segmentCount = counts.byTile[tileIndex]!;
  const positions = new Float32Array(segmentCount * 6);
  const alphas = new Float32Array(segmentCount * 2);
  const revealThresholds = new Float32Array(segmentCount);
  const vertexFilamentIndices = new Uint16Array(segmentCount * 2);
  const filamentCounts = counts.byTileAndFilament.subarray(
    tileIndex * catalog.filamentCount,
    (tileIndex + 1) * catalog.filamentCount,
  );
  const segmentOffsets = createSortedSegmentOffsets(filamentCounts, thresholds);
  const nextSegmentOffsets = segmentOffsets.slice();

  revealThresholds.fill(Number.POSITIVE_INFINITY);

  for (let filamentIndex = 0; filamentIndex < catalog.filamentCount; filamentIndex += 1) {
    const startPoint = catalog.pointOffsets[filamentIndex]!;
    const endPoint = catalog.pointOffsets[filamentIndex + 1]!;

    for (let pointIndex = startPoint; pointIndex < endPoint - 1; pointIndex += 1) {
      if (getSegmentTile(catalog.positionsMpc, pointIndex) !== tileIndex) {
        continue;
      }
      const segmentIndex = nextSegmentOffsets[filamentIndex]!;

      nextSegmentOffsets[filamentIndex] = segmentIndex + 1;
      writeSegment(
        catalog,
        sceneUnitsPerMpc,
        pointIndex,
        filamentIndex,
        segmentIndex,
        thresholds[filamentIndex]!,
        positions,
        alphas,
        revealThresholds,
        vertexFilamentIndices,
      );
    }
  }

  return {
    tileIndex,
    segmentCount,
    positions,
    alphas,
    revealThresholds,
    vertexFilamentIndices,
    bounds: calculateBounds(positions),
  };
}

function createSortedSegmentOffsets(
  segmentCounts: Uint32Array,
  thresholds: Float32Array,
): Uint32Array {
  const filamentOrder = Array.from(segmentCounts.keys()).sort(
    (left, right) => thresholds[left]! - thresholds[right]! || left - right,
  );
  const offsets = new Uint32Array(segmentCounts.length);
  let offset = 0;

  for (const filamentIndex of filamentOrder) {
    offsets[filamentIndex] = offset;
    offset += segmentCounts[filamentIndex]!;
  }

  return offsets;
}

function createFilamentRevealThresholds(catalog: TempelFilamentSpineCatalog): Float32Array {
  return Float32Array.from(catalog.filamentIds, (filamentId) =>
    filamentId === 1
      ? 0
      : stableUnitInterval(`${TEMPEL_OBJECT_ID_PREFIX}${filamentId}`) * FILAMENT_SPINE_REVEAL_RANGE,
  );
}

function writeSegment(
  catalog: TempelFilamentSpineCatalog,
  scale: number,
  pointIndex: number,
  filamentIndex: number,
  segmentIndex: number,
  revealThreshold: number,
  positions: Float32Array,
  alphas: Float32Array,
  revealThresholds: Float32Array,
  vertexFilamentIndices: Uint16Array,
): void {
  const positionOffset = segmentIndex * 6;
  const vertexOffset = segmentIndex * 2;
  const alpha = getSegmentAlpha(catalog, pointIndex);

  copyScaledPoint(catalog.positionsMpc, pointIndex, positions, positionOffset, scale);
  copyScaledPoint(catalog.positionsMpc, pointIndex + 1, positions, positionOffset + 3, scale);
  alphas[vertexOffset] = alpha;
  alphas[vertexOffset + 1] = alpha;
  revealThresholds[segmentIndex] = revealThreshold;
  vertexFilamentIndices[vertexOffset] = filamentIndex;
  vertexFilamentIndices[vertexOffset + 1] = filamentIndex;
}

function getSegmentTile(positions: Float32Array, pointIndex: number): number {
  const fromOffset = pointIndex * 3;
  const toOffset = fromOffset + 3;
  const x = positions[fromOffset]! + positions[toOffset]!;
  const y = positions[fromOffset + 1]! + positions[toOffset + 1]!;
  const z = positions[fromOffset + 2]! + positions[toOffset + 2]!;

  return Number(x >= 0) | (Number(y >= 0) << 1) | (Number(z >= 0) << 2);
}

function getSegmentAlpha(catalog: TempelFilamentSpineCatalog, pointIndex: number): number {
  const nextPointIndex = pointIndex + 1;
  const visitMap = (catalog.visitMap[pointIndex]! + catalog.visitMap[nextPointIndex]!) / 510;
  const density = (catalog.density[pointIndex]! + catalog.density[nextPointIndex]!) / 510;
  const orientation =
    (catalog.orientationStrength[pointIndex]! + catalog.orientationStrength[nextPointIndex]!) / 510;

  return 0.18 + visitMap * 0.14 + density * 0.38 + orientation * 0.3;
}

function copyScaledPoint(
  source: Float32Array,
  pointIndex: number,
  target: Float32Array,
  targetOffset: number,
  scale: number,
): void {
  const sourceOffset = pointIndex * 3;

  target[targetOffset] = source[sourceOffset]! * scale;
  target[targetOffset + 1] = source[sourceOffset + 1]! * scale;
  target[targetOffset + 2] = source[sourceOffset + 2]! * scale;
}

function calculateBounds(positions: Float32Array): {
  readonly minimum: readonly [number, number, number];
  readonly maximum: readonly [number, number, number];
  readonly center: readonly [number, number, number];
  readonly radius: number;
} {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (let offset = 0; offset < positions.length; offset += 3) {
    const x = positions[offset]!;
    const y = positions[offset + 1]!;
    const z = positions[offset + 2]!;

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  }
  const center: readonly [number, number, number] = [
    (minX + maxX) / 2,
    (minY + maxY) / 2,
    (minZ + maxZ) / 2,
  ];
  let radiusSquared = 0;

  for (let offset = 0; offset < positions.length; offset += 3) {
    const dx = positions[offset]! - center[0];
    const dy = positions[offset + 1]! - center[1];
    const dz = positions[offset + 2]! - center[2];

    radiusSquared = Math.max(radiusSquared, dx * dx + dy * dy + dz * dz);
  }

  return {
    minimum: [minX, minY, minZ],
    maximum: [maxX, maxY, maxZ],
    center,
    radius: Math.sqrt(radiusSquared),
  };
}
