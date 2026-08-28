import * as THREE from 'three';
import { type GraphicQuality, type StarTileIndex } from '../../data/models/universe.models';

export interface StarTileRenderNode {
  readonly id: string;
  readonly parentId?: string;
  readonly childIds: readonly string[];
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

export const STAR_TILE_NAVIGATION_LOD_LEVEL = 2;
export const STAR_TILE_OVERVIEW_NAVIGATION_LOD_LEVEL = 3;
export const STAR_TILE_LOCAL_GROUP_NAVIGATION_LOD_LEVEL = 4;

export function isStarTileNavigationLodLevel(lodLevel: number): boolean {
  return (
    lodLevel === STAR_TILE_NAVIGATION_LOD_LEVEL ||
    lodLevel === STAR_TILE_OVERVIEW_NAVIGATION_LOD_LEVEL ||
    lodLevel === STAR_TILE_LOCAL_GROUP_NAVIGATION_LOD_LEVEL
  );
}

const REFINEMENT_BUDGETS = {
  low: 2,
  medium: 4,
  high: 8,
} as const satisfies Record<GraphicQuality, number>;

const REFINEMENT_PIXEL_THRESHOLDS = {
  low: 80,
  medium: 48,
  high: 28,
} as const satisfies Record<GraphicQuality, number>;

export function createStarTileRenderNodes(
  index: StarTileIndex,
  projectPosition: StarPositionProjector,
): readonly StarTileRenderNode[] {
  return index.nodes.map((node) => {
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

    return {
      id: node.id,
      parentId: node.parentId,
      childIds: node.childIds,
      center: sphere.center,
      radius: sphere.radius,
    };
  });
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
  const roots = nodes.filter((node) => node.parentId === undefined);
  const visibleRoots = roots.filter((node) => isVisible(node, view));

  if (view.lodLevel >= STAR_TILE_OVERVIEW_NAVIGATION_LOD_LEVEL) {
    return visibleRoots.map((node) => node.id).sort();
  }

  const candidates = visibleRoots
    .filter((node) => node.childIds.length > 0)
    .filter((node) => isCenterVisible(node, view))
    .map((node) => ({ node, pixels: projectedDiameterPixels(node, view) }))
    .filter((candidate) => candidate.pixels >= REFINEMENT_PIXEL_THRESHOLDS[view.quality])
    .sort((left, right) => right.pixels - left.pixels || left.node.id.localeCompare(right.node.id))
    .slice(0, REFINEMENT_BUDGETS[view.quality]);
  const refinedIds = new Set(candidates.map((candidate) => candidate.node.id));
  const selectedIds = visibleRoots.flatMap((node) =>
    refinedIds.has(node.id) ? [...node.childIds] : [node.id],
  );

  return selectedIds.sort();
}

function isVisible(node: StarTileRenderNode, view: StarTileView): boolean {
  const sphere = new THREE.Sphere(
    node.center.clone().add(view.worldOffset),
    Math.max(node.radius, 0.001),
  );

  return view.frustum.intersectsSphere(sphere);
}

function isCenterVisible(node: StarTileRenderNode, view: StarTileView): boolean {
  return view.frustum.containsPoint(node.center.clone().add(view.worldOffset));
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
