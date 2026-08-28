import * as THREE from 'three';
import {
  type GraphicQuality,
  type GaiaPresentationStats,
  type SpaceObject,
  type StarClusterTile,
  type StarColorIndexSystem,
  type StarTilePointRepresentation,
} from '../../data/models/universe.models';
import { equatorialJ2000ToGalacticScene } from '../coordinates/galactic-reference-frame';
import {
  calculateStellarNeighborhoodReveal,
  STELLAR_NEIGHBORHOOD_EXPANSION_END,
} from '../coordinates/stellar-neighborhood-scale-model';
import { convertDistance } from '../coordinates/unit-conversion';
import { MILKY_WAY_TRANSITION_END, MILKY_WAY_TRANSITION_START } from '../lod/milky-way-transition';
import { dampValue } from '../lod/screen-space-lod';
import { stellarColorIndexToRgb } from '../materials/star-color';
import { type StarCatalogRegistry } from '../objects/star-catalog-registry';
import { PICKING_LAYER } from '../selection/selection-layers';
import {
  isDetailedStarTileNavigationLodLevel,
  isStarTileNavigationLodLevel,
} from '../tiles/star-tile-selection';

interface ClusterRepresentation {
  readonly signature: string;
  readonly lodLevel: number;
  readonly pointRepresentation: StarTilePointRepresentation;
  readonly tileIds: readonly string[];
  readonly clusterCount: number;
  readonly records: readonly ClusterRecord[];
  readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  readonly visibleIndices: Uint8Array | null;
  opacity: number;
  retiring: boolean;
}

interface ClusterRecord {
  readonly position: readonly [number, number, number];
  readonly magnitude: number;
  readonly colorIndex: number;
  readonly colorIndexSystem: StarColorIndexSystem;
  readonly starCount: number;
  readonly sourceId?: string;
  readonly sourceCatalog: string;
  readonly referenceEpochJulianDay: number;
}

const QUALITY_FRACTIONS = {
  low: 0.45,
  medium: 0.72,
  high: 1,
} as const satisfies Record<GraphicQuality, number>;

const REPRESENTATION_OPACITIES = {
  'aggregate-cell': 0.18,
  'sampled-source': 0.96,
} as const satisfies Record<StarTilePointRepresentation, number>;
const GALACTIC_OVERVIEW_AGGREGATE_OPACITY = 0.035;
const LOCAL_GROUP_AGGREGATE_OPACITY = 0.012;
const GALACTIC_OVERVIEW_STABLE_FADE_END = 6_200;

const GAIA_SAMPLE_FAINT_MAGNITUDE = 12;
const GAIA_FAINT_SOURCE_SIZE_LIFT = 0.08;
const GAIA_FAINT_SOURCE_ALPHA_LIFT = 0.03;
const GAIA_MINIMUM_SAMPLED_RASTER_SIZE = 1.3;
const GAIA_PROMINENT_SAMPLED_RASTER_SIZE = 2.2;
const GAIA_BRIGHT_SOURCE_PROMINENCE_START = 0.45;
const GAIA_BRIGHT_SOURCE_PROMINENCE_END = 0.74;
const GAIA_PIXEL_CORE_INNER_RADIUS = 0.12;
const GAIA_PIXEL_CORE_OUTER_RADIUS = 0.95;
const GAIA_PIXEL_CORE_BRIGHT_STRENGTH = 0.92;
const GAIA_PIXEL_CORE_FAINT_STRENGTH = 0.58;
const GAIA_PERCEPTIBLE_ALPHA_FLOOR = 0.04;
const GAIA_FAINT_SOURCE_CHROMA_RETENTION = 0.04;
const GAIA_BRIGHT_SOURCE_CHROMA_RETENTION = 0.62;
const GAIA_FAINT_SOURCE_CORE_WHITENING = 0.98;
const GAIA_BRIGHT_SOURCE_CORE_WHITENING = 0.64;
const WORST_CASE_NEAREST_PIXEL_RADIUS = Math.SQRT1_2;
const GAIA_PICKING_PRIORITY = 10;
const GAIA_SOURCE_OBJECT_ID_PREFIX = 'gaia-dr3-source-';
const GAIA_SOURCE_VISUAL_RADIUS = 0.06;

export class StarClusterBatch {
  public readonly root = new THREE.Group();

