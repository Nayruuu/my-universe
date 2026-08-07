import * as THREE from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { GraphicQuality } from '../../data/models/universe.models';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import { TempelFilamentSpineCatalog } from '../loaders/tempel-filament-spine-catalog';
import { dampValue } from '../lod/screen-space-lod';
import { CosmicStructureCatalogRegistry } from '../objects/cosmic-structure-catalog-registry';
import { PICKING_LAYER } from '../selection/selection-layers';
import {
  CosmicMapLayers,
  DEFAULT_COSMIC_MAP_LAYERS,
  getCosmicFilamentSpineRevealThreshold,
  getCosmicMapDetail,
} from './cosmic-map-policy';

const TEMPEL_SOURCE_ID = 'sdss-dr8-tempel-filaments';
const TEMPEL_SOURCE_CITATION = 'Tempel et al. (2014), MNRAS 438, 3465';
const FADE_START_DISTANCE = 140_000;
const FULL_OPACITY_DISTANCE = 320_000;
const MAXIMUM_OPACITY = 0.66;
const OPACITY_DAMPING = 4;
const DETAIL_DAMPING = 5;
const TILE_COUNT = 8;
const TEMPEL_FILAMENT_VISUAL_PROFILES = Object.freeze({
  low: Object.freeze({
    haloWidthPixels: 2.4,
    haloOpacityScale: 0.2,
    maximumHaloDetail: 0.045,
    hoverWidthPixels: 4.2,
    selectionWidthPixels: 5.2,
  }),
  medium: Object.freeze({
    haloWidthPixels: 3.1,
    haloOpacityScale: 0.23,
    maximumHaloDetail: 0.055,
    hoverWidthPixels: 4.9,
    selectionWidthPixels: 6,
  }),
  high: Object.freeze({
    haloWidthPixels: 3.8,
    haloOpacityScale: 0.26,
    maximumHaloDetail: 0.065,
    hoverWidthPixels: 5.6,
    selectionWidthPixels: 6.8,
  }),
} as const satisfies Record<GraphicQuality, TempelFilamentVisualProfile>);

export interface TempelFilamentVisualProfile {
  readonly haloWidthPixels: number;
  readonly haloOpacityScale: number;
  readonly maximumHaloDetail: number;
  readonly hoverWidthPixels: number;
  readonly selectionWidthPixels: number;
}

interface SegmentRecord {
  readonly filamentIndex: number;
  readonly fromPointIndex: number;
  readonly toPointIndex: number;
  readonly objectId: string;
  readonly revealThreshold: number;
  readonly alpha: number;
}

interface TileState {
  readonly line: THREE.LineSegments<THREE.BufferGeometry, THREE.ShaderMaterial>;
  readonly halo: LineSegments2;
  readonly revealThresholds: Float32Array;
  readonly visibleIndices: Uint8Array;
  readonly segmentCount: number;
  activeSegmentCount: number;
  activeHaloSegmentCount: number;
}

export function getTempelFilamentSpineTargetOpacity(cameraDistance: number): number {
  const progress = THREE.MathUtils.clamp(
    (cameraDistance - FADE_START_DISTANCE) / (FULL_OPACITY_DISTANCE - FADE_START_DISTANCE),
    0,
    1,
  );
  const easedProgress = progress * progress * (3 - 2 * progress);

  return MAXIMUM_OPACITY * easedProgress;
}

export function getTempelFilamentVisualProfile(
  quality: GraphicQuality,
): TempelFilamentVisualProfile {
  return TEMPEL_FILAMENT_VISUAL_PROFILES[quality];
}

export class TempelFilamentSpineBatch {
  public readonly root = new THREE.Group();
  public readonly tiles: readonly THREE.LineSegments<THREE.BufferGeometry, THREE.ShaderMaterial>[];
  public readonly haloTiles: readonly LineSegments2[];
  public readonly selectionLine = createHighlightLine(
    'selected-tempel-filament-spine',
    0xffe7a3,
    0.98,
  );
  public readonly hoverLine = createHighlightLine('hovered-tempel-filament-spine', 0xa8fff0, 0.82);
  public readonly selectionHalo = createHighlightHalo(
    'selected-tempel-filament-spine-halo',
    0xffd77a,
    0.5,
  );
  public readonly hoverHalo = createHighlightHalo(
    'hovered-tempel-filament-spine-halo',
    0x65f5dd,
    0.38,
  );

