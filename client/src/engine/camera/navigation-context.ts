import { ReferenceFrame, SpaceObject } from '../../data/models/universe.models';
import { NAVIGATION_SCALES } from './navigation-scales';

export interface NavigationContext {
  targetId: string | null;
  referenceFrame: ReferenceFrame;
  lodLevel: number;
}

export type NavigationObjectReader = (objectId: string) => SpaceObject | undefined;

const MAX_LOD_LEVEL = NAVIGATION_SCALES.length - 1;
const CANONICAL_TARGET_IDS = new Set(NAVIGATION_SCALES.map((scale) => scale.targetId));
const CANONICAL_TARGETS = NAVIGATION_SCALES.map((scale) => scale.targetId);
const NAVIGATION_REFERENCE_FRAMES: readonly ReferenceFrame[] = [
  'solar-system',
  'solar-system',
  'stellar',
  'galactic',
  'local-group',
  'nearby-universe',
  'cosmic-web',
];

export class NavigationContextJourney {
  private targets: Array<string | null> = NAVIGATION_SCALES.map(() => null);

  constructor(private readonly getObject: NavigationObjectReader) {}

  public adoptTarget(objectId: string): void {
    this.targets = CANONICAL_TARGET_IDS.has(objectId)
      ? [...CANONICAL_TARGETS]
      : resolveHierarchyTargets(objectId, this.getObject);
  }

  public adoptObjectTarget(objectId: string): void {
    this.targets = resolveHierarchyTargets(objectId, this.getObject);
  }

  public clear(): void {
    this.targets = NAVIGATION_SCALES.map(() => null);
  }

  public resolve(lodLevel: number): NavigationContext {
    const normalizedLevel = normalizeLodLevel(lodLevel);

    return {
      targetId: this.targets[normalizedLevel] ?? null,
      referenceFrame: getNavigationReferenceFrame(normalizedLevel),
      lodLevel: normalizedLevel,
    };
  }
}

export function getNavigationReferenceFrame(lodLevel: number): ReferenceFrame {
  return NAVIGATION_REFERENCE_FRAMES[normalizeLodLevel(lodLevel)]!;
}

function resolveHierarchyTargets(
  objectId: string,
  getObject: NavigationObjectReader,
): Array<string | null> {
  const lineage = collectLineage(objectId, getObject);

  if (lineage.length === 0) {
    return NAVIGATION_SCALES.map(() => objectId);
  }
  const target = lineage[0]!;
  const star = lineage.find((object) => object.type === 'star') ?? target;
  const galaxy = lineage.find((object) => object.type === 'galaxy') ?? target;
  const group =
    lineage.find((object) => object.type === 'galaxy-cluster') ??
    lineage.find((object) => object.type === 'region' && object.referenceFrame === 'local-group') ??
    galaxy;
  const nearbyUniverse =
    lineage.find(
      (object) =>
        object.referenceFrame === 'nearby-universe' &&
        (object.type === 'universe' || object.type === 'region'),
    ) ?? group;
  const cosmicWeb =
    lineage.find(
      (object) => object.referenceFrame === 'cosmic-web' && object.type === 'universe',
    ) ?? nearbyUniverse;

  return [target.id, star.id, star.id, galaxy.id, group.id, nearbyUniverse.id, cosmicWeb.id];
}

function collectLineage(objectId: string, getObject: NavigationObjectReader): SpaceObject[] {
  const lineage: SpaceObject[] = [];
  const visited = new Set<string>();
  let currentId: string | undefined = objectId;

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const object = getObject(currentId);

    if (!object) {
      break;
    }
    lineage.push(object);
    currentId = object.parentId;
  }

  return lineage;
}

function normalizeLodLevel(lodLevel: number): number {
  return Math.max(0, Math.min(MAX_LOD_LEVEL, Math.trunc(lodLevel)));
}
