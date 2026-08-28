import * as THREE from 'three';
import {
  type ConstellationCatalog,
  type GaiaPresentationStats,
  type GraphicQuality,
  type SpaceObject,
  type StarClusterTile,
  type TemporalMode,
  type UniverseTime,
  type Vector3Like,
} from '../../data/models/universe.models';
import { type ExoplanetCatalogRegistry } from '../objects/exoplanet-catalog-registry';
import { type StarCatalogRegistry } from '../objects/star-catalog-registry';
import { type ConstellationBatch } from './constellation-batch';
import { type ExoplanetHostBatch } from './exoplanet-host-batch';
import { type StarCatalogBatch } from './star-catalog-batch';
import { type StarClusterBatch } from './star-cluster-batch';

export class StellarCatalogLayers {
  private starCatalogBatch: StarCatalogBatch | null = null;
  private exoplanetHostBatch: ExoplanetHostBatch | null = null;
  private starClusterBatch: StarClusterBatch | null = null;
  private constellationBatch: ConstellationBatch | null = null;
  private quality: GraphicQuality = 'medium';
  private pixelRatio = 1;

  constructor(private readonly root: THREE.Group) {}

  public setQuality(quality: GraphicQuality): void {
    this.quality = quality;
    this.starCatalogBatch?.setQuality(quality);
    this.starClusterBatch?.setQuality(quality);
    this.exoplanetHostBatch?.setQuality(quality);
  }

  public setPixelRatio(pixelRatio: number): void {
    this.pixelRatio = pixelRatio;
    this.starCatalogBatch?.setPixelRatio(pixelRatio);
    this.exoplanetHostBatch?.setPixelRatio(pixelRatio);
    this.starClusterBatch?.setPixelRatio(pixelRatio);
  }

  public async setStarCatalog(registry: StarCatalogRegistry): Promise<void> {
    this.disposeStarClusters();
    if (this.starCatalogBatch) {
      this.root.remove(this.starCatalogBatch.root);
      this.starCatalogBatch.dispose();
    }

    const { StarCatalogBatch } = await import('./star-catalog-batch');

    this.starCatalogBatch = new StarCatalogBatch(registry, this.quality);
    this.root.add(this.starCatalogBatch.root);
    this.applyDisplayConfiguration();
  }

  public async setExoplanetCatalog(registry: ExoplanetCatalogRegistry): Promise<void> {
    if (this.exoplanetHostBatch) {
      this.root.remove(this.exoplanetHostBatch.root);
      this.exoplanetHostBatch.dispose();
    }

    const { ExoplanetHostBatch } = await import('./exoplanet-host-batch');

    this.exoplanetHostBatch = new ExoplanetHostBatch(registry, this.quality);
    this.root.add(this.exoplanetHostBatch.root);
    this.applyDisplayConfiguration();
  }

  public async setStarClusterTiles(
    tiles: readonly StarClusterTile[],
    registry: StarCatalogRegistry,
  ): Promise<void> {
    if (!this.starClusterBatch) {
      const { StarClusterBatch } = await import('./star-cluster-batch');

      if (!this.starClusterBatch) {
        this.starClusterBatch = new StarClusterBatch(registry);
        this.root.add(this.starClusterBatch.root);
        this.applyDisplayConfiguration();
      }
    }
    this.starClusterBatch.synchronizeTiles(tiles);
  }

  public async setConstellationCatalog(
    catalog: ConstellationCatalog,
    registry: StarCatalogRegistry,
  ): Promise<void> {
    if (this.constellationBatch) {
      this.root.remove(this.constellationBatch.root);
      this.constellationBatch.dispose();
    }

    const { ConstellationBatch } = await import('./constellation-batch');

    this.constellationBatch = new ConstellationBatch(catalog, registry);
    this.root.add(this.constellationBatch.root);
  }

