import * as THREE from 'three';
import {
  CosmicStructureType,
  SearchEntry,
  SpaceObject,
  SpaceObjectType,
} from '../../data/models/universe.models';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import {
  CATALOG_PREPARATION_CHUNK_SIZE,
  finishCatalogPreparation,
  prepareCatalogIncrementally,
  sortCatalogRecords,
  yieldCatalogPreparation,
} from '../core/catalog-preparation';
import type { CosmicStructureCatalog } from '../loaders/cosmic-structure-catalog';
import {
  COSMOLOGICAL_REDSHIFT_METADATA_KEY,
  COSMOLOGICAL_REDSHIFT_ORIGIN_METADATA_KEY,
  inferFlatLambdaCdmRedshiftFromComovingDistanceMpc,
  RECEIVED_LIGHT_DISTANCE_MODEL_METADATA_KEY,
  RECEIVED_LIGHT_DISTANCE_MODELS,
} from '../simulation/cosmological-lookback';
import type { LabelObject } from './label-manager';
import {
  cosmicStructureAliases,
  cosmicStructureDescription,
  cosmicStructureName,
  cosmicStructureScore,
} from './cosmic-structure-catalog-presentation';

const DEFAULT_MAXIMUM_LABEL_RANK = 600;
const STRUCTURE_COLORS = {
  cluster: '#d7ccff',
  supercluster: '#d6a8ff',
  wall: '#ffad7d',
  filament: '#73dbe9',
  void: '#6ea8ff',
  basin: '#ae91ff',
  attractor: '#ffd078',
  repeller: '#72daba',
} as const satisfies Record<CosmicStructureType, string>;

interface PreparedStructureRegistry {
  readonly sceneUnitsPerMpc: number;
  readonly renderPositions: Float32Array;
  readonly objectIds: readonly string[];
  readonly indexByObjectId: ReadonlyMap<string, number>;
  readonly labelRecordIndices: readonly number[];
}

export class CosmicStructureCatalogRegistry {
  public readonly renderPositions: Float32Array;
  public readonly objectIds: readonly string[];

  private readonly indexByObjectId: ReadonlyMap<string, number>;
  private readonly labelRecordIndices: readonly number[];
  private readonly definitions = new Map<string, SpaceObject>();
  private readonly sceneUnitsPerMpc: number;
  private searchEntries: readonly SearchEntry[] | null = null;

  constructor(
    public readonly catalog: CosmicStructureCatalog,
    coordinateSystem: CoordinateSystem,
    prepared = finishCatalogPreparation(prepareStructureRegistry(catalog, coordinateSystem)),
  ) {
    this.sceneUnitsPerMpc = prepared.sceneUnitsPerMpc;
    this.renderPositions = prepared.renderPositions;
    this.objectIds = prepared.objectIds;
    this.labelRecordIndices = prepared.labelRecordIndices;
    this.indexByObjectId = prepared.indexByObjectId;
  }

  public static async create(
    catalog: CosmicStructureCatalog,
    coordinateSystem: CoordinateSystem,
    yieldControl = yieldCatalogPreparation,
  ): Promise<CosmicStructureCatalogRegistry> {
    const prepared = await prepareCatalogIncrementally(
      prepareStructureRegistry(catalog, coordinateSystem),
      yieldControl,
    );
    const registry = new CosmicStructureCatalogRegistry(catalog, coordinateSystem, prepared);

    registry.searchEntries = await prepareCatalogIncrementally(
      registry.prepareSearchEntries(),
      yieldControl,
    );

    return registry;
  }

  public has(objectId: string): boolean {
    return this.indexByObjectId.has(objectId);
  }

  public getIndex(objectId: string): number | null {
    return this.indexByObjectId.get(objectId) ?? null;
  }

  public getDefinition(objectId: string): SpaceObject | undefined {
    const cached = this.definitions.get(objectId);

    if (cached) {
      return cached;
    }
    const index = this.getIndex(objectId);

    if (index === null) {
      return undefined;
    }
    const definition = this.createDefinition(index);

    this.definitions.set(objectId, definition);

    return definition;
  }

  public getSearchEntries(): readonly SearchEntry[] {
    this.searchEntries ??= finishCatalogPreparation(this.prepareSearchEntries());

    return this.searchEntries;
  }

