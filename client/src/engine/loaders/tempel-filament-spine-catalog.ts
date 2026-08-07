import { TempelFilamentSpineSource } from '../../data/models/universe.models';

export interface TempelFilamentSpineCatalog {
  readonly filamentCount: number;
  readonly pointCount: number;
  readonly segmentCount: number;
  readonly referenceEpochJulianDay: number;
  readonly minimumDistanceMpc: number;
  readonly maximumDistanceMpc: number;
  readonly filamentIds: Uint16Array<ArrayBuffer>;
  readonly pointOffsets: Uint32Array<ArrayBuffer>;
  readonly positionsMpc: Float32Array<ArrayBuffer>;
  readonly visitMap: Uint8Array<ArrayBuffer>;
  readonly density: Uint8Array<ArrayBuffer>;
  readonly orientationStrength: Uint8Array<ArrayBuffer>;
  readonly renderData?: TempelFilamentSpineRenderData;
}

export interface TempelFilamentSpineTileRenderData {
  readonly tileIndex: number;
  readonly segmentCount: number;
  readonly positions: Float32Array<ArrayBuffer>;
  readonly alphas: Float32Array<ArrayBuffer>;
  readonly revealThresholds: Float32Array<ArrayBuffer>;
  readonly vertexFilamentIndices: Uint16Array<ArrayBuffer>;
  readonly bounds: {
    readonly minimum: readonly [number, number, number];
    readonly maximum: readonly [number, number, number];
    readonly center: readonly [number, number, number];
    readonly radius: number;
  };
}

export interface TempelFilamentSpineRenderData {
  readonly sceneUnitsPerMpc: number;
  readonly segmentCount: number;
  readonly tiles: readonly TempelFilamentSpineTileRenderData[];
}

export interface TempelFilamentSpineCatalogLoadMetrics {
  readonly fetchMs: number;
  readonly decodeMs: number;
}

export interface TempelFilamentSpineCatalogLoadResult {
  readonly catalog: TempelFilamentSpineCatalog;
  readonly metrics: TempelFilamentSpineCatalogLoadMetrics;
}

type MonotonicClock = () => number;

export const TEMPEL_FILAMENT_SPINE_MAGIC = 'UMFS';
export const TEMPEL_FILAMENT_SPINE_VERSION = 1;
export const TEMPEL_FILAMENT_SPINE_HEADER_BYTES = 64;
export const TEMPEL_FILAMENT_SPINE_INDEX_BYTES = 8;
export const TEMPEL_FILAMENT_SPINE_POINT_BYTES = 16;

const EQUATORIAL_CARTESIAN_FRAME = 1;
const MEGAPARSEC_UNIT = 1;
const PUBLISHED_METRIC_FLAGS = 0x7;
const MAXIMUM_FILAMENT_COUNT = 65_535;
const MAXIMUM_POINT_COUNT = 5_000_000;

export async function loadTempelFilamentSpineCatalog(
  source: TempelFilamentSpineSource,
): Promise<TempelFilamentSpineCatalog> {
  return (await loadTempelFilamentSpineCatalogWithMetrics(source)).catalog;
}

export async function loadTempelFilamentSpineCatalogWithMetrics(
  source: TempelFilamentSpineSource,
  now: MonotonicClock = () => performance.now(),
): Promise<TempelFilamentSpineCatalogLoadResult> {
  const fetchStartedAt = now();
  const response = await fetch(source.url);

  if (!response.ok) {
    throw new Error(`Impossible de charger ${source.id} (${response.status}).`);
  }
  const buffer = await response.arrayBuffer();
  const decodeStartedAt = now();
  const catalog = parseTempelFilamentSpineCatalog(buffer);

  return {
    catalog,
    metrics: {
      fetchMs: decodeStartedAt - fetchStartedAt,
      decodeMs: now() - decodeStartedAt,
    },
  };
}