  private readonly representations = new Map<string, ClusterRepresentation>();
  private activeSignatures: readonly string[] = [];
  private quality: GraphicQuality = 'medium';
  private pixelRatio = 1;
  private radiance = 1;
  private readonly activeSourceRecords = new Map<string, ClusterRecord>();
  private readonly retainedSourceRecords = new Map<string, ClusterRecord>();
  private readonly sourceDefinitions = new Map<string, SpaceObject>();
  private selectedObjectId: string | null = null;
  private focusedObjectId: string | null = null;

  constructor(private readonly registry: StarCatalogRegistry) {
    this.root.name = 'dense-star-cluster-root';
  }

  public synchronizeTiles(tiles: readonly StarClusterTile[]): boolean {
    const groups = groupTilesByLod(tiles);
    const desiredSignatures = [...groups.entries()]
      .map(([lodLevel, levelTiles]) => signatureFor(lodLevel, levelTiles))
      .sort();
    const changed = !sameSignatures(this.activeSignatures, desiredSignatures);

    if (!changed) {
      return false;
    }

    for (const representation of this.representations.values()) {
      representation.retiring = !desiredSignatures.includes(representation.signature);
    }
    for (const [lodLevel, levelTiles] of groups) {
      const signature = signatureFor(lodLevel, levelTiles);
      const existing = this.representations.get(signature);

      if (existing) {
        existing.retiring = false;
        continue;
      }
      const representation = createRepresentation(signature, lodLevel, levelTiles, this.registry);

      this.representations.set(signature, representation);
      this.root.add(representation.points);
      this.applyPixelRatio(representation);
      this.applyQuality(representation);
      this.applyPhotographicRadiance(representation);
    }
    this.activeSignatures = desiredSignatures;
    this.pruneRetiringRepresentations(desiredSignatures.length);
    this.rebuildActiveSourceRecords();

    return true;
  }

  public setPixelRatio(pixelRatio: number): void {
    this.pixelRatio = Math.max(0.5, pixelRatio);
    for (const representation of this.representations.values()) {
      this.applyPixelRatio(representation);
    }
  }

  public setQuality(quality: GraphicQuality): void {
    this.quality = quality;
    for (const representation of this.representations.values()) {
      this.applyQuality(representation);
    }
  }

  public setPhotographicRadiance(radiance: number): void {
    this.radiance = THREE.MathUtils.clamp(radiance, 0.5, 1.5);
    for (const representation of this.representations.values()) {
      this.applyPhotographicRadiance(representation);
    }
  }

  public updateLod(
    lodLevel: number,
    deltaSeconds: number,
    cameraDistance = defaultCameraDistanceFor(lodLevel),
  ): void {
    const hierarchyVisible = isStarTileNavigationLodLevel(lodLevel);
    const retired: string[] = [];

    for (const representation of this.representations.values()) {
      const targetOpacity =
        hierarchyVisible && !representation.retiring
          ? opacityFor(representation, lodLevel, cameraDistance)
          : 0;

      representation.opacity = dampValue(representation.opacity, targetOpacity, 6, deltaSeconds);
      representation.points.material.uniforms['clusterOpacity']!.value = representation.opacity;
      representation.points.visible =
        representation.points.geometry.drawRange.count > 0 && representation.opacity > 0.004;
      updatePickableIndices(representation);

      if (representation.retiring && representation.opacity <= 0.004) {
        retired.push(representation.signature);
      }
    }

    for (const signature of retired) {
      const representation = this.representations.get(signature)!;

      this.root.remove(representation.points);
      disposePoints(representation.points);
      this.representations.delete(signature);
    }
    if (retired.length > 0) {
      this.rebuildActiveSourceRecords();
    }
  }

  public select(objectId: string | null): void {
    const record = objectId ? this.resolveSourceRecord(objectId) : undefined;

    this.selectedObjectId = record ? objectId : null;
    if (record && objectId) {
      this.retainedSourceRecords.set(objectId, record);
    }
    this.releaseUnpinnedSourceRecords();
  }

  public focus(objectId: string | null): void {
    const record = objectId ? this.resolveSourceRecord(objectId) : undefined;

    this.focusedObjectId = record ? objectId : null;
    if (record && objectId) {
      this.retainedSourceRecords.set(objectId, record);
    }
    this.releaseUnpinnedSourceRecords();
  }

  public has(objectId: string): boolean {
    return this.resolveSourceRecord(objectId) !== undefined;
  }

