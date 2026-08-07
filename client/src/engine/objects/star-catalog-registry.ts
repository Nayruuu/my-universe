import * as THREE from 'three';
import {
  type ConstellationCatalog,
  SearchEntry,
  SpaceObject,
  type TemporalMode,
  type UniverseTime,
} from '../../data/models/universe.models';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import {
  equatorialJ2000ToGalacticScene,
  writeEquatorialJ2000ToGalacticScene,
} from '../coordinates/galactic-reference-frame';
import { convertDistance } from '../coordinates/unit-conversion';
import type { StarCatalog } from '../loaders/star-catalog';
import { colorIndexToCssColor } from '../materials/star-color';
import {
  equatorialCoordinatesFromCartesian,
  type StellarObservationCatalogEntry,
  type StellarObservationConstellation,
} from '../simulation/stellar-observation';
import {
  HYG_STELLAR_VELOCITY_SOURCE_URL,
  STELLAR_MOTION_MAX_ABSOLUTE_YEARS,
  type StellarMotionEpoch,
  UNIFORM_RECTILINEAR_MOTION_SOURCE_URL,
  propagateReceivedStellarCatalogPositions,
  propagateStellarCatalogPositions,
  resolveStellarMotionEpoch,
} from '../simulation/stellar-space-motion';
import { HYG_REFERENCE_POSITION_METADATA_KEYS } from '../simulation/received-light-time';
import type { LabelObject } from './label-manager';

const DEFAULT_MAXIMUM_LABEL_RANK = 3_000;

export const HYG_STAR_CATALOG_ID = 'hyg-v41-bright-stars';

export const CATALOG_STAR_VISUAL_RADIUS = 0.08;

export class StarCatalogRegistry {
  public readonly renderPositions: Float32Array;
  public readonly objectIds: string[];

  private readonly currentPositionsParsec: Float64Array;
  private readonly indexByObjectId = new Map<string, number>();
  private readonly definitions = new Map<string, SpaceObject>();
  private readonly resolvedCatalogObjects = new Map<string, SpaceObject>();
  private readonly catalogBackedObjectIds = new Set<string>();
  private searchEntries: readonly SearchEntry[] | null = null;
  private stellarObservationCatalog: readonly StellarObservationCatalogEntry[] | null = null;
  private stellarObservationConstellations = new WeakMap<
    ConstellationCatalog,
    readonly StellarObservationConstellation[]
  >();
  private currentMotionEpoch: StellarMotionEpoch;
  private currentTemporalMode: TemporalMode = 'state';
  private currentReceivedLightClampedStarCount = 0;

  constructor(
    public readonly catalog: StarCatalog,
    private readonly coordinateSystem: CoordinateSystem,
    catalogObjects: readonly SpaceObject[] = [],
  ) {
    this.renderPositions = new Float32Array(catalog.count * 3);
    this.currentPositionsParsec = new Float64Array(catalog.positionsParsec);
    this.currentMotionEpoch = resolveStellarMotionEpoch(
      catalog.referenceEpochJulianDay,
      catalog.referenceEpochJulianDay,
    );
    this.objectIds = Array.from(
      { length: catalog.count },
      (_, index) => `hyg-${catalog.catalogIds[index]}`,
    );

    for (let index = 0; index < catalog.count; index += 1) {
      this.indexByObjectId.set(rawCatalogObjectId(catalog.catalogIds[index]!), index);
    }
    this.projectCurrentPositions();
    this.linkCatalogObjects(catalogObjects);
  }

  public get stellarMotionEpoch(): StellarMotionEpoch {
    return this.currentMotionEpoch;
  }

  public get receivedLightClampedStarCount(): number {
    return this.currentReceivedLightClampedStarCount;
  }

