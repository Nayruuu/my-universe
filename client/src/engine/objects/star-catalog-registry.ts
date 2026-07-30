import * as THREE from 'three';
import { SearchEntry, SpaceObject } from '../../data/models/universe.models';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import { equatorialJ2000ToGalacticScene } from '../coordinates/galactic-reference-frame';
import { convertDistance } from '../coordinates/unit-conversion';
import type { StarCatalog } from '../loaders/star-catalog';
import { colorIndexToCssColor } from '../materials/star-color';
import type { LabelObject } from './label-manager';

const DEFAULT_MAXIMUM_LABEL_RANK = 3_000;

export const HYG_STAR_CATALOG_ID = 'hyg-v41-bright-stars';

export const CATALOG_STAR_VISUAL_RADIUS = 0.08;

export class StarCatalogRegistry {
  public readonly renderPositions: Float32Array;
  public readonly objectIds: string[];

  private readonly indexByObjectId = new Map<string, number>();
  private readonly definitions = new Map<string, SpaceObject>();
  private readonly resolvedCatalogObjects = new Map<string, SpaceObject>();
  private readonly catalogBackedObjectIds = new Set<string>();
  private searchEntries: readonly SearchEntry[] | null = null;

  constructor(
    public readonly catalog: StarCatalog,
    private readonly coordinateSystem: CoordinateSystem,
    catalogObjects: readonly SpaceObject[] = [],
  ) {
    this.renderPositions = new Float32Array(catalog.count * 3);
    this.objectIds = Array.from(
      { length: catalog.count },
      (_, index) => `hyg-${catalog.catalogIds[index]}`,
    );

    for (let index = 0; index < catalog.count; index += 1) {
      this.indexByObjectId.set(rawCatalogObjectId(catalog.catalogIds[index]!), index);
      const offset = index * 3;
      const galacticPosition = equatorialJ2000ToGalacticScene({
        x: catalog.positionsParsec[offset]!,
        y: catalog.positionsParsec[offset + 1]!,
        z: catalog.positionsParsec[offset + 2]!,
      });
      const position = coordinateSystem.toRenderPosition(
        [galacticPosition.x, galacticPosition.y, galacticPosition.z],
        'parsec',
        'stellar',
      );

      this.renderPositions[offset] = position.x;
      this.renderPositions[offset + 1] = position.y;
      this.renderPositions[offset + 2] = position.z;
    }
    this.linkCatalogObjects(catalogObjects);
  }

  public has(objectId: string): boolean {
    return this.indexByObjectId.has(objectId);
  }

  public getIndex(objectId: string): number | null {
    return this.indexByObjectId.get(objectId) ?? null;
  }