  public getDefinition(objectId: string): SpaceObject | undefined {
    const record = this.resolveSourceRecord(objectId);

    if (!record) {
      return undefined;
    }
    const cached = this.sourceDefinitions.get(objectId);

    if (cached) {
      return cached;
    }
    const definition = createGaiaSourceDefinition(objectId, record);

    this.sourceDefinitions.set(objectId, definition);

    return definition;
  }

  public getWorldPosition(objectId: string, target = new THREE.Vector3()): THREE.Vector3 | null {
    const record = this.resolveSourceRecord(objectId);

    if (!record) {
      return null;
    }
    this.registry.toRenderPosition(record.position, target);
    this.root.updateWorldMatrix(true, false);

    return target.applyMatrix4(this.root.matrixWorld);
  }

  public getPickables(): readonly THREE.Object3D[] {
    return [...this.representations.values()]
      .filter((representation) => representation.visibleIndices !== null)
      .map((representation) => representation.points);
  }

  public get activeTileCount(): number {
    return this.activeSignatures.reduce(
      (total, signature) => total + (this.representations.get(signature)?.tileIds.length ?? 0),
      0,
    );
  }

  public get representationCount(): number {
    return this.representations.size;
  }

  public get visibleClusterCount(): number {
    return [...this.representations.values()].reduce(
      (total, representation) =>
        total +
        (representation.points.visible ? representation.points.geometry.drawRange.count : 0),
      0,
    );
  }

  public getPresentationStats(camera: THREE.Camera): GaiaPresentationStats {
    let sampledSources = 0;
    let perceptibleSampledSources = 0;
    let projectedSampledSources = 0;
    let aggregateCells = 0;
    let projectedAggregateCells = 0;

    for (const representation of this.representations.values()) {
      if (!representation.points.visible) {
        continue;
      }
      const pointCount = representation.points.geometry.drawRange.count;
      const projection = measureProjectedPoints(representation.points, camera);

      if (representation.pointRepresentation === 'sampled-source') {
        sampledSources += pointCount;
        perceptibleSampledSources += projection.perceptibleCount;
        projectedSampledSources += projection.projectedCount;
      } else {
        aggregateCells += pointCount;
        projectedAggregateCells += projection.projectedCount;
      }
    }

    return {
      sampledSources,
      perceptibleSampledSources,
      projectedSampledSources,
      aggregateCells,
      projectedAggregateCells,
    };
  }

  public dispose(): void {
    for (const representation of this.representations.values()) {
      disposePoints(representation.points);
    }
    this.representations.clear();
    this.activeSignatures = [];
    this.activeSourceRecords.clear();
    this.retainedSourceRecords.clear();
    this.sourceDefinitions.clear();
    this.selectedObjectId = null;
    this.focusedObjectId = null;
    this.root.clear();
  }

  private applyPixelRatio(representation: ClusterRepresentation): void {
    representation.points.material.uniforms['pixelRatio']!.value = this.pixelRatio;
  }

  private applyQuality(representation: ClusterRepresentation): void {
    const count = Math.max(
      1,
      Math.round(representation.clusterCount * QUALITY_FRACTIONS[this.quality]),
    );

    representation.points.geometry.setDrawRange(0, count);
    updatePickableIndices(representation);
  }

  private applyPhotographicRadiance(representation: ClusterRepresentation): void {
    representation.points.material.uniforms['radiance']!.value = this.radiance;
  }

  private pruneRetiringRepresentations(activeRepresentationCount: number): void {
    const maximumRepresentationCount =
      activeRepresentationCount === 0 ? 1 : activeRepresentationCount + 1;
    const activeRepresentationTypes = new Set(
      [...this.representations.values()]
        .filter((representation) => !representation.retiring)
        .map((representation) => representation.pointRepresentation),
    );
    const retiringRepresentations = [...this.representations.values()].filter(
      (representation) => representation.retiring,
    );

    retiringRepresentations.sort(
      (left, right) =>
        retiringRepresentationRetentionPriority(left, activeRepresentationTypes) -
        retiringRepresentationRetentionPriority(right, activeRepresentationTypes),
    );

    while (
      this.representations.size > maximumRepresentationCount &&
      retiringRepresentations.length > 0
    ) {
      const representation = retiringRepresentations.shift()!;

      this.transferOpacityBeforePruning(representation, retiringRepresentations);
      this.root.remove(representation.points);
      disposePoints(representation.points);
      this.representations.delete(representation.signature);
    }
  }

