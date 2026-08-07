import * as THREE from 'three';
import { type CosmicGroupCatalogRegistry } from '../objects/cosmic-group-catalog-registry';
import { getCosmicGroupRevealThreshold, stableMapPriority } from './cosmic-map-policy';

export interface CosmicGroupFilamentGeometry {
  readonly geometry: THREE.BufferGeometry;
  readonly revealThresholds: Float32Array;
}

export interface CosmicGroupPointGeometry {
  readonly geometry: THREE.BufferGeometry;
  readonly objectIds: readonly string[];
  readonly revealThresholds: Float32Array;
}

interface FilamentRenderRecord {
  readonly edgeIndex: number;
  readonly fromIndex: number;
  readonly toIndex: number;
  readonly alpha: number;
  readonly revealThreshold: number;
}

interface GroupRenderRecord {
  readonly catalogIndex: number;
  readonly objectId: string;
  revealThreshold: number;
}

const FILAMENT_MAXIMUM_LENGTH_MPC = 52;

export function createCosmicGroupFilamentGeometry(
  registry: CosmicGroupCatalogRegistry,
  filamentPairs: Uint32Array,
): CosmicGroupFilamentGeometry {
  const edgeCount = filamentPairs.length / 2;
  const records = Array.from({ length: edgeCount }, (_, edgeIndex) =>
    createFilamentRecord(registry, filamentPairs, edgeIndex),
  ).sort(
    (left, right) =>
      left.revealThreshold - right.revealThreshold || left.edgeIndex - right.edgeIndex,
  );
  const positions = new Float32Array(edgeCount * 6);
  const alphas = new Float32Array(edgeCount * 2);
  const detailThresholds = new Float32Array(edgeCount * 2);
  const revealThresholds = new Float32Array(edgeCount);

  for (let renderIndex = 0; renderIndex < records.length; renderIndex += 1) {
    const record = records[renderIndex]!;
    const vertexOffset = renderIndex * 6;
    const alphaOffset = renderIndex * 2;
    const sourceOffset = record.fromIndex * 3;
    const targetOffset = record.toIndex * 3;

    positions.set(registry.renderPositions.subarray(sourceOffset, sourceOffset + 3), vertexOffset);
    positions.set(
      registry.renderPositions.subarray(targetOffset, targetOffset + 3),
      vertexOffset + 3,
    );
    alphas[alphaOffset] = record.alpha;
    alphas[alphaOffset + 1] = record.alpha;
    detailThresholds[alphaOffset] = record.revealThreshold;
    detailThresholds[alphaOffset + 1] = record.revealThreshold;
    revealThresholds[renderIndex] = record.revealThreshold;
  }
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('lineAlpha', new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute('detailThreshold', new THREE.BufferAttribute(detailThresholds, 1));
  geometry.setDrawRange(0, 0);
  if (edgeCount > 0) {
    geometry.computeBoundingSphere();
  }

  return { geometry, revealThresholds };
}

export function createCosmicGroupPointGeometry(
  registry: CosmicGroupCatalogRegistry,
): CosmicGroupPointGeometry {
  const catalog = registry.catalog;
  const records: GroupRenderRecord[] = Array.from({ length: catalog.count }, (_, catalogIndex) => ({
    catalogIndex,
    objectId: registry.objectIds[catalogIndex]!,
    revealThreshold: getCosmicGroupRevealThreshold(registry.objectIds[catalogIndex]!),
  }));

  if (records.length > 0) {
    records[0]!.revealThreshold = 0;
  }
  records.sort(
    (left, right) =>
      left.revealThreshold - right.revealThreshold || left.catalogIndex - right.catalogIndex,
  );
  const positions = new Float32Array(catalog.count * 3);
  const sizes = new Float32Array(catalog.count);
  const alphas = new Float32Array(catalog.count);
  const colors = new Float32Array(catalog.count * 3);
  const revealThresholds = new Float32Array(catalog.count);
  const galaxyAngles = new Float32Array(catalog.count);
  const galaxyAxisRatios = new Float32Array(catalog.count);
  const galaxyProfiles = new Float32Array(catalog.count);
  const galaxyProminences = new Float32Array(catalog.count);
  const galaxySeeds = new Float32Array(catalog.count);
  const objectIds = new Array<string>(catalog.count);
  const nearColor = new THREE.Color(0xffc876);
  const middleColor = new THREE.Color(0xb9e5ff);
  const farColor = new THREE.Color(0x8c78ff);
  const pointColor = new THREE.Color();

  for (let renderIndex = 0; renderIndex < catalog.count; renderIndex += 1) {
    const record = records[renderIndex]!;
    const catalogIndex = record.catalogIndex;
    const sourceOffset = catalogIndex * 3;
    const renderOffset = renderIndex * 3;
    const reliability =
      1 - THREE.MathUtils.clamp(catalog.distanceModulusErrors[catalogIndex]! / 1.2, 0, 1);
    const objectId = record.objectId;
    const depth = normalizedLogarithmicDepth(
      catalog.distancesMpc[catalogIndex]!,
      catalog.minimumDistanceMpc,
      catalog.maximumDistanceMpc,
    );
    const prominence = Math.pow(1 - stableMapPriority(`${objectId}:prominence`), 6);

    positions.set(registry.renderPositions.subarray(sourceOffset, sourceOffset + 3), renderOffset);
    sizes[renderIndex] = 2.4 + reliability * 5.5 + (1 - depth) * 3 + prominence * 2.4;
    alphas[renderIndex] = 0.3 + reliability * 0.5 + prominence * 0.08;

    if (depth < 0.5) {
      pointColor.lerpColors(nearColor, middleColor, depth * 2);
    } else {
      pointColor.lerpColors(middleColor, farColor, (depth - 0.5) * 2);
    }
    colors[renderOffset] = pointColor.r;
    colors[renderOffset + 1] = pointColor.g;
    colors[renderOffset + 2] = pointColor.b;
    revealThresholds[renderIndex] = record.revealThreshold;
    galaxyAngles[renderIndex] = stableMapPriority(`${objectId}:angle`) * Math.PI * 2;
    galaxyAxisRatios[renderIndex] = 0.28 + stableMapPriority(`${objectId}:axis-ratio`) * 0.68;
    galaxyProfiles[renderIndex] = stableMapPriority(`${objectId}:profile`);
    galaxyProminences[renderIndex] = prominence;
    galaxySeeds[renderIndex] = stableMapPriority(`${objectId}:structure`);
    objectIds[renderIndex] = objectId;
  }
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('pointSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('pointAlpha', new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute('pointColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('revealThreshold', new THREE.BufferAttribute(revealThresholds, 1));
  geometry.setAttribute('galaxyAngle', new THREE.BufferAttribute(galaxyAngles, 1));
  geometry.setAttribute('galaxyAxisRatio', new THREE.BufferAttribute(galaxyAxisRatios, 1));
  geometry.setAttribute('galaxyProfile', new THREE.BufferAttribute(galaxyProfiles, 1));
  geometry.setAttribute('galaxyProminence', new THREE.BufferAttribute(galaxyProminences, 1));
  geometry.setAttribute('galaxySeed', new THREE.BufferAttribute(galaxySeeds, 1));
  geometry.setDrawRange(0, 0);
  geometry.computeBoundingSphere();

  return { geometry, objectIds, revealThresholds };
}

function createFilamentRecord(
  registry: CosmicGroupCatalogRegistry,
  filamentPairs: Uint32Array,
  edgeIndex: number,
): FilamentRenderRecord {
  const fromIndex = filamentPairs[edgeIndex * 2]!;
  const toIndex = filamentPairs[edgeIndex * 2 + 1]!;
  const sourceOffset = fromIndex * 3;
  const targetOffset = toIndex * 3;
  const deltaX =
    registry.catalog.positionsMpc[targetOffset]! - registry.catalog.positionsMpc[sourceOffset]!;
  const deltaY =
    registry.catalog.positionsMpc[targetOffset + 1]! -
    registry.catalog.positionsMpc[sourceOffset + 1]!;
  const deltaZ =
    registry.catalog.positionsMpc[targetOffset + 2]! -
    registry.catalog.positionsMpc[sourceOffset + 2]!;
  const distanceMpc = Math.hypot(deltaX, deltaY, deltaZ);
  const strength =
    0.12 + (1 - THREE.MathUtils.clamp(distanceMpc / FILAMENT_MAXIMUM_LENGTH_MPC, 0, 1)) * 0.88;
  const sourceReliability =
    1 - THREE.MathUtils.clamp(registry.catalog.distanceModulusErrors[fromIndex]! / 1.2, 0, 1);
  const targetReliability =
    1 - THREE.MathUtils.clamp(registry.catalog.distanceModulusErrors[toIndex]! / 1.2, 0, 1);
  const reliability = (sourceReliability + targetReliability) * 0.5;

  return {
    edgeIndex,
    fromIndex,
    toIndex,
    alpha: (0.38 + strength * 0.62) * (0.6 + reliability * 0.4),
    revealThreshold: 0.04 + (1 - (strength * 0.72 + reliability * 0.28)) * 0.72,
  };
}

function normalizedLogarithmicDepth(distance: number, minimum: number, maximum: number): number {
  const logarithmicMinimum = Math.log1p(Math.max(0, minimum));
  const logarithmicRange = Math.max(
    0.000_001,
    Math.log1p(Math.max(0, maximum)) - logarithmicMinimum,
  );

  return THREE.MathUtils.clamp(
    (Math.log1p(Math.max(0, distance)) - logarithmicMinimum) / logarithmicRange,
    0,
    1,
  );
}
