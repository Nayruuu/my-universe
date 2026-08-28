import * as THREE from 'three';
import { type GraphicQuality, type Vector3Like } from '../../data/models/universe.models';
import { type PerformanceManager } from '../performance/performance-manager';
import { CosmicBackground } from './cosmic-background';
import { GalacticTransitionLayer } from './galactic-transition-layer';
import { LocalSpaceEnvironment, type LocalMilkyWayPanoramaStatus } from './local-space-environment';
import { MilkyWayVolume, type MilkyWayAtlasStatus } from './milky-way-volume';
import { type PhotographicRenderingProfile } from './photographic-profile';
import { type TexturePrewarmTarget } from './texture-prewarm-target';

export class UniverseSceneEnvironment {
  private readonly cosmicBackground = new CosmicBackground();
  private readonly localSpaceEnvironment = new LocalSpaceEnvironment();
  private readonly milkyWayVolume = new MilkyWayVolume();
  private readonly galacticTransitionLayer: GalacticTransitionLayer;
  private readonly ambientLight = new THREE.AmbientLight(0x5b6b8f, 0.12);
  private readonly localObserverPosition = new THREE.Vector3();
  private readonly stellarOriginWorldPosition = new THREE.Vector3();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly spaceRoot: THREE.Group,
    private readonly stellarNeighborhoodRoot: THREE.Group,
    private readonly performanceManager: PerformanceManager,
  ) {
    this.scene.background = new THREE.Color(0x010208);
    this.scene.fog = new THREE.FogExp2(0x02030a, 0.000_045);
    this.scene.add(this.cosmicBackground.mesh, this.ambientLight);
    this.stellarNeighborhoodRoot.add(this.localSpaceEnvironment.root);
    this.spaceRoot.add(this.milkyWayVolume.root);
    this.galacticTransitionLayer = new GalacticTransitionLayer(
      this.spaceRoot,
      this.stellarNeighborhoodRoot,
      this.performanceManager,
    );
  }

  public get milkyWayAtlasStatus(): MilkyWayAtlasStatus {
    return this.milkyWayVolume.atlasStatus;
  }

  public get milkyWayVolumeDrawMeshCount(): number {
    return this.milkyWayVolume.drawMeshCount;
  }

  public get localMilkyWayPanoramaStatus(): LocalMilkyWayPanoramaStatus {
    return this.localSpaceEnvironment.panoramaStatus;
  }

  public setQuality(quality: GraphicQuality): void {
    this.galacticTransitionLayer.setQuality(quality);
    this.cosmicBackground.setQuality(quality);
    this.localSpaceEnvironment.setQuality(quality);
    this.milkyWayVolume.setQuality(quality);
  }

  public setPixelRatio(pixelRatio: number): void {
    this.galacticTransitionLayer.setPixelRatio(pixelRatio);
  }

  public setStellarOrigin(position: Vector3Like): void {
    this.galacticTransitionLayer.setStellarOrigin(position);
  }

  public async ensureMilkyWayAtlas(): Promise<boolean> {
    return this.localSpaceEnvironment.ensurePanorama();
  }

  public async prewarmMilkyWayAssets(target: TexturePrewarmTarget): Promise<boolean> {
    return this.localSpaceEnvironment.prewarmPanorama(target);
  }

  public update(
    lodLevel: number,
    deltaSeconds: number,
    cameraDistance: number,
    profile: PhotographicRenderingProfile,
    cameraPosition?: Vector3Like,
    earthObserverActive = false,
  ): void {
    this.galacticTransitionLayer.update({
      lodLevel,
      deltaSeconds,
      cameraDistance,
      starRadiance: profile.starRadiance,
      galaxyRadiance: profile.galaxyRadiance,
      observerPosition: cameraPosition,
    });
    const localObserverDistance = cameraPosition
      ? this.getLocalObserverDistance(cameraPosition)
      : 0;

    this.cosmicBackground.update(cameraDistance, deltaSeconds);
    this.localSpaceEnvironment.update(
      cameraDistance,
      deltaSeconds,
      profile.starRadiance,
      localObserverDistance,
      earthObserverActive,
      cameraPosition,
    );
    this.milkyWayVolume.update(
      cameraDistance,
      deltaSeconds,
      profile.galaxyRadiance,
      lodLevel >= 1 && lodLevel <= 5 && !earthObserverActive,
    );
    (this.scene.background as THREE.Color).copy(this.cosmicBackground.fallbackColor);
    (this.scene.fog as THREE.FogExp2).color.copy(this.cosmicBackground.fogColor);
  }

  public dispose(): void {
    this.localSpaceEnvironment.root.removeFromParent();
    this.localSpaceEnvironment.dispose();
    this.milkyWayVolume.root.removeFromParent();
    this.milkyWayVolume.dispose();
    this.cosmicBackground.mesh.removeFromParent();
    this.cosmicBackground.dispose();
    this.galacticTransitionLayer.dispose();
    this.ambientLight.removeFromParent();
  }

  private getLocalObserverDistance(cameraPosition: Vector3Like): number {
    this.stellarNeighborhoodRoot.getWorldPosition(this.stellarOriginWorldPosition);
    this.localObserverPosition.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);

    return this.localObserverPosition.distanceTo(this.stellarOriginWorldPosition);
  }
}