  private transferOpacityBeforePruning(
    representation: ClusterRepresentation,
    remainingRetiringRepresentations: readonly ClusterRepresentation[],
  ): void {
    const recipient =
      remainingRetiringRepresentations.find(
        (candidate) => candidate.pointRepresentation === representation.pointRepresentation,
      ) ??
      [...this.representations.values()].find(
        (candidate) =>
          candidate.signature !== representation.signature &&
          candidate.pointRepresentation === representation.pointRepresentation,
      );

    if (!recipient) {
      return;
    }

    recipient.opacity += representation.opacity;
    recipient.points.material.uniforms['clusterOpacity']!.value = recipient.opacity;
    recipient.points.visible =
      recipient.points.geometry.drawRange.count > 0 && recipient.opacity > 0.004;
    updatePickableIndices(recipient);
  }

  private rebuildActiveSourceRecords(): void {
    this.activeSourceRecords.clear();
    const representations = [...this.representations.values()].sort(
      (left, right) => Number(left.retiring) - Number(right.retiring),
    );

    for (const representation of representations) {
      for (const record of representation.records) {
        if (!record.sourceId) {
          continue;
        }
        const objectId = gaiaSourceObjectId(record.sourceId);

        if (!this.activeSourceRecords.has(objectId)) {
          this.activeSourceRecords.set(objectId, record);
        }
      }
    }
    this.releaseUnpinnedSourceRecords();
    for (const objectId of this.sourceDefinitions.keys()) {
      if (!this.resolveSourceRecord(objectId)) {
        this.sourceDefinitions.delete(objectId);
      }
    }
  }

  private resolveSourceRecord(objectId: string): ClusterRecord | undefined {
    return this.activeSourceRecords.get(objectId) ?? this.retainedSourceRecords.get(objectId);
  }

  private releaseUnpinnedSourceRecords(): void {
    for (const objectId of this.retainedSourceRecords.keys()) {
      if (objectId !== this.selectedObjectId && objectId !== this.focusedObjectId) {
        this.retainedSourceRecords.delete(objectId);
      }
    }
  }
}

function retiringRepresentationRetentionPriority(
  representation: ClusterRepresentation,
  activeRepresentationTypes: ReadonlySet<StarTilePointRepresentation>,
): number {
  const bridgesAResolutionChange = !activeRepresentationTypes.has(
    representation.pointRepresentation,
  );
  const preservesDetailedSources = representation.pointRepresentation === 'sampled-source';

  return Number(bridgesAResolutionChange) * 2 + Number(preservesDetailedSources);
}

function opacityFor(
  representation: ClusterRepresentation,
  navigationLodLevel: number,
  cameraDistance: number,
): number {
  if (isDetailedStarTileNavigationLodLevel(navigationLodLevel)) {
    const reveal = calculateStellarNeighborhoodReveal(cameraDistance);

    if (representation.lodLevel === 3 && representation.pointRepresentation === 'sampled-source') {
      return REPRESENTATION_OPACITIES['sampled-source'] * reveal;
    }
    if (representation.lodLevel === 4 && representation.pointRepresentation === 'aggregate-cell') {
      return REPRESENTATION_OPACITIES['aggregate-cell'] * reveal;
    }
  }
  if (
    (navigationLodLevel === 3 || navigationLodLevel === 4) &&
    representation.lodLevel === 4 &&
    representation.pointRepresentation === 'aggregate-cell'
  ) {
    const overviewOpacity = THREE.MathUtils.lerp(
      GALACTIC_OVERVIEW_AGGREGATE_OPACITY,
      LOCAL_GROUP_AGGREGATE_OPACITY,
      smoothstep(MILKY_WAY_TRANSITION_START, MILKY_WAY_TRANSITION_END, cameraDistance),
    );
    const stableTransformPresence = smoothstep(
      STELLAR_NEIGHBORHOOD_EXPANSION_END,
      GALACTIC_OVERVIEW_STABLE_FADE_END,
      cameraDistance,
    );

    return overviewOpacity * stableTransformPresence;
  }

  return 0;
}

function defaultCameraDistanceFor(lodLevel: number): number {
  if (lodLevel === 3) {
    return MILKY_WAY_TRANSITION_START;
  }
  if (lodLevel === 4) {
    return MILKY_WAY_TRANSITION_END;
  }

  return 0;
}