  private readonly tileStates: readonly TileState[];
  private readonly material = createMaterial();
  private readonly haloMaterial = createHaloMaterial();
  private readonly filamentIndexByObjectId = new Map<string, number>();
  private readonly sceneUnitsPerMpc: number;
  private layers: CosmicMapLayers = DEFAULT_COSMIC_MAP_LAYERS;
  private quality: GraphicQuality;
  private cameraDistance = Number.POSITIVE_INFINITY;
  private opacity = 0;
  private detail = 0;
  private radiance = 1;
  private activeSegmentCount = 0;
  private selectedObjectId: string | null = null;
  private hoveredObjectId: string | null = null;

  constructor(
    private readonly catalog: TempelFilamentSpineCatalog,
    registry: CosmicStructureCatalogRegistry,
    coordinateSystem: CoordinateSystem,
    quality: GraphicQuality = 'high',
  ) {
    this.quality = quality;
    this.sceneUnitsPerMpc = coordinateSystem.toSceneDistance(1, 'megaparsec', 'cosmic-web');
    const filamentObjectIds = resolveFilamentObjectIds(catalog, registry);

    for (let index = 0; index < filamentObjectIds.length; index += 1) {
      this.filamentIndexByObjectId.set(filamentObjectIds[index]!, index);
    }
    this.tileStates = createTileStates(
      catalog,
      filamentObjectIds,
      this.sceneUnitsPerMpc,
      this.material,
      this.haloMaterial,
    );
    this.tiles = this.tileStates.map(({ line }) => line);
    this.haloTiles = this.tileStates.map(({ halo }) => halo);
    this.root.name = 'tempel-filament-spine-root';
    this.root.add(
      ...this.haloTiles,
      ...this.tiles,
      this.hoverHalo,
      this.selectionHalo,
      this.hoverLine,
      this.selectionLine,
    );
    this.setQuality(quality);
  }

  public get tileCount(): number {
    return this.tiles.length;
  }

  public get catalogFilamentCount(): number {
    return this.catalog.filamentCount;
  }

  public get catalogPointCount(): number {
    return this.catalog.pointCount;
  }

  public get catalogSegmentCount(): number {
    return this.catalog.segmentCount;
  }

  public get visibleSegmentCount(): number {
    return this.activeSegmentCount;
  }

  public setQuality(quality: GraphicQuality): void {
    this.quality = quality;
    const profile = getTempelFilamentVisualProfile(quality);

    setScreenSpaceLineWidth(this.haloMaterial, profile.haloWidthPixels);
    setScreenSpaceLineWidth(this.hoverHalo.material, profile.hoverWidthPixels);
    setScreenSpaceLineWidth(this.selectionHalo.material, profile.selectionWidthPixels);
    this.detail = getCosmicMapDetail(this.cameraDistance, quality);
    this.updateHaloOpacity();
    this.refreshVisibility();
  }

  public setLayers(layers: CosmicMapLayers): void {
    this.layers = { ...layers };
    this.refreshVisibility();
  }

  public setPhotographicRadiance(radiance: number): void {
    this.radiance = THREE.MathUtils.clamp(radiance, 0.5, 1.5);
    this.material.uniforms['radiance']!.value = this.radiance;
    this.updateHaloOpacity();
  }

  public updateDistance(cameraDistance: number, deltaSeconds: number): void {
    this.cameraDistance = cameraDistance;
    this.opacity = dampValue(
      this.opacity,
      getTempelFilamentSpineTargetOpacity(cameraDistance),
      OPACITY_DAMPING,
      deltaSeconds,
    );
    this.detail = dampValue(
      this.detail,
      getCosmicMapDetail(cameraDistance, this.quality),
      DETAIL_DAMPING,
      deltaSeconds,
    );
    this.material.uniforms['spineOpacity']!.value = this.opacity;
    this.updateHaloOpacity();
    this.refreshVisibility();
  }

  public select(objectId: string | null): void {
    this.selectedObjectId = this.resolveObjectId(objectId);
    this.updateHighlight(this.selectionLine, this.selectionHalo, this.selectedObjectId);
    this.refreshHoverHighlight();
  }

  public hover(objectId: string | null): void {
    this.hoveredObjectId = this.resolveObjectId(objectId);
    this.refreshHoverHighlight();
  }

  public getPickables(): readonly THREE.Object3D[] {
    return this.tiles;
  }

  public dispose(): void {
    for (const tile of this.tileStates) {
      tile.line.geometry.dispose();
      tile.halo.geometry.dispose();
    }
    this.material.dispose();
    this.haloMaterial.dispose();
    this.selectionLine.geometry.dispose();
    this.selectionLine.material.dispose();
    this.selectionHalo.geometry.dispose();
    this.selectionHalo.material.dispose();
    this.hoverLine.geometry.dispose();
    this.hoverLine.material.dispose();
    this.hoverHalo.geometry.dispose();
    this.hoverHalo.material.dispose();
    this.root.clear();
  }

