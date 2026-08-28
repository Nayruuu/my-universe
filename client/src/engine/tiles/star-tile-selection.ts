import * as THREE from 'three';
import { type GraphicQuality, type StarTileIndex } from '../../data/models/universe.models';
import { finishCatalogPreparation } from '../core/catalog-preparation';

export interface StarTileRenderNode {
  readonly id: string;
  readonly parentId?: string;
  readonly childIds: readonly string[];
  readonly clusterCount: number;
  readonly center: THREE.Vector3;
  readonly radius: number;
}

export interface StarTileView {
  readonly lodLevel: number;
  readonly quality: GraphicQuality;
  readonly viewportHeight: number;
  readonly projectionScaleY: number;
  readonly cameraPosition: THREE.Vector3;
  readonly worldOffset: THREE.Vector3;
  readonly frustum: THREE.Frustum;
  readonly stellarNeighborhoodReveal?: number;
}

type StarPositionProjector = (
  positionParsec: readonly [number, number, number],
  target: THREE.Vector3,
) => THREE.Vector3;

export const STAR_TILE_SOLAR_SYSTEM_NAVIGATION_LOD_LEVEL = 1;
export const STAR_TILE_NAVIGATION_LOD_LEVEL = 2;
export const STAR_TILE_OVERVIEW_NAVIGATION_LOD_LEVEL = 3;
export const STAR_TILE_LOCAL_GROUP_NAVIGATION_LOD_LEVEL = 4;

export function isStarTileNavigationLodLevel(lodLevel: number): boolean {
  return (
    lodLevel === STAR_TILE_SOLAR_SYSTEM_NAVIGATION_LOD_LEVEL ||
    lodLevel === STAR_TILE_NAVIGATION_LOD_LEVEL ||
    lodLevel === STAR_TILE_OVERVIEW_NAVIGATION_LOD_LEVEL ||
    lodLevel === STAR_TILE_LOCAL_GROUP_NAVIGATION_LOD_LEVEL
  );
}

export function isDetailedStarTileNavigationLodLevel(lodLevel: number): boolean {
  return (
    lodLevel === STAR_TILE_SOLAR_SYSTEM_NAVIGATION_LOD_LEVEL ||
    lodLevel === STAR_TILE_NAVIGATION_LOD_LEVEL
  );
}

const REFINEMENT_BUDGETS = {
  low: 2,
  medium: 4,
  high: 16,
} as const satisfies Record<GraphicQuality, number>;

const REFINEMENT_PIXEL_THRESHOLDS = {
  low: 80,
  medium: 48,
  high: 28,
} as const satisfies Record<GraphicQuality, number>;

// Each node projects 27 samples, so use smaller batches than point-catalogue preparation.
const STAR_TILE_PREPARATION_CHUNK_SIZE = 128;

export function createStarTileRenderNodes(
  index: StarTileIndex,
  projectPosition: StarPositionProjector,
): readonly StarTileRenderNode[] {
  return finishCatalogPreparation(prepareStarTileRenderNodes(index, projectPosition));
}

export function* prepareStarTileRenderNodes(
  index: StarTileIndex,
  projectPosition: StarPositionProjector,
): Generator<void, readonly StarTileRenderNode[]> {
  const nodes: StarTileRenderNode[] = [];

  for (const node of index.nodes) {
    const box = new THREE.Box3();
    const sample = new THREE.Vector3();
    const xValues = sampleAxis(node.boundsParsec.min[0], node.boundsParsec.max[0]);
    const yValues = sampleAxis(node.boundsParsec.min[1], node.boundsParsec.max[1]);
    const zValues = sampleAxis(node.boundsParsec.min[2], node.boundsParsec.max[2]);

    for (const x of xValues) {
      for (const y of yValues) {
        for (const z of zValues) {
          box.expandByPoint(projectPosition([x, y, z], sample));
        }
      }
    }
    const sphere = box.getBoundingSphere(new THREE.Sphere());

    nodes.push({
      id: node.id,
      parentId: node.parentId,
      childIds: node.childIds,
      clusterCount: node.clusterCount,
      center: sphere.center,
      radius: sphere.radius,
    });
    if (nodes.length % STAR_TILE_PREPARATION_CHUNK_SIZE === 0) {
      yield;
    }
  }

  return nodes;
}

