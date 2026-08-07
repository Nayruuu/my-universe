import * as THREE from 'three';
import {
  type GraphicQuality,
  type SpaceTileIndex,
  type TempelFilamentSceneInstallationMetrics,
} from '../../data/models/universe.models';
import { type CoordinateSystem } from '../coordinates/coordinate-system';
import { type CosmicWebVolume } from '../loaders/cosmic-web-volume';
import { type TempelFilamentSpineCatalog } from '../loaders/tempel-filament-spine-catalog';
import { type CosmicGroupCatalogRegistry } from '../objects/cosmic-group-catalog-registry';
import { type CosmicStructureCatalogRegistry } from '../objects/cosmic-structure-catalog-registry';
import { type CosmicGroupCatalogBatch } from './cosmic-group-catalog-batch';
import { type CosmicStructureCatalogBatch } from './cosmic-structure-catalog-batch';
import { type CosmicWebVolumeRenderer } from './cosmic-web-volume';
import { type LocalVolumeDepthBackdrop } from './local-volume-depth-backdrop';
import { type NearbyGalaxyOverviewBatch } from './nearby-galaxy-overview-batch';
import { type TempelFilamentSpineBatch } from './tempel-filament-spine-batch';
import { type CosmicMapLayers, DEFAULT_COSMIC_MAP_LAYERS } from './cosmic-map-policy';
import { measureTempelFilamentInstallation } from './tempel-filament-installation-performance';

export class CosmicCatalogLayers {
  private cosmicGroupCatalogBatch: CosmicGroupCatalogBatch | null = null;
  private cosmicStructureCatalogBatch: CosmicStructureCatalogBatch | null = null;
  private cosmicWebVolumeRenderer: CosmicWebVolumeRenderer | null = null;
  private tempelFilamentSpineBatch: TempelFilamentSpineBatch | null = null;
  private nearbyGalaxyOverviewBatch: NearbyGalaxyOverviewBatch | null = null;
  private localVolumeDepthBackdrop: LocalVolumeDepthBackdrop | null = null;
  private quality: GraphicQuality = 'medium';
  private pixelRatio = 1;
  private photographicRadiance = 1;
  private cosmicMapLayers: CosmicMapLayers = DEFAULT_COSMIC_MAP_LAYERS;

  constructor(private readonly root: THREE.Group) {}

  public setQuality(quality: GraphicQuality): void {
    this.quality = quality;
    this.cosmicGroupCatalogBatch?.setQuality(quality);
    this.localVolumeDepthBackdrop?.setQuality(quality);
    this.cosmicStructureCatalogBatch?.setQuality(quality);
    this.cosmicWebVolumeRenderer?.setQuality(quality);
    this.tempelFilamentSpineBatch?.setQuality(quality);
  }

  public setPixelRatio(pixelRatio: number): void {
    this.pixelRatio = pixelRatio;
    this.cosmicGroupCatalogBatch?.setPixelRatio(pixelRatio);
    this.localVolumeDepthBackdrop?.setPixelRatio(pixelRatio);
    this.cosmicStructureCatalogBatch?.setPixelRatio(pixelRatio);
    this.nearbyGalaxyOverviewBatch?.setPixelRatio(pixelRatio);
  }

  public async setNearbyGalaxyOverview(
    index: SpaceTileIndex,
    coordinateSystem: CoordinateSystem,
  ): Promise<void> {
    this.disposeNearbyGalaxyOverview();
    const entries = index.overviewEntries ?? [];

    if (entries.length === 0) {
      return;
    }
    const { NearbyGalaxyOverviewBatch } = await import('./nearby-galaxy-overview-batch');

    this.nearbyGalaxyOverviewBatch = new NearbyGalaxyOverviewBatch(entries, coordinateSystem);
    this.root.add(this.nearbyGalaxyOverviewBatch.points);
    this.nearbyGalaxyOverviewBatch.setPixelRatio(this.pixelRatio);
    this.nearbyGalaxyOverviewBatch.setPhotographicRadiance(this.photographicRadiance);
  }