function groupTilesByLod(
  tiles: readonly StarClusterTile[],
): ReadonlyMap<number, readonly StarClusterTile[]> {
  const groups = new Map<number, StarClusterTile[]>();

  for (const tile of tiles) {
    const group = groups.get(tile.lodLevel) ?? [];

    group.push(tile);
    groups.set(tile.lodLevel, group);
  }
  for (const group of groups.values()) {
    group.sort((left, right) => left.id.localeCompare(right.id));
  }

  return groups;
}

function signatureFor(lodLevel: number, tiles: readonly StarClusterTile[]): string {
  return `${lodLevel}:${tiles.map((tile) => tile.id).join(',')}`;
}

function sameSignatures(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length && left.every((signature, index) => signature === right[index])
  );
}

function createRepresentation(
  signature: string,
  lodLevel: number,
  tiles: readonly StarClusterTile[],
  registry: StarCatalogRegistry,
): ClusterRepresentation {
  const records = tiles
    .flatMap((tile) => recordsFromTile(tile))
    .sort((left, right) => left.magnitude - right.magnitude);
  const points = createClusterPoints(records, lodLevel, tiles, registry);

  return {
    signature,
    lodLevel,
    pointRepresentation: tiles[0]!.representation,
    tileIds: tiles.map((tile) => tile.id),
    clusterCount: records.length,
    records,
    points,
    visibleIndices:
      points.userData['visibleIndices'] instanceof Uint8Array
        ? points.userData['visibleIndices']
        : null,
    opacity: 0,
    retiring: false,
  };
}

function recordsFromTile(tile: StarClusterTile): readonly ClusterRecord[] {
  return Array.from({ length: tile.clusterCount }, (_, index) => {
    const offset = index * 3;

    return {
      position: [
        tile.positionsParsec[offset]!,
        tile.positionsParsec[offset + 1]!,
        tile.positionsParsec[offset + 2]!,
      ],
      magnitude: tile.apparentMagnitudes[index]!,
      colorIndex: tile.colorIndices[index]!,
      colorIndexSystem: tile.colorIndexSystem,
      starCount: tile.starCounts[index]!,
      ...(tile.representation === 'sampled-source' && tile.sourceIds
        ? { sourceId: tile.sourceIds[index]! }
        : {}),
      sourceCatalog: tile.sourceCatalog,
      referenceEpochJulianDay: tile.referenceEpochJulianDay,
    };
  });
}

