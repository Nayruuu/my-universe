import * as THREE from 'three';
import { type GraphicQuality } from '../../data/models/universe.models';
import {
  calculateMilkyWayTransition,
  MILKY_WAY_TRANSITION_START,
} from '../lod/milky-way-transition';
import { dampValue } from '../lod/screen-space-lod';
import { MILKY_WAY_ATLAS_URL, MilkyWayVolumeVisual } from './milky-way-volume-visual';
import { prewarmTexture, type TexturePrewarmTarget } from './texture-prewarm-target';

export { getMilkyWayCinematicProfile, MILKY_WAY_ATLAS_URL } from './milky-way-volume-visual';
export type { MilkyWayCinematicProfile } from './milky-way-volume-visual';

export interface MilkyWayVolumeSample {
  opacity: number;
  scale: number;
}

export type MilkyWayAtlasStatus = 'idle' | 'loading' | 'ready' | 'failed';
export type MilkyWayAtlasLoader = (url: string) => Promise<THREE.Texture>;

const VOLUME_FADE_START = 2_200;
const VOLUME_FADE_END = 6_500;
const MAXIMUM_VOLUME_OPACITY = 0.92;
const TRANSITION_AURA_OPACITY_FACTOR = 0.38;

export function createMilkyWayVolumeSample(): MilkyWayVolumeSample {
  return { opacity: 0, scale: 1 };
}

export function sampleMilkyWayVolume(
  cameraDistance: number,
  target: MilkyWayVolumeSample,
): MilkyWayVolumeSample {
  const distance = normalizeDistance(cameraDistance);
  const entryOpacity = smoothstep(VOLUME_FADE_START, VOLUME_FADE_END, distance);
  const transition = calculateMilkyWayTransition(distance);
  const transitionOpacity = Math.max(
    transition.detailOpacity,
    transition.auraOpacity * TRANSITION_AURA_OPACITY_FACTOR,
  );

  target.opacity = MAXIMUM_VOLUME_OPACITY * entryOpacity * transitionOpacity;
  target.scale = distance < MILKY_WAY_TRANSITION_START ? 1 : transition.detailScale;

  return target;
}

export class MilkyWayVolume {
  public readonly root: THREE.Group;

  private readonly sample = createMilkyWayVolumeSample();
  private readonly visual = new MilkyWayVolumeVisual();
  private atlasPromise: Promise<boolean> | null = null;
  private status: MilkyWayAtlasStatus = 'idle';
  private opacity = 0;
  private scale = 1;
  private disposed = false;

  constructor(private readonly loadAtlas: MilkyWayAtlasLoader = loadMilkyWayAtlas) {
    this.root = this.visual.root;
  }

  public get atlasStatus(): MilkyWayAtlasStatus {
    return this.status;
  }

  public get visibleDiscLayerCount(): number {
    return this.visual.visibleDiscLayerCount;
  }

  public get drawMeshCount(): number {
    return this.visual.drawMeshCount;
  }

  public setQuality(quality: GraphicQuality): void {
    this.visual.setQuality(quality);
  }

  public async ensureAtlas(): Promise<boolean> {
    if (this.disposed || this.status === 'failed') {
      return false;
    }
    if (this.status === 'ready') {
      return true;
    }
    if (this.atlasPromise) {
      return this.atlasPromise;
    }

    this.status = 'loading';
    this.atlasPromise = this.loadAtlas(MILKY_WAY_ATLAS_URL)
      .then((texture) => this.installAtlas(texture))
      .catch(() => {
        this.status = 'failed';

        return false;
      });

    return this.atlasPromise;
  }

  public async prewarmAtlas(target: TexturePrewarmTarget): Promise<boolean> {
    if (!(await this.ensureAtlas())) {
      return false;
    }

    return prewarmTexture(target, this.visual.atlasTexture!);
  }

  public update(cameraDistance: number, deltaSeconds: number, galaxyRadiance = 1): void {
    sampleMilkyWayVolume(cameraDistance, this.sample);
    this.opacity = dampValue(this.opacity, this.sample.opacity, 5, deltaSeconds);
    this.scale = dampValue(this.scale, this.sample.scale, 6, deltaSeconds);
    this.visual.update(this.opacity, this.scale, galaxyRadiance);
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.visual.dispose();
  }

  private installAtlas(texture: THREE.Texture): boolean {
    if (this.disposed) {
      texture.dispose();
      this.status = 'failed';

      return false;
    }

    this.visual.installAtlas(texture);
    this.status = 'ready';

    return true;
  }
}

function loadMilkyWayAtlas(url: string): Promise<THREE.Texture> {
  return new THREE.TextureLoader().loadAsync(url);
}

function normalizeDistance(cameraDistance: number): number {
  if (!Number.isFinite(cameraDistance)) {
    return cameraDistance === Number.POSITIVE_INFINITY ? Number.MAX_VALUE : 0;
  }

  return Math.max(0, cameraDistance);
}

function smoothstep(minimum: number, maximum: number, value: number): number {
  const progress = Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum)));

  return progress * progress * (3 - 2 * progress);
}