export function parseTempelFilamentSpineCatalog(buffer: ArrayBuffer): TempelFilamentSpineCatalog {
  if (buffer.byteLength < TEMPEL_FILAMENT_SPINE_HEADER_BYTES) {
    throw invalidCatalog('en-tête tronqué');
  }
  const view = new DataView(buffer);

  assertMagic(view);
  assertDimensions(view);
  const filamentCount = view.getUint32(12, true);
  const pointCount = view.getUint32(16, true);
  const segmentCount = view.getUint32(20, true);
  const coordinateFrame = view.getUint16(24, true);
  const distanceUnit = view.getUint16(26, true);
  const referenceEpochJulianDay = view.getFloat64(28, true);
  const minimumDistanceMpc = view.getFloat32(36, true);
  const maximumDistanceMpc = view.getFloat32(40, true);
  const metricFlags = view.getUint32(44, true);

  assertHeaderValues(
    filamentCount,
    pointCount,
    segmentCount,
    coordinateFrame,
    distanceUnit,
    referenceEpochJulianDay,
    minimumDistanceMpc,
    maximumDistanceMpc,
    metricFlags,
  );
  const expectedBytes =
    TEMPEL_FILAMENT_SPINE_HEADER_BYTES +
    filamentCount * TEMPEL_FILAMENT_SPINE_INDEX_BYTES +
    pointCount * TEMPEL_FILAMENT_SPINE_POINT_BYTES;

  if (buffer.byteLength !== expectedBytes) {
    throw invalidCatalog(
      `taille inattendue (${buffer.byteLength} octets au lieu de ${expectedBytes})`,
    );
  }
  const { filamentIds, pointOffsets } = decodeFilamentIndex(view, filamentCount, pointCount);
  const { positionsMpc, visitMap, density, orientationStrength } = decodePoints(
    view,
    filamentCount,
    pointCount,
    minimumDistanceMpc,
    maximumDistanceMpc,
  );

  return {
    filamentCount,
    pointCount,
    segmentCount,
    referenceEpochJulianDay,
    minimumDistanceMpc,
    maximumDistanceMpc,
    filamentIds,
    pointOffsets,
    positionsMpc,
    visitMap,
    density,
    orientationStrength,
  };
}

function assertMagic(view: DataView): void {
  for (let index = 0; index < TEMPEL_FILAMENT_SPINE_MAGIC.length; index += 1) {
    if (view.getUint8(index) !== TEMPEL_FILAMENT_SPINE_MAGIC.charCodeAt(index)) {
      throw invalidCatalog('signature inconnue');
    }
  }
}

function assertDimensions(view: DataView): void {
  const version = view.getUint16(4, true);

  if (version !== TEMPEL_FILAMENT_SPINE_VERSION) {
    throw invalidCatalog(`version non prise en charge (${version})`);
  }
  if (
    view.getUint16(6, true) !== TEMPEL_FILAMENT_SPINE_HEADER_BYTES ||
    view.getUint16(8, true) !== TEMPEL_FILAMENT_SPINE_POINT_BYTES ||
    view.getUint16(10, true) !== TEMPEL_FILAMENT_SPINE_INDEX_BYTES
  ) {
    throw invalidCatalog('dimensions incompatibles');
  }
}

function assertHeaderValues(
  filamentCount: number,
  pointCount: number,
  segmentCount: number,
  coordinateFrame: number,
  distanceUnit: number,
  referenceEpochJulianDay: number,
  minimumDistanceMpc: number,
  maximumDistanceMpc: number,
  metricFlags: number,
): void {
  if (filamentCount === 0 || filamentCount > MAXIMUM_FILAMENT_COUNT) {
    throw invalidCatalog(`nombre de filaments hors limites (${filamentCount})`);
  }
  if (
    pointCount <= filamentCount ||
    pointCount > MAXIMUM_POINT_COUNT ||
    pointCount < filamentCount * 2
  ) {
    throw invalidCatalog(`nombre de points hors limites (${pointCount})`);
  }
  if (segmentCount !== pointCount - filamentCount) {
    throw invalidCatalog(`nombre de segments incohérent (${segmentCount})`);
  }
  if (coordinateFrame !== EQUATORIAL_CARTESIAN_FRAME) {
    throw invalidCatalog(`référentiel inconnu (${coordinateFrame})`);
  }
  if (distanceUnit !== MEGAPARSEC_UNIT) {
    throw invalidCatalog(`unité inconnue (${distanceUnit})`);
  }
  if (!Number.isFinite(referenceEpochJulianDay)) {
    throw invalidCatalog('époque de référence invalide');
  }
  if (
    !positiveFinite(minimumDistanceMpc) ||
    !positiveFinite(maximumDistanceMpc) ||
    maximumDistanceMpc < minimumDistanceMpc
  ) {
    throw invalidCatalog('limites de distance invalides');
  }
  if (metricFlags !== PUBLISHED_METRIC_FLAGS) {
    throw invalidCatalog(`métriques incompatibles (${metricFlags})`);
  }
}

