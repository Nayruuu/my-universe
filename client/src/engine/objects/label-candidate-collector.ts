import * as THREE from 'three';
import type { GraphicQuality, LabelDensity } from '../../data/models/universe.models';
import {
  getLabelPriority,
  isConstellationLabel,
  isLabelVisibleAtLevel,
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

  public get candidates(): readonly LabelCandidate[] {
    return this.values;
  }

  public collect(options: LabelCandidateCollectionOptions): readonly LabelCandidate[] {
    this.values.length = 0;
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
  }

  private collectCandidate(object: LabelObject, options: LabelCandidateCollectionOptions): void {
    const selected = object.id === options.selectedId;
    const scaleLandmark = isScaleLandmarkAtLevel(object, options.lodLevel);

    if (object.type === 'region' && !isConstellationLabel(object)) {
      return;
    }
    if (
      (!selected || isConstellationLabel(object)) &&
      !scaleLandmark &&
      !options.isObjectVisible(object.id)
    ) {
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
    this.values.push({
      object,
      distanceSquared: options.camera.position.distanceToSquared(position),
      priority: getLabelPriority(object, options.lodLevel),
      selected,
    });
  }
}
