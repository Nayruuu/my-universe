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
}

type StarPositionProjector = (
  positionParsec: readonly [number, number, number],
  target: THREE.Vector3,
) => THREE.Vector3;

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
  };
}

export function selectStarTileNodeIds(
  nodes: readonly StarTileRenderNode[],
  view: StarTileView,
): readonly string[] {
  if (view.lodLevel !== 3 && view.lodLevel !== 4) {
    return [];
  }
  const roots = nodes.filter((node) => node.parentId === undefined);
  const visibleRoots = roots.filter((node) => isVisible(node, view));

  if (view.lodLevel === 4) {
    return visibleRoots.map((node) => node.id).sort();
  }

  const candidates = visibleRoots
    .filter((node) => node.childIds.length > 0)
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

function projectedDiameterPixels(node: StarTileRenderNode, view: StarTileView): number {
  const worldCenter = node.center.clone().add(view.worldOffset);
  const surfaceDistance = Math.max(1, view.cameraPosition.distanceTo(worldCenter) - node.radius);

  return (node.radius * view.projectionScaleY * view.viewportHeight) / surfaceDistance;
}

function sampleAxis(minimum: number, maximum: number): readonly number[] {
  return [minimum, (minimum + maximum) / 2, maximum];
}
