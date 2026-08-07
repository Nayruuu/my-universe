import * as THREE from 'three';
import type { SpaceObjectType } from '../../data/models/universe.models';
import { calculateApparentRadiusPixels } from '../lod/screen-space-lod';
import { circleIntersectsRectangle, type ScreenRectangle } from './label-screen-layout';
import type { LabelObject } from './label-visibility-policy';

export type LabelWorldPositionReader = (
  objectId: string,
  target: THREE.Vector3,
) => THREE.Vector3 | null;

export interface LabelOcclusionCandidate {
  readonly object: LabelObject;
  readonly distanceSquared: number;
  readonly selected: boolean;
}

interface ScreenOccluder {
  readonly objectId: string;
  readonly centerX: number;
  readonly centerY: number;
  readonly radius: number;
  readonly distanceSquared: number;
  readonly occludesSelectedLabels: boolean;
}

const OCCLUDING_OBJECT_TYPES = new Set<SpaceObjectType>([
  'black-hole',
  'supernova',
  'supernova-remnant',
  'star',
  'planet',
  'exoplanet',
  'dwarf-planet',
  'moon',
  'asteroid',
  'comet',
]);
const MINIMUM_OCCLUDER_RADIUS_PX = 6;
const LABEL_OCCLUSION_PADDING_PX = 4;

export class LabelOcclusionManager {
  private readonly worldPosition = new THREE.Vector3();
  private readonly projectedPosition = new THREE.Vector3();
  private readonly occluders: ScreenOccluder[] = [];
  private potentialOccluders: readonly LabelObject[] = [];

  public get occluderCount(): number {
    return this.occluders.length;
  }

  public setObjects(objects: readonly LabelObject[]): void {
    this.potentialOccluders = objects.filter(isPotentialOccluder);
  }

  public collect(
    camera: THREE.Camera,
    readWorldPosition: LabelWorldPositionReader,
    viewportWidth: number,
    viewportHeight: number,
  ): void {
    this.occluders.length = 0;
    if (!(camera instanceof THREE.PerspectiveCamera)) {
      return;
    }

    for (const object of this.potentialOccluders) {
      const visualRadius = object.visual!.visualRadius!;
      const position = readWorldPosition(object.id, this.worldPosition);

      if (!position) {
        continue;
      }
      const distanceSquared = camera.position.distanceToSquared(position);
      const radius = calculateApparentRadiusPixels(
        visualRadius,
        Math.sqrt(distanceSquared),
        viewportHeight,
        camera.fov,
      );

      if (radius < MINIMUM_OCCLUDER_RADIUS_PX) {
        continue;
      }
      this.projectedPosition.copy(position).project(camera);
      if (this.projectedPosition.z < -1 || this.projectedPosition.z > 1) {
        continue;
      }
      this.occluders.push({
        objectId: object.id,
        centerX: (this.projectedPosition.x * 0.5 + 0.5) * viewportWidth,
        centerY: (-this.projectedPosition.y * 0.5 + 0.5) * viewportHeight,
        radius,
        distanceSquared,
        occludesSelectedLabels: object.type === 'star' || object.type === 'black-hole',
      });
    }
  }

  public isOccluded(
    candidate: LabelOcclusionCandidate,
    rectangle: ScreenRectangle,
    pointX: number,
    pointY: number,
  ): boolean {
    return this.occluders.some((occluder) => {
      if (
        occluder.objectId === candidate.object.id ||
        candidate.distanceSquared <= occluder.distanceSquared ||
        (candidate.selected && !occluder.occludesSelectedLabels)
      ) {
        return false;
      }
      const radius = occluder.radius + LABEL_OCCLUSION_PADDING_PX;
      const pointDistance = Math.hypot(pointX - occluder.centerX, pointY - occluder.centerY);

      return (
        pointDistance <= radius ||
        circleIntersectsRectangle(occluder.centerX, occluder.centerY, radius, rectangle)
      );
    });
  }

  public clear(): void {
    this.occluders.length = 0;
    this.potentialOccluders = [];
  }
}

function isPotentialOccluder(object: LabelObject): boolean {
  const visualRadius = object.visual?.visualRadius;

  return (
    typeof visualRadius === 'number' && visualRadius > 0 && OCCLUDING_OBJECT_TYPES.has(object.type)
  );
}
