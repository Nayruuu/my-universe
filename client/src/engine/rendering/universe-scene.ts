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
import { calculateMilkyWayTransition } from '../lod/milky-way-transition';
import type { ConstellationBatch as ConstellationBatchInstance } from './constellation-batch';
import type { CosmicGroupCatalogBatch as CosmicGroupCatalogBatchInstance } from './cosmic-group-catalog-batch';
import type { CosmicStructureCatalogBatch as CosmicStructureCatalogBatchInstance } from './cosmic-structure-catalog-batch';
import type { CosmicWebVolumeRenderer as CosmicWebVolumeRendererInstance } from './cosmic-web-volume';
import type { TempelFilamentSpineBatch as TempelFilamentSpineBatchInstance } from './tempel-filament-spine-batch';
import { CosmicBackground } from './cosmic-background';
import {
  calculateGalactocentricSpiralAngle,
  MILKY_WAY_ARM_COUNT,
  MILKY_WAY_ARM_PITCH_DEGREES,
  MILKY_WAY_ARM_REFERENCE_RADIUS,
} from './milky-way-density-model';
import { MilkyWayVolume, type MilkyWayAtlasStatus } from './milky-way-volume';
import type { NearbyGalaxyOverviewBatch as NearbyGalaxyOverviewBatchInstance } from './nearby-galaxy-overview-batch';
import type { LocalVolumeDepthBackdrop as LocalVolumeDepthBackdropInstance } from './local-volume-depth-backdrop';
import { getPhotographicProfile } from './photographic-profile';
import type { StarCatalogBatch as StarCatalogBatchInstance } from './star-catalog-batch';
import type { ExoplanetHostBatch as ExoplanetHostBatchInstance } from './exoplanet-host-batch';
import type { StarClusterBatch as StarClusterBatchInstance } from './star-cluster-batch';
import { type CosmicMapLayers, DEFAULT_COSMIC_MAP_LAYERS } from './cosmic-map-policy';
import { LocalSpaceEnvironment, type LocalMilkyWayPanoramaStatus } from './local-space-environment';

export class UniverseScene {
  public readonly scene = new THREE.Scene();
  public readonly spaceRoot = new THREE.Group();

  private readonly backdropGeometry: THREE.BufferGeometry;
  private readonly backdropMaterial: THREE.ShaderMaterial;
  private readonly milkyWayGeometry: THREE.BufferGeometry;
  private readonly milkyWayMaterial: THREE.PointsMaterial;
  private readonly backdrop: THREE.Points;
  private readonly milkyWay: THREE.Points;
  private readonly stellarNeighborhoodRoot = new THREE.Group();
  private readonly cosmicBackground = new CosmicBackground();
  private readonly localSpaceEnvironment = new LocalSpaceEnvironment();
  private readonly localObserverPosition = new THREE.Vector3();
  private readonly stellarOriginWorldPosition = new THREE.Vector3();
  private readonly milkyWayVolume = new MilkyWayVolume();
  private starCatalogBatch: StarCatalogBatchInstance | null = null;
  private exoplanetHostBatch: ExoplanetHostBatchInstance | null = null;
  private starClusterBatch: StarClusterBatchInstance | null = null;
  private constellationBatch: ConstellationBatchInstance | null = null;
  private cosmicGroupCatalogBatch: CosmicGroupCatalogBatchInstance | null = null;
  private cosmicStructureCatalogBatch: CosmicStructureCatalogBatchInstance | null = null;
  private cosmicWebVolumeRenderer: CosmicWebVolumeRendererInstance | null = null;
  private tempelFilamentSpineBatch: TempelFilamentSpineBatchInstance | null = null;
  private nearbyGalaxyOverviewBatch: NearbyGalaxyOverviewBatchInstance | null = null;
  private localVolumeDepthBackdrop: LocalVolumeDepthBackdropInstance | null = null;
  private quality: GraphicQuality = 'medium';
  private cosmicMapLayers: CosmicMapLayers = DEFAULT_COSMIC_MAP_LAYERS;
  private milkyWayScale = 1;
  private stellarNeighborhoodScale = 1;

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

    this.scene.add(new THREE.AmbientLight(0x5b6b8f, 0.12));

