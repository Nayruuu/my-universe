import * as THREE from 'three';
import type { GraphicQuality, LabelDensity } from '../../data/models/universe.models';
import {
  LabelCandidateCollector,
  type LabelCandidate,
  type LabelCandidateWorldPositionReader,
  type LabelObjectVisibilityReader,
} from './label-candidate-collector';
import { LabelCanvasPainter, type LabelNameResolver } from './label-canvas-painter';
import { findLabelHit, type LabelHitRegion } from './label-screen-layout';
import { LabelPlacementManager } from './label-placement-manager';
import {
  getLabelRenderFlags,
  getMaximumOrdinaryLabelCount,
  getMaximumOrdinaryLabelPlacementAttempts,
  isLabelWithinOrdinaryBudget,
} from './label-render-policy';
import { LabelScreenProjector, getLabelViewportLayout } from './label-screen-projector';
import { LabelOcclusionManager } from './label-occlusion-manager';
import type { LabelObject } from './label-visibility-policy';

export {
  getLabelTextColor,
  getMaximumCatalogLabelPoolRank,
  getMaximumCatalogLabelRank,
  getMaximumConstellationLabelRank,
  getMaximumCosmicLabelRank,
  getMaximumExoplanetHostLabelPoolRank,
  getMaximumExoplanetHostLabelRank,
  getMaximumLabelCount,
  isLabelVisibleAtLevel,
  isScaleLandmarkAtLevel,
  requiresDynamicLabelVisibility,
} from './label-visibility-policy';
export { calculateGalacticContextLabelOpacity } from './label-render-policy';
export type { LabelObject } from './label-visibility-policy';
export type { LabelNameResolver } from './label-canvas-painter';
export { findLabelHit } from './label-screen-layout';
export type { LabelHitRegion, ScreenRectangle } from './label-screen-layout';

type WorldPositionReader = LabelCandidateWorldPositionReader;
type ObjectVisibilityReader = LabelObjectVisibilityReader;

const LABEL_FRAME_INTERVAL_MS = 1_000 / 30;
const LABEL_TRANSITION_FRAME_INTERVAL_MS = 1_000 / 15;
const MINIMUM_LABEL_OPACITY = 0.02;
const LABEL_PIXEL_RATIO_CAP = {
  low: 1,
  medium: 1.25,
  high: 1.5,
} as const satisfies Record<GraphicQuality, number>;

export class LabelManager {
  private readonly canvas = document.createElement('canvas');
  private readonly painter: LabelCanvasPainter;
  private readonly placementManager: LabelPlacementManager;
  private readonly worldPosition = new THREE.Vector3();
  private readonly screenProjector = new LabelScreenProjector();
  private readonly occlusionManager = new LabelOcclusionManager();
  private readonly candidateCollector = new LabelCandidateCollector();
  private readonly hitRegions: LabelHitRegion[] = [];
  private transientObject: LabelObject | null = null;
  private quality: GraphicQuality;
  private density: LabelDensity;
  private enabled = true;
  private detailsPanelVisible = false;
  private transitioning = false;
  private hoveredId: string | null = null;
  private width = 1;
  private height = 1;
  private pixelRatio = 1;
  private lastRenderTime = Number.NEGATIVE_INFINITY;

