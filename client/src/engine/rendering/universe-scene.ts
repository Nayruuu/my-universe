import * as THREE from 'three';
import {
  type ConstellationCatalog,
  GraphicQuality,
  type SpaceObject,
  type SpaceTileIndex,
  type StarClusterTile,
  type Vector3Like,
} from '../../data/models/universe.models';
import type { CoordinateSystem } from '../coordinates/coordinate-system';
import type { StarCatalogRegistry } from '../objects/star-catalog-registry';
import type { ExoplanetCatalogRegistry } from '../objects/exoplanet-catalog-registry';
import type { CosmicGroupCatalogRegistry } from '../objects/cosmic-group-catalog-registry';
import type { CosmicStructureCatalogRegistry } from '../objects/cosmic-structure-catalog-registry';
import type { CosmicWebVolume } from '../loaders/cosmic-web-volume';
import type { TempelFilamentSpineCatalog } from '../loaders/tempel-filament-spine-catalog';
import { PerformanceManager } from '../performance/performance-manager';
import { getNavigationScaleForLod } from '../camera/navigation-scales';
import { CosmicBackground } from './cosmic-background';
import { CosmicCatalogLayers } from './cosmic-catalog-layers';
import { GalacticTransitionLayer } from './galactic-transition-layer';
import { MilkyWayVolume, type MilkyWayAtlasStatus } from './milky-way-volume';
import { getPhotographicProfile } from './photographic-profile';
import { type CosmicMapLayers } from './cosmic-map-policy';
import { LocalSpaceEnvironment, type LocalMilkyWayPanoramaStatus } from './local-space-environment';
import { StellarCatalogLayers } from './stellar-catalog-layers';

export class UniverseScene {
  public readonly scene = new THREE.Scene();
  public readonly spaceRoot = new THREE.Group();

  private readonly stellarNeighborhoodRoot = new THREE.Group();
  private readonly stellarCatalogLayers: StellarCatalogLayers;
  private readonly cosmicCatalogLayers: CosmicCatalogLayers;
  private readonly galacticTransitionLayer: GalacticTransitionLayer;
  private readonly cosmicBackground = new CosmicBackground();
  private readonly localSpaceEnvironment = new LocalSpaceEnvironment();
  private readonly localObserverPosition = new THREE.Vector3();
  private readonly stellarOriginWorldPosition = new THREE.Vector3();
  private readonly milkyWayVolume = new MilkyWayVolume();
  private quality: GraphicQuality = 'medium';

  constructor(private readonly performanceManager: PerformanceManager) {
    this.scene.background = new THREE.Color(0x010208);
    this.scene.fog = new THREE.FogExp2(0x02030a, 0.000_045);
    this.scene.add(this.cosmicBackground.mesh);
    this.spaceRoot.name = 'floating-space-root';
    this.scene.add(this.spaceRoot);
    this.stellarNeighborhoodRoot.name = 'solar-neighborhood-reference';
    this.stellarNeighborhoodRoot.userData['referenceFrame'] = 'galactocentric-visual';
    this.stellarNeighborhoodRoot.userData['scientificConfidence'] = 'calculated';
    this.stellarNeighborhoodRoot.userData['visualScale'] = 'adaptive-heliocentric-neighborhood';
    this.spaceRoot.add(this.stellarNeighborhoodRoot);
    this.stellarNeighborhoodRoot.add(this.localSpaceEnvironment.root);
    this.spaceRoot.add(this.milkyWayVolume.root);
    this.stellarCatalogLayers = new StellarCatalogLayers(this.stellarNeighborhoodRoot);
    this.cosmicCatalogLayers = new CosmicCatalogLayers(this.spaceRoot);

    this.scene.add(new THREE.AmbientLight(0x5b6b8f, 0.12));
    this.galacticTransitionLayer = new GalacticTransitionLayer(
      this.spaceRoot,
      this.stellarNeighborhoodRoot,
      this.performanceManager,
    );
  }