    this.backdropGeometry = createBackdropGeometry(LOCAL_SKY_PARTICLE_COUNTS.high);
    this.backdropGeometry.setDrawRange(0, LOCAL_SKY_PARTICLE_COUNTS.medium);
    this.backdropMaterial = createBackdropMaterial();
    this.backdrop = new THREE.Points(this.backdropGeometry, this.backdropMaterial);
    this.backdrop.name = 'distant-star-field';
    this.backdrop.userData['scientificConfidence'] = 'procedural';
    this.backdrop.userData['visualRole'] = 'decorative';
    this.backdrop.userData['visualStyle'] = 'integrated-galactic-sky-depth';
    this.backdrop.userData['distribution'] = 'isotropic-plus-galactic-plane';
    this.spaceRoot.add(this.backdrop);

    this.milkyWayGeometry = createMilkyWayGeometry(10_000);
    this.milkyWayMaterial = new THREE.PointsMaterial({
      size: 1.65,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
    });
    this.milkyWay = new THREE.Points(this.milkyWayGeometry, this.milkyWayMaterial);
    this.milkyWay.name = 'illustrative-milky-way';
    this.milkyWay.visible = false;
    this.milkyWay.userData['scientificConfidence'] = 'illustrative';
    this.milkyWay.userData['visualStructure'] = 'illustrative-galactocentric-four-arm-disk';
    this.milkyWay.userData['structureOrigin'] = 'galactic-center';
    this.milkyWay.userData['spiralArmCount'] = MILKY_WAY_ARM_COUNT;
    this.milkyWay.userData['spiralPitchDegrees'] = MILKY_WAY_ARM_PITCH_DEGREES;
    this.milkyWay.userData['visualRole'] = 'galactic-scale-transition';
    this.spaceRoot.add(this.milkyWay);
  }

  public setQuality(quality: GraphicQuality): void {
    this.quality = quality;
    const count = this.performanceManager.getParticleCount(quality);

    this.backdropGeometry.setDrawRange(0, LOCAL_SKY_PARTICLE_COUNTS[quality]);
    this.milkyWayGeometry.setDrawRange(0, Math.min(count, 10_000));
    this.setPixelRatio(this.performanceManager.getPixelRatio(quality));
    this.cosmicBackground.setQuality(quality);
    this.localSpaceEnvironment.setQuality(quality);
    this.milkyWayVolume.setQuality(quality);
    this.starCatalogBatch?.setQuality(quality);
    this.starClusterBatch?.setQuality(quality);
    this.exoplanetHostBatch?.setQuality(quality);
    this.cosmicGroupCatalogBatch?.setQuality(quality);
    this.localVolumeDepthBackdrop?.setQuality(quality);
    this.cosmicStructureCatalogBatch?.setQuality(quality);
    this.cosmicWebVolumeRenderer?.setQuality(quality);
    this.tempelFilamentSpineBatch?.setQuality(quality);
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
    this.backdropMaterial.uniforms['pixelRatio']!.value = THREE.MathUtils.clamp(
      pixelRatio,
      0.5,
      1.5,
    );
    this.starCatalogBatch?.setPixelRatio(pixelRatio);
    this.exoplanetHostBatch?.setPixelRatio(pixelRatio);
    this.starClusterBatch?.setPixelRatio(pixelRatio);
    this.cosmicGroupCatalogBatch?.setPixelRatio(pixelRatio);
    this.localVolumeDepthBackdrop?.setPixelRatio(pixelRatio);
    this.cosmicStructureCatalogBatch?.setPixelRatio(pixelRatio);
    this.nearbyGalaxyOverviewBatch?.setPixelRatio(pixelRatio);
  }

  public setStellarOrigin(position: Vector3Like): void {
    this.stellarNeighborhoodRoot.position.set(position.x, position.y, position.z);
  }

  public async setNearbyGalaxyOverview(
    index: SpaceTileIndex,
    coordinateSystem: CoordinateSystem,
  ): Promise<void> {
    if (this.nearbyGalaxyOverviewBatch) {
      this.spaceRoot.remove(this.nearbyGalaxyOverviewBatch.points);
      this.nearbyGalaxyOverviewBatch.dispose();
      this.nearbyGalaxyOverviewBatch = null;
    }
    const entries = index.overviewEntries ?? [];

    if (entries.length === 0) {
      return;
    }
    const { NearbyGalaxyOverviewBatch } = await import('./nearby-galaxy-overview-batch');

    this.nearbyGalaxyOverviewBatch = new NearbyGalaxyOverviewBatch(entries, coordinateSystem);
    this.spaceRoot.add(this.nearbyGalaxyOverviewBatch.points);
  }

  public async setCosmicGroupCatalog(registry: CosmicGroupCatalogRegistry): Promise<void> {
    if (this.cosmicGroupCatalogBatch) {
      this.spaceRoot.remove(this.cosmicGroupCatalogBatch.root);
      this.cosmicGroupCatalogBatch.dispose();
      this.cosmicGroupCatalogBatch = null;
    }
    if (this.localVolumeDepthBackdrop) {
      this.spaceRoot.remove(this.localVolumeDepthBackdrop.points);
      this.localVolumeDepthBackdrop.dispose();
      this.localVolumeDepthBackdrop = null;
    }

    const [{ CosmicGroupCatalogBatch }, { LocalVolumeDepthBackdrop }] = await Promise.all([
      import('./cosmic-group-catalog-batch'),
      import('./local-volume-depth-backdrop'),
    ]);

    this.cosmicGroupCatalogBatch = new CosmicGroupCatalogBatch(registry, this.quality);
    this.localVolumeDepthBackdrop = new LocalVolumeDepthBackdrop(registry, this.quality);
    this.cosmicGroupCatalogBatch.setLayers(this.cosmicMapLayers);
    this.localVolumeDepthBackdrop.setEnabled(this.cosmicMapLayers.groups);
    this.spaceRoot.add(this.localVolumeDepthBackdrop.points, this.cosmicGroupCatalogBatch.root);
    this.setQuality(this.quality);
  }

  public async setCosmicStructureCatalog(registry: CosmicStructureCatalogRegistry): Promise<void> {
    if (this.cosmicStructureCatalogBatch) {
      this.spaceRoot.remove(this.cosmicStructureCatalogBatch.root);
      this.cosmicStructureCatalogBatch.dispose();
    }

    const { CosmicStructureCatalogBatch } = await import('./cosmic-structure-catalog-batch');

    this.cosmicStructureCatalogBatch = new CosmicStructureCatalogBatch(registry, this.quality);
    this.cosmicStructureCatalogBatch.setLayers(this.cosmicMapLayers);
    this.spaceRoot.add(this.cosmicStructureCatalogBatch.root);
    this.setQuality(this.quality);
  }

  public async setCosmicWebVolume(
    volume: CosmicWebVolume,
    coordinateSystem: CoordinateSystem,
  ): Promise<void> {
    if (this.cosmicWebVolumeRenderer) {
      this.spaceRoot.remove(this.cosmicWebVolumeRenderer.mesh);
      this.cosmicWebVolumeRenderer.dispose();
    }

    const { CosmicWebVolumeRenderer } = await import('./cosmic-web-volume');

    this.cosmicWebVolumeRenderer = new CosmicWebVolumeRenderer(
      volume,
      coordinateSystem,
      this.quality,
    );
    this.cosmicWebVolumeRenderer.setEnabled(this.cosmicMapLayers.volume);
    this.spaceRoot.add(this.cosmicWebVolumeRenderer.mesh);
  }

  public async setTempelFilamentSpineCatalog(
    catalog: TempelFilamentSpineCatalog,
    registry: CosmicStructureCatalogRegistry,
    coordinateSystem: CoordinateSystem,
  ): Promise<void> {
    if (this.tempelFilamentSpineBatch) {
      this.spaceRoot.remove(this.tempelFilamentSpineBatch.root);
      this.tempelFilamentSpineBatch.dispose();
    }

    const { TempelFilamentSpineBatch } = await import('./tempel-filament-spine-batch');

    this.tempelFilamentSpineBatch = new TempelFilamentSpineBatch(
      catalog,
      registry,
      coordinateSystem,
      this.quality,
    );
    this.tempelFilamentSpineBatch.setLayers(this.cosmicMapLayers);
    this.spaceRoot.add(this.tempelFilamentSpineBatch.root);
  }

  public async setStarCatalog(registry: StarCatalogRegistry): Promise<void> {
    if (this.starClusterBatch) {
      this.stellarNeighborhoodRoot.remove(this.starClusterBatch.root);
      this.starClusterBatch.dispose();
      this.starClusterBatch = null;
    }
    if (this.starCatalogBatch) {
      this.stellarNeighborhoodRoot.remove(this.starCatalogBatch.root);
      this.starCatalogBatch.dispose();
    }

    const { StarCatalogBatch } = await import('./star-catalog-batch');

    this.starCatalogBatch = new StarCatalogBatch(registry, this.quality);
    this.stellarNeighborhoodRoot.add(this.starCatalogBatch.root);
    this.setQuality(this.quality);
  }

  public async setExoplanetCatalog(registry: ExoplanetCatalogRegistry): Promise<void> {
    if (this.exoplanetHostBatch) {
      this.stellarNeighborhoodRoot.remove(this.exoplanetHostBatch.root);
      this.exoplanetHostBatch.dispose();
    }

    const { ExoplanetHostBatch } = await import('./exoplanet-host-batch');

    this.exoplanetHostBatch = new ExoplanetHostBatch(registry, this.quality);
    this.stellarNeighborhoodRoot.add(this.exoplanetHostBatch.root);
    this.setQuality(this.quality);
  }

  public async setStarClusterTiles(
    tiles: readonly StarClusterTile[],
    registry: StarCatalogRegistry,
  ): Promise<void> {
    if (!this.starClusterBatch) {
      const { StarClusterBatch } = await import('./star-cluster-batch');

      if (!this.starClusterBatch) {
        this.starClusterBatch = new StarClusterBatch(registry);
        this.stellarNeighborhoodRoot.add(this.starClusterBatch.root);
        this.setQuality(this.quality);
      }
    }
    this.starClusterBatch.synchronizeTiles(tiles);
  }

  public async setConstellationCatalog(
    catalog: ConstellationCatalog,
    registry: StarCatalogRegistry,
  ): Promise<void> {
    if (this.constellationBatch) {
      this.stellarNeighborhoodRoot.remove(this.constellationBatch.root);
      this.constellationBatch.dispose();
    }

    const { ConstellationBatch } = await import('./constellation-batch');

    this.constellationBatch = new ConstellationBatch(catalog, registry);
    this.stellarNeighborhoodRoot.add(this.constellationBatch.root);
  }

  public setConstellationsEnabled(enabled: boolean): void {
    this.constellationBatch?.setEnabled(enabled);
  }

  public setCosmicMapLayers(layers: CosmicMapLayers): void {
    this.cosmicMapLayers = { ...layers };
    this.cosmicGroupCatalogBatch?.setLayers(this.cosmicMapLayers);
    this.localVolumeDepthBackdrop?.setEnabled(this.cosmicMapLayers.groups);
    this.cosmicStructureCatalogBatch?.setLayers(this.cosmicMapLayers);
    this.cosmicWebVolumeRenderer?.setEnabled(this.cosmicMapLayers.volume);
    this.tempelFilamentSpineBatch?.setLayers(this.cosmicMapLayers);
  }

  public get constellationDefinitions(): readonly SpaceObject[] {
    return this.constellationBatch?.definitions ?? [];
  }

  public hasConstellation(objectId: string): boolean {
    return this.constellationBatch?.has(objectId) ?? false;
  }

  public getConstellationDefinition(objectId: string): SpaceObject | undefined {
    return this.constellationBatch?.getDefinition(objectId);
  }

  public getConstellationWorldPosition(
    objectId: string,
    target = new THREE.Vector3(),
  ): THREE.Vector3 | null {
    return this.constellationBatch?.getWorldPosition(objectId, target) ?? null;
  }

  public getConstellationFocusRadius(objectId: string): number | null {
    return this.constellationBatch?.getFocusRadius(objectId) ?? null;
  }

  public selectConstellation(objectId: string | null): void {
    this.constellationBatch?.select(objectId);
  }

  public hoverConstellation(objectId: string | null): void {
    this.constellationBatch?.hover(objectId);
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

    this.starCatalogBatch?.setPhotographicRadiance(photographicProfile.starRadiance);
    this.exoplanetHostBatch?.setPhotographicRadiance(photographicProfile.starRadiance);
    this.starClusterBatch?.setPhotographicRadiance(photographicProfile.starRadiance);
    this.cosmicGroupCatalogBatch?.setPhotographicRadiance(photographicProfile.galaxyRadiance);
    this.localVolumeDepthBackdrop?.setPhotographicRadiance(photographicProfile.galaxyRadiance);
    this.cosmicStructureCatalogBatch?.setPhotographicRadiance(photographicProfile.galaxyRadiance);
    this.cosmicWebVolumeRenderer?.updateDistance(
      cameraDistance,
      deltaSeconds,
      photographicProfile.galaxyRadiance,
    );
    this.tempelFilamentSpineBatch?.setPhotographicRadiance(photographicProfile.galaxyRadiance);
    this.nearbyGalaxyOverviewBatch?.setPhotographicRadiance(photographicProfile.galaxyRadiance);
    this.starCatalogBatch?.updateLod(lodLevel, deltaSeconds, cameraPosition);
    this.exoplanetHostBatch?.updateLod(lodLevel, deltaSeconds, cameraPosition);
    this.starClusterBatch?.updateLod(lodLevel, deltaSeconds);
    this.constellationBatch?.updateLod(lodLevel, deltaSeconds);
    this.cosmicGroupCatalogBatch?.updateDistance(cameraDistance, deltaSeconds);
    this.localVolumeDepthBackdrop?.updateDistance(cameraDistance, deltaSeconds);
    this.cosmicStructureCatalogBatch?.updateDistance(cameraDistance, deltaSeconds);
    this.tempelFilamentSpineBatch?.updateDistance(cameraDistance, deltaSeconds);
    this.nearbyGalaxyOverviewBatch?.updateDistance(cameraDistance, deltaSeconds);
    const transition = calculateMilkyWayTransition(cameraDistance);
    const transitionVisible = lodLevel === 3 || lodLevel === 4;
    const legacyFallbackVisible = this.milkyWayVolume.atlasStatus !== 'ready';
    const targetOpacity =
      transitionVisible && legacyFallbackVisible
        ? transition.detailOpacity * 0.03 * photographicProfile.galaxyRadiance
        : 0;
    const targetMilkyWayScale = transitionVisible ? transition.detailScale : 1;
    const targetStellarNeighborhoodScale = calculateStellarNeighborhoodScale(cameraDistance);
    const targetBackdropOpacity =
      (BACKDROP_OPACITIES[lodLevel] ?? 0) * photographicProfile.starRadiance;

    this.milkyWayMaterial.opacity = dampOpacity(
      this.milkyWayMaterial.opacity,
      targetOpacity,
      deltaSeconds,
    );
    this.milkyWay.visible = this.milkyWayMaterial.opacity > 0.004;
    this.milkyWayScale = dampOpacity(this.milkyWayScale, targetMilkyWayScale, deltaSeconds);
    this.milkyWay.scale.setScalar(this.milkyWayScale);
    this.stellarNeighborhoodScale = dampOpacity(
      this.stellarNeighborhoodScale,
      targetStellarNeighborhoodScale,
      deltaSeconds,
    );
    this.stellarNeighborhoodRoot.scale.setScalar(this.stellarNeighborhoodScale);
    this.backdropMaterial.opacity = dampOpacity(
      this.backdropMaterial.opacity,
      targetBackdropOpacity,
      deltaSeconds,
    );
    this.backdropMaterial.uniforms['opacity']!.value = this.backdropMaterial.opacity;
    this.backdrop.visible = this.backdropMaterial.opacity > 0.004;
  }

  public selectCatalogObject(objectId: string | null): void {
    this.starCatalogBatch?.select(objectId);
    this.exoplanetHostBatch?.select(objectId);
    this.cosmicGroupCatalogBatch?.select(objectId);
    this.cosmicStructureCatalogBatch?.select(objectId);
    this.tempelFilamentSpineBatch?.select(objectId);
  }

  public hoverCatalogObject(objectId: string | null): void {
    this.tempelFilamentSpineBatch?.hover(objectId);
  }

  public getCatalogWorldPosition(
    objectId: string,
    target = new THREE.Vector3(),
  ): THREE.Vector3 | null {
    return (
      this.starCatalogBatch?.getWorldPosition(objectId, target) ??
      this.exoplanetHostBatch?.getWorldPosition(objectId, target) ??
      this.cosmicGroupCatalogBatch?.getWorldPosition(objectId, target) ??
      this.cosmicStructureCatalogBatch?.getWorldPosition(objectId, target) ??
      null
    );
  }

  public getCatalogPickables(): readonly THREE.Object3D[] {
    return [
      ...(this.starCatalogBatch?.getPickables() ?? []),
      ...(this.exoplanetHostBatch?.getPickables() ?? []),
      ...(this.constellationBatch?.getPickables() ?? []),
      ...(this.cosmicGroupCatalogBatch?.getPickables() ?? []),
      ...(this.cosmicStructureCatalogBatch?.getPickables() ?? []),
      ...(this.tempelFilamentSpineBatch?.getPickables() ?? []),
    ];
  }

  public isCatalogObjectVisibleForLabels(objectId: string): boolean | null {
    return (
      this.exoplanetHostBatch?.isObjectVisibleForLabels(objectId) ??
      this.cosmicGroupCatalogBatch?.isObjectVisibleForLabels(objectId) ??
      this.cosmicStructureCatalogBatch?.isObjectVisibleForLabels(objectId) ??
      null
    );
  }

  public get visibleCatalogStarCount(): number {
    return this.starCatalogBatch?.visibleCount ?? 0;
  }

  public get catalogStarCount(): number {
    return this.starCatalogBatch?.points.userData['catalogCount'] ?? 0;
  }

  public get visibleExoplanetHostCount(): number {
    return this.exoplanetHostBatch?.visibleCount ?? 0;
  }

  public get exoplanetHostCount(): number {
    return this.exoplanetHostBatch?.points.userData['catalogCount'] ?? 0;
  }

  public get exoplanetCount(): number {
    return this.exoplanetHostBatch?.points.userData['planetCount'] ?? 0;
  }

  public get visibleCosmicGroupCount(): number {
    return this.cosmicGroupCatalogBatch?.visibleCount ?? 0;
  }

  public get visibleNearbyGalaxyOverviewCount(): number {
    return this.nearbyGalaxyOverviewBatch?.visibleCount ?? 0;
  }

  public get cosmicGroupCount(): number {
    return this.cosmicGroupCatalogBatch?.points.userData['catalogCount'] ?? 0;
  }

  public get visibleCosmicStructureCount(): number {
    return this.cosmicStructureCatalogBatch?.visibleCount ?? 0;
  }

  public get tempelFilamentSpineTileCount(): number {
    return this.tempelFilamentSpineBatch?.tileCount ?? 0;
  }

  public get tempelFilamentSpineCount(): number {
    return this.tempelFilamentSpineBatch?.catalogFilamentCount ?? 0;
  }

  public get tempelFilamentSpinePointCount(): number {
    return this.tempelFilamentSpineBatch?.catalogPointCount ?? 0;
  }

  public get tempelFilamentSpineSegmentCount(): number {
    return this.tempelFilamentSpineBatch?.catalogSegmentCount ?? 0;
  }

  public get visibleTempelFilamentSpineSegmentCount(): number {
    return this.tempelFilamentSpineBatch?.visibleSegmentCount ?? 0;
  }

  public get cosmicStructureCount(): number {
    return this.cosmicStructureCatalogBatch?.points.userData['catalogCount'] ?? 0;
  }

  public get cosmicFilamentCount(): number {
    return this.cosmicGroupCatalogBatch?.filaments.userData['edgeCount'] ?? 0;
  }

  public get activeCosmicFilamentCount(): number {
    return this.cosmicGroupCatalogBatch?.activeFilamentCount ?? 0;
  }

  public get visibleCosmicFilamentCount(): number {
    return this.cosmicGroupCatalogBatch?.visibleFilamentCount ?? 0;
  }

  public get activeStarTileCount(): number {
    return this.starClusterBatch?.activeTileCount ?? 0;
  }

  public get starClusterRepresentationCount(): number {
    return this.starClusterBatch?.representationCount ?? 0;
  }

  public get visibleStarClusterCount(): number {
    return this.starClusterBatch?.visibleClusterCount ?? 0;
  }

  public dispose(): void {
    if (this.constellationBatch) {
      this.stellarNeighborhoodRoot.remove(this.constellationBatch.root);
      this.constellationBatch.dispose();
      this.constellationBatch = null;
    }
    if (this.starCatalogBatch) {
      this.stellarNeighborhoodRoot.remove(this.starCatalogBatch.root);
      this.starCatalogBatch.dispose();
      this.starCatalogBatch = null;
    }
    if (this.exoplanetHostBatch) {
      this.stellarNeighborhoodRoot.remove(this.exoplanetHostBatch.root);
      this.exoplanetHostBatch.dispose();
      this.exoplanetHostBatch = null;
    }
    if (this.starClusterBatch) {
      this.stellarNeighborhoodRoot.remove(this.starClusterBatch.root);
      this.starClusterBatch.dispose();
      this.starClusterBatch = null;
    }
    if (this.cosmicGroupCatalogBatch) {
      this.spaceRoot.remove(this.cosmicGroupCatalogBatch.root);
      this.cosmicGroupCatalogBatch.dispose();
      this.cosmicGroupCatalogBatch = null;
    }
    if (this.localVolumeDepthBackdrop) {
      this.spaceRoot.remove(this.localVolumeDepthBackdrop.points);
      this.localVolumeDepthBackdrop.dispose();
      this.localVolumeDepthBackdrop = null;
    }
    if (this.cosmicStructureCatalogBatch) {
      this.spaceRoot.remove(this.cosmicStructureCatalogBatch.root);
      this.cosmicStructureCatalogBatch.dispose();
      this.cosmicStructureCatalogBatch = null;
    }
    if (this.cosmicWebVolumeRenderer) {
      this.spaceRoot.remove(this.cosmicWebVolumeRenderer.mesh);
      this.cosmicWebVolumeRenderer.dispose();
      this.cosmicWebVolumeRenderer = null;
    }
    if (this.tempelFilamentSpineBatch) {
      this.spaceRoot.remove(this.tempelFilamentSpineBatch.root);
      this.tempelFilamentSpineBatch.dispose();
      this.tempelFilamentSpineBatch = null;
    }
    if (this.nearbyGalaxyOverviewBatch) {
      this.spaceRoot.remove(this.nearbyGalaxyOverviewBatch.points);
      this.nearbyGalaxyOverviewBatch.dispose();
      this.nearbyGalaxyOverviewBatch = null;
    }
    this.localSpaceEnvironment.root.removeFromParent();
    this.localSpaceEnvironment.dispose();
    this.spaceRoot.remove(this.milkyWayVolume.root);
    this.milkyWayVolume.dispose();
    this.scene.remove(this.cosmicBackground.mesh);
    this.cosmicBackground.dispose();
    disposeObjectTree(this.scene);
    this.scene.clear();
  }

  private getLocalObserverDistance(cameraPosition: Vector3Like): number {
    this.stellarNeighborhoodRoot.getWorldPosition(this.stellarOriginWorldPosition);
    this.localObserverPosition.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);

    return this.localObserverPosition.distanceTo(this.stellarOriginWorldPosition);
  }
}

