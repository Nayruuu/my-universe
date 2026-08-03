export interface CosmicFilamentEdge {
  readonly fromIndex: number;
  readonly toIndex: number;
  readonly distanceMpc: number;
  readonly strength: number;
}

export interface CosmicFilamentGraphOptions {
  readonly cellSizeMpc: number;
  readonly maximumLengthMpc: number;
  readonly maximumNeighbors: number;
}

export interface CosmicFilamentGraphDiagnostics {
  visitedCellCount: number;
  candidateComparisonCount: number;
}

const DEFAULT_OPTIONS: CosmicFilamentGraphOptions = {
  cellSizeMpc: 20,
  maximumLengthMpc: 52,
  maximumNeighbors: 2,
};

interface NeighborCandidate {
  readonly index: number;
  readonly distanceSquared: number;
}

type SpatialCells = Map<number, Map<number, Map<number, number[]>>>;

export function buildCosmicFilamentGraph(
  positionsMpc: Float32Array,
  count: number,
  options: CosmicFilamentGraphOptions = DEFAULT_OPTIONS,
  diagnostics?: CosmicFilamentGraphDiagnostics,
): CosmicFilamentEdge[] {
  if (!Number.isInteger(count) || count < 0 || positionsMpc.length < count * 3) {
    throw new Error('Catalogue de positions Cosmicflows-4 incohérent.');
  }
  if (
    !Number.isFinite(options.cellSizeMpc) ||
    options.cellSizeMpc <= 0 ||
    !Number.isFinite(options.maximumLengthMpc) ||
    options.maximumLengthMpc <= 0 ||
    !Number.isInteger(options.maximumNeighbors) ||
    options.maximumNeighbors <= 0
  ) {
    throw new Error('Les paramètres de filaments Cosmicflows-4 sont invalides.');
  }
  if (count <= 1) {
    return [];
  }
  if (diagnostics) {
    diagnostics.visitedCellCount = 0;
    diagnostics.candidateComparisonCount = 0;
  }

  const cells = buildSpatialCells(positionsMpc, count, options.cellSizeMpc);
  const searchRadius = Math.ceil(options.maximumLengthMpc / options.cellSizeMpc);
  const maximumDistanceSquared = options.maximumLengthMpc ** 2;
  const edgeKeys = new Set<string>();
  const edges: CosmicFilamentEdge[] = [];

  for (let index = 0; index < count; index += 1) {
    const offset = index * 3;
    const x = positionsMpc[offset]!;
    const y = positionsMpc[offset + 1]!;
    const z = positionsMpc[offset + 2]!;
    const cellX = Math.floor(x / options.cellSizeMpc);
    const cellY = Math.floor(y / options.cellSizeMpc);
    const cellZ = Math.floor(z / options.cellSizeMpc);
    const candidates: NeighborCandidate[] = [];

    for (let radius = 0; radius <= searchRadius; radius += 1) {
      collectShellCandidates(
        cells,
        positionsMpc,
        index,
        x,
        y,
        z,
        cellX,
        cellY,
        cellZ,
        radius,
        maximumDistanceSquared,
        options.maximumNeighbors,
        candidates,
        diagnostics,
      );
      if (
        canStopNeighborSearch(
          candidates,
          options.maximumNeighbors,
          options.maximumLengthMpc,
          x,
          y,
          z,
          cellX,
          cellY,
          cellZ,
          radius,
          options.cellSizeMpc,
        )
      ) {
        break;
      }
    }

    for (const candidate of candidates) {
      const fromIndex = Math.min(index, candidate.index);
      const toIndex = Math.max(index, candidate.index);
      const key = `${fromIndex}:${toIndex}`;

      if (edgeKeys.has(key)) {
        continue;
      }
      edgeKeys.add(key);
      const distanceMpc = Math.sqrt(candidate.distanceSquared);

      edges.push({
        fromIndex,
        toIndex,
        distanceMpc,
        strength: 0.12 + (1 - distanceMpc / options.maximumLengthMpc) * 0.88,
      });
    }
  }

  edges.sort((first, second) => edgeOrder(first) - edgeOrder(second));

  return edges;
}