export function createStarTileView(
  camera: THREE.PerspectiveCamera,
  viewportHeight: number,
  lodLevel: number,
  quality: GraphicQuality,
  worldOffset: THREE.Vector3,
  stellarNeighborhoodReveal = 1,
): StarTileView {
  const projectionView = new THREE.Matrix4().multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse,
  );

  return {
    lodLevel,
    quality,
    viewportHeight: Math.max(1, viewportHeight),
    projectionScaleY: camera.projectionMatrix.elements[5]!,
    cameraPosition: camera.position.clone(),
    worldOffset: worldOffset.clone(),
    frustum: new THREE.Frustum().setFromProjectionMatrix(projectionView),
    stellarNeighborhoodReveal: THREE.MathUtils.clamp(stellarNeighborhoodReveal, 0, 1),
  };
}

export function selectStarTileNodeIds(
  nodes: readonly StarTileRenderNode[],
  view: StarTileView,
): readonly string[] {
  if (!isStarTileNavigationLodLevel(view.lodLevel)) {
    return [];
  }
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const roots = nodes.filter((node) => node.parentId === undefined);
  const visibleRoots = selectVisibleStarTileRootNodeIds(nodes, view).map((nodeId) =>
    nodesById.get(nodeId)!,
  );

  if (view.lodLevel >= STAR_TILE_OVERVIEW_NAVIGATION_LOD_LEVEL) {
    return visibleRoots.map((node) => node.id).sort();
  }

  const candidates = visibleRoots
    .filter((node) => node.childIds.length > 0)
    .map((node) => refinementCandidate(node, nodesById, view))
    .filter((candidate) => candidate.visibleDetailCount > 0)
    .filter((candidate) => candidate.pixels >= REFINEMENT_PIXEL_THRESHOLDS[view.quality])
    .sort(
      (left, right) =>
        right.visibleDetailCount - left.visibleDetailCount ||
        right.pixels - left.pixels ||
        left.node.id.localeCompare(right.node.id),
    )
    .slice(0, REFINEMENT_BUDGETS[view.quality]);
  const refinedIds = new Set(candidates.map((candidate) => candidate.node.id));
  // The complete aggregate layer is only a few thousand Gaia cells. Keeping it around the
  // observer gives every direction genuine catalogue coverage while visible roots are refined.
  const selectedIds = roots.flatMap((node) =>
    refinedIds.has(node.id) ? [...node.childIds] : [node.id],
  );

  return selectedIds.sort();
}

export function selectVisibleStarTileRootNodeIds(
  nodes: readonly StarTileRenderNode[],
  view: StarTileView,
): readonly string[] {
  if (!isStarTileNavigationLodLevel(view.lodLevel)) {
    return [];
  }

  return nodes
    .filter((node) => node.parentId === undefined && isVisible(node, view))
    .map((node) => node.id)
    .sort();
}

function refinementCandidate(
  node: StarTileRenderNode,
  nodesById: ReadonlyMap<string, StarTileRenderNode>,
  view: StarTileView,
): {
  readonly node: StarTileRenderNode;
  readonly visibleDetailCount: number;
  readonly pixels: number;
} {
  let visibleDetailCount = 0;
  const pixels = projectedDiameterPixels(node, view);

  for (const childId of node.childIds) {
    const child = nodesById.get(childId);

    if (!child || !isVisible(child, view)) {
      continue;
    }
    visibleDetailCount += child.clusterCount;
  }

  return { node, visibleDetailCount, pixels };
}

function isVisible(node: StarTileRenderNode, view: StarTileView): boolean {
  const sphere = new THREE.Sphere(
    node.center.clone().add(view.worldOffset),
    Math.max(node.radius, 0.001),
  );

  return view.frustum.intersectsSphere(sphere);
}

function projectedDiameterPixels(node: StarTileRenderNode, view: StarTileView): number {
  const worldCenter = node.center.clone().add(view.worldOffset);
  const surfaceDistance = Math.max(1, view.cameraPosition.distanceTo(worldCenter) - node.radius);

  return (
    ((node.radius * view.projectionScaleY * view.viewportHeight) / surfaceDistance) *
    (view.stellarNeighborhoodReveal ?? 1)
  );
}

function sampleAxis(minimum: number, maximum: number): readonly number[] {
  return [minimum, (minimum + maximum) / 2, maximum];
}