  private refreshVisibility(): void {
    this.activeSegmentCount = 0;
    const maximumHaloDetail = getTempelFilamentVisualProfile(this.quality).maximumHaloDetail;

    for (const tile of this.tileStates) {
      const segmentCount =
        this.layers.filaments && this.opacity > 0.004
          ? findThresholdCount(tile.revealThresholds, this.detail)
          : 0;
      const haloSegmentCount =
        segmentCount > 0
          ? findThresholdCount(tile.revealThresholds, Math.min(this.detail, maximumHaloDetail))
          : 0;

      if (segmentCount !== tile.activeSegmentCount) {
        tile.line.geometry.setDrawRange(0, segmentCount * 2);
        tile.visibleIndices.fill(0);
        tile.visibleIndices.fill(1, 0, segmentCount * 2);
        tile.line.userData['activeSegmentCount'] = segmentCount;
        tile.activeSegmentCount = segmentCount;
      }
      if (haloSegmentCount !== tile.activeHaloSegmentCount) {
        tile.halo.geometry.instanceCount = haloSegmentCount;
        tile.halo.userData['activeSegmentCount'] = haloSegmentCount;
        tile.activeHaloSegmentCount = haloSegmentCount;
      }
      tile.line.visible = segmentCount > 0;
      tile.halo.visible = haloSegmentCount > 0;
      this.activeSegmentCount += segmentCount;
    }
  }

  private resolveObjectId(objectId: string | null): string | null {
    return objectId && this.filamentIndexByObjectId.has(objectId) ? objectId : null;
  }

  private refreshHoverHighlight(): void {
    this.updateHighlight(
      this.hoverLine,
      this.hoverHalo,
      this.hoveredObjectId === this.selectedObjectId ? null : this.hoveredObjectId,
    );
  }

  private updateHighlight(
    line: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>,
    halo: LineSegments2,
    objectId: string | null,
  ): void {
    const filamentIndex = objectId ? this.filamentIndexByObjectId.get(objectId) : undefined;

    if (filamentIndex === undefined) {
      line.visible = false;
      line.userData['objectId'] = null;
      line.geometry.setDrawRange(0, 0);
      halo.visible = false;
      halo.userData['objectId'] = null;
      halo.geometry.instanceCount = 0;

      return;
    }
    const startPoint = this.catalog.pointOffsets[filamentIndex]!;
    const endPoint = this.catalog.pointOffsets[filamentIndex + 1]!;
    const positions = new Float32Array((endPoint - startPoint - 1) * 6);
    let outputOffset = 0;

    for (let pointIndex = startPoint; pointIndex < endPoint - 1; pointIndex += 1) {
      copyScaledPoint(
        this.catalog.positionsMpc,
        pointIndex,
        positions,
        outputOffset,
        this.sceneUnitsPerMpc,
      );
      copyScaledPoint(
        this.catalog.positionsMpc,
        pointIndex + 1,
        positions,
        outputOffset + 3,
        this.sceneUnitsPerMpc,
      );
      outputOffset += 6;
    }
    line.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    line.geometry.setDrawRange(0, positions.length / 3);
    line.geometry.computeBoundingSphere();
    line.userData['objectId'] = objectId;
    line.visible = true;
    halo.geometry.setPositions(positions);
    halo.geometry.instanceCount = positions.length / 6;
    halo.userData['objectId'] = objectId;
    halo.visible = true;
  }

  private updateHaloOpacity(): void {
    const profile = getTempelFilamentVisualProfile(this.quality);

    this.haloMaterial.opacity = THREE.MathUtils.clamp(
      this.opacity * profile.haloOpacityScale * this.radiance,
      0,
      0.3,
    );
  }
}

function resolveFilamentObjectIds(
  catalog: TempelFilamentSpineCatalog,
  registry: CosmicStructureCatalogRegistry,
): readonly string[] {
  const objectIdByNumericId = new Map<number, string>();

  for (let index = 0; index < registry.catalog.count; index += 1) {
    const source = registry.catalog.metadata.sources[registry.catalog.sourceIndices[index]!]!;

    if (source.id === TEMPEL_SOURCE_ID) {
      objectIdByNumericId.set(
        registry.catalog.catalogNumericIds[index]!,
        registry.objectIds[index]!,
      );
    }
  }

  return Array.from(catalog.filamentIds, (filamentId) => {
    const objectId = objectIdByNumericId.get(filamentId);

    if (!objectId) {
      throw new Error(`Filament Tempel F${filamentId} absent du catalogue de structures.`);
    }

    return objectId;
  });
}

