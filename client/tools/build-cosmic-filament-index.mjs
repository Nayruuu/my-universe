export const DEFAULT_COSMIC_FILAMENT_OPTIONS = Object.freeze({
  cellSizeMpc: 20,
  maximumLengthMpc: 52,
  maximumNeighbors: 2,
});

export function buildCosmicFilamentIndex(
  positionsMpc,
  count,
  options = DEFAULT_COSMIC_FILAMENT_OPTIONS,
  diagnostics,
) {
  if (!Number.isInteger(count) || count < 0 || positionsMpc.length < count * 3) {
    throw new Error('Inconsistent Cosmicflows-4 positions catalogue.');
  }
  if (
    !Number.isFinite(options.cellSizeMpc) ||
    options.cellSizeMpc <= 0 ||
    !Number.isFinite(options.maximumLengthMpc) ||
    options.maximumLengthMpc <= 0 ||
    !Number.isInteger(options.maximumNeighbors) ||
    options.maximumNeighbors <= 0
  ) {
    throw new Error('Cosmicflows-4 filament parameters are invalid.');
  }
  if (count <= 1) {
    return new Uint32Array();
  }
  if (diagnostics) {
    diagnostics.visitedCellCount = 0;
    diagnostics.candidateComparisonCount = 0;
  }

  const cells = buildSpatialCells(positionsMpc, count, options.cellSizeMpc);
  const searchRadius = Math.ceil(options.maximumLengthMpc / options.cellSizeMpc);
  const maximumDistanceSquared = options.maximumLengthMpc ** 2;
  const edgeKeys = new Set();
  const edges = [];

  for (let index = 0; index < count; index += 1) {
    const offset = index * 3;
    const x = positionsMpc[offset];
    const y = positionsMpc[offset + 1];
    const z = positionsMpc[offset + 2];
    const cellX = Math.floor(x / options.cellSizeMpc);
    const cellY = Math.floor(y / options.cellSizeMpc);
    const cellZ = Math.floor(z / options.cellSizeMpc);
    const candidates = [];

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
      const key = fromIndex * count + toIndex;

      if (edgeKeys.has(key)) {
        continue;
      }
      edgeKeys.add(key);
      edges.push({ fromIndex, toIndex });
    }
  }

  edges.sort((first, second) => edgeOrder(first) - edgeOrder(second));
  const pairs = new Uint32Array(edges.length * 2);

  for (let index = 0; index < edges.length; index += 1) {
    pairs[index * 2] = edges[index].fromIndex;
    pairs[index * 2 + 1] = edges[index].toIndex;
  }

  return pairs;
}

function collectShellCandidates(
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
  maximumNeighbors,
  candidates,
  diagnostics,
) {
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
          const deltaPositionX = positionsMpc[candidateOffset] - x;
          const deltaPositionY = positionsMpc[candidateOffset + 1] - y;
          const deltaPositionZ = positionsMpc[candidateOffset + 2] - z;
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

function retainNearestCandidate(candidates, candidate, maximumNeighbors) {
  let insertionIndex = 0;

  while (
    insertionIndex < candidates.length &&
    compareCandidates(candidates[insertionIndex], candidate) <= 0
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

function compareCandidates(first, second) {
  return first.distanceSquared - second.distanceSquared || first.index - second.index;
}

function canStopNeighborSearch(
  candidates,
  maximumNeighbors,
  maximumLengthMpc,
  x,
  y,
  z,
  cellX,
  cellY,
  cellZ,
  radius,
  cellSizeMpc,
) {
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

  return candidates.at(-1).distanceSquared < minimumOutsideDistance ** 2;
}

function buildSpatialCells(positionsMpc, count, cellSizeMpc) {
  const cells = new Map();

  for (let index = 0; index < count; index += 1) {
    const offset = index * 3;
    const x = positionsMpc[offset];
    const y = positionsMpc[offset + 1];
    const z = positionsMpc[offset + 2];

    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      throw new Error(`Cosmicflows-4 catalogue: non-finite position at index ${index}.`);
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

function getCellOccupants(cells, x, y, z) {
  return cells.get(x)?.get(y)?.get(z);
}

function edgeOrder(edge) {
  let hash =
    Math.imul(edge.fromIndex + 1, 2_654_435_761) ^ Math.imul(edge.toIndex + 1, 805_459_861);

  hash ^= hash >>> 16;
  hash = Math.imul(hash, 2_246_822_507);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 3_266_489_909);

  return (hash ^ (hash >>> 16)) >>> 0;
}
