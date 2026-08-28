import * as THREE from 'three';
import type { SearchEntry, SpaceObject } from '../../data/models/universe.models';
import type { CoordinateSystem } from '../coordinates/coordinate-system';
import {
  CATALOG_PREPARATION_CHUNK_SIZE,
  finishCatalogPreparation,
  prepareCatalogIncrementally,
  yieldCatalogPreparation,
} from '../core/catalog-preparation';
import type { ExoplanetCatalog } from '../loaders/exoplanet-catalog';
import { stableCatalogHash } from './exoplanet-catalog-values';
import {
  prepareExoplanetCatalogPresentation,
  type ExoplanetCatalogPresentation,
} from './exoplanet-catalog-presentation';
import {
  EXOPLANET_MISSING_DISTANCE_FALLBACK_CONFIDENCE,
  ExoplanetObjectFactory,
} from './exoplanet-object-factory';
import type { LabelObject } from './label-manager';
import { prepareExoplanetSpatialModel } from './exoplanet-spatial-model';

export { EXOPLANET_MISSING_DISTANCE_FALLBACK_CONFIDENCE };

type CatalogObjectKind = 'host' | 'planet';

interface PreparedExoplanetRegistry {
  readonly hostObjectIds: readonly string[];
  readonly planetObjectIds: readonly string[];
  readonly hostIndexByObjectId: ReadonlyMap<string, number>;
  readonly planetIndexByObjectId: ReadonlyMap<string, number>;
  readonly objectFactory: ExoplanetObjectFactory;
  readonly presentation: ExoplanetCatalogPresentation;
}

export class ExoplanetCatalogRegistry {
  public readonly hostObjectIds: readonly string[];
  public readonly planetObjectIds: readonly string[];
  public readonly renderPositions: Float32Array;
  public readonly activeObjectCount = 0;

  private readonly hostIndexByObjectId: ReadonlyMap<string, number>;
  private readonly planetIndexByObjectId: ReadonlyMap<string, number>;
  private readonly definitions = new Map<string, SpaceObject>();
  private readonly objectFactory: ExoplanetObjectFactory;
  private readonly presentation: ExoplanetCatalogPresentation;

  constructor(
    public readonly catalog: ExoplanetCatalog,
    coordinateSystem: CoordinateSystem,
    featuredObjects: readonly SpaceObject[] = [],
    prepared = finishCatalogPreparation(
      prepareExoplanetRegistry(catalog, coordinateSystem, featuredObjects),
    ),
  ) {
    this.hostObjectIds = prepared.hostObjectIds;
    this.planetObjectIds = prepared.planetObjectIds;
    this.hostIndexByObjectId = prepared.hostIndexByObjectId;
    this.planetIndexByObjectId = prepared.planetIndexByObjectId;
    this.objectFactory = prepared.objectFactory;
    this.renderPositions = this.objectFactory.renderPositions;
    this.presentation = prepared.presentation;
  }

  public static async create(
    catalog: ExoplanetCatalog,
    coordinateSystem: CoordinateSystem,
    featuredObjects: readonly SpaceObject[] = [],
    yieldControl = yieldCatalogPreparation,
  ): Promise<ExoplanetCatalogRegistry> {
    const prepared = await prepareCatalogIncrementally(
      prepareExoplanetRegistry(catalog, coordinateSystem, featuredObjects, true),
      yieldControl,
    );

    return new ExoplanetCatalogRegistry(catalog, coordinateSystem, featuredObjects, prepared);
  }

  public has(objectId: string): boolean {
    return this.hostIndexByObjectId.has(objectId) || this.planetIndexByObjectId.has(objectId);
  }

  public isHost(objectId: string): boolean {
    return this.hostIndexByObjectId.has(objectId);
  }

  public getHostObjectId(index: number): string {
    const objectId = this.hostObjectIds[index];

    if (!objectId) {
      throw new Error(`Indice d’hôte exoplanétaire hors limites : ${index}.`);
    }

    return objectId;
  }

  public getHostIndex(objectId: string): number | null {
    const directIndex = this.hostIndexByObjectId.get(objectId);

    if (directIndex !== undefined) {
      return directIndex;
    }
    const planetIndex = this.planetIndexByObjectId.get(objectId);

    return planetIndex === undefined ? null : this.catalog.planetHostIndices[planetIndex]!;
  }

  public getRenderableHostIndices(): readonly number[] {
    return this.presentation.renderableHostIndices;
  }

  public getPlanetObjectId(index: number): string {
    const objectId = this.planetObjectIds[index];

    if (!objectId) {
      throw new Error(`Indice d’exoplanète hors limites : ${index}.`);
    }

    return objectId;
  }

  public getHostIdForObject(objectId: string): string | null {
    const hostIndex = this.hostIndexByObjectId.get(objectId);

    if (hostIndex !== undefined) {
      return this.hostObjectIds[hostIndex]!;
    }
    const planetIndex = this.planetIndexByObjectId.get(objectId);

    return planetIndex === undefined
      ? null
      : this.hostObjectIds[this.catalog.planetHostIndices[planetIndex]!]!;
  }

  public getDefinition(objectId: string): SpaceObject | undefined {
    const cached = this.definitions.get(objectId);

    if (cached) {
      return cached;
    }
    const hostIndex = this.hostIndexByObjectId.get(objectId);
    const planetIndex = this.planetIndexByObjectId.get(objectId);
    const definition =
      hostIndex !== undefined
        ? this.objectFactory.createHostDefinition(hostIndex)
        : planetIndex !== undefined
          ? this.objectFactory.createPlanetDefinition(planetIndex)
          : undefined;

    if (definition) {
      this.definitions.set(objectId, definition);
    }

    return definition;
  }

