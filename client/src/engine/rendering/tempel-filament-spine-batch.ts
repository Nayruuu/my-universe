import * as THREE from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { GraphicQuality } from '../../data/models/universe.models';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import { TempelFilamentSpineCatalog } from '../loaders/tempel-filament-spine-catalog';
import { dampValue } from '../lod/screen-space-lod';
import { CosmicStructureCatalogRegistry } from '../objects/cosmic-structure-catalog-registry';
import {
  CosmicMapLayers,
  DEFAULT_COSMIC_MAP_LAYERS,
  getCosmicMapDetail,
} from './cosmic-map-policy';
import {
  createTempelFilamentSpineVisual,
  setTempelScreenSpaceLineWidth,
  type TempelFilamentTileState,
  updateTempelFilamentHighlight,
} from './tempel-filament-spine-visual';

const FADE_START_DISTANCE = 140_000;
const FULL_OPACITY_DISTANCE = 320_000;
const MAXIMUM_OPACITY = 0.66;
const OPACITY_DAMPING = 4;
const DETAIL_DAMPING = 5;
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
  public readonly selectionLine: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  public readonly hoverLine: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  public readonly selectionHalo: LineSegments2;
  public readonly hoverHalo: LineSegments2;

  private readonly tileStates: readonly TempelFilamentTileState[];
  private readonly material: THREE.ShaderMaterial;
  private readonly haloMaterial: LineMaterial;
  private readonly filamentIndexByObjectId: ReadonlyMap<string, number>;
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
    const visual = createTempelFilamentSpineVisual(catalog, registry, this.sceneUnitsPerMpc);

    this.tileStates = visual.tileStates;
    this.tiles = visual.tiles;
    this.haloTiles = visual.haloTiles;
    this.selectionLine = visual.selectionLine;
    this.hoverLine = visual.hoverLine;
    this.selectionHalo = visual.selectionHalo;
    this.hoverHalo = visual.hoverHalo;
    this.material = visual.material;
    this.haloMaterial = visual.haloMaterial;
    this.filamentIndexByObjectId = visual.filamentIndexByObjectId;
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

    setTempelScreenSpaceLineWidth(this.haloMaterial, profile.haloWidthPixels);
    setTempelScreenSpaceLineWidth(this.hoverHalo.material, profile.hoverWidthPixels);
    setTempelScreenSpaceLineWidth(this.selectionHalo.material, profile.selectionWidthPixels);
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

    updateTempelFilamentHighlight(
      line,
      halo,
      this.catalog,
      filamentIndex,
      this.sceneUnitsPerMpc,
      objectId,
    );
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