  public getLabelObjects(maximumRank = DEFAULT_MAXIMUM_LABEL_RANK): readonly LabelObject[] {
    const limit = Math.min(this.labelRecordIndices.length, Math.max(0, Math.floor(maximumRank)));

    return Array.from({ length: limit }, (_, rank) => {
      const recordIndex = this.labelRecordIndices[rank]!;
      const source = this.sourceAt(recordIndex);
      const structureType = this.catalog.structureTypes[recordIndex]!;

      return {
        id: this.objectIds[recordIndex]!,
        name: cosmicStructureName(source, this.catalog.identifiers[recordIndex]!),
        type: toSpaceObjectType(structureType),
        metadata: {
          cosmicStructureRank: rank,
          distanceMpc: this.catalog.distancesMpc[recordIndex]!,
          catalogConfidence: this.catalog.confidences[recordIndex]!,
          structureType,
        },
      };
    });
  }

  public getLocalPosition(objectId: string, target = new THREE.Vector3()): THREE.Vector3 | null {
    const index = this.getIndex(objectId);

    return index === null ? null : target.fromArray(this.renderPositions, index * 3);
  }

  private *prepareSearchEntries(): Generator<void, readonly SearchEntry[]> {
    const entries: SearchEntry[] = [];

    for (let index = 0; index < this.catalog.count; index += 1) {
      const source = this.sourceAt(index);
      const identifier = this.catalog.identifiers[index]!;
      const structureType = this.catalog.structureTypes[index]!;

      entries.push({
        id: this.objectIds[index]!,
        name: cosmicStructureName(source, identifier),
        aliases: cosmicStructureAliases(source, identifier),
        type: toSpaceObjectType(structureType),
        parentName: `Réseau cosmique · ${source.name}`,
        keywords: [
          structureType,
          source.id,
          source.name,
          source.citation,
          'structure à grande échelle',
          'catalogue scientifique',
        ],
      });
      if ((index + 1) % CATALOG_PREPARATION_CHUNK_SIZE === 0) {
        yield;
      }
    }

    return entries;
  }

  private createDefinition(index: number): SpaceObject {
    const catalog = this.catalog;
    const source = this.sourceAt(index);
    const identifier = catalog.identifiers[index]!;
    const structureType = catalog.structureTypes[index]!;
    const offset = index * 3;
    const densityContrast = catalog.densityContrasts[index]!;
    const boundaryDistanceMpc = catalog.boundaryDistancesMpc[index]!;
    const distanceMpc = catalog.distancesMpc[index]!;
    const cosmologicalRedshift = inferFlatLambdaCdmRedshiftFromComovingDistanceMpc(distanceMpc);
    const sample = structureType === 'void' ? voidSample(identifier) : null;

    return {
      id: this.objectIds[index]!,
      name: cosmicStructureName(source, identifier),
      aliases: cosmicStructureAliases(source, identifier),
      type: toSpaceObjectType(structureType),
      parentId: 'cosmic-web',
      referenceFrame: 'cosmic-web',
      scientificConfidence: source.scientificConfidence,
      description: cosmicStructureDescription(structureType),
      referenceEpoch: catalog.referenceEpochJulianDay,
      visual: {
        color: STRUCTURE_COLORS[structureType],
        visualRadius: Math.max(600, catalog.radiiMpc[index]! * this.sceneUnitsPerMpc),
        scaleMode: 'adaptive',
      },
      positionProvider: {
        type: 'static',
        position: [
          catalog.positionsMpc[offset]!,
          catalog.positionsMpc[offset + 1]!,
          catalog.positionsMpc[offset + 2]!,
        ],
        unit: 'megaparsec',
      },
      metadata: {
        source: source.citation,
        sourceUrl: source.sourceUrl,
        catalogName: source.name,
        catalogIdentifier: identifier,
        catalogNumericId: catalog.catalogNumericIds[index]!,
        detectionMethod: source.method,
        structureType,
        distanceMpc,
        [RECEIVED_LIGHT_DISTANCE_MODEL_METADATA_KEY]:
          RECEIVED_LIGHT_DISTANCE_MODELS.flatLambdaCdmComoving,
        [COSMOLOGICAL_REDSHIFT_METADATA_KEY]: cosmologicalRedshift,
        [COSMOLOGICAL_REDSHIFT_ORIGIN_METADATA_KEY]: 'inferred-from-comoving-distance',
        cosmologicalModel: 'Flat ΛCDM · H0=70 km/s/Mpc · Ωm=0.3 · ΩΛ=0.7',
        ...(structureType === 'filament'
          ? { lengthMpc: catalog.radiiMpc[index]! * 2 }
          : catalog.radiiMpc[index]! > 0
            ? { effectiveRadiusMpc: catalog.radiiMpc[index]! }
            : {}),
        ...(catalog.galaxyCounts[index]! > 0
          ? { memberGalaxyCount: catalog.galaxyCounts[index]! }
          : {}),
        catalogConfidence: catalog.confidences[index]!,
        ...(source.confidenceMeaning ? { catalogConfidenceMeaning: source.confidenceMeaning } : {}),
        ...(source.extentMeaning ? { extentMeaning: source.extentMeaning } : {}),
        ...(source.mapPriority ? { mapPriority: source.mapPriority } : {}),
        ...(structureType === 'supercluster'
          ? { surveyEdge: (catalog.flags[index]! & 1) === 1 }
          : {}),
        ...(Number.isNaN(densityContrast) ? {} : { densityContrast }),
        ...(Number.isNaN(boundaryDistanceMpc) ? {} : { boundaryDistanceMpc }),
        ...(sample ? { sample } : {}),
        visualAdaptation:
          structureType === 'filament'
            ? 'Centre et symbole GPU adaptés ; l’épine 3D relie les points publiés sans lisser ni prétendre représenter la largeur physique.'
            : 'Symbole GPU et rayon de cadrage adaptés ; la détection source reste distincte des autres catalogues.',
      },
    };
  }