  public updateTime(time: UniverseTime, temporalMode: TemporalMode = 'state'): boolean {
    const nextEpoch = resolveStellarMotionEpoch(
      time.julianDay,
      this.catalog.referenceEpochJulianDay,
    );
    const modeChanged = temporalMode !== this.currentTemporalMode;
    const positionsChanged =
      modeChanged ||
      (temporalMode === 'observable'
        ? nextEpoch.requestedJulianDay !== this.currentMotionEpoch.requestedJulianDay
        : nextEpoch.appliedElapsedYears !== this.currentMotionEpoch.appliedElapsedYears);

    this.currentMotionEpoch = nextEpoch;
    this.currentTemporalMode = temporalMode;
    if (!positionsChanged) {
      return false;
    }

    if (temporalMode === 'observable') {
      const propagation = propagateReceivedStellarCatalogPositions(
        this.catalog.positionsParsec,
        this.catalog.velocitiesParsecPerYear,
        nextEpoch.requestedElapsedYears,
        this.currentPositionsParsec,
      );

      this.currentReceivedLightClampedStarCount = propagation.clampedStarCount;
    } else {
      propagateStellarCatalogPositions(
        this.catalog.positionsParsec,
        this.catalog.velocitiesParsecPerYear,
        nextEpoch.appliedElapsedYears,
        this.currentPositionsParsec,
      );
      this.currentReceivedLightClampedStarCount = 0;
    }
    this.projectCurrentPositions();
    this.stellarObservationCatalog = null;
    this.stellarObservationConstellations = new WeakMap();

    return true;
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

  public getStellarObservationCatalog(
    maximumCount: number,
  ): readonly StellarObservationCatalogEntry[] {
    const limit = Math.min(this.catalog.count, Math.max(0, Math.floor(maximumCount)));

    if (limit === 0) {
      return [];
    }
    const observations = this.ensureStellarObservationCatalog();

    return observations.slice(0, limit);
  }

  public getStellarObservationConstellations(
    catalog: ConstellationCatalog,
  ): readonly StellarObservationConstellation[] {
    const cached = this.stellarObservationConstellations.get(catalog);

    if (cached) {
      return cached;
    }
    const observations = this.ensureStellarObservationCatalog();
    const constellations = catalog.figures.map((figure) => ({
      id: `constellation-${figure.id}`,
      name: figure.name,
      abbreviation: figure.abbreviation,
      segments: figure.segments.map(([fromId, toId]) => ({
        from: this.requireObservationEntry(fromId, figure.id, observations),
        to: this.requireObservationEntry(toId, figure.id, observations),
      })),
    }));

    this.stellarObservationConstellations.set(catalog, constellations);

    return constellations;
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
    const velocityX = catalog.velocitiesParsecPerYear[offset]!;
    const velocityY = catalog.velocitiesParsecPerYear[offset + 1]!;
    const velocityZ = catalog.velocitiesParsecPerYear[offset + 2]!;
    const galacticPosition = equatorialJ2000ToGalacticScene({
      x: sourceX,
      y: sourceY,
      z: sourceZ,
    });
    const equatorialCoordinates = equatorialCoordinatesFromCartesian({
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
      scientificConfidence: 'extrapolated',
      description:
        'Étoile du catalogue HYG v4.1. Sa position J2000 observée est propagée par mouvement rectiligne uniforme dans un domaine temporel borné.',
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
        source: 'HYG Database v4.1 · position et vitesse J2000',
        distanceLy: convertDistance(distanceParsec, 'parsec', 'light-year'),
        apparentMagnitude: catalog.apparentMagnitudes[index]!,
        colorIndexBv: catalog.colorIndicesBv[index]!,
        hygId: catalog.catalogIds[index]!,
        catalogRecordIndex: index,
        rightAscensionDegrees: equatorialCoordinates.rightAscensionDegrees,
        declinationDegrees: equatorialCoordinates.declinationDegrees,
        skyCoordinateEpoch: 'J2000',
        properMotionApplied: true,
        properMotionModel: 'Uniform rectilinear motion relative to the solar-system barycenter',
        properMotionVelocityUnit: 'parsec/year',
        properMotionMaximumAbsoluteYears: STELLAR_MOTION_MAX_ABSOLUTE_YEARS,
        properMotionOutsideDomain: 'Clamped to the nearest validity boundary',
        properMotionSourceUrl: HYG_STELLAR_VELOCITY_SOURCE_URL,
        properMotionModelSourceUrl: UNIFORM_RECTILINEAR_MOTION_SOURCE_URL,
        [HYG_REFERENCE_POSITION_METADATA_KEYS.x]: sourceX,
        [HYG_REFERENCE_POSITION_METADATA_KEYS.y]: sourceY,
        [HYG_REFERENCE_POSITION_METADATA_KEYS.z]: sourceZ,
        [HYG_REFERENCE_POSITION_METADATA_KEYS.velocityX]: velocityX,
        [HYG_REFERENCE_POSITION_METADATA_KEYS.velocityY]: velocityY,
        [HYG_REFERENCE_POSITION_METADATA_KEYS.velocityZ]: velocityZ,
        sourcePositionConfidence: 'observed',
        temporalPositionConfidence: 'extrapolated',
        sourceReferenceFrame: 'J2000 equatorial Cartesian',
        renderReferenceFrame: 'Galactic heliocentric, north Galactic pole on +Y',
        visualAdaptation: 'Distance comprimée, taille et couleur adaptées au rendu',
      },
    };
  }

  private ensureStellarObservationCatalog(): readonly StellarObservationCatalogEntry[] {
    return (this.stellarObservationCatalog ??= this.catalog.names.map((name, index) => {
      const offset = index * 3;

      return {
        id: this.objectIds[index]!,
        name,
        coordinates: equatorialCoordinatesFromCartesian({
          x: this.currentPositionsParsec[offset]!,
          y: this.currentPositionsParsec[offset + 1]!,
          z: this.currentPositionsParsec[offset + 2]!,
        }),
        apparentMagnitude: this.catalog.apparentMagnitudes[index]!,
        color: colorIndexToCssColor(this.catalog.colorIndicesBv[index]!),
      };
    }));
  }

  private requireObservationEntry(
    catalogId: number,
    constellationId: string,
    observations: readonly StellarObservationCatalogEntry[],
  ): StellarObservationCatalogEntry {
    const index = this.getIndex(rawCatalogObjectId(catalogId));
    const entry = index === null ? undefined : observations[index];

    if (!entry) {
      throw new Error(`Étoile HYG ${catalogId} introuvable pour le tracé de ${constellationId}.`);
    }

    return entry;
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
      scientificConfidence: catalogDefinition.scientificConfidence,
      physical: {
        ...(catalogDefinition.physical ?? {}),
        ...(object.physical ?? {}),
      },
      positionProvider: catalogDefinition.positionProvider,
      metadata: {
        ...(object.metadata ?? {}),
        ...catalogDefinition.metadata,
        source: 'HYG Database v4.1 · position et vitesse J2000',
        catalogId: HYG_STAR_CATALOG_ID,
        catalogIdentifier,
        catalogPointRepresentation: true,
      },
    };
  }

  private projectCurrentPositions(): void {
    for (let offset = 0; offset < this.currentPositionsParsec.length; offset += 3) {
      writeEquatorialJ2000ToGalacticScene(
        this.currentPositionsParsec[offset]!,
        this.currentPositionsParsec[offset + 1]!,
        this.currentPositionsParsec[offset + 2]!,
        this.renderPositions,
        offset,
      );
      const galacticX = this.renderPositions[offset]!;
      const galacticY = this.renderPositions[offset + 1]!;
      const galacticZ = this.renderPositions[offset + 2]!;

      this.coordinateSystem.writeRenderPosition(
        galacticX,
        galacticY,
        galacticZ,
        'parsec',
        'stellar',
        this.renderPositions,
        offset,
      );
    }
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
