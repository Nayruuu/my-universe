import * as THREE from 'three';
import {
  type GraphicQuality,
  type LabelDensity,
  type SearchEntry,
  type SpaceObject,
} from '../../data/models/universe.models';
import {
  getMaximumCatalogLabelPoolRank,
  getMaximumCosmicLabelRank,
  getMaximumExoplanetHostLabelPoolRank,
  type LabelObject,
} from '../objects/label-manager';

export interface UniverseObjectDirectoryObjectRuntime {
  has(objectId: string): boolean;
  getDefinition(objectId: string): SpaceObject | undefined;
  getWorldPosition(objectId: string, target?: THREE.Vector3): THREE.Vector3 | null;
}

export interface UniverseObjectDirectoryCatalog {
  has(objectId: string): boolean;
  getDefinition(objectId: string): SpaceObject | undefined;
  getLabelObjects(
    existingObjects: readonly SpaceObject[],
    maximumCatalogRank: number,
    maximumExoplanetHostRank: number,
    maximumCosmicRank: number,
  ): readonly LabelObject[];
  getSearchEntries(): readonly SearchEntry[];
}

export interface UniverseObjectDirectoryScene {
  readonly constellationDefinitions: readonly SpaceObject[];
  hasConstellation(objectId: string): boolean;
  getConstellationDefinition(objectId: string): SpaceObject | undefined;
  getCatalogWorldPosition(objectId: string, target?: THREE.Vector3): THREE.Vector3 | null;
  getConstellationWorldPosition(objectId: string, target?: THREE.Vector3): THREE.Vector3 | null;
}

export interface UniverseObjectDirectoryBindings {
  getLoadedObjects(): readonly SpaceObject[];
  getActiveExoplanetObjects(): readonly SpaceObject[];
  getCatalog(): UniverseObjectDirectoryCatalog | null;
  getScene(): UniverseObjectDirectoryScene | null;
  hasStreamedObject(objectId: string): boolean;
  getQuality(): GraphicQuality;
  getLabelDensity(): LabelDensity;
}

export interface UniverseObjectDirectorySearchSource {
  readonly searchEntries: readonly SearchEntry[];
}

export interface UniverseObjectDirectoryDataReadyPayload {
  readonly objects: readonly SpaceObject[];
  readonly catalogEntries: readonly SearchEntry[];
}

export class UniverseObjectDirectory {
  constructor(
    private readonly objectRuntime: UniverseObjectDirectoryObjectRuntime,
    private readonly bindings: UniverseObjectDirectoryBindings,
  ) {}

  public has(objectId: string): boolean {
    return (
      this.objectRuntime.has(objectId) ||
      this.bindings.getCatalog()?.has(objectId) === true ||
      this.bindings.getScene()?.hasConstellation(objectId) === true ||
      this.bindings.hasStreamedObject(objectId)
    );
  }

  public getDefinition(objectId: string): SpaceObject | undefined {
    return (
      this.objectRuntime.getDefinition(objectId) ??
      this.bindings.getCatalog()?.getDefinition(objectId) ??
      this.bindings.getScene()?.getConstellationDefinition(objectId)
    );
  }

  public getWorldPosition(objectId: string, target = new THREE.Vector3()): THREE.Vector3 | null {
    const scene = this.bindings.getScene();

    return (
      this.objectRuntime.getWorldPosition(objectId, target) ??
      scene?.getCatalogWorldPosition(objectId, target) ??
      scene?.getConstellationWorldPosition(objectId, target) ??
      null
    );
  }

  public getPublicObjects(): SpaceObject[] {
    return [
      ...this.bindings.getLoadedObjects(),
      ...this.bindings.getActiveExoplanetObjects(),
      ...(this.bindings.getScene()?.constellationDefinitions ?? []),
    ];
  }

  public getLabelObjects(): LabelObject[] {
    const publicObjects = this.getPublicObjects();
    const quality = this.bindings.getQuality();
    const labelDensity = this.bindings.getLabelDensity();
    const maximumCatalogRank = getMaximumCatalogLabelPoolRank(quality, labelDensity);
    const maximumExoplanetHostRank = getMaximumExoplanetHostLabelPoolRank(quality, labelDensity);
    const maximumCosmicRank = getMaximumCosmicLabelRank(quality, 6, labelDensity);

    return [
      ...publicObjects,
      ...(this.bindings
        .getCatalog()
        ?.getLabelObjects(
          publicObjects,
          maximumCatalogRank,
          maximumExoplanetHostRank,
          maximumCosmicRank,
        ) ?? []),
    ];
  }

  public createDataReadyPayload(
    searchSource: UniverseObjectDirectorySearchSource,
  ): UniverseObjectDirectoryDataReadyPayload {
    const loadedObjects = this.bindings.getLoadedObjects();
    const loadedObjectIds = new Set(loadedObjects.map((object) => object.id));
    const tileSearchEntries = searchSource.searchEntries.filter(
      (entry) => !loadedObjectIds.has(entry.id),
    );

    return {
      objects: this.getPublicObjects(),
      catalogEntries: [
        ...(this.bindings.getCatalog()?.getSearchEntries() ?? []),
        ...tileSearchEntries,
      ],
    };
  }
}