  private sourceAt(index: number) {
    return this.catalog.metadata.sources[this.catalog.sourceIndices[index]!]!;
  }
}

function createObjectId(sourceId: string, identifier: string): string {
  return `lss-${sourceId}-${identifier}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function* prepareStructureRegistry(
  catalog: CosmicStructureCatalog,
  coordinateSystem: CoordinateSystem,
): Generator<void, PreparedStructureRegistry> {
  const sceneUnitsPerMpc = coordinateSystem.toSceneDistance(1, 'megaparsec', 'cosmic-web');
  const renderPositions = new Float32Array(catalog.count * 3);
  const objectIds: string[] = [];
  const indexByObjectId = new Map<string, number>();
  const scores = new Float64Array(catalog.count);
  const indices: number[] = [];

  for (let index = 0; index < catalog.count; index += 1) {
    const objectId = createObjectId(
      catalog.metadata.sources[catalog.sourceIndices[index]!]!.id,
      catalog.identifiers[index]!,
    );
    const offset = index * 3;

    objectIds.push(objectId);
    indexByObjectId.set(objectId, index);
    renderPositions[offset] = catalog.positionsMpc[offset]! * sceneUnitsPerMpc;
    renderPositions[offset + 1] = catalog.positionsMpc[offset + 1]! * sceneUnitsPerMpc;
    renderPositions[offset + 2] = catalog.positionsMpc[offset + 2]! * sceneUnitsPerMpc;
    scores[index] = cosmicStructureScore(catalog, index);
    indices.push(index);
    if ((index + 1) % CATALOG_PREPARATION_CHUNK_SIZE === 0) {
      yield;
    }
  }
  const labelRecordIndices = yield* sortCatalogRecords(
    indices,
    (left, right) => scores[right]! - scores[left]! || left - right,
  );

  return { sceneUnitsPerMpc, renderPositions, objectIds, indexByObjectId, labelRecordIndices };
}

function toSpaceObjectType(structureType: CosmicStructureType): SpaceObjectType {
  const types: Record<CosmicStructureType, SpaceObjectType> = {
    cluster: 'galaxy-cluster',
    supercluster: 'supercluster',
    wall: 'cosmic-wall',
    filament: 'cosmic-filament',
    void: 'cosmic-void',
    basin: 'cosmic-basin',
    attractor: 'cosmic-attractor',
    repeller: 'cosmic-repeller',
  };

  return types[structureType];
}

function voidSample(identifier: string): string {
  return identifier.split('-').slice(0, -1).join(' ');
}
