import * as THREE from 'three';
import {
  type DistanceUnit,
  type GraphicQuality,
  type ReferenceFrame,
  type SpaceTileIndex,
} from '../../data/models/universe.models';

export const SPACE_TILE_OVERVIEW_LOD = 5;

export interface SpaceTileRenderNode {
  readonly id: string;
  readonly parentId?: string;
  readonly childIds: readonly string[];
  readonly center: THREE.Vector3;
  readonly radius: number;
}

export interface SpaceTileView {
  readonly lodLevel: number;
  readonly quality: GraphicQuality;
  readonly viewportHeight: number;
  readonly projectionScaleY: number;
  readonly cameraPosition: THREE.Vector3;
  readonly worldOffset: THREE.Vector3;
  readonly frustum: THREE.Frustum;
}

type SpacePositionProjector = (
  position: readonly [number, number, number],
  unit: DistanceUnit,
  frame: ReferenceFrame,
  target: THREE.Vector3,
) => THREE.Vector3;

const TILE_BUDGETS = {
  low: 2,
  medium: 3,
  high: 5,
} as const satisfies Record<GraphicQuality, number>;

const REFINEMENT_PIXEL_THRESHOLDS = {
  low: 900,
  medium: 520,
  high: 240,
} as const satisfies Record<GraphicQuality, number>;

export function createSpaceTileRenderNodes(
  index: SpaceTileIndex,
  projectPosition: SpacePositionProjector,
): readonly SpaceTileRenderNode[] {
  return index.tiles.map((tile) => {
    const box = new THREE.Box3();
    const sample = new THREE.Vector3();

    for (const x of sampleAxis(tile.bounds.min[0], tile.bounds.max[0])) {
      for (const y of sampleAxis(tile.bounds.min[1], tile.bounds.max[1])) {
        for (const z of sampleAxis(tile.bounds.min[2], tile.bounds.max[2])) {
          box.expandByPoint(
            projectPosition([x, y, z], tile.bounds.unit, tile.referenceFrame, sample),
          );
        }
      }
    }
    const sphere = box.getBoundingSphere(new THREE.Sphere());

    return {
      id: tile.id,
      parentId: tile.parentId,
      childIds: tile.childIds ?? [],
      center: sphere.center,
      radius: sphere.radius,
    };
  });
}

export function createSpaceTileView(
  camera: THREE.PerspectiveCamera,
  viewportHeight: number,
  lodLevel: number,
  quality: GraphicQuality,
  worldOffset: THREE.Vector3,
): SpaceTileView {
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

export function selectSpaceTileIds(
  nodes: readonly SpaceTileRenderNode[],
  view: SpaceTileView,
  retainedTileIds: readonly string[],
): readonly string[] {
  const knownIds = new Set(nodes.map((node) => node.id));
  const retainedIds = new Set(retainedTileIds.filter((tileId) => knownIds.has(tileId)));

  if (view.lodLevel !== SPACE_TILE_OVERVIEW_LOD) {
    return [...retainedIds].sort();
  }
  const selectedIds = selectVisibleTileIds(nodes, view, TILE_BUDGETS[view.quality]);

  return [...new Set([...selectedIds, ...retainedIds])].sort();
}

function selectVisibleTileIds(
  nodes: readonly SpaceTileRenderNode[],
  view: SpaceTileView,
  budget: number,
): readonly string[] {
  const candidatesById = new Map(
    nodes
      .filter((node) => isVisible(node, view))
      .map((node) => [node.id, candidate(node, view)] as const),
  );
  const roots = [...candidatesById.values()]
    .filter(({ node }) => node.parentId === undefined)
    .sort(compareCandidates);
  const refinementRoot = roots.find((entry) => canRefine(entry, view));

  if (!refinementRoot) {
    return roots.slice(0, budget).map(({ node }) => node.id);
  }

  const selected = [refinementRoot];
  const deferred = roots.filter(({ node }) => node.id !== refinementRoot.node.id);
  let current = refinementRoot;

  while (selected.length < budget && canRefine(current, view)) {
    const children = current.node.childIds
      .map((childId) => candidatesById.get(childId))
      .filter((entry): entry is TileCandidate => entry !== undefined)
      .sort(compareCandidates);
    const next = children.shift();

    if (!next) {
      break;
    }
    selected.push(next);
    deferred.push(...children);
    current = next;
  }

  const selectedIds = new Set(selected.map(({ node }) => node.id));
  const filler = deferred
    .filter(({ node }) => !selectedIds.has(node.id))
    .sort(compareCandidates)
    .slice(0, budget - selected.length);

  return [...selected, ...filler].map(({ node }) => node.id);
}

interface TileCandidate {
  readonly node: SpaceTileRenderNode;
  readonly pixels: number;
}

function candidate(node: SpaceTileRenderNode, view: SpaceTileView): TileCandidate {
  return { node, pixels: projectedDiameterPixels(node, view) };
}

function canRefine(candidate: TileCandidate, view: SpaceTileView): boolean {
  return (
    candidate.node.childIds.length > 0 &&
    candidate.pixels >= REFINEMENT_PIXEL_THRESHOLDS[view.quality]
  );
}

function compareCandidates(left: TileCandidate, right: TileCandidate): number {
  return right.pixels - left.pixels || left.node.id.localeCompare(right.node.id);
}

function isVisible(node: SpaceTileRenderNode, view: SpaceTileView): boolean {
  const sphere = new THREE.Sphere(
    node.center.clone().add(view.worldOffset),
    Math.max(node.radius, 0.001),
  );

  return view.frustum.intersectsSphere(sphere);
}

function projectedDiameterPixels(node: SpaceTileRenderNode, view: SpaceTileView): number {
  const worldCenter = node.center.clone().add(view.worldOffset);
  const surfaceDistance = Math.max(1, view.cameraPosition.distanceTo(worldCenter) - node.radius);

  return (node.radius * view.projectionScaleY * view.viewportHeight) / surfaceDistance;
}

function sampleAxis(minimum: number, maximum: number): readonly number[] {
  return [minimum, (minimum + maximum) / 2, maximum];
}
