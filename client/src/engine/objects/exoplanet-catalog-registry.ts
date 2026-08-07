import * as THREE from 'three';
import type { SearchEntry, SpaceObject } from '../../data/models/universe.models';
import type { CoordinateSystem } from '../coordinates/coordinate-system';
import type { ExoplanetCatalog } from '../loaders/exoplanet-catalog';
import { stableCatalogHash } from './exoplanet-catalog-values';
import {
  createExoplanetCatalogPresentation,
  type ExoplanetCatalogPresentation,
} from './exoplanet-catalog-presentation';
import {
  EXOPLANET_MISSING_DISTANCE_FALLBACK_CONFIDENCE,
  ExoplanetObjectFactory,
} from './exoplanet-object-factory';
import type { LabelObject } from './label-manager';

export { EXOPLANET_MISSING_DISTANCE_FALLBACK_CONFIDENCE };

type CatalogObjectKind = 'host' | 'planet';

export class ExoplanetCatalogRegistry {
  public readonly hostObjectIds: readonly string[];
  public readonly planetObjectIds: readonly string[];
  public readonly renderPositions: Float32Array;
  public readonly activeObjectCount = 0;

  private readonly hostIndexByObjectId = new Map<string, number>();
  private readonly planetIndexByObjectId = new Map<string, number>();
  private readonly linkedObjectIds = new Set<string>();
  private readonly definitions = new Map<string, SpaceObject>();
  private readonly objectFactory: ExoplanetObjectFactory;
  private readonly presentation: ExoplanetCatalogPresentation;

  constructor(
    public readonly catalog: ExoplanetCatalog,
    coordinateSystem: CoordinateSystem,
    featuredObjects: readonly SpaceObject[] = [],
  ) {
    const featuredHosts = createFeaturedObjectMap(featuredObjects, 'star');
    const featuredPlanets = createFeaturedObjectMap(featuredObjects, 'exoplanet');

    this.hostObjectIds = catalog.hostNames.map((name) => {
      const featured = findFeaturedObject(featuredHosts, name);

      if (featured) {
        this.linkedObjectIds.add(featured.id);
      }

      return featured?.id ?? createNasaCatalogObjectId('host', name);
    });
    this.planetObjectIds = catalog.planetNames.map((name) => {
      const featured = findFeaturedObject(featuredPlanets, name);

      if (featured) {
        this.linkedObjectIds.add(featured.id);
      }

      return featured?.id ?? createNasaCatalogObjectId('planet', name);
    });
    this.assertUniqueObjectIds();
    this.objectFactory = new ExoplanetObjectFactory(
      catalog,
      coordinateSystem,
      this.hostObjectIds,
      this.planetObjectIds,
    );
    this.renderPositions = this.objectFactory.renderPositions;
    this.presentation = createExoplanetCatalogPresentation(
      catalog,
      this.hostObjectIds,
      this.planetObjectIds,
      this.linkedObjectIds,
    );

    for (let index = 0; index < catalog.hostCount; index += 1) {
      this.hostIndexByObjectId.set(this.hostObjectIds[index]!, index);
    }
    for (let index = 0; index < catalog.planetCount; index += 1) {
      this.planetIndexByObjectId.set(this.planetObjectIds[index]!, index);
    }
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

  private assertUniqueObjectIds(): void {
    const identifiers = [...this.hostObjectIds, ...this.planetObjectIds];

    if (new Set(identifiers).size !== identifiers.length) {
      throw new Error('Le catalogue d’exoplanètes contient des identifiants de carte dupliqués.');
    }
  }
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

function createFeaturedObjectMap(
  objects: readonly SpaceObject[],
  type: 'star' | 'exoplanet',
): ReadonlyMap<string, SpaceObject> {
  const map = new Map<string, SpaceObject>();

  for (const object of objects) {
    const isCatalogObject =
      object.type === type &&
      (object.metadata?.['sourceTable'] === 'PSCompPars' ||
        (type === 'star' && object.metadata?.['exoplanetHost'] === true));

    if (!isCatalogObject) {
      continue;
    }
    for (const name of [object.name, ...(object.aliases ?? [])]) {
      map.set(normalizeCatalogName(name), object);
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