function createTileStates(
  catalog: TempelFilamentSpineCatalog,
  filamentObjectIds: readonly string[],
  sceneUnitsPerMpc: number,
  material: THREE.ShaderMaterial,
  haloMaterial: LineMaterial,
): readonly TileState[] {
  const recordsByTile = Array.from({ length: TILE_COUNT }, () => [] as SegmentRecord[]);

  for (let filamentIndex = 0; filamentIndex < catalog.filamentCount; filamentIndex += 1) {
    const filamentId = catalog.filamentIds[filamentIndex]!;
    const objectId = filamentObjectIds[filamentIndex]!;
    const revealThreshold = filamentId === 1 ? 0 : getCosmicFilamentSpineRevealThreshold(objectId);
    const startPoint = catalog.pointOffsets[filamentIndex]!;
    const endPoint = catalog.pointOffsets[filamentIndex + 1]!;

    for (let pointIndex = startPoint; pointIndex < endPoint - 1; pointIndex += 1) {
      recordsByTile[getSegmentTile(catalog.positionsMpc, pointIndex)]!.push({
        filamentIndex,
        fromPointIndex: pointIndex,
        toPointIndex: pointIndex + 1,
        objectId,
        revealThreshold,
        alpha: getSegmentAlpha(catalog, pointIndex),
      });
    }
  }

  return recordsByTile.flatMap((records, tileIndex) => {
    if (records.length === 0) {
      return [];
    }
    records.sort(
      (left, right) =>
        left.revealThreshold - right.revealThreshold ||
        left.filamentIndex - right.filamentIndex ||
        left.fromPointIndex - right.fromPointIndex,
    );

    return [createTileState(records, tileIndex, catalog, sceneUnitsPerMpc, material, haloMaterial)];
  });
}

function createTileState(
  records: readonly SegmentRecord[],
  tileIndex: number,
  catalog: TempelFilamentSpineCatalog,
  sceneUnitsPerMpc: number,
  material: THREE.ShaderMaterial,
  haloMaterial: LineMaterial,
): TileState {
  const positions = new Float32Array(records.length * 6);
  const alphas = new Float32Array(records.length * 2);
  const revealThresholds = new Float32Array(records.length);
  const visibleIndices = new Uint8Array(records.length * 2);
  const objectIds = new Array<string>(records.length * 2);

  for (let segmentIndex = 0; segmentIndex < records.length; segmentIndex += 1) {
    const record = records[segmentIndex]!;
    const positionOffset = segmentIndex * 6;
    const vertexOffset = segmentIndex * 2;

    copyScaledPoint(
      catalog.positionsMpc,
      record.fromPointIndex,
      positions,
      positionOffset,
      sceneUnitsPerMpc,
    );
    copyScaledPoint(
      catalog.positionsMpc,
      record.toPointIndex,
      positions,
      positionOffset + 3,
      sceneUnitsPerMpc,
    );
    alphas[vertexOffset] = record.alpha;
    alphas[vertexOffset + 1] = record.alpha;
    revealThresholds[segmentIndex] = record.revealThreshold;
    objectIds[vertexOffset] = record.objectId;
    objectIds[vertexOffset + 1] = record.objectId;
  }
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('lineAlpha', new THREE.BufferAttribute(alphas, 1));
  geometry.setDrawRange(0, 0);
  geometry.computeBoundingSphere();
  const line = new THREE.LineSegments(geometry, material);
  const haloGeometry = new LineSegmentsGeometry();

  haloGeometry.setPositions(positions);
  haloGeometry.instanceCount = 0;
  const halo = new LineSegments2(haloGeometry, haloMaterial);

  line.name = `calculated-tempel-filament-spine-tile-${tileIndex}`;
  halo.name = `illustrative-tempel-filament-spine-halo-tile-${tileIndex}`;
  line.visible = false;
  halo.visible = false;
  line.renderOrder = 1;
  halo.renderOrder = 0;
  line.layers.enable(PICKING_LAYER);
  line.userData['tileIndex'] = tileIndex;
  line.userData['segmentCount'] = records.length;
  line.userData['activeSegmentCount'] = 0;
  line.userData['scientificConfidence'] = 'calculated';
  line.userData['representation'] = 'published-filament-spine-points';
  line.userData['source'] = TEMPEL_SOURCE_CITATION;
  line.userData['objectIds'] = objectIds;
  line.userData['visibleIndices'] = visibleIndices;
  line.userData['pickingPriority'] = 12;
  halo.userData['scientificConfidence'] = 'illustrative';
  halo.userData['representation'] = 'screen-space-filament-halo';
  halo.userData['physicalWidth'] = false;
  halo.userData['activeSegmentCount'] = 0;
  halo.userData['source'] = TEMPEL_SOURCE_CITATION;

  return {
    line,
    halo,
    revealThresholds,
    visibleIndices,
    segmentCount: records.length,
    activeSegmentCount: 0,
    activeHaloSegmentCount: 0,
  };
}