function createClusterPoints(
  records: readonly ClusterRecord[],
  lodLevel: number,
  tiles: readonly StarClusterTile[],
  registry: StarCatalogRegistry,
): THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> {
  const positions = new Float32Array(records.length * 3);
  const colors = new Float32Array(records.length * 3);
  const sizes = new Float32Array(records.length);
  const alphas = new Float32Array(records.length);
  const faintnesses = new Float32Array(records.length);
  const renderPosition = new THREE.Vector3();
  const pointRepresentation = tiles[0]!.representation;

  if (
    pointRepresentation === 'sampled-source' &&
    records.some((record) => record.sourceId === undefined)
  ) {
    throw new Error('Une source Gaia détaillée ne peut pas être rendue sans source_id.');
  }

  records.forEach((record, index) => {
    const offset = index * 3;
    const color = stellarColorIndexToRgb(record.colorIndex, record.colorIndexSystem);
    const aggregateBrightness = THREE.MathUtils.clamp((5 - record.magnitude) / 8, 0, 1);
    const density = THREE.MathUtils.clamp(Math.log2(record.starCount + 1) / 11, 0, 1);
    const sampledBrightness = Math.pow(
      THREE.MathUtils.clamp(
        (GAIA_SAMPLE_FAINT_MAGNITUDE - record.magnitude) / GAIA_SAMPLE_FAINT_MAGNITUDE,
        0,
        1,
      ),
      0.72,
    );
    const sampledFaintness = Math.pow(1 - sampledBrightness, 1.35);

    registry.toRenderPosition(record.position, renderPosition);
    renderPosition.toArray(positions, offset);
    colors[offset] = color[0];
    colors[offset + 1] = color[1];
    colors[offset + 2] = color[2];
    if (pointRepresentation === 'sampled-source') {
      sizes[index] =
        0.9 + sampledBrightness + density * 0.1 + sampledFaintness * GAIA_FAINT_SOURCE_SIZE_LIFT;
      alphas[index] =
        0.5 +
        sampledBrightness * 0.42 +
        density * 0.08 +
        sampledFaintness * GAIA_FAINT_SOURCE_ALPHA_LIFT;
      faintnesses[index] = sampledFaintness;
    } else {
      sizes[index] = 1.1 + density * 1.45 + aggregateBrightness * 0.35;
      alphas[index] = 0.22 + density * 0.22 + aggregateBrightness * 0.18;
    }
  });
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('pointSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('pointAlpha', new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute('pointFaintness', new THREE.BufferAttribute(faintnesses, 1));
  geometry.setDrawRange(0, records.length);
  geometry.computeBoundingSphere();

  const points = new THREE.Points(geometry, createMaterial(pointRepresentation));
  const sourceTile = tiles[0]!;

  points.name =
    pointRepresentation === 'sampled-source'
      ? `calculated-dense-star-samples-lod-${lodLevel}`
      : `calculated-dense-star-clusters-lod-${lodLevel}`;
  points.visible = false;
  points.renderOrder = 1;
  points.userData['tileIds'] = tiles.map((tile) => tile.id);
  points.userData['sourceStarCount'] = tiles.reduce(
    (total, tile) => total + tile.sourceStarCount,
    0,
  );
  points.userData['clusterCount'] = records.length;
  points.userData['pointRepresentation'] = pointRepresentation;
  points.userData['sourceCatalog'] = sourceTile.sourceCatalog;
  points.userData['magnitudeBand'] = sourceTile.magnitudeBand;
  points.userData['colorIndexSystem'] = sourceTile.colorIndexSystem;
  points.userData['scientificConfidence'] = 'calculated';
  points.userData['visualScale'] =
    pointRepresentation === 'sampled-source'
      ? 'measured-source-sample'
      : 'illustrative-aggregation';
  points.userData['visualStyle'] =
    'gaia-photometry-with-white-screen-core-and-restrained-bp-rp-temperature';
  points.userData['appearanceConfidence'] = 'illustrative';
  points.userData['photometricTreatment'] =
    'magnitude-preserving-faint-source-legibility-with-mesopic-color-restraint';
  points.userData['rasterTreatment'] = 'fine-screen-space-core-with-photometric-bright-source-halo';
  if (pointRepresentation === 'sampled-source') {
    const objectIds = records.map((record) => gaiaSourceObjectId(record.sourceId!));

    points.layers.enable(PICKING_LAYER);
    points.userData['objectIds'] = objectIds;
    points.userData['visibleIndices'] = new Uint8Array(records.length);
    points.userData['pickingPriority'] = GAIA_PICKING_PRIORITY;
    points.userData['catalogAssociation'] = 'individual-gaia-dr3-sources';
  }

  return points;
}

function updatePickableIndices(representation: ClusterRepresentation): void {
  const visibleIndices = representation.visibleIndices;

  if (!visibleIndices) {
    return;
  }
  visibleIndices.fill(0);
  if (representation.points.visible) {
    visibleIndices.fill(1, 0, representation.points.geometry.drawRange.count);
  }
}

function gaiaSourceObjectId(sourceId: string): string {
  return `${GAIA_SOURCE_OBJECT_ID_PREFIX}${sourceId}`;
}

function createGaiaSourceDefinition(objectId: string, record: ClusterRecord): SpaceObject {
  const sourceId = record.sourceId!;
  const distanceParsec = Math.hypot(...record.position);
  const galacticPosition = equatorialJ2000ToGalacticScene({
    x: record.position[0],
    y: record.position[1],
    z: record.position[2],
  });
  const color = stellarColorIndexToRgb(record.colorIndex, record.colorIndexSystem);

  return {
    id: objectId,
    name: `Gaia DR3 ${sourceId}`,
    aliases: [],
    type: 'star',
    parentId: 'milky-way',
    referenceFrame: 'stellar',
    scientificConfidence: 'calculated',
    description:
      'Source mesurée du catalogue Gaia DR3. La position affichée est fixée à J2016.0 et la distance est calculée par inversion de la parallaxe après une sélection astrométrique à fort rapport signal/bruit.',
    referenceEpoch: record.referenceEpochJulianDay,
    visual: {
      color: rgbToCssColor(color),
      visualRadius: GAIA_SOURCE_VISUAL_RADIUS,
      scaleMode: 'adaptive',
    },
    positionProvider: {
      type: 'static',
      position: [galacticPosition.x, galacticPosition.y, galacticPosition.z],
      unit: 'parsec',
    },
    metadata: {
      catalogIdentifier: `Gaia DR3 ${sourceId}`,
      gaiaSourceId: sourceId,
      sourceCatalog: record.sourceCatalog,
      source: 'ESA/Gaia/DPAC · Gaia Data Release 3',
      apparentMagnitude: record.magnitude,
      magnitudeBand: 'Gaia G',
      colorIndexBpRp: record.colorIndex,
      colorIndexSystem: 'Gaia BP−RP',
      distanceParsec,
      distanceLy: convertDistance(distanceParsec, 'parsec', 'light-year'),
      sourceReferenceFrame: 'ICRS · époque J2016.0',
      sourcePositionConfidence: 'observed',
      distanceModel: '1000 / parallaxe (mas), parallaxe / erreur ≥ 10',
      appearanceConfidence: 'illustrative',
      visualSource: 'Couleur écran dérivée de l’indice Gaia BP−RP mesuré ; taille adaptée.',
    },
  };
}

function rgbToCssColor(color: readonly [number, number, number]): string {
  return `#${color
    .map((channel) =>
      Math.round(THREE.MathUtils.clamp(channel, 0, 1) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

function createMaterial(pointRepresentation: StarTilePointRepresentation): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      pixelRatio: { value: 1 },
      clusterOpacity: { value: 0 },
      radiance: { value: 1 },
      sampledSource: { value: pointRepresentation === 'sampled-source' ? 1 : 0 },
      catalogSignature: { value: pointRepresentation === 'sampled-source' ? 0 : 0.22 },
      catalogTint: { value: new THREE.Color(0x9fbdff) },
    },
    vertexShader: `
      attribute float pointSize;
      attribute float pointAlpha;
      attribute float pointFaintness;
      varying vec3 starColor;
      varying float starAlpha;
      varying float starFaintness;
      varying float starProminence;
      varying float starRasterSize;
      uniform float pixelRatio;
      uniform float sampledSource;

      void main() {
        starColor = color;
        starAlpha = pointAlpha;
        starFaintness = pointFaintness;
        starProminence = smoothstep(
          ${GAIA_BRIGHT_SOURCE_PROMINENCE_START.toFixed(2)},
          ${GAIA_BRIGHT_SOURCE_PROMINENCE_END.toFixed(2)},
          clamp(1.0 - starFaintness, 0.0, 1.0)
        );
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        float sampledRasterSize = mix(
          ${GAIA_MINIMUM_SAMPLED_RASTER_SIZE.toFixed(1)},
          ${GAIA_PROMINENT_SAMPLED_RASTER_SIZE.toFixed(1)} * pixelRatio,
          starProminence
        );
        float minimumRasterSize = mix(
          1.0,
          sampledRasterSize,
          sampledSource
        );
        starRasterSize = max(minimumRasterSize, pointSize * pixelRatio);
        gl_PointSize = starRasterSize;
      }
    `,
    fragmentShader: `
      varying vec3 starColor;
      varying float starAlpha;
      varying float starFaintness;
      varying float starProminence;
      varying float starRasterSize;
      uniform float clusterOpacity;
      uniform float radiance;
      uniform float sampledSource;
      uniform float catalogSignature;
      uniform vec3 catalogTint;

      void main() {
        float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
        if (radius > 1.0) {
          discard;
        }
        float halo = 1.0 - smoothstep(0.18, 1.0, radius);
        float coreEdge = mix(0.24, 0.30, starFaintness * sampledSource);
        float photometricCore = 1.0 - smoothstep(0.0, coreEdge, radius);
        float pixelRadius = radius * starRasterSize * 0.5;
        float pixelStableCore = 1.0 - smoothstep(
          ${GAIA_PIXEL_CORE_INNER_RADIUS.toFixed(2)},
          ${GAIA_PIXEL_CORE_OUTER_RADIUS.toFixed(2)},
          pixelRadius
        );
        float pixelStableCoreStrength = mix(
          ${GAIA_PIXEL_CORE_BRIGHT_STRENGTH.toFixed(2)},
          ${GAIA_PIXEL_CORE_FAINT_STRENGTH.toFixed(2)},
          starFaintness
        );
        float sampledPixelCore =
          pixelStableCore * pixelStableCoreStrength * sampledSource;
        float core = mix(photometricCore, sampledPixelCore, sampledSource);
        float sampledHaloStrength = mix(0.04, 0.12, starProminence);
        float haloStrength = mix(0.58, sampledHaloStrength, sampledSource);
        float alpha = max(halo * haloStrength, core) * starAlpha * clusterOpacity;
        float signatureStrength = catalogSignature * (1.0 - core * 0.62);
        float stellarLuminance = dot(starColor, vec3(0.2126, 0.7152, 0.0722));
        float sampledChromaRetention = mix(
          ${GAIA_FAINT_SOURCE_CHROMA_RETENTION.toFixed(2)},
          ${GAIA_BRIGHT_SOURCE_CHROMA_RETENTION.toFixed(2)},
          starProminence
        );
        float chromaMix = mix(1.0, sampledChromaRetention, sampledSource);
        vec3 chromaticStarColor = max(
          vec3(0.0),
          mix(vec3(stellarLuminance), starColor, chromaMix)
        );
        vec3 catalogColor = mix(chromaticStarColor, catalogTint, signatureStrength);
        float coreWhitening = mix(
          ${GAIA_FAINT_SOURCE_CORE_WHITENING.toFixed(2)},
          ${GAIA_BRIGHT_SOURCE_CORE_WHITENING.toFixed(2)},
          starProminence
        );
        vec3 coreColor = mix(
          catalogColor,
          vec3(1.0),
          core * sampledSource * coreWhitening
        );
        float luminosity = 0.82 + core * sampledSource * 0.42;
        gl_FragColor = vec4(coreColor * radiance * luminosity, alpha);
      }
    `,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
}

function smoothstep(minimum: number, maximum: number, value: number): number {
  const progress = THREE.MathUtils.clamp((value - minimum) / (maximum - minimum), 0, 1);

  return progress * progress * (3 - 2 * progress);
}

function disposePoints(points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>): void {
  points.geometry.dispose();
  points.material.dispose();
}

interface ProjectedPointMeasurement {
  readonly projectedCount: number;
  readonly perceptibleCount: number;
}

function measureProjectedPoints(
  points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>,
  camera: THREE.Camera,
): ProjectedPointMeasurement {
  const positions = points.geometry.getAttribute('position');
  const pointAlphas = points.geometry.getAttribute('pointAlpha');
  const pointFaintnesses = points.geometry.getAttribute('pointFaintness');
  const drawStart = Math.max(0, points.geometry.drawRange.start);
  const drawCount = Math.min(
    positions.count - drawStart,
    Math.max(0, points.geometry.drawRange.count),
  );
  const projected = new THREE.Vector3();
  const sampledSource = points.userData['pointRepresentation'] === 'sampled-source';
  const clusterOpacity = points.material.uniforms['clusterOpacity']!.value as number;
  let projectedCount = 0;
  let perceptibleCount = 0;

  points.updateWorldMatrix(true, false);
  camera.updateWorldMatrix(true, false);
  for (let index = drawStart; index < drawStart + drawCount; index += 1) {
    projected.fromBufferAttribute(positions, index);
    points.localToWorld(projected);
    projected.project(camera);
    if (
      Math.abs(projected.x) <= 1 &&
      Math.abs(projected.y) <= 1 &&
      projected.z >= -1 &&
      projected.z <= 1
    ) {
      projectedCount += 1;
      if (
        sampledSource &&
        sampledPointWorstCaseAlpha(
          pointAlphas.getX(index),
          pointFaintnesses.getX(index),
          clusterOpacity,
        ) >= GAIA_PERCEPTIBLE_ALPHA_FLOOR
      ) {
        perceptibleCount += 1;
      }
    }
  }

  return { projectedCount, perceptibleCount };
}

function sampledPointWorstCaseAlpha(
  pointAlpha: number,
  pointFaintness: number,
  clusterOpacity: number,
): number {
  const stableCore =
    1 -
    smoothstep(
      GAIA_PIXEL_CORE_INNER_RADIUS,
      GAIA_PIXEL_CORE_OUTER_RADIUS,
      WORST_CASE_NEAREST_PIXEL_RADIUS,
    );
  const stableCoreStrength = THREE.MathUtils.lerp(
    GAIA_PIXEL_CORE_BRIGHT_STRENGTH,
    GAIA_PIXEL_CORE_FAINT_STRENGTH,
    pointFaintness,
  );

  return stableCore * stableCoreStrength * pointAlpha * clusterOpacity;
}
