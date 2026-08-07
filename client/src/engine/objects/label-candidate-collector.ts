import * as THREE from 'three';
import type { GraphicQuality, LabelDensity } from '../../data/models/universe.models';
import {
  getLabelPriority,
  isConstellationLabel,
  isLabelVisibleAtLevel,
  requiresDynamicLabelVisibility,
  isScaleLandmarkAtLevel,
  type LabelObject,
} from './label-visibility-policy';

export type LabelCandidateWorldPositionReader = (
  objectId: string,
  target: THREE.Vector3,
) => THREE.Vector3 | null;

export type LabelObjectVisibilityReader = (objectId: string) => boolean;

export interface LabelCandidate {
  readonly object: LabelObject;
  readonly distanceSquared: number;
  readonly priority: number;
  readonly selected: boolean;
  readonly worldX: number;
  readonly worldY: number;
  readonly worldZ: number;
}

interface MutableLabelCandidate {
  object: LabelObject;
  distanceSquared: number;
  priority: number;
  selected: boolean;
  worldX: number;
  worldY: number;
  worldZ: number;
}

export interface LabelCandidateCollectionOptions {
  readonly objects: readonly LabelObject[];
  readonly transientObject: LabelObject | null;
  readonly camera: THREE.Camera;
  readonly readWorldPosition: LabelCandidateWorldPositionReader;
  readonly lodLevel: number;
  readonly selectedId: string | null;
  readonly quality: GraphicQuality;
  readonly density: LabelDensity;
  readonly isObjectVisible: LabelObjectVisibilityReader;
}

export class LabelCandidateCollector {
  private readonly worldPosition = new THREE.Vector3();
  private readonly values: LabelCandidate[] = [];
  private readonly pool: MutableLabelCandidate[] = [];
  private poolIndex = 0;

  public get candidates(): readonly LabelCandidate[] {
    return this.values;
  }

  public collect(options: LabelCandidateCollectionOptions): readonly LabelCandidate[] {
    this.values.length = 0;
    this.poolIndex = 0;
    for (const object of options.objects) {
      this.collectCandidate(object, options);
    }
    if (
      options.transientObject &&
      !options.objects.some((object) => object.id === options.transientObject?.id)
    ) {
      this.collectCandidate(options.transientObject, options);
    }
    this.values.sort(
      (left, right) =>
        Number(right.selected) - Number(left.selected) ||
        left.priority - right.priority ||
        left.distanceSquared - right.distanceSquared,
    );

    return this.values;
  }

  public clear(): void {
    this.values.length = 0;
    this.pool.length = 0;
    this.poolIndex = 0;
  }

  private collectCandidate(object: LabelObject, options: LabelCandidateCollectionOptions): void {
    const selected = object.id === options.selectedId;
    const scaleLandmark = isScaleLandmarkAtLevel(object, options.lodLevel);

    if (object.type === 'region' && !isConstellationLabel(object)) {
      return;
    }
    const visibilityRequired =
      (!selected || isConstellationLabel(object)) &&
      !scaleLandmark &&
      requiresDynamicLabelVisibility(object);

    if (visibilityRequired && !options.isObjectVisible(object.id)) {
      return;
    }
    if (
      !selected &&
      !isLabelVisibleAtLevel(object, options.lodLevel, options.quality, options.density)
    ) {
      return;
    }
    const position = options.readWorldPosition(object.id, this.worldPosition);

    if (!position) {
      return;
    }
    const candidate = this.borrowCandidate();

    candidate.object = object;
    candidate.distanceSquared = options.camera.position.distanceToSquared(position);
    candidate.priority = getLabelPriority(object, options.lodLevel);
    candidate.selected = selected;
    candidate.worldX = position.x;
    candidate.worldY = position.y;
    candidate.worldZ = position.z;
    this.values.push(candidate);
  }

  private borrowCandidate(): MutableLabelCandidate {
    const candidate =
      this.pool[this.poolIndex] ??
      ({
        object: { id: '', name: '', type: 'region' },
        distanceSquared: 0,
        priority: 0,
        selected: false,
        worldX: 0,
        worldY: 0,
        worldZ: 0,
      } satisfies MutableLabelCandidate);

    if (this.poolIndex === this.pool.length) {
      this.pool.push(candidate);
    }
    this.poolIndex += 1;

    return candidate;
  }
}