  public getDefinition(objectId: string): SpaceObject | undefined {
    const resolvedCatalogObject = this.resolvedCatalogObjects.get(objectId);

    if (resolvedCatalogObject) {
      return resolvedCatalogObject;
    }
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
    this.searchEntries ??= this.catalog.names.flatMap((name, index) => {
      const objectId = this.objectIds[index]!;

      if (this.catalogBackedObjectIds.has(objectId)) {
        return [];
      }

      return {
        id: objectId,
        name,
        aliases: this.catalog.aliases[index] ?? [],
        type: 'star' as const,
        parentName: 'Voie lactée',
        keywords: [
          'HYG',
          'étoile',
          'J2000',
          ...(this.catalog.spectralTypes[index] ? [this.catalog.spectralTypes[index]!] : []),
        ],
      };
    });

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
      if (this.catalogBackedObjectIds.has(this.objectIds[index]!)) {
        continue;
      }
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

  public resolveCatalogObjects(objects: readonly SpaceObject[]): SpaceObject[] {
    return objects.map((object) => this.resolvedCatalogObjects.get(object.id) ?? object);
  }

  public isCatalogBackedObject(objectId: string): boolean {
    return this.catalogBackedObjectIds.has(objectId);
  }

  public getLocalPosition(objectId: string, target = new THREE.Vector3()): THREE.Vector3 | null {
    const index = this.getIndex(objectId);

    if (index === null) {
      return null;
    }

    return target.fromArray(this.renderPositions, index * 3);
  }

  public toRenderPosition(
    positionParsec: readonly [number, number, number],
    target = new THREE.Vector3(),
  ): THREE.Vector3 {
    const galacticPosition = equatorialJ2000ToGalacticScene({
      x: positionParsec[0],
      y: positionParsec[1],
      z: positionParsec[2],
    });
    const position = this.coordinateSystem.toRenderPosition(
      [galacticPosition.x, galacticPosition.y, galacticPosition.z],
      'parsec',
      'stellar',
    );

    return target.set(position.x, position.y, position.z);
  }

  private createDefinition(index: number): SpaceObject {
    const catalog = this.catalog;
    const offset = index * 3;
    const sourceX = catalog.positionsParsec[offset]!;
    const sourceY = catalog.positionsParsec[offset + 1]!;
    const sourceZ = catalog.positionsParsec[offset + 2]!;
    const galacticPosition = equatorialJ2000ToGalacticScene({
      x: sourceX,
      y: sourceY,
      z: sourceZ,
    });
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
        visualRadius: CATALOG_STAR_VISUAL_RADIUS,
        scaleMode: 'adaptive',
      },
      positionProvider: {
        type: 'static',
        position: [galacticPosition.x, galacticPosition.y, galacticPosition.z],
        unit: 'parsec',
      },
      metadata: {
        source: 'HYG Database v4.1 · J2000',
        distanceLy: convertDistance(distanceParsec, 'parsec', 'light-year'),
        apparentMagnitude: catalog.apparentMagnitudes[index]!,
        colorIndexBv: catalog.colorIndicesBv[index]!,
        hygId: catalog.catalogIds[index]!,
        catalogRecordIndex: index,
        sourceReferenceFrame: 'J2000 equatorial Cartesian',
        renderReferenceFrame: 'Galactic heliocentric, north Galactic pole on +Y',
        visualAdaptation: 'Distance comprimée, taille et couleur adaptées au rendu',
      },
    };
  }

  private linkCatalogObjects(objects: readonly SpaceObject[]): void {
    const indexByIdentifier = this.createIndexByIdentifier();
    const linkedIndices = new Set<number>();

    for (const object of objects) {
      const provider = object.positionProvider;

      if (provider.type !== 'catalog' || provider.catalogId !== HYG_STAR_CATALOG_ID) {
        continue;
      }
      const index = indexByIdentifier.get(normalizeCatalogIdentifier(provider.identifier));

      if (index === undefined) {
        throw new Error(
          `Identifiant ${provider.identifier} introuvable dans ${HYG_STAR_CATALOG_ID} pour ${object.id}.`,
        );
      }
      if (linkedIndices.has(index)) {
        throw new Error(`Plusieurs fiches éditoriales ciblent ${provider.identifier}.`);
      }
      linkedIndices.add(index);
      this.objectIds[index] = object.id;
      this.indexByObjectId.set(object.id, index);
      this.catalogBackedObjectIds.add(object.id);
      this.resolvedCatalogObjects.set(
        object.id,
        this.createResolvedCatalogObject(object, index, provider.identifier),
      );
    }
  }

  private createIndexByIdentifier(): ReadonlyMap<string, number> {
    const indexByIdentifier = new Map<string, number>();

    for (let index = 0; index < this.catalog.count; index += 1) {
      const identifiers = [this.catalog.names[index]!, ...(this.catalog.aliases[index] ?? [])];

      for (const identifier of identifiers) {
        const normalized = normalizeCatalogIdentifier(identifier);

        if (!indexByIdentifier.has(normalized)) {
          indexByIdentifier.set(normalized, index);
        }
      }
    }

    return indexByIdentifier;
  }

  private createResolvedCatalogObject(
    object: SpaceObject,
    index: number,
    catalogIdentifier: string,
  ): SpaceObject {
    const catalogDefinition = this.createDefinition(index);
    const catalogName = this.catalog.names[index]!;
    const aliases = [
      ...(object.aliases ?? []),
      catalogName,
      ...(this.catalog.aliases[index] ?? []),
    ];

    return {
      ...object,
      aliases: [...new Set(aliases)],
      referenceEpoch: this.catalog.referenceEpochJulianDay,
      physical: {
        ...(catalogDefinition.physical ?? {}),
        ...(object.physical ?? {}),
      },
      positionProvider: catalogDefinition.positionProvider,
      metadata: {
        ...(object.metadata ?? {}),
        ...catalogDefinition.metadata,
        source: 'HYG Database v4.1 · J2000',
        catalogId: HYG_STAR_CATALOG_ID,
        catalogIdentifier,
        catalogPointRepresentation: true,
      },
    };
  }
}

function rawCatalogObjectId(catalogId: number): string {
  return `hyg-${catalogId}`;
}

function normalizeCatalogIdentifier(value: string): string {
  return value.trim().replace(/\s+/gu, ' ').toLocaleUpperCase('en');
}

function normalizeLabelName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLocaleLowerCase('fr');
}
