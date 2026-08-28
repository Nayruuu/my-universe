import * as THREE from 'three';
import { type GraphicQuality } from '../../data/models/universe.models';
import { calculateMilkyWaySceneScale } from '../coordinates/galaxy-scale-model';
import { MilkyWayVolumeVisual } from './milky-way-volume-visual';

export type MilkyWayAtlasStatus = 'point-cloud';

export class MilkyWayVolume {
  public readonly root: THREE.Group;

  private readonly visual = new MilkyWayVolumeVisual();
  private disposed = false;

  constructor() {
    this.root = this.visual.root;
  }

  public get atlasStatus(): MilkyWayAtlasStatus {
    return 'point-cloud';
  }

  public get visibleSurfaceLayerCount(): number {
    return this.visual.visibleSurfaceLayerCount;
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

  public update(cameraDistance: number, galaxyRadiance = 1, active = true): void {
    this.visual.update(galaxyRadiance, calculateMilkyWaySceneScale(cameraDistance), active);
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.visual.dispose();
  }
}