  constructor(
    container: HTMLElement,
    private objects: readonly LabelObject[],
    quality: GraphicQuality,
    density: LabelDensity = 'balanced',
    private readonly isObjectVisible: ObjectVisibilityReader = () => true,
    nameResolver: LabelNameResolver = (_objectId, fallback) => fallback,
  ) {
    const context = this.canvas.getContext('2d');

    if (!context) {
      throw new Error('Canvas 2D indisponible pour les labels astronomiques.');
    }
    this.painter = new LabelCanvasPainter(context, nameResolver);
    this.placementManager = new LabelPlacementManager(this.painter, this.occlusionManager);
    this.occlusionManager.setObjects(objects);
    this.quality = quality;
    this.density = density;
    this.canvas.className = 'universe-label-layer';
    this.canvas.setAttribute('aria-hidden', 'true');
    Object.assign(this.canvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '1',
    });
    container.appendChild(this.canvas);
  }

  public setEnabled(enabled: boolean): void {
    if (enabled === this.enabled) {
      return;
    }
    this.enabled = enabled;
    this.canvas.hidden = !enabled;
    this.hitRegions.length = 0;
    this.lastRenderTime = Number.NEGATIVE_INFINITY;
  }

  public setQuality(quality: GraphicQuality): void {
    if (quality === this.quality) {
      return;
    }
    this.quality = quality;
    this.resize(this.width, this.height);
  }

  public setDensity(density: LabelDensity): void {
    if (density === this.density) {
      return;
    }
    this.density = density;
    this.hitRegions.length = 0;
    this.lastRenderTime = Number.NEGATIVE_INFINITY;
  }

  public setObjects(objects: readonly LabelObject[]): void {
    this.objects = objects;
    this.occlusionManager.setObjects(objects);
    this.hitRegions.length = 0;
    this.lastRenderTime = Number.NEGATIVE_INFINITY;
  }

  public setNameResolver(resolver: LabelNameResolver): void {
    this.painter.setNameResolver(resolver);
    this.hitRegions.length = 0;
    this.lastRenderTime = Number.NEGATIVE_INFINITY;
  }

  public setTransientObject(object: LabelObject | null): void {
    this.transientObject = object;
    this.lastRenderTime = Number.NEGATIVE_INFINITY;
  }

  public setHoveredObject(objectId: string | null): void {
    if (objectId === this.hoveredId) {
      return;
    }
    this.hoveredId = objectId;
    this.lastRenderTime = Number.NEGATIVE_INFINITY;
  }

  public setDetailsPanelVisible(visible: boolean): void {
    this.detailsPanelVisible = visible;
    this.lastRenderTime = Number.NEGATIVE_INFINITY;
  }

  public setTransitioning(transitioning: boolean): void {
    this.transitioning = transitioning;
  }

  public resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) {
      return;
    }
    this.width = width;
    this.height = height;
    const ratioCap = LABEL_PIXEL_RATIO_CAP[this.quality];

    this.pixelRatio = Math.min(window.devicePixelRatio, ratioCap);
    const renderWidth = Math.max(1, Math.round(width * this.pixelRatio));
    const renderHeight = Math.max(1, Math.round(height * this.pixelRatio));

    if (this.canvas.width !== renderWidth || this.canvas.height !== renderHeight) {
      this.canvas.width = renderWidth;
      this.canvas.height = renderHeight;
    }
    this.hitRegions.length = 0;
    this.lastRenderTime = Number.NEGATIVE_INFINITY;
  }

  public render(
    camera: THREE.Camera,
    readWorldPosition: WorldPositionReader,
    lodLevel: number,
    selectedId: string | null,
    now = performance.now(),
    stellarNeighborhoodReveal = 1,
    galacticContextLabelOpacity = 1,
  ): void {
    const interval = this.transitioning
      ? LABEL_TRANSITION_FRAME_INTERVAL_MS
      : LABEL_FRAME_INTERVAL_MS;

    if (!this.enabled || now - this.lastRenderTime < interval) {
      return;
    }
    this.lastRenderTime = now;
    this.clearCanvas();
    const candidates = this.collectCandidates(camera, readWorldPosition, lodLevel, selectedId);

    this.occlusionManager.collect(camera, readWorldPosition, this.width, this.height);

    const maximumOrdinaryLabels = getMaximumOrdinaryLabelCount(
      this.quality,
      lodLevel,
      this.density,
      candidates,
    );
    const maximumOrdinaryPlacementAttempts =
      getMaximumOrdinaryLabelPlacementAttempts(maximumOrdinaryLabels);
    let renderedOrdinaryLabels = 0;
    let attemptedOrdinaryLabels = 0;
    const { safeTop, safeBottom, landmarkSafeLeft, landmarkSafeRight } = getLabelViewportLayout(
      this.width,
      this.detailsPanelVisible,
    );
    const projectionViewport = {
      viewportWidth: this.width,
      viewportHeight: this.height,
      safeTop,
      safeBottom,
    };
    const placementFrame = {
      ...projectionViewport,
      landmarkSafeLeft,
      landmarkSafeRight,
      lodLevel,
    };

    this.placementManager.clear();

    for (const candidate of candidates) {
      const flags = getLabelRenderFlags(candidate.object, lodLevel);
      const hovered = candidate.object.id === this.hoveredId;
      const stellarNeighborhoodOpacity =
        lodLevel >= 1 && lodLevel <= 2 && !flags.scaleLandmark && !candidate.selected && !hovered
          ? clampOpacity(stellarNeighborhoodReveal)
          : 1;
      const galaxyContextOpacity =
        candidate.object.type === 'galaxy' && !candidate.selected && !hovered
          ? clampOpacity(galacticContextLabelOpacity)
          : 1;
      const labelOpacity = Math.min(stellarNeighborhoodOpacity, galaxyContextOpacity);

      if (
        labelOpacity <= MINIMUM_LABEL_OPACITY ||
        !isLabelWithinOrdinaryBudget(
          candidate,
          flags.scaleLandmark,
          renderedOrdinaryLabels,
          maximumOrdinaryLabels,
        )
      ) {
        continue;
      }
      if (!candidate.selected && !flags.scaleLandmark) {
        if (attemptedOrdinaryLabels >= maximumOrdinaryPlacementAttempts) {
          continue;
        }
        attemptedOrdinaryLabels += 1;
      }
      const position = this.worldPosition.set(candidate.worldX, candidate.worldY, candidate.worldZ);
      const projection = this.screenProjector.project(
        position,
        camera,
        projectionViewport,
        flags.scaleLandmark,
      );

      if (!projection) {
        continue;
      }
      const { x, y } = projection;
      const rectangle = this.placementManager.place(
        candidate,
        x,
        y,
        placementFrame,
        flags.scaleLandmark,
        flags.solarSystemPrimaryLabel,
      );

      if (!rectangle) {
        continue;
      }

      if (flags.drawAnchor) {
        this.painter.drawAnchor(
          rectangle,
          x,
          y + 18,
          candidate.selected,
          hovered,
          flags.solarSystemLabel,
          labelOpacity,
        );
      }
      this.painter.drawLabel(
        candidate.object,
        rectangle,
        candidate.selected,
        hovered,
        lodLevel,
        labelOpacity,
      );
      this.hitRegions.push({
        objectId: candidate.object.id,
        rectangle,
      });
      if (!flags.scaleLandmark) {
        renderedOrdinaryLabels += 1;
      }
    }
  }

  public hitTest(clientX: number, clientY: number): string | null {
    if (!this.enabled) {
      return null;
    }
    const bounds = this.canvas.getBoundingClientRect();
    const x = clientX - bounds.left;
    const y = clientY - bounds.top;

    return findLabelHit(this.hitRegions, x, y);
  }

  public clear(): void {
    this.clearCanvas();
    this.lastRenderTime = Number.NEGATIVE_INFINITY;
  }

  public dispose(): void {
    this.canvas.remove();
    this.candidateCollector.clear();
    this.placementManager.clear();
    this.occlusionManager.clear();
    this.hitRegions.length = 0;
  }

  private collectCandidates(
    camera: THREE.Camera,
    readWorldPosition: WorldPositionReader,
    lodLevel: number,
    selectedId: string | null,
  ): readonly LabelCandidate[] {
    return this.candidateCollector.collect({
      objects: this.objects,
      transientObject: this.transientObject,
      camera,
      readWorldPosition,
      lodLevel,
      selectedId,
      quality: this.quality,
      density: this.density,
      isObjectVisible: this.isObjectVisible,
    });
  }

  private clearCanvas(): void {
    this.hitRegions.length = 0;
    this.painter.clear(this.canvas.width, this.canvas.height, this.pixelRatio);
  }
}

function clampOpacity(opacity: number): number {
  return Math.max(0, Math.min(1, opacity));
}