function decodeFilamentIndex(
  view: DataView,
  filamentCount: number,
  pointCount: number,
): {
  readonly filamentIds: Uint16Array<ArrayBuffer>;
  readonly pointOffsets: Uint32Array<ArrayBuffer>;
} {
  const filamentIds = new Uint16Array(filamentCount);
  const pointOffsets = new Uint32Array(filamentCount + 1);
  let previousId = 0;
  let expectedPointOffset = 0;

  for (let index = 0; index < filamentCount; index += 1) {
    const offset = TEMPEL_FILAMENT_SPINE_HEADER_BYTES + index * TEMPEL_FILAMENT_SPINE_INDEX_BYTES;
    const filamentId = view.getUint16(offset, true);
    const filamentPointCount = view.getUint16(offset + 2, true);
    const pointOffset = view.getUint32(offset + 4, true);

    if (filamentId === 0 || filamentId <= previousId || filamentPointCount < 2) {
      throw invalidCatalog(`index de filament invalide à l’index ${index}`);
    }
    if (pointOffset !== expectedPointOffset) {
      throw invalidCatalog(`index de filament non contigu à l’index ${index}`);
    }
    const nextPointOffset = pointOffset + filamentPointCount;

    if (nextPointOffset > pointCount) {
      throw invalidCatalog(`index de filament hors limites à l’index ${index}`);
    }
    filamentIds[index] = filamentId;
    pointOffsets[index] = pointOffset;
    previousId = filamentId;
    expectedPointOffset = nextPointOffset;
  }
  if (expectedPointOffset !== pointCount) {
    throw invalidCatalog('index de filament hors limites');
  }
  pointOffsets[filamentCount] = pointCount;

  return { filamentIds, pointOffsets };
}

function decodePoints(
  view: DataView,
  filamentCount: number,
  pointCount: number,
  minimumDistanceMpc: number,
  maximumDistanceMpc: number,
): Pick<
  TempelFilamentSpineCatalog,
  'positionsMpc' | 'visitMap' | 'density' | 'orientationStrength'
> {
  const positionsMpc = new Float32Array(pointCount * 3);
  const visitMap = new Uint8Array(pointCount);
  const density = new Uint8Array(pointCount);
  const orientationStrength = new Uint8Array(pointCount);
  const pointsOffset =
    TEMPEL_FILAMENT_SPINE_HEADER_BYTES + filamentCount * TEMPEL_FILAMENT_SPINE_INDEX_BYTES;
  let actualMinimumDistanceMpc = Number.POSITIVE_INFINITY;
  let actualMaximumDistanceMpc = 0;

  for (let pointIndex = 0; pointIndex < pointCount; pointIndex += 1) {
    const inputOffset = pointsOffset + pointIndex * TEMPEL_FILAMENT_SPINE_POINT_BYTES;
    const outputOffset = pointIndex * 3;
    const x = view.getFloat32(inputOffset, true);
    const y = view.getFloat32(inputOffset + 4, true);
    const z = view.getFloat32(inputOffset + 8, true);
    const distanceMpc = Math.hypot(x, y, z);

    if (![x, y, z].every(Number.isFinite) || !positiveFinite(distanceMpc)) {
      throw invalidCatalog(`point invalide à l’index ${pointIndex}`);
    }
    positionsMpc[outputOffset] = x;
    positionsMpc[outputOffset + 1] = y;
    positionsMpc[outputOffset + 2] = z;
    visitMap[pointIndex] = view.getUint8(inputOffset + 12);
    density[pointIndex] = view.getUint8(inputOffset + 13);
    orientationStrength[pointIndex] = view.getUint8(inputOffset + 14);
    actualMinimumDistanceMpc = Math.min(actualMinimumDistanceMpc, distanceMpc);
    actualMaximumDistanceMpc = Math.max(actualMaximumDistanceMpc, distanceMpc);
  }
  if (
    !approximatelyEqual(actualMinimumDistanceMpc, minimumDistanceMpc) ||
    !approximatelyEqual(actualMaximumDistanceMpc, maximumDistanceMpc)
  ) {
    throw invalidCatalog('bornes du catalogue incohérentes');
  }

  return { positionsMpc, visitMap, density, orientationStrength };
}

function approximatelyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= Math.max(0.000_1, Math.abs(right) * 0.000_1);
}

function positiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function invalidCatalog(reason: string): Error {
  return new Error(`Catalogue d’épines Tempel binaire invalide : ${reason}.`);
}