function collectShellCandidates(
  cells: SpatialCells,
  positionsMpc: Float32Array,
  index: number,
  x: number,
  y: number,
  z: number,
  cellX: number,
  cellY: number,
  cellZ: number,
  radius: number,
  maximumDistanceSquared: number,
  maximumNeighbors: number,
  candidates: NeighborCandidate[],
  diagnostics?: CosmicFilamentGraphDiagnostics,
): void {
  for (let deltaX = -radius; deltaX <= radius; deltaX += 1) {
    for (let deltaY = -radius; deltaY <= radius; deltaY += 1) {
      for (let deltaZ = -radius; deltaZ <= radius; deltaZ += 1) {
        if (
          radius > 0 &&
          Math.max(Math.abs(deltaX), Math.abs(deltaY), Math.abs(deltaZ)) !== radius
        ) {
          continue;
        }
        if (diagnostics) {
          diagnostics.visitedCellCount += 1;
        }
        const occupants = getCellOccupants(cells, cellX + deltaX, cellY + deltaY, cellZ + deltaZ);

        if (!occupants) {
          continue;
        }
        for (const candidateIndex of occupants) {
          if (diagnostics) {
            diagnostics.candidateComparisonCount += 1;
          }
          if (candidateIndex === index) {
            continue;
          }
          const candidateOffset = candidateIndex * 3;
          const deltaPositionX = positionsMpc[candidateOffset]! - x;
          const deltaPositionY = positionsMpc[candidateOffset + 1]! - y;
          const deltaPositionZ = positionsMpc[candidateOffset + 2]! - z;
          const distanceSquared = deltaPositionX ** 2 + deltaPositionY ** 2 + deltaPositionZ ** 2;

          if (distanceSquared === 0 || distanceSquared > maximumDistanceSquared) {
            continue;
          }
          retainNearestCandidate(
            candidates,
            { index: candidateIndex, distanceSquared },
            maximumNeighbors,
          );
        }
      }
    }
  }
}

function retainNearestCandidate(
  candidates: NeighborCandidate[],
  candidate: NeighborCandidate,
  maximumNeighbors: number,
): void {
  let insertionIndex = 0;

  while (
    insertionIndex < candidates.length &&
    compareCandidates(candidates[insertionIndex]!, candidate) <= 0
  ) {
    insertionIndex += 1;
  }
  if (insertionIndex >= maximumNeighbors) {
    return;
  }
  candidates.splice(insertionIndex, 0, candidate);
  if (candidates.length > maximumNeighbors) {
    candidates.pop();
  }
}

function compareCandidates(first: NeighborCandidate, second: NeighborCandidate): number {
  return first.distanceSquared - second.distanceSquared || first.index - second.index;
}

function canStopNeighborSearch(
  candidates: readonly NeighborCandidate[],
  maximumNeighbors: number,
  maximumLengthMpc: number,
  x: number,
  y: number,
  z: number,
  cellX: number,
  cellY: number,
  cellZ: number,
  radius: number,
  cellSizeMpc: number,
): boolean {
  const minimumOutsideDistance = Math.min(
    x - (cellX - radius) * cellSizeMpc,
    (cellX + radius + 1) * cellSizeMpc - x,
    y - (cellY - radius) * cellSizeMpc,
    (cellY + radius + 1) * cellSizeMpc - y,
    z - (cellZ - radius) * cellSizeMpc,
    (cellZ + radius + 1) * cellSizeMpc - z,
  );

  if (minimumOutsideDistance > maximumLengthMpc) {
    return true;
  }
  if (candidates.length < maximumNeighbors) {
    return false;
  }

  return candidates[candidates.length - 1]!.distanceSquared < minimumOutsideDistance ** 2;
}

function buildSpatialCells(
  positionsMpc: Float32Array,
  count: number,
  cellSizeMpc: number,
): SpatialCells {
  const cells: SpatialCells = new Map();

  for (let index = 0; index < count; index += 1) {
    const offset = index * 3;
    const x = positionsMpc[offset]!;
    const y = positionsMpc[offset + 1]!;
    const z = positionsMpc[offset + 2]!;

    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      throw new Error(`Catalogue Cosmicflows-4 : position non finie à l’index ${index}.`);
    }
    const cellX = Math.floor(x / cellSizeMpc);
    const cellY = Math.floor(y / cellSizeMpc);
    const cellZ = Math.floor(z / cellSizeMpc);
    let rows = cells.get(cellX);

    if (!rows) {
      rows = new Map();
      cells.set(cellX, rows);
    }
    let columns = rows.get(cellY);

    if (!columns) {
      columns = new Map();
      rows.set(cellY, columns);
    }
    const occupants = columns.get(cellZ);

    if (occupants) {
      occupants.push(index);
    } else {
      columns.set(cellZ, [index]);
    }
  }

  return cells;
}

function getCellOccupants(
  cells: SpatialCells,
  x: number,
  y: number,
  z: number,
): readonly number[] | undefined {
  return cells.get(x)?.get(y)?.get(z);
}

function edgeOrder(edge: CosmicFilamentEdge): number {
  let hash =
    Math.imul(edge.fromIndex + 1, 2_654_435_761) ^ Math.imul(edge.toIndex + 1, 805_459_861);

  hash ^= hash >>> 16;
  hash = Math.imul(hash, 2_246_822_507);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 3_266_489_909);

  return (hash ^ (hash >>> 16)) >>> 0;
}