function getSegmentTile(positions: Float32Array, pointIndex: number): number {
  const fromOffset = pointIndex * 3;
  const toOffset = fromOffset + 3;
  const x = positions[fromOffset]! + positions[toOffset]!;
  const y = positions[fromOffset + 1]! + positions[toOffset + 1]!;
  const z = positions[fromOffset + 2]! + positions[toOffset + 2]!;

  return Number(x >= 0) | (Number(y >= 0) << 1) | (Number(z >= 0) << 2);
}

function getSegmentAlpha(catalog: TempelFilamentSpineCatalog, pointIndex: number): number {
  const nextPointIndex = pointIndex + 1;
  const visitMap = (catalog.visitMap[pointIndex]! + catalog.visitMap[nextPointIndex]!) / 510;
  const density = (catalog.density[pointIndex]! + catalog.density[nextPointIndex]!) / 510;
  const orientation =
    (catalog.orientationStrength[pointIndex]! + catalog.orientationStrength[nextPointIndex]!) / 510;

  return 0.18 + visitMap * 0.14 + density * 0.38 + orientation * 0.3;
}

function copyScaledPoint(
  source: Float32Array,
  pointIndex: number,
  target: Float32Array,
  targetOffset: number,
  scale: number,
): void {
  const sourceOffset = pointIndex * 3;

  target[targetOffset] = source[sourceOffset]! * scale;
  target[targetOffset + 1] = source[sourceOffset + 1]! * scale;
  target[targetOffset + 2] = source[sourceOffset + 2]! * scale;
}

function createMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      spineOpacity: { value: 0 },
      radiance: { value: 1 },
    },
    vertexShader: `
      attribute float lineAlpha;
      varying float vAlpha;

      void main() {
        vAlpha = lineAlpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float spineOpacity;
      uniform float radiance;
      varying float vAlpha;

      void main() {
        vec3 color = mix(vec3(0.16, 0.62, 0.68), vec3(0.48, 1.0, 0.86), vAlpha);
        gl_FragColor = vec4(color * radiance, spineOpacity * vAlpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
}

function createHaloMaterial(): LineMaterial {
  return createScreenSpaceLineMaterial(0x2daec2, 0, true, THREE.AdditiveBlending);
}

function createHighlightLine(
  name: string,
  color: THREE.ColorRepresentation,
  opacity: number,
): THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial> {
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
  geometry.setDrawRange(0, 0);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  });
  const line = new THREE.LineSegments(geometry, material);

  line.name = name;
  line.visible = false;
  line.frustumCulled = false;
  line.renderOrder = 7;
  line.userData['objectId'] = null;

  return line;
}

function createHighlightHalo(
  name: string,
  color: THREE.ColorRepresentation,
  opacity: number,
): LineSegments2 {
  const geometry = new LineSegmentsGeometry();
  const material = createScreenSpaceLineMaterial(color, opacity, false, THREE.NormalBlending);
  const halo = new LineSegments2(geometry, material);

  geometry.instanceCount = 0;
  halo.name = name;
  halo.visible = false;
  halo.frustumCulled = false;
  halo.renderOrder = 6;
  halo.userData['objectId'] = null;
  halo.userData['scientificConfidence'] = 'illustrative';
  halo.userData['representation'] = 'screen-space-selection-halo';
  halo.userData['physicalWidth'] = false;

  return halo;
}

function createScreenSpaceLineMaterial(
  color: THREE.ColorRepresentation,
  opacity: number,
  depthTest: boolean,
  blending: THREE.Blending,
): LineMaterial {
  const material = new LineMaterial({
    color,
    transparent: true,
    opacity,
    depthTest,
    depthWrite: false,
    blending,
    toneMapped: false,
    worldUnits: false,
  });

  material.dashed = false;

  return material;
}

function setScreenSpaceLineWidth(material: LineMaterial, widthPixels: number): void {
  material.uniforms['linewidth']!.value = widthPixels;
}

function findThresholdCount(thresholds: Float32Array, detail: number): number {
  let lower = 0;
  let upper = thresholds.length;

  while (lower < upper) {
    const middle = (lower + upper) >>> 1;

    if (thresholds[middle]! <= detail) {
      lower = middle + 1;
    } else {
      upper = middle;
    }
  }

  return lower;
}