  public async setCosmicGroupCatalog(registry: CosmicGroupCatalogRegistry): Promise<void> {
    this.disposeCosmicGroups();
    const [{ CosmicGroupCatalogBatch }, { LocalVolumeDepthBackdrop }] = await Promise.all([
      import('./cosmic-group-catalog-batch'),
      import('./local-volume-depth-backdrop'),
    ]);

    this.cosmicGroupCatalogBatch = new CosmicGroupCatalogBatch(registry, this.quality);
    this.localVolumeDepthBackdrop = new LocalVolumeDepthBackdrop(registry, this.quality);
    this.cosmicGroupCatalogBatch.setLayers(this.cosmicMapLayers);
    this.localVolumeDepthBackdrop.setEnabled(this.cosmicMapLayers.groups);
    this.root.add(this.localVolumeDepthBackdrop.points, this.cosmicGroupCatalogBatch.root);
    this.applyDisplayConfiguration();
  }

  public async setCosmicStructureCatalog(registry: CosmicStructureCatalogRegistry): Promise<void> {
    this.disposeCosmicStructures();
    const { CosmicStructureCatalogBatch } = await import('./cosmic-structure-catalog-batch');

    this.cosmicStructureCatalogBatch = new CosmicStructureCatalogBatch(registry, this.quality);
    this.cosmicStructureCatalogBatch.setLayers(this.cosmicMapLayers);
    this.root.add(this.cosmicStructureCatalogBatch.root);
    this.applyDisplayConfiguration();
  }

  public async setCosmicWebVolume(
    volume: CosmicWebVolume,
    coordinateSystem: CoordinateSystem,
  ): Promise<void> {
    this.disposeCosmicWebVolume();
    const { CosmicWebVolumeRenderer } = await import('./cosmic-web-volume');

    this.cosmicWebVolumeRenderer = new CosmicWebVolumeRenderer(
      volume,
      coordinateSystem,
      this.quality,
    );
    this.cosmicWebVolumeRenderer.setEnabled(this.cosmicMapLayers.volume);
    this.root.add(this.cosmicWebVolumeRenderer.mesh);
  }

  public async setTempelFilamentSpineCatalog(
    catalog: TempelFilamentSpineCatalog,
    registry: CosmicStructureCatalogRegistry,
    coordinateSystem: CoordinateSystem,
  ): Promise<TempelFilamentSceneInstallationMetrics> {
    this.disposeTempelFilamentSpines();
    const { TempelFilamentSpineBatch } = await import('./tempel-filament-spine-batch');
    const installation = measureTempelFilamentInstallation(
      () => new TempelFilamentSpineBatch(catalog, registry, coordinateSystem, this.quality),
      (batch) => {
        this.tempelFilamentSpineBatch = batch;
        batch.setLayers(this.cosmicMapLayers);
        batch.setPhotographicRadiance(this.photographicRadiance);
        this.root.add(batch.root);
      },
    );

    return installation.metrics;
  }

  public setCosmicMapLayers(layers: CosmicMapLayers): void {
    this.cosmicMapLayers = { ...layers };
    this.cosmicGroupCatalogBatch?.setLayers(this.cosmicMapLayers);
    this.localVolumeDepthBackdrop?.setEnabled(this.cosmicMapLayers.groups);
    this.cosmicStructureCatalogBatch?.setLayers(this.cosmicMapLayers);
    this.cosmicWebVolumeRenderer?.setEnabled(this.cosmicMapLayers.volume);
    this.tempelFilamentSpineBatch?.setLayers(this.cosmicMapLayers);
  }

  public update(cameraDistance: number, deltaSeconds: number, galaxyRadiance: number): void {
    this.photographicRadiance = galaxyRadiance;
    this.cosmicGroupCatalogBatch?.setPhotographicRadiance(galaxyRadiance);
    this.localVolumeDepthBackdrop?.setPhotographicRadiance(galaxyRadiance);
    this.cosmicStructureCatalogBatch?.setPhotographicRadiance(galaxyRadiance);
    this.cosmicWebVolumeRenderer?.updateDistance(cameraDistance, deltaSeconds, galaxyRadiance);
    this.tempelFilamentSpineBatch?.setPhotographicRadiance(galaxyRadiance);
    this.nearbyGalaxyOverviewBatch?.setPhotographicRadiance(galaxyRadiance);
    this.cosmicGroupCatalogBatch?.updateDistance(cameraDistance, deltaSeconds);
    this.localVolumeDepthBackdrop?.updateDistance(cameraDistance, deltaSeconds);
    this.cosmicStructureCatalogBatch?.updateDistance(cameraDistance, deltaSeconds);
    this.tempelFilamentSpineBatch?.updateDistance(cameraDistance, deltaSeconds);
    this.nearbyGalaxyOverviewBatch?.updateDistance(cameraDistance, deltaSeconds);
  }

