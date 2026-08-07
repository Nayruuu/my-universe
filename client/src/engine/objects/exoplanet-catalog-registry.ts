import * as THREE from 'three';
import type { SearchEntry, SpaceObject } from '../../data/models/universe.models';
import type { CoordinateSystem } from '../coordinates/coordinate-system';
import type { ExoplanetCatalog } from '../loaders/exoplanet-catalog';
import {
  compactDefinedValues,
  finiteCatalogValue,
  isPositiveFiniteCatalogValue,
  nonZeroCatalogValue,
  stableCatalogHash,
} from './exoplanet-catalog-values';
import {
  EXOPLANET_MISSING_DISTANCE_FALLBACK_CONFIDENCE,
  ExoplanetObjectFactory,
} from './exoplanet-object-factory';
import type { LabelObject } from './label-manager';

const DEFAULT_MAXIMUM_LABEL_RANK = 1_000;
const TEMPERATE_MINIMUM_KELVIN = 180;
const TEMPERATE_MAXIMUM_KELVIN = 320;
const TEMPERATE_MAXIMUM_RADIUS_EARTH = 2.5;

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
  private readonly labelHostIndices: readonly number[];
  private searchEntries: readonly SearchEntry[] | null = null;

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

    for (let index = 0; index < catalog.hostCount; index += 1) {
      this.hostIndexByObjectId.set(this.hostObjectIds[index]!, index);
    }
    for (let index = 0; index < catalog.planetCount; index += 1) {
      this.planetIndexByObjectId.set(this.planetObjectIds[index]!, index);
    }

    this.labelHostIndices = this.createLabelHostIndices();
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
    return this.labelHostIndices;
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
    this.searchEntries ??= [
      ...this.catalog.hostNames.flatMap((_, index) =>
        this.linkedObjectIds.has(this.hostObjectIds[index]!)
          ? []
          : [this.createHostSearchEntry(index)],
      ),
      ...this.catalog.planetNames.flatMap((_, index) =>
        this.linkedObjectIds.has(this.planetObjectIds[index]!)
          ? []
          : [this.createPlanetSearchEntry(index)],
      ),
    ];

    return this.searchEntries;
  }

  public getLabelObjects(maximumRank = DEFAULT_MAXIMUM_LABEL_RANK): readonly LabelObject[] {
    const limit = Math.min(this.labelHostIndices.length, Math.max(0, Math.floor(maximumRank)));

    return this.labelHostIndices.slice(0, limit).map((hostIndex, rank) => ({
      id: this.hostObjectIds[hostIndex]!,
      name: this.catalog.hostNames[hostIndex]!,
      type: 'star' as const,
      metadata: {
        exoplanetHost: true,
        exoplanetHostRank: rank,
        planetCount: this.catalog.hostPlanetCounts[hostIndex]!,
        ...(finiteMetadata('distanceParsec', this.catalog.hostDistancesParsec[hostIndex]!) ?? {}),
      },
    }));
  }

  private createHostSearchEntry(index: number): SearchEntry {
    const distance = this.catalog.hostDistancesParsec[index]!;

    return {
      id: this.hostObjectIds[index]!,
      name: this.catalog.hostNames[index]!,
      aliases: this.catalog.hostAliases[index]!,
      type: 'star',
      parentName: 'Voie lactée',
      keywords: ['NASA Exoplanet Archive', 'étoile hôte', 'exoplanète'],
      metadata: compactDefinedValues({
        exoplanetHost: true,
        distanceParsec: finiteCatalogValue(distance),
        planetCount: this.catalog.hostPlanetCounts[index]!,
      }),
    };
  }

  private createPlanetSearchEntry(index: number): SearchEntry {
    const hostIndex = this.catalog.planetHostIndices[index]!;
    const distance = this.catalog.hostDistancesParsec[hostIndex]!;
    const radius = this.catalog.planetRadiiEarth[index]!;
    const temperature = this.catalog.planetEquilibriumTemperaturesKelvin[index]!;
    const method = this.catalog.planetDiscoveryMethods[index]!;

    return {
      id: this.planetObjectIds[index]!,
      name: this.catalog.planetNames[index]!,
      aliases: [],
      type: 'exoplanet',
      parentName: this.catalog.hostNames[hostIndex]!,
      keywords: ['NASA Exoplanet Archive', 'exoplanète confirmée', method],
      metadata: compactDefinedValues({
        distanceParsec: finiteCatalogValue(distance),
        radiusEarth: roundedFiniteValue(radius),
        discoveryMethod: method,
        discoveryYear: nonZeroCatalogValue(this.catalog.planetDiscoveryYears[index]!),
        temperateCandidate: isTemperateCandidate(radius, temperature),
        controversial: this.catalog.planetControversialFlags[index] === 1,
      }),
    };
  }

  private createLabelHostIndices(): readonly number[] {
    return Array.from({ length: this.catalog.hostCount }, (_, index) => index)
      .filter((index) => !this.linkedObjectIds.has(this.hostObjectIds[index]!))
      .sort((left, right) => compareHostRank(this.catalog, left, right));
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

function compareHostRank(catalog: ExoplanetCatalog, left: number, right: number): number {
  const leftDistance = finiteOrInfinity(catalog.hostDistancesParsec[left]!);
  const rightDistance = finiteOrInfinity(catalog.hostDistancesParsec[right]!);
  const leftMagnitude = finiteOrInfinity(catalog.hostApparentMagnitudes[left]!);
  const rightMagnitude = finiteOrInfinity(catalog.hostApparentMagnitudes[right]!);

  return (
    leftDistance - rightDistance ||
    leftMagnitude - rightMagnitude ||
    catalog.hostNames[left]!.localeCompare(catalog.hostNames[right]!)
  );
}

function isTemperateCandidate(radiusEarth: number, temperatureKelvin: number): boolean {
  return (
    isPositiveFiniteCatalogValue(radiusEarth) &&
    radiusEarth <= TEMPERATE_MAXIMUM_RADIUS_EARTH &&
    temperatureKelvin >= TEMPERATE_MINIMUM_KELVIN &&
    temperatureKelvin <= TEMPERATE_MAXIMUM_KELVIN
  );
}

function finiteMetadata(key: string, value: number): Readonly<Record<string, number>> | undefined {
  return Number.isFinite(value) ? { [key]: value } : undefined;
}

function roundedFiniteValue(value: number): number | undefined {
  return Number.isFinite(value) ? Math.round(value * 1_000_000) / 1_000_000 : undefined;
}

function finiteOrInfinity(value: number): number {
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}