  public setConstellationsEnabled(enabled: boolean): void {
    this.constellationBatch?.setEnabled(enabled);
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
    starRadiance: number,
    cameraPosition?: Vector3Like,
    navigationTargetId: string | null = null,
    cameraDistance?: number,
  ): void {
    this.starCatalogBatch?.setPhotographicRadiance(starRadiance);
    this.exoplanetHostBatch?.setPhotographicRadiance(starRadiance);
    this.starClusterBatch?.setPhotographicRadiance(starRadiance);
    this.starCatalogBatch?.focus(navigationTargetId);
    this.starCatalogBatch?.updateLod(lodLevel, deltaSeconds, cameraPosition, cameraDistance);
    this.exoplanetHostBatch?.updateLod(lodLevel, deltaSeconds, cameraPosition, cameraDistance);
    this.starClusterBatch?.updateLod(lodLevel, deltaSeconds, cameraDistance);
    this.constellationBatch?.updateLod(lodLevel, deltaSeconds, cameraDistance);
  }

  public updateTime(time: UniverseTime, temporalMode: TemporalMode = 'state'): void {
    if (this.starCatalogBatch?.updateTime(time, temporalMode)) {
      this.constellationBatch?.updatePositions();
    }
  }

  public selectCatalogObject(objectId: string | null): void {
    this.starCatalogBatch?.select(objectId);
    this.exoplanetHostBatch?.select(objectId);
  }

  public getCatalogWorldPosition(
    objectId: string,
    target = new THREE.Vector3(),
  ): THREE.Vector3 | null {
    return (
      this.starCatalogBatch?.getWorldPosition(objectId, target) ??
      this.exoplanetHostBatch?.getWorldPosition(objectId, target) ??
      null
    );
  }

  public getPickables(): readonly THREE.Object3D[] {
    return [
      ...(this.starCatalogBatch?.getPickables() ?? []),
      ...(this.exoplanetHostBatch?.getPickables() ?? []),
      ...(this.constellationBatch?.getPickables() ?? []),
    ];
  }

  public isObjectVisibleForLabels(objectId: string): boolean | null {
    return (
      this.starCatalogBatch?.isObjectVisibleForLabels(objectId) ??
      this.exoplanetHostBatch?.isObjectVisibleForLabels(objectId) ??
      this.constellationBatch?.isObjectVisibleForLabels(objectId) ??
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

  public get activeStarTileCount(): number {
    return this.starClusterBatch?.activeTileCount ?? 0;
  }

  public get starClusterRepresentationCount(): number {
    return this.starClusterBatch?.representationCount ?? 0;
  }

  public get visibleStarClusterCount(): number {
    return this.starClusterBatch?.visibleClusterCount ?? 0;
  }

  public getGaiaPresentationStats(camera: THREE.Camera): GaiaPresentationStats {
    return (
      this.starClusterBatch?.getPresentationStats(camera) ?? {
        sampledSources: 0,
        projectedSampledSources: 0,
        aggregateCells: 0,
        projectedAggregateCells: 0,
      }
    );
  }

  public dispose(): void {
    if (this.constellationBatch) {
      this.root.remove(this.constellationBatch.root);
      this.constellationBatch.dispose();
      this.constellationBatch = null;
    }
    if (this.starCatalogBatch) {
      this.root.remove(this.starCatalogBatch.root);
      this.starCatalogBatch.dispose();
      this.starCatalogBatch = null;
    }
    if (this.exoplanetHostBatch) {
      this.root.remove(this.exoplanetHostBatch.root);
      this.exoplanetHostBatch.dispose();
      this.exoplanetHostBatch = null;
    }
    this.disposeStarClusters();
  }

  private applyDisplayConfiguration(): void {
    this.setQuality(this.quality);
    this.setPixelRatio(this.pixelRatio);
  }

  private disposeStarClusters(): void {
    if (!this.starClusterBatch) {
      return;
    }
    this.root.remove(this.starClusterBatch.root);
    this.starClusterBatch.dispose();
    this.starClusterBatch = null;
  }
}
