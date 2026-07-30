import * as THREE from 'three';
import { SearchEntry, SpaceObject } from '../../data/models/universe.models';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import { convertDistance } from '../coordinates/unit-conversion';
import type { StarCatalog } from '../loaders/star-catalog';
import { colorIndexToCssColor } from '../materials/star-color';
import type { LabelObject } from './label-manager';

const DEFAULT_MAXIMUM_LABEL_RANK = 240;

export class StarCatalogRegistry {
  public readonly renderPositions: Float32Array;
  public readonly objectIds: readonly string[];

  private readonly indexByObjectId = new Map<string, number>();
  private readonly definitions = new Map<string, SpaceObject>();
  private searchEntries: readonly SearchEntry[] | null = null;

  constructor(
    public readonly catalog: StarCatalog,
    coordinateSystem: CoordinateSystem,
  ) {
    this.renderPositions = new Float32Array(catalog.count * 3);
    this.objectIds = Array.from(
      { length: catalog.count },
      (_, index) => `hyg-${catalog.catalogIds[index]}`,
    );

    for (let index = 0; index < catalog.count; index += 1) {
      this.indexByObjectId.set(this.objectIds[index]!, index);
      const offset = index * 3;
      const position = coordinateSystem.toRenderPosition(
        [
          catalog.positionsParsec[offset]!,
          catalog.positionsParsec[offset + 2]!,
          -catalog.positionsParsec[offset + 1]!,
        ],
        'parsec',
        'stellar',
      );

      this.renderPositions[offset] = position.x;
      this.renderPositions[offset + 1] = position.y;
      this.renderPositions[offset + 2] = position.z;
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
    this.searchEntries ??= this.catalog.names.map((name, index) => ({
      id: this.objectIds[index]!,
      name,
      aliases: this.catalog.aliases[index] ?? [],
      type: 'star',
      parentName: 'Voie lactée',
      keywords: [
        'HYG',
        'étoile',
        'J2000',
        ...(this.catalog.spectralTypes[index] ? [this.catalog.spectralTypes[index]!] : []),
      ],
    }));

    return this.searchEntries;
  }

  public getLabelObjects(
    existingObjects: readonly Pick<SpaceObject, 'name' | 'aliases'>[],
    maximumRank = DEFAULT_MAXIMUM_LABEL_RANK,
  ): readonly LabelObject[] {
    const excludedNames = new Set(
      existingObjects.flatMap((object) =>
        [object.name, ...(object.aliases ?? [])].map(normalizeLabelName),
      ),
    );
    const labels: LabelObject[] = [];
    const limit = Math.min(this.catalog.count, Math.max(0, Math.floor(maximumRank)));

    for (let index = 0; index < limit; index += 1) {
      const names = [this.catalog.names[index]!, ...(this.catalog.aliases[index] ?? [])];

      if (names.some((name) => excludedNames.has(normalizeLabelName(name)))) {
        continue;
      }
      labels.push({
        id: this.objectIds[index]!,
        name: this.catalog.names[index]!,
        type: 'star',
        metadata: {
          apparentMagnitude: this.catalog.apparentMagnitudes[index]!,
          catalogRecordIndex: index,
        },
      });
    }

    return labels;
  }

  public getLocalPosition(objectId: string, target = new THREE.Vector3()): THREE.Vector3 | null {
    const index = this.getIndex(objectId);

    if (index === null) {
      return null;
    }

    return target.fromArray(this.renderPositions, index * 3);
  }

  private createDefinition(index: number): SpaceObject {
    const catalog = this.catalog;
    const offset = index * 3;
    const sourceX = catalog.positionsParsec[offset]!;
    const sourceY = catalog.positionsParsec[offset + 1]!;
    const sourceZ = catalog.positionsParsec[offset + 2]!;
    const distanceParsec = Math.hypot(sourceX, sourceY, sourceZ);
    const spectralType = catalog.spectralTypes[index];

    return {
      id: this.objectIds[index]!,
      name: catalog.names[index]!,
      aliases: [...(catalog.aliases[index] ?? [])],
      type: 'star',
      parentId: 'milky-way',
      referenceFrame: 'stellar',
      scientificConfidence: 'observed',
      description:
        'Étoile du catalogue HYG v4.1. Sa position cartésienne, sa magnitude apparente et son indice de couleur sont référencés à l’époque J2000.',
      referenceEpoch: catalog.referenceEpochJulianDay,
      physical: spectralType ? { spectralType } : undefined,
      visual: {
        color: colorIndexToCssColor(catalog.colorIndicesBv[index]!),
        visualRadius: 1,
        scaleMode: 'adaptive',
      },
      positionProvider: {
        type: 'static',
        position: [sourceX, sourceZ, -sourceY],
        unit: 'parsec',
      },
      metadata: {
        source: 'HYG Database v4.1 · J2000',
        distanceLy: convertDistance(distanceParsec, 'parsec', 'light-year'),
        apparentMagnitude: catalog.apparentMagnitudes[index]!,
        colorIndexBv: catalog.colorIndicesBv[index]!,
        hygId: catalog.catalogIds[index]!,
        catalogRecordIndex: index,
        visualAdaptation: 'Distance comprimée, taille et couleur adaptées au rendu',
      },
    };
  }
}

function normalizeLabelName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLocaleLowerCase('fr');
}