  public selectCatalogObject(objectId: string | null): void {
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
      this.cosmicGroupCatalogBatch?.getWorldPosition(objectId, target) ??
      this.cosmicStructureCatalogBatch?.getWorldPosition(objectId, target) ??
      null
    );
  }

  public getPickables(): readonly THREE.Object3D[] {
    return [
      ...(this.cosmicGroupCatalogBatch?.getPickables() ?? []),
      ...(this.cosmicStructureCatalogBatch?.getPickables() ?? []),
      ...(this.tempelFilamentSpineBatch?.getPickables() ?? []),
    ];
  }

  public isObjectVisibleForLabels(objectId: string): boolean | null {
    return (
      this.cosmicGroupCatalogBatch?.isObjectVisibleForLabels(objectId) ??
      this.cosmicStructureCatalogBatch?.isObjectVisibleForLabels(objectId) ??
      null
    );
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

  public get cosmicStructureCount(): number {
    return this.cosmicStructureCatalogBatch?.points.userData['catalogCount'] ?? 0;
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

  public get cosmicFilamentCount(): number {
    return this.cosmicGroupCatalogBatch?.filaments.userData['edgeCount'] ?? 0;
  }

  public get activeCosmicFilamentCount(): number {
    return this.cosmicGroupCatalogBatch?.activeFilamentCount ?? 0;
  }

  public get visibleCosmicFilamentCount(): number {
    return this.cosmicGroupCatalogBatch?.visibleFilamentCount ?? 0;
  }

  public dispose(): void {
    this.disposeCosmicGroups();
    this.disposeCosmicStructures();
    this.disposeCosmicWebVolume();
    this.disposeTempelFilamentSpines();
    this.disposeNearbyGalaxyOverview();
  }

  private applyDisplayConfiguration(): void {
    this.setQuality(this.quality);
    this.setPixelRatio(this.pixelRatio);
    this.cosmicGroupCatalogBatch?.setPhotographicRadiance(this.photographicRadiance);
    this.localVolumeDepthBackdrop?.setPhotographicRadiance(this.photographicRadiance);
    this.cosmicStructureCatalogBatch?.setPhotographicRadiance(this.photographicRadiance);
  }

  private disposeCosmicGroups(): void {
    if (this.cosmicGroupCatalogBatch) {
      this.root.remove(this.cosmicGroupCatalogBatch.root);
      this.cosmicGroupCatalogBatch.dispose();
      this.cosmicGroupCatalogBatch = null;
    }
    if (this.localVolumeDepthBackdrop) {
      this.root.remove(this.localVolumeDepthBackdrop.points);
      this.localVolumeDepthBackdrop.dispose();
      this.localVolumeDepthBackdrop = null;
    }
  }

  private disposeCosmicStructures(): void {
    if (!this.cosmicStructureCatalogBatch) {
      return;
    }
    this.root.remove(this.cosmicStructureCatalogBatch.root);
    this.cosmicStructureCatalogBatch.dispose();
    this.cosmicStructureCatalogBatch = null;
  }

  private disposeCosmicWebVolume(): void {
    if (!this.cosmicWebVolumeRenderer) {
      return;
    }
    this.root.remove(this.cosmicWebVolumeRenderer.mesh);
    this.cosmicWebVolumeRenderer.dispose();
    this.cosmicWebVolumeRenderer = null;
  }

  private disposeTempelFilamentSpines(): void {
    if (!this.tempelFilamentSpineBatch) {
      return;
    }
    this.root.remove(this.tempelFilamentSpineBatch.root);
    this.tempelFilamentSpineBatch.dispose();
    this.tempelFilamentSpineBatch = null;
  }

  private disposeNearbyGalaxyOverview(): void {
    if (!this.nearbyGalaxyOverviewBatch) {
      return;
    }
    this.root.remove(this.nearbyGalaxyOverviewBatch.points);
    this.nearbyGalaxyOverviewBatch.dispose();
    this.nearbyGalaxyOverviewBatch = null;
  }
}