const LOCAL_SKY_PARTICLE_COUNTS = {
  low: 3_000,
  medium: 7_000,
  high: 14_000,
} as const satisfies Record<GraphicQuality, number>;
const BACKDROP_OPACITIES = [0.26, 0.34, 0.18, 0, 0, 0, 0] as const;
const STELLAR_NEIGHBORHOOD_SCALE_START = 1_400;
const STELLAR_NEIGHBORHOOD_SCALE_END = 9_600;
const GALACTIC_STELLAR_NEIGHBORHOOD_SCALE = 0.16;

function dampOpacity(current: number, target: number, deltaSeconds: number): number {
  if (deltaSeconds <= 0) {
    return current;
  }

  return current + (target - current) * (1 - Math.exp(-6 * deltaSeconds));
}

function calculateStellarNeighborhoodScale(cameraDistance: number): number {
  const progress = smoothstep(
    STELLAR_NEIGHBORHOOD_SCALE_START,
    STELLAR_NEIGHBORHOOD_SCALE_END,
    cameraDistance,
  );

  return 1 - progress * (1 - GALACTIC_STELLAR_NEIGHBORHOOD_SCALE);
}

function smoothstep(minimum: number, maximum: number, value: number): number {
  const progress = Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum)));

  return progress * progress * (3 - 2 * progress);
}

