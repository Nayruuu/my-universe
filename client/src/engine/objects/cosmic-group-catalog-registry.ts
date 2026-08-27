import * as THREE from 'three';
import { SearchEntry, SpaceObject } from '../../data/models/universe.models';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import type { CosmicGroupCatalog } from '../loaders/cosmic-group-catalog';
import {
  COSMOLOGICAL_REDSHIFT_METADATA_KEY,
  COSMOLOGICAL_REDSHIFT_ORIGIN_METADATA_KEY,
  inferFlatLambdaCdmRedshiftFromLuminosityDistanceMpc,
  RECEIVED_LIGHT_DISTANCE_MODEL_METADATA_KEY,
  RECEIVED_LIGHT_DISTANCE_MODELS,
} from '../simulation/cosmological-lookback';
import type { LabelObject } from './label-manager';

const DEFAULT_MAXIMUM_LABEL_RANK = 1_000;

export class CosmicGroupCatalogRegistry {
  public readonly renderPositions: Float32Array;
  public readonly objectIds: readonly string[];

  private readonly indexByObjectId = new Map<string, number>();
  private readonly labelRecordIndices: Uint32Array;
  private readonly definitions = new Map<string, SpaceObject>();
  private searchEntries: readonly SearchEntry[] | null = null;

  constructor(
    public readonly catalog: CosmicGroupCatalog,
    coordinateSystem: CoordinateSystem,
  ) {
    this.renderPositions = new Float32Array(catalog.count * 3);
    this.objectIds = Array.from(
      { length: catalog.count },
      (_, index) => `cf4-pgc-${catalog.pgcIds[index]}`,
    );
    this.labelRecordIndices = createProgressiveSampleIndices(
      catalog.count,
      Math.min(catalog.count, DEFAULT_MAXIMUM_LABEL_RANK),
    );
    const scale = coordinateSystem.toSceneDistance(1, 'megaparsec', 'cosmic-web');

    for (let index = 0; index < catalog.count; index += 1) {
      const objectId = this.objectIds[index]!;
      const offset = index * 3;

      this.indexByObjectId.set(objectId, index);
      this.renderPositions[offset] = catalog.positionsMpc[offset]! * scale;
      this.renderPositions[offset + 1] = catalog.positionsMpc[offset + 1]! * scale;
      this.renderPositions[offset + 2] = catalog.positionsMpc[offset + 2]! * scale;
    }
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
    this.searchEntries ??= this.objectIds.map((id, index) => {
      const pgcId = this.catalog.pgcIds[index]!;

      return {
        id,
        name: `Groupe PGC ${pgcId}`,
        aliases: [`PGC ${pgcId}`],
        type: 'galaxy-cluster',
        parentName: 'Réseau cosmique',
        keywords: ['Cosmicflows-4', 'groupe de galaxies', 'amas', 'PGC'],
      };
    });

    return this.searchEntries;
  }

  public getLabelObjects(maximumRank = DEFAULT_MAXIMUM_LABEL_RANK): readonly LabelObject[] {
    const limit = Math.min(this.labelRecordIndices.length, Math.max(0, Math.floor(maximumRank)));

    return Array.from({ length: limit }, (_, rank) => {
      const recordIndex = this.labelRecordIndices[rank]!;
      const pgcId = this.catalog.pgcIds[recordIndex]!;

      return {
        id: this.objectIds[recordIndex]!,
        name: `PGC ${pgcId}`,
        type: 'galaxy-cluster' as const,
        metadata: {
          cosmicCatalogRank: rank,
          distanceMpc: this.catalog.distancesMpc[recordIndex]!,
          distanceModulusError: this.catalog.distanceModulusErrors[recordIndex]!,
        },
      };
    });
  }

  public getLocalPosition(objectId: string, target = new THREE.Vector3()): THREE.Vector3 | null {
    const index = this.getIndex(objectId);

    return index === null ? null : target.fromArray(this.renderPositions, index * 3);
  }

  private createDefinition(index: number): SpaceObject {
    const catalog = this.catalog;
    const pgcId = catalog.pgcIds[index]!;
    const offset = index * 3;
    const distanceMpc = catalog.distancesMpc[index]!;
    const cosmologicalRedshift = inferFlatLambdaCdmRedshiftFromLuminosityDistanceMpc(distanceMpc);

    return {
      id: this.objectIds[index]!,
      name: `Groupe PGC ${pgcId}`,
      aliases: [`PGC ${pgcId}`],
      type: 'galaxy-cluster',
      parentId: 'cosmic-web',
      referenceFrame: 'cosmic-web',
      scientificConfidence: 'calculated',
      description:
        'Groupe de galaxies du catalogue Cosmicflows-4. Sa distance combine plusieurs indicateurs puis un ajustement statistique du champ de vitesses local.',
      referenceEpoch: catalog.referenceEpochJulianDay,
      visual: {
        color: '#86b6cf',
        visualRadius: 600,
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
        source: 'Cosmicflows-4 · Tully et al. (2023)',
        pgcId,
        distanceMpc,
        distanceModulus: catalog.distanceModuli[index]!,
        distanceModulusError: catalog.distanceModulusErrors[index]!,
        velocityCmbKmPerSecond: catalog.velocitiesCmbKmPerSecond[index]!,
        [RECEIVED_LIGHT_DISTANCE_MODEL_METADATA_KEY]:
          RECEIVED_LIGHT_DISTANCE_MODELS.flatLambdaCdmLuminosity,
        [COSMOLOGICAL_REDSHIFT_METADATA_KEY]: cosmologicalRedshift,
        [COSMOLOGICAL_REDSHIFT_ORIGIN_METADATA_KEY]: 'inferred-from-luminosity-distance',
        cosmologicalModel: 'Flat ΛCDM · H0=70 km/s/Mpc · Ωm=0.3 · ΩΛ=0.7',
        cosmicCatalogRank: index,
        visualAdaptation:
          'Position du groupe calculée ; silhouettes, orientations, luminosités et membres non résolus illustratifs',
      },
    };
  }
}

function createProgressiveSampleIndices(count: number, targetCount: number): Uint32Array {
  const indices = Array.from({ length: Math.min(1, targetCount) }, () => 0);
  const seen = new Set(indices);

  for (let divisions = 2; indices.length < targetCount; divisions *= 2) {
    for (let numerator = 1; numerator < divisions && indices.length < targetCount; numerator += 2) {
      const index = Math.floor((numerator * count) / divisions);

      if (seen.has(index)) {
        continue;
      }
      seen.add(index);
      indices.push(index);
    }
  }

  return Uint32Array.from(indices);
}