  public createSystemObjects(objectId: string): readonly SpaceObject[] {
    const hostId = this.getHostIdForObject(objectId);

    if (!hostId) {
      return [];
    }
    const hostIndex = this.hostIndexByObjectId.get(hostId)!;
    const host = this.objectFactory.createHostDefinition(hostIndex);
    const firstPlanetIndex = this.catalog.hostFirstPlanetIndices[hostIndex]!;
    const planetCount = this.catalog.hostPlanetCounts[hostIndex]!;
    const planets = Array.from({ length: planetCount }, (_, offset) =>
      this.objectFactory.createPlanetDefinition(firstPlanetIndex + offset),
    );

    return [host, ...planets];
  }

  public getLocalPosition(objectId: string, target = new THREE.Vector3()): THREE.Vector3 | null {
    const hostId = this.getHostIdForObject(objectId);

    if (!hostId) {
      return null;
    }
    const hostIndex = this.hostIndexByObjectId.get(hostId)!;

    return target.fromArray(this.renderPositions, hostIndex * 3);
  }

  public getSearchEntries(): readonly SearchEntry[] {
    return this.presentation.getSearchEntries();
  }

  public getLabelObjects(maximumRank?: number): readonly LabelObject[] {
    return this.presentation.getLabelObjects(maximumRank);
  }
}

function* prepareExoplanetRegistry(
  catalog: ExoplanetCatalog,
  coordinateSystem: CoordinateSystem,
  featuredObjects: readonly SpaceObject[],
  prepareSearch = false,
): Generator<void, PreparedExoplanetRegistry> {
  const featuredHosts = yield* prepareFeaturedObjectMap(featuredObjects, 'star');
  const featuredPlanets = yield* prepareFeaturedObjectMap(featuredObjects, 'exoplanet');
  const linkedObjectIds = new Set<string>();
  const identifiers = new Set<string>();
  const hostIndexByObjectId = new Map<string, number>();
  const planetIndexByObjectId = new Map<string, number>();
  const hostObjectIds = yield* prepareObjectIds(
    catalog.hostNames,
    'host',
    featuredHosts,
    linkedObjectIds,
    identifiers,
    hostIndexByObjectId,
  );
  const planetObjectIds = yield* prepareObjectIds(
    catalog.planetNames,
    'planet',
    featuredPlanets,
    linkedObjectIds,
    identifiers,
    planetIndexByObjectId,
  );
  const spatialModel = yield* prepareExoplanetSpatialModel(catalog, coordinateSystem);
  const objectFactory = new ExoplanetObjectFactory(
    catalog,
    coordinateSystem,
    hostObjectIds,
    planetObjectIds,
    spatialModel,
  );
  const presentation = yield* prepareExoplanetCatalogPresentation(
    catalog,
    hostObjectIds,
    planetObjectIds,
    linkedObjectIds,
    prepareSearch,
  );

  return {
    hostObjectIds,
    planetObjectIds,
    hostIndexByObjectId,
    planetIndexByObjectId,
    objectFactory,
    presentation,
  };
}

function* prepareObjectIds(
  names: readonly string[],
  kind: CatalogObjectKind,
  featuredObjects: ReadonlyMap<string, SpaceObject>,
  linkedObjectIds: Set<string>,
  identifiers: Set<string>,
  indices: Map<string, number>,
): Generator<void, readonly string[]> {
  const ids: string[] = [];

  for (let index = 0; index < names.length; index += 1) {
    const name = names[index]!;
    const featured = findFeaturedObject(featuredObjects, name);
    const id = featured?.id ?? createNasaCatalogObjectId(kind, name);

    if (identifiers.has(id)) {
      throw new Error('Le catalogue d’exoplanètes contient des identifiants de carte dupliqués.');
    }
    if (featured) {
      linkedObjectIds.add(id);
    }
    identifiers.add(id);
    indices.set(id, index);
    ids.push(id);
    if ((index + 1) % CATALOG_PREPARATION_CHUNK_SIZE === 0) {
      yield;
    }
  }

  return ids;
}

export function createNasaCatalogObjectId(kind: CatalogObjectKind, name: string): string {
  const slug =
    name
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLocaleLowerCase('en')
      .replace(/[^a-z0-9]+/gu, '-')
      .replace(/^-|-$/gu, '') || 'object';

  return `nea-${kind}-${slug}-${stableCatalogHash(`${kind}:${name}`).toString(36)}`;
}

function* prepareFeaturedObjectMap(
  objects: readonly SpaceObject[],
  type: 'star' | 'exoplanet',
): Generator<void, ReadonlyMap<string, SpaceObject>> {
  const map = new Map<string, SpaceObject>();
  let work = 0;

  for (const object of objects) {
    const isCatalogObject =
      object.type === type &&
      (object.metadata?.['sourceTable'] === 'PSCompPars' ||
        (type === 'star' && object.metadata?.['exoplanetHost'] === true));

    if (isCatalogObject) {
      map.set(normalizeCatalogName(object.name), object);
      for (const name of object.aliases ?? []) {
        map.set(normalizeCatalogName(name), object);
        work += 1;
        if (work % CATALOG_PREPARATION_CHUNK_SIZE === 0) {
          yield;
        }
      }
    }
    work += 1;
    if (work % CATALOG_PREPARATION_CHUNK_SIZE === 0) {
      yield;
    }
  }

  return map;
}

function findFeaturedObject(
  objects: ReadonlyMap<string, SpaceObject>,
  name: string,
): SpaceObject | undefined {
  return objects.get(normalizeCatalogName(name));
}

function normalizeCatalogName(value: string): string {
  return value.trim().replace(/\s+/gu, ' ').toLocaleUpperCase('en');
}