function createBackdropGeometry(count: number): THREE.BufferGeometry {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const alphas = new Float32Array(count);
  const random = mulberry32(0x0c05_105);
  const cool = new THREE.Color(0x94b7ff);
  const neutral = new THREE.Color(0xe7efff);
  const warm = new THREE.Color(0xffbd72);
  const color = new THREE.Color();

  for (let index = 0; index < count; index += 1) {
    const radius = 7_500 + random() * 1_500;
    const theta = random() * Math.PI * 2;
    const galacticPlaneStar = random() < 0.46;
    const cosine = galacticPlaneStar
      ? THREE.MathUtils.clamp(centeredNoise(random) * 0.12, -0.32, 0.32)
      : random() * 2 - 1;
    const sine = Math.sqrt(1 - cosine * cosine);
    const offset = index * 3;
    const temperature = random();
    const prominence = Math.pow(random(), 5.5);

    positions[offset] = radius * sine * Math.cos(theta);
    positions[offset + 1] = radius * cosine;
    positions[offset + 2] = radius * sine * Math.sin(theta);
    if (temperature < 0.38) {
      color.lerpColors(cool, neutral, temperature / 0.38);
    } else {
      color.lerpColors(neutral, warm, (temperature - 0.38) / 0.62);
    }
    colors[offset] = color.r;
    colors[offset + 1] = color.g;
    colors[offset + 2] = color.b;
    sizes[index] = 0.72 + prominence * 2.35;
    alphas[index] = 0.34 + random() * 0.42 + prominence * 0.2;
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('pointSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('pointAlpha', new THREE.BufferAttribute(alphas, 1));

  return geometry;
}

function createBackdropMaterial(): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      pixelRatio: { value: 1 },
      opacity: { value: 0.32 },
    },
    vertexShader: `
      attribute vec3 color;
      attribute float pointSize;
      attribute float pointAlpha;
      uniform float pixelRatio;
      varying vec3 starColor;
      varying float starAlpha;

      void main() {
        starColor = color;
        starAlpha = pointAlpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = max(0.8, pointSize * pixelRatio);
      }
    `,
    fragmentShader: `
      uniform float opacity;
      varying vec3 starColor;
      varying float starAlpha;

      void main() {
        vec2 point = (gl_PointCoord - vec2(0.5)) * 2.0;
        float radius = length(point);
        if (radius > 1.0) {
          discard;
        }
        float stellarHalo = pow(1.0 - radius, 1.7);
        float stellarCore = 1.0 - smoothstep(0.0, 0.2, radius);
        float alpha = min(1.0, stellarHalo * 0.62 + stellarCore * 0.7)
          * starAlpha * opacity;
        vec3 color = starColor * (0.72 + stellarCore * 1.18);

        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });

  material.opacity = 0.32;

  return material;
}

function createMilkyWayGeometry(count: number): THREE.BufferGeometry {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const random = mulberry32(0x51a7_f13d);
  const cool = new THREE.Color(0x7195d0);
  const warm = new THREE.Color(0xe1bc82);
  const sample: MilkyWayParticle = { x: 0, y: 0, z: 0, warmth: 0 };

  for (let index = 0; index < count; index += 1) {
    sampleMilkyWayParticle(random, sample);
    const offset = index * 3;

    positions[offset] = sample.x;
    positions[offset + 1] = sample.y;
    positions[offset + 2] = sample.z;
    colors[offset] = cool.r + (warm.r - cool.r) * sample.warmth;
    colors[offset + 1] = cool.g + (warm.g - cool.g) * sample.warmth;
    colors[offset + 2] = cool.b + (warm.b - cool.b) * sample.warmth;
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  return geometry;
}

interface MilkyWayParticle {
  x: number;
  y: number;
  z: number;
  warmth: number;
}

function sampleMilkyWayParticle(random: () => number, target: MilkyWayParticle): void {
  const component = random();

  if (component < 0.17) {
    sampleGalacticBar(random, target);

    return;
  }
  if (component < 0.62) {
    sampleSpiralArm(random, target);

    return;
  }
  sampleDiffuseDisk(random, target);
}

function sampleGalacticBar(random: () => number, target: MilkyWayParticle): void {
  const radialProgress = Math.pow(random(), 1.65);
  const angle = random() * Math.PI * 2;
  const barX = Math.cos(angle) * radialProgress * 1_420;
  const barZ = Math.sin(angle) * radialProgress * 520;
  const barRotation = Math.PI * 0.14;

  target.x = Math.cos(barRotation) * barX - Math.sin(barRotation) * barZ;
  target.y = centeredNoise(random) * 330 * (1 - radialProgress * 0.65);
  target.z = Math.sin(barRotation) * barX + Math.cos(barRotation) * barZ;
  target.warmth = 0.52 + (1 - radialProgress) * 0.28 + random() * 0.08;
}

function sampleSpiralArm(random: () => number, target: MilkyWayParticle): void {
  const radialProgress = Math.pow(random(), 0.78);
  const armIndex = Math.floor(random() * MILKY_WAY_ARM_COUNT);
  const armWidth = 75 + radialProgress * 185;
  const radius =
    MILKY_WAY_ARM_REFERENCE_RADIUS + radialProgress * 4_550 + centeredNoise(random) * armWidth;
  const angle =
    calculateGalactocentricSpiralAngle(radius, armIndex) +
    centeredNoise(random) * (0.08 + radialProgress * 0.075);

  target.x = Math.cos(angle) * radius;
  target.y = centeredNoise(random) * (75 + radialProgress * 155);
  target.z = Math.sin(angle) * radius;
  target.warmth = 0.08 + (1 - radialProgress) * 0.18 + random() * 0.12;
}

function sampleDiffuseDisk(random: () => number, target: MilkyWayParticle): void {
  const radialProgress = Math.sqrt(random());
  const radius = 620 + radialProgress * 5_180;
  const angle = random() * Math.PI * 2;

  target.x = Math.cos(angle) * radius;
  target.y = centeredNoise(random) * (65 + radialProgress * 220);
  target.z = Math.sin(angle) * radius;
  target.warmth = 0.16 + (1 - radialProgress) * 0.3 + random() * 0.1;
}

function centeredNoise(random: () => number): number {
  return random() + random() + random() - 1.5;
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

function mulberry32(seed: number): () => number {
  let state = seed;

  return () => {
    state |= 0;
    state = (state + 0x6d2b_79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);

    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;

    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}