  public setQuality(quality: GraphicQuality): void {
    this.quality = quality;

    this.galacticTransitionLayer.setQuality(quality);
    this.setPixelRatio(this.performanceManager.getPixelRatio(quality));
    this.cosmicBackground.setQuality(quality);
    this.localSpaceEnvironment.setQuality(quality);
    this.milkyWayVolume.setQuality(quality);
    this.stellarCatalogLayers.setQuality(quality);
    this.cosmicCatalogLayers.setQuality(quality);
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

  public async ensureMilkyWayAtlas(): Promise<boolean> {
    const loaded = await Promise.all([
      this.milkyWayVolume.ensureAtlas(),
      this.localSpaceEnvironment.ensurePanorama(),
    ]);

    return loaded.every(Boolean);
  }

  public setPixelRatio(pixelRatio: number): void {
    this.galacticTransitionLayer.setPixelRatio(pixelRatio);
    this.stellarCatalogLayers.setPixelRatio(pixelRatio);
    this.cosmicCatalogLayers.setPixelRatio(pixelRatio);
  }

  public setStellarOrigin(position: Vector3Like): void {
    this.stellarNeighborhoodRoot.position.set(position.x, position.y, position.z);
  }

  public async setNearbyGalaxyOverview(
    index: SpaceTileIndex,
    coordinateSystem: CoordinateSystem,
  ): Promise<void> {
    await this.cosmicCatalogLayers.setNearbyGalaxyOverview(index, coordinateSystem);
  }

  public async setCosmicGroupCatalog(registry: CosmicGroupCatalogRegistry): Promise<void> {
    await this.cosmicCatalogLayers.setCosmicGroupCatalog(registry);
  }

  public async setCosmicStructureCatalog(registry: CosmicStructureCatalogRegistry): Promise<void> {
    await this.cosmicCatalogLayers.setCosmicStructureCatalog(registry);
  }

  public async setCosmicWebVolume(
    volume: CosmicWebVolume,
    coordinateSystem: CoordinateSystem,
  ): Promise<void> {
    await this.cosmicCatalogLayers.setCosmicWebVolume(volume, coordinateSystem);
  }

  public async setTempelFilamentSpineCatalog(
    catalog: TempelFilamentSpineCatalog,
    registry: CosmicStructureCatalogRegistry,
    coordinateSystem: CoordinateSystem,
  ): Promise<void> {
    await this.cosmicCatalogLayers.setTempelFilamentSpineCatalog(
      catalog,
      registry,
      coordinateSystem,
    );
  }

  public async setStarCatalog(registry: StarCatalogRegistry): Promise<void> {
    await this.stellarCatalogLayers.setStarCatalog(registry);
  }

  public async setExoplanetCatalog(registry: ExoplanetCatalogRegistry): Promise<void> {
    await this.stellarCatalogLayers.setExoplanetCatalog(registry);
  }

  public async setStarClusterTiles(
    tiles: readonly StarClusterTile[],
    registry: StarCatalogRegistry,
  ): Promise<void> {
    await this.stellarCatalogLayers.setStarClusterTiles(tiles, registry);
  }

  public async setConstellationCatalog(
    catalog: ConstellationCatalog,
    registry: StarCatalogRegistry,
  ): Promise<void> {
    await this.stellarCatalogLayers.setConstellationCatalog(catalog, registry);
  }

  public setConstellationsEnabled(enabled: boolean): void {
    this.stellarCatalogLayers.setConstellationsEnabled(enabled);
  }

  public setCosmicMapLayers(layers: CosmicMapLayers): void {
    this.cosmicCatalogLayers.setCosmicMapLayers(layers);
  }

  public get constellationDefinitions(): readonly SpaceObject[] {
    return this.stellarCatalogLayers.constellationDefinitions;
  }

  public hasConstellation(objectId: string): boolean {
    return this.stellarCatalogLayers.hasConstellation(objectId);
  }

  public getConstellationDefinition(objectId: string): SpaceObject | undefined {
    return this.stellarCatalogLayers.getConstellationDefinition(objectId);
  }

  public getConstellationWorldPosition(
    objectId: string,
    target = new THREE.Vector3(),
  ): THREE.Vector3 | null {
    return this.stellarCatalogLayers.getConstellationWorldPosition(objectId, target);
  }

  public getConstellationFocusRadius(objectId: string): number | null {
    return this.stellarCatalogLayers.getConstellationFocusRadius(objectId);
  }

  public selectConstellation(objectId: string | null): void {
    this.stellarCatalogLayers.selectConstellation(objectId);
  }

  public hoverConstellation(objectId: string | null): void {
    this.stellarCatalogLayers.hoverConstellation(objectId);
  }

  public updateLod(
    lodLevel: number,
    deltaSeconds: number,
    cameraDistance = getNavigationScaleForLod(lodLevel).distance,
    cameraPosition?: Vector3Like,
  ): void {
    const photographicProfile = getPhotographicProfile(lodLevel, this.quality);
    const localObserverDistance = cameraPosition
      ? this.getLocalObserverDistance(cameraPosition)
      : 0;

    this.cosmicBackground.update(cameraDistance, deltaSeconds);
    this.localSpaceEnvironment.update(
      cameraDistance,
      deltaSeconds,
      photographicProfile.starRadiance,
      localObserverDistance,
    );
    this.milkyWayVolume.update(cameraDistance, deltaSeconds, photographicProfile.galaxyRadiance);
    (this.scene.background as THREE.Color).copy(this.cosmicBackground.fallbackColor);
    (this.scene.fog as THREE.FogExp2).color.copy(this.cosmicBackground.fogColor);

    this.stellarCatalogLayers.updateLod(
      lodLevel,
      deltaSeconds,
      photographicProfile.starRadiance,
      cameraPosition,
    );
    this.cosmicCatalogLayers.update(
      cameraDistance,
      deltaSeconds,
      photographicProfile.galaxyRadiance,
    );
    this.galacticTransitionLayer.update({
      lodLevel,
      deltaSeconds,
      cameraDistance,
      starRadiance: photographicProfile.starRadiance,
      galaxyRadiance: photographicProfile.galaxyRadiance,
      legacyMilkyWayVisible: this.milkyWayVolume.atlasStatus !== 'ready',
    });
  }

  public selectCatalogObject(objectId: string | null): void {
    this.stellarCatalogLayers.selectCatalogObject(objectId);
    this.cosmicCatalogLayers.selectCatalogObject(objectId);
  }

  public hoverCatalogObject(objectId: string | null): void {
    this.cosmicCatalogLayers.hoverCatalogObject(objectId);
  }

  public getCatalogWorldPosition(
    objectId: string,
    target = new THREE.Vector3(),
  ): THREE.Vector3 | null {
    return (
      this.stellarCatalogLayers.getCatalogWorldPosition(objectId, target) ??
      this.cosmicCatalogLayers.getCatalogWorldPosition(objectId, target)
    );
  }

  public getCatalogPickables(): readonly THREE.Object3D[] {
    return [
      ...this.stellarCatalogLayers.getPickables(),
      ...this.cosmicCatalogLayers.getPickables(),
    ];
  }

  public isCatalogObjectVisibleForLabels(objectId: string): boolean | null {
    return (
      this.stellarCatalogLayers.isObjectVisibleForLabels(objectId) ??
      this.cosmicCatalogLayers.isObjectVisibleForLabels(objectId)
    );
  }

  public get visibleCatalogStarCount(): number {
    return this.stellarCatalogLayers.visibleCatalogStarCount;
  }

  public get catalogStarCount(): number {
    return this.stellarCatalogLayers.catalogStarCount;
  }

  public get visibleExoplanetHostCount(): number {
    return this.stellarCatalogLayers.visibleExoplanetHostCount;
  }

  public get exoplanetHostCount(): number {
    return this.stellarCatalogLayers.exoplanetHostCount;
  }

  public get exoplanetCount(): number {
    return this.stellarCatalogLayers.exoplanetCount;
  }

  public get visibleCosmicGroupCount(): number {
    return this.cosmicCatalogLayers.visibleCosmicGroupCount;
  }

  public get visibleNearbyGalaxyOverviewCount(): number {
    return this.cosmicCatalogLayers.visibleNearbyGalaxyOverviewCount;
  }

  public get cosmicGroupCount(): number {
    return this.cosmicCatalogLayers.cosmicGroupCount;
  }

  public get visibleCosmicStructureCount(): number {
    return this.cosmicCatalogLayers.visibleCosmicStructureCount;
  }

  public get tempelFilamentSpineTileCount(): number {
    return this.cosmicCatalogLayers.tempelFilamentSpineTileCount;
  }

  public get tempelFilamentSpineCount(): number {
    return this.cosmicCatalogLayers.tempelFilamentSpineCount;
  }

  public get tempelFilamentSpinePointCount(): number {
    return this.cosmicCatalogLayers.tempelFilamentSpinePointCount;
  }

  public get tempelFilamentSpineSegmentCount(): number {
    return this.cosmicCatalogLayers.tempelFilamentSpineSegmentCount;
  }

  public get visibleTempelFilamentSpineSegmentCount(): number {
    return this.cosmicCatalogLayers.visibleTempelFilamentSpineSegmentCount;
  }

  public get cosmicStructureCount(): number {
    return this.cosmicCatalogLayers.cosmicStructureCount;
  }

  public get cosmicFilamentCount(): number {
    return this.cosmicCatalogLayers.cosmicFilamentCount;
  }

  public get activeCosmicFilamentCount(): number {
    return this.cosmicCatalogLayers.activeCosmicFilamentCount;
  }

  public get visibleCosmicFilamentCount(): number {
    return this.cosmicCatalogLayers.visibleCosmicFilamentCount;
  }

  public get activeStarTileCount(): number {
    return this.stellarCatalogLayers.activeStarTileCount;
  }

  public get starClusterRepresentationCount(): number {
    return this.stellarCatalogLayers.starClusterRepresentationCount;
  }

  public get visibleStarClusterCount(): number {
    return this.stellarCatalogLayers.visibleStarClusterCount;
  }

  public dispose(): void {
    this.stellarCatalogLayers.dispose();
    this.cosmicCatalogLayers.dispose();
    this.localSpaceEnvironment.root.removeFromParent();
    this.localSpaceEnvironment.dispose();
    this.spaceRoot.remove(this.milkyWayVolume.root);
    this.milkyWayVolume.dispose();
    this.scene.remove(this.cosmicBackground.mesh);
    this.cosmicBackground.dispose();
    this.galacticTransitionLayer.dispose();
    disposeObjectTree(this.scene);
    this.scene.clear();
  }

  private getLocalObserverDistance(cameraPosition: Vector3Like): number {
    this.stellarNeighborhoodRoot.getWorldPosition(this.stellarOriginWorldPosition);
    this.localObserverPosition.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);

    return this.localObserverPosition.distanceTo(this.stellarOriginWorldPosition);
  }
}

function disposeObjectTree(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (
      object instanceof THREE.Mesh ||
      object instanceof THREE.Points ||
      object instanceof THREE.Line
    ) {
      object.geometry.dispose();
      disposeMaterial(object.material);
    }
    if (object instanceof THREE.Sprite) {
      disposeMaterial(object.material);
    }
  });
}

function disposeMaterial(materialOrMaterials: THREE.Material | THREE.Material[]): void {
  const materials = Array.isArray(materialOrMaterials)
    ? materialOrMaterials
    : [materialOrMaterials];

  for (const material of materials) {
    for (const value of Object.values(material)) {
      if (value instanceof THREE.Texture) {
        value.dispose();
      }
    }
    material.dispose();
  }
}
