import * as THREE from 'three';
import { type GraphicQuality } from '../../data/models/universe.models';
import { calculateMilkyWaySceneScale } from '../coordinates/galaxy-scale-model';
import { dampValue } from '../lod/screen-space-lod';
import { MilkyWayVolumeVisual } from './milky-way-volume-visual';

export interface MilkyWayVolumeSample {
  opacity: number;
  immersionOpacity: number;
}

export type MilkyWayAtlasStatus = 'procedural';

const VOLUME_FADE_START = 1_200;
const VOLUME_FADE_END = 9_000;
const VOLUME_OVERVIEW_FADE_START = 170_000;
const VOLUME_OVERVIEW_FADE_END = 300_000;
const MAXIMUM_VOLUME_OPACITY = 0.92;
const IMMERSION_OUTER_FADE_START = 520;
const IMMERSION_OUTER_FADE_END = 1_800;
const IMMERSION_NEAR_FADE_START = 5;
const IMMERSION_NEAR_FADE_END = 520;
const MAXIMUM_IMMERSION_OPACITY = 0.16;
const MINIMUM_ACTIVE_IMMERSION_PRESENCE = 0.46;

export function createMilkyWayVolumeSample(): MilkyWayVolumeSample {
  return { opacity: 0, immersionOpacity: 0 };
}

export function sampleMilkyWayVolume(
  cameraDistance: number,
  target: MilkyWayVolumeSample,
): MilkyWayVolumeSample {
  if (!Number.isFinite(cameraDistance) || cameraDistance < 0) {
    target.opacity = 0;
    target.immersionOpacity = 0;

    return target;
  }
  const distance = cameraDistance;
  const entryOpacity = smoothstep(VOLUME_FADE_START, VOLUME_FADE_END, distance);
  const overviewOpacity =
    1 - smoothstep(VOLUME_OVERVIEW_FADE_START, VOLUME_OVERVIEW_FADE_END, distance);
  const immersionEntry =
    1 - smoothstep(IMMERSION_OUTER_FADE_START, IMMERSION_OUTER_FADE_END, distance);
  const immersionExit = lerp(
    MINIMUM_ACTIVE_IMMERSION_PRESENCE,
    1,
    smoothstep(IMMERSION_NEAR_FADE_START, IMMERSION_NEAR_FADE_END, distance),
  );

  target.opacity = MAXIMUM_VOLUME_OPACITY * entryOpacity * overviewOpacity;
  // Illustrative interior lighting only: keep a restrained floor while this semantic layer stays
  // active so a free camera cannot fall between the density volume and the local stellar view.
  // Canonical Galactic coordinates remain unchanged.
  target.immersionOpacity = MAXIMUM_IMMERSION_OPACITY * immersionEntry * immersionExit;

  return target;
}

export class MilkyWayVolume {
  public readonly root: THREE.Group;

  private readonly sample = createMilkyWayVolumeSample();
  private readonly visual = new MilkyWayVolumeVisual();
  private opacity = 0;
  private immersionOpacity = 0;
  private disposed = false;

  constructor() {
    this.root = this.visual.root;
  }

  public get atlasStatus(): MilkyWayAtlasStatus {
    return 'procedural';
  }

  public get visibleDiscLayerCount(): number {
    return this.visual.visibleDiscLayerCount;
  }

  public get drawMeshCount(): number {
    return this.visual.drawMeshCount;
  }

  public get proceduralVolumeVisible(): boolean {
    return this.visual.proceduralVolumeVisible;
  }

  public setQuality(quality: GraphicQuality): void {
    this.visual.setQuality(quality);
  }

  public update(
    cameraDistance: number,
    deltaSeconds: number,
    galaxyRadiance = 1,
    active = true,
  ): void {
    sampleMilkyWayVolume(active ? cameraDistance : Number.NaN, this.sample);
    this.opacity = dampValue(this.opacity, this.sample.opacity, 5, deltaSeconds);
    this.immersionOpacity = dampValue(
      this.immersionOpacity,
      this.sample.immersionOpacity,
      5,
      deltaSeconds,
    );
    this.visual.update(
      this.opacity,
      this.immersionOpacity,
      galaxyRadiance,
      calculateMilkyWaySceneScale(cameraDistance),
    );
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.visual.dispose();
  }
}

function smoothstep(minimum: number, maximum: number, value: number): number {
  const progress = Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum)));

  return progress * progress * (3 - 2 * progress);
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}
