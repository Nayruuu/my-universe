import * as THREE from 'three';
import {
  GraphicQuality,
  LabelDensity,
  SpaceObject,
  SpaceObjectType,
} from '../../data/models/universe.models';
import { calculateApparentRadiusPixels } from '../lod/screen-space-lod';
import { isGalaxyMapRankVisible } from './galaxy-map-policy';
import { scaleLabelLimit } from './label-density-policy';
import { getSolarSystemMapAccent } from './solar-system-map-palette';

type WorldPositionReader = (objectId: string, target: THREE.Vector3) => THREE.Vector3 | null;
type ObjectVisibilityReader = (objectId: string) => boolean;
export type LabelNameResolver = (objectId: string, fallback: string) => string;

export interface LabelObject {
  readonly id: string;
  readonly name: string;
  readonly type: SpaceObjectType;
  readonly visual?: Pick<SpaceObject['visual'], 'visualRadius'>;
  readonly metadata?: SpaceObject['metadata'];
}

interface LabelCandidate {
  object: LabelObject;
  distanceSquared: number;
  priority: number;
  selected: boolean;
}

interface ScreenOccluder {
  objectId: string;
  centerX: number;
  centerY: number;
  radius: number;
  distanceSquared: number;
  occludesSelectedLabels: boolean;
}

export interface ScreenRectangle {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface LabelHitRegion {
  objectId: string;
  rectangle: ScreenRectangle;
}

const LABEL_FRAME_INTERVAL_MS = 1_000 / 30;
const LABEL_HIT_PADDING_PX = 6;
const COSMIC_LABEL_PRIORITY_BASE = 300;
const MAXIMUM_CATALOG_LABEL_RANKS = {
  low: [400, 700, 1_000, 0, 0],
  medium: [800, 1_400, 2_200, 0, 0],
  high: [1_400, 2_400, 3_000, 0, 0],
} as const satisfies Record<GraphicQuality, readonly number[]>;
const MAXIMUM_EXOPLANET_HOST_LABEL_RANKS = {
  low: [1, 2, 3, 0, 0],
  medium: [2, 4, 5, 0, 0],
  high: [4, 8, 8, 0, 0],
} as const satisfies Record<GraphicQuality, readonly number[]>;
const MAXIMUM_CONSTELLATION_LABEL_RANKS = {
  low: [8, 12, 16, 0, 0, 0],
  medium: [14, 22, 30, 0, 0, 0],
  high: [20, 32, 44, 0, 0, 0],
} as const satisfies Record<GraphicQuality, readonly number[]>;
const MAXIMUM_COSMIC_LABEL_RANKS = {
  low: 24,
  medium: 48,
  high: 72,
} as const satisfies Record<GraphicQuality, number>;
const MAXIMUM_COSMIC_LABELS = {
  low: 10,
  medium: 16,
  high: 24,
} as const satisfies Record<GraphicQuality, number>;
const LABEL_TEXT_COLORS = {
  universe: '#d7ccff',
  'galaxy-cluster': '#d7ccff',
  supercluster: '#d9b8ff',
  'cosmic-wall': '#ffb78a',
  'cosmic-filament': '#7de4f2',
  'cosmic-void': '#78a9ff',
  'cosmic-basin': '#b89cff',
  'cosmic-attractor': '#ffd27c',
  'cosmic-repeller': '#7ce0c3',
  galaxy: '#c9b8ff',
  'black-hole': '#ffb274',
  supernova: '#ff9fc9',
  'supernova-remnant': '#82dcff',
  nebula: '#efb9dc',
  star: '#ffe7ad',
  planet: '#a9d4ff',
  exoplanet: '#77e6cf',
  'dwarf-planet': '#b9cfff',
  moon: '#d7dee8',
  asteroid: '#dbbe93',
  comet: '#a8e4d4',
  'artificial-object': '#bdcad7',
  region: '#b9c8dc',
} as const satisfies Record<SpaceObjectType, string>;
const CONSTELLATION_LABEL_TEXT_COLOR = '#8edff5';
const ACTIVE_LABEL_TEXT_COLOR = '#c8efff';
const SOLAR_SYSTEM_LABEL_TYPES = new Set<SpaceObjectType>([
  'planet',
  'dwarf-planet',
  'moon',
  'asteroid',
  'comet',
]);
const MAXIMUM_LABELS_BY_LOD = [64, 80, 96, 72, 36, 48, 72] as const;
const OCCLUDING_OBJECT_TYPES = new Set<SpaceObjectType>([
  'black-hole',
  'supernova',
  'supernova-remnant',
  'star',
  'planet',
  'exoplanet',
  'dwarf-planet',
  'moon',
  'asteroid',
  'comet',
]);
const MINIMUM_OCCLUDER_RADIUS_PX = 6;
const LABEL_OCCLUSION_PADDING_PX = 4;
const LABEL_VIEWPORT_MARGIN_PX = 8;
const DESKTOP_DETAILS_SAFE_LEFT_PX = 390;
const DESKTOP_CONTROLS_SAFE_RIGHT_PX = 72;

export class LabelManager {
  private readonly canvas = document.createElement('canvas');
  private readonly context: CanvasRenderingContext2D;
  private readonly worldPosition = new THREE.Vector3();
  private readonly projectedPosition = new THREE.Vector3();
  private readonly cameraSpacePosition = new THREE.Vector3();
  private readonly occupiedRectangles: ScreenRectangle[] = [];
  private readonly screenOccluders: ScreenOccluder[] = [];
  private readonly hitRegions: LabelHitRegion[] = [];
  private readonly candidates: LabelCandidate[] = [];
  private transientObject: LabelObject | null = null;
  private quality: GraphicQuality;
  private density: LabelDensity;
  private enabled = true;
  private detailsPanelVisible = false;
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
    private nameResolver: LabelNameResolver = (_objectId, fallback) => fallback,
  ) {
    const context = this.canvas.getContext('2d');

    if (!context) {
      throw new Error('Canvas 2D indisponible pour les labels astronomiques.');
    }
    this.context = context;
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
    this.hitRegions.length = 0;
    this.lastRenderTime = Number.NEGATIVE_INFINITY;
  }

  public setNameResolver(resolver: LabelNameResolver): void {
    this.nameResolver = resolver;
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

  public resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) {
      return;
    }
    this.width = width;
    this.height = height;
    const ratioCap = this.quality === 'low' ? 1 : this.quality === 'medium' ? 1.5 : 2;

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
  ): void {
    if (!this.enabled || now - this.lastRenderTime < LABEL_FRAME_INTERVAL_MS) {
      return;
    }
    this.lastRenderTime = now;
    this.clearCanvas();
    this.collectCandidates(camera, readWorldPosition, lodLevel, selectedId);
    this.collectScreenOccluders(camera, readWorldPosition);

    const maximumLabels = getMaximumLabelCount(this.quality, lodLevel, this.density);
    const maximumOrdinaryLabels =
      maximumLabels -
      Number(this.candidates.some(({ object }) => isScaleLandmarkAtLevel(object, lodLevel)));
    let renderedOrdinaryLabels = 0;
    const safeTop = this.width <= 720 ? 112 : 76;
    const safeBottom = this.width <= 720 ? 124 : 88;
    const landmarkSafeLeft =
      this.width > 720 && this.detailsPanelVisible
        ? DESKTOP_DETAILS_SAFE_LEFT_PX
        : LABEL_VIEWPORT_MARGIN_PX;
    const landmarkSafeRight =
      this.width > 720 ? DESKTOP_CONTROLS_SAFE_RIGHT_PX : LABEL_VIEWPORT_MARGIN_PX;

    this.occupiedRectangles.length = 0;

    for (const candidate of this.candidates) {
      const scaleLandmark = isScaleLandmarkAtLevel(candidate.object, lodLevel);
      const solarSystemPrimaryLabel = isSolarSystemPrimaryLabel(candidate.object, lodLevel);

      if (
        renderedOrdinaryLabels >= maximumOrdinaryLabels &&
        !candidate.selected &&
        !scaleLandmark
      ) {
        continue;
      }
      const position = readWorldPosition(candidate.object.id, this.worldPosition);

      if (!position) {
        continue;
      }
      this.projectedPosition.copy(position).project(camera);
      const behindCamera =
        this.cameraSpacePosition.copy(position).applyMatrix4(camera.matrixWorldInverse).z >= 0;

      if (scaleLandmark && behindCamera) {
        this.projectedPosition.x *= -1;
        this.projectedPosition.y *= -1;
        if (
          Math.abs(this.projectedPosition.x) < 0.001 &&
          Math.abs(this.projectedPosition.y) < 0.001
        ) {
          this.projectedPosition.y = 1;
        }
      }
      if (!scaleLandmark && (this.projectedPosition.z < -1 || this.projectedPosition.z > 1)) {
        continue;
      }

      const x = (this.projectedPosition.x * 0.5 + 0.5) * this.width;
      const y = (-this.projectedPosition.y * 0.5 + 0.5) * this.height - 18;

      if (
        !scaleLandmark &&
        (x < -40 || x > this.width + 40 || y < safeTop || y > this.height - safeBottom)
      ) {
        continue;
      }

      const rectangle = this.measureRectangle(candidate.object, x, y, candidate.selected, lodLevel);

      if (scaleLandmark) {
        fitLandmarkRectangle(
          rectangle,
          this.width,
          this.height,
          safeTop,
          safeBottom,
          landmarkSafeLeft,
          landmarkSafeRight,
        );
        this.moveLandmarkToFreeSlot(
          rectangle,
          safeTop,
          safeBottom,
          landmarkSafeLeft,
          landmarkSafeRight,
        );
      } else {
        fitRectangleHorizontally(rectangle, this.width);
      }
      if (!scaleLandmark && this.isOccludedByBody(candidate, rectangle, x, y + 18)) {
        continue;
      }
      if (!candidate.selected && !scaleLandmark && this.overlapsExistingLabel(rectangle)) {
        if (
          !solarSystemPrimaryLabel ||
          !this.moveLabelToNearbyFreeSlot(rectangle, safeTop, safeBottom)
        ) {
          continue;
        }
      }
      const hovered = candidate.object.id === this.hoveredId;
      const solarSystemLabel = isSolarSystemLabelAtLevel(candidate.object, lodLevel);

      if (
        solarSystemPrimaryLabel ||
        (candidate.object.id !== 'sun' &&
          (candidate.object.type === 'star' ||
            candidate.object.type === 'black-hole' ||
            candidate.object.type === 'supernova' ||
            candidate.object.type === 'supernova-remnant' ||
            isCosmicCatalogLabel(candidate.object)))
      ) {
        this.drawAnchor(rectangle, x, y + 18, candidate.selected, hovered, solarSystemLabel);
      }
      this.drawLabel(candidate.object, rectangle, candidate.selected, hovered, lodLevel);
      this.occupiedRectangles.push(rectangle);
      this.hitRegions.push({
        objectId: candidate.object.id,
        rectangle,
      });
      if (!scaleLandmark) {
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
    this.candidates.length = 0;
    this.occupiedRectangles.length = 0;
    this.screenOccluders.length = 0;
    this.hitRegions.length = 0;
  }

  private collectCandidates(
    camera: THREE.Camera,
    readWorldPosition: WorldPositionReader,
    lodLevel: number,
    selectedId: string | null,
  ): void {
    this.candidates.length = 0;
    for (const object of this.objects) {
      this.collectCandidate(object, camera, readWorldPosition, lodLevel, selectedId);
    }
    if (
      this.transientObject &&
      !this.objects.some((object) => object.id === this.transientObject?.id)
    ) {
      this.collectCandidate(this.transientObject, camera, readWorldPosition, lodLevel, selectedId);
    }
    this.candidates.sort(
      (left, right) =>
        Number(right.selected) - Number(left.selected) ||
        left.priority - right.priority ||
        left.distanceSquared - right.distanceSquared,
    );
  }

  private collectCandidate(
    object: LabelObject,
    camera: THREE.Camera,
    readWorldPosition: WorldPositionReader,
    lodLevel: number,
    selectedId: string | null,
  ): void {
    const selected = object.id === selectedId;
    const scaleLandmark = isScaleLandmarkAtLevel(object, lodLevel);

    if (object.type === 'region' && !isConstellationLabel(object)) {
      return;
    }
    if (
      (!selected || isConstellationLabel(object)) &&
      !scaleLandmark &&
      !this.isObjectVisible(object.id)
    ) {
      return;
    }
    if (!selected && !isLabelVisibleAtLevel(object, lodLevel, this.quality, this.density)) {
      return;
    }
    const position = readWorldPosition(object.id, this.worldPosition);

    if (!position) {
      return;
    }
    this.candidates.push({
      object,
      distanceSquared: camera.position.distanceToSquared(position),
      priority: getLabelPriority(object, lodLevel),
      selected,
    });
  }

  private clearCanvas(): void {
    this.hitRegions.length = 0;
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
  }

  private collectScreenOccluders(
    camera: THREE.Camera,
    readWorldPosition: WorldPositionReader,
  ): void {
    this.screenOccluders.length = 0;
    if (!(camera instanceof THREE.PerspectiveCamera)) {
      return;
    }

    for (const object of this.objects) {
      const visualRadius = object.visual?.visualRadius;

      if (
        typeof visualRadius !== 'number' ||
        !OCCLUDING_OBJECT_TYPES.has(object.type) ||
        visualRadius <= 0
      ) {
        continue;
      }
      const position = readWorldPosition(object.id, this.worldPosition);

      if (!position) {
        continue;
      }
      const distanceSquared = camera.position.distanceToSquared(position);
      const radius = calculateApparentRadiusPixels(
        visualRadius,
        Math.sqrt(distanceSquared),
        this.height,
        camera.fov,
      );

      if (radius < MINIMUM_OCCLUDER_RADIUS_PX) {
        continue;
      }
      this.projectedPosition.copy(position).project(camera);
      if (this.projectedPosition.z < -1 || this.projectedPosition.z > 1) {
        continue;
      }
      this.screenOccluders.push({
        objectId: object.id,
        centerX: (this.projectedPosition.x * 0.5 + 0.5) * this.width,
        centerY: (-this.projectedPosition.y * 0.5 + 0.5) * this.height,
        radius,
        distanceSquared,
        occludesSelectedLabels: object.type === 'star' || object.type === 'black-hole',
      });
    }
  }

  private isOccludedByBody(
    candidate: LabelCandidate,
    rectangle: ScreenRectangle,
    pointX: number,
    pointY: number,
  ): boolean {
    return this.screenOccluders.some((occluder) => {
      if (
        occluder.objectId === candidate.object.id ||
        candidate.distanceSquared <= occluder.distanceSquared ||
        (candidate.selected && !occluder.occludesSelectedLabels)
      ) {
        return false;
      }
      const radius = occluder.radius + LABEL_OCCLUSION_PADDING_PX;
      const pointDistance = Math.hypot(pointX - occluder.centerX, pointY - occluder.centerY);

      return (
        pointDistance <= radius ||
        circleIntersectsRectangle(occluder.centerX, occluder.centerY, radius, rectangle)
      );
    });
  }

  private measureRectangle(
    object: LabelObject,
    centerX: number,
    baselineY: number,
    selected: boolean,
    lodLevel = -1,
  ): ScreenRectangle {
    const catalogLabel = isCatalogLabel(object);
    const solarSystemPrimaryLabel = isSolarSystemPrimaryLabel(object, lodLevel);
    const fontSize =
      selected || solarSystemPrimaryLabel
        ? 13
        : object.type === 'galaxy'
          ? 12
          : catalogLabel
            ? 10
            : 11;

    this.context.font = `${selected || solarSystemPrimaryLabel ? 600 : 500} ${fontSize}px Inter, system-ui, sans-serif`;
    const name = this.nameResolver(object.id, object.name);
    const width =
      Math.min(this.context.measureText(name).width, 176) +
      (solarSystemPrimaryLabel ? 22 : catalogLabel ? 16 : 18);
    const height = selected || solarSystemPrimaryLabel ? 27 : catalogLabel ? 21 : 23;

    return {
      left: centerX - width / 2,
      top: baselineY - height,
      right: centerX + width / 2,
      bottom: baselineY,
    };
  }

  private drawLabel(
    object: LabelObject,
    rectangle: ScreenRectangle,
    selected: boolean,
    hovered: boolean,
    lodLevel = -1,
  ): void {
    const width = rectangle.right - rectangle.left;
    const height = rectangle.bottom - rectangle.top;
    const radius = height / 2;
    const catalogLabel = isCatalogLabel(object);
    const solarSystemPrimaryLabel = isSolarSystemPrimaryLabel(object, lodLevel);
    const solarSystemLabel = isSolarSystemLabelAtLevel(object, lodLevel);
    const solarSystemAccent = solarSystemLabel
      ? getSolarSystemMapAccent(object.id, selected || hovered)
      : null;

    this.context.beginPath();
    this.context.roundRect(rectangle.left, rectangle.top, width, height, radius);
    this.context.fillStyle = solarSystemLabel
      ? selected || hovered
        ? 'rgba(38, 25, 8, 0.94)'
        : 'rgba(30, 19, 6, 0.88)'
      : selected || hovered
        ? 'rgba(9, 27, 43, 0.92)'
        : catalogLabel
          ? 'rgba(5, 12, 22, 0.48)'
          : 'rgba(5, 9, 18, 0.72)';
    this.context.fill();

    if (selected || hovered || solarSystemLabel) {
      this.context.strokeStyle = solarSystemLabel
        ? solarSystemAccent!
        : hovered
          ? 'rgba(137, 207, 246, 0.88)'
          : 'rgba(137, 207, 246, 0.6)';
      this.context.lineWidth = 1;
      this.context.stroke();
    }

    const fontSize =
      selected || solarSystemPrimaryLabel
        ? 13
        : object.type === 'galaxy'
          ? 12
          : catalogLabel
            ? 10
            : 11;

    this.context.font = `${selected || solarSystemPrimaryLabel ? 600 : 500} ${fontSize}px Inter, system-ui, sans-serif`;
    this.context.fillStyle = getLabelTextColor(object, selected || hovered, lodLevel);
    this.context.textAlign = 'center';
    this.context.textBaseline = 'middle';
    this.context.fillText(
      this.nameResolver(object.id, object.name),
      rectangle.left + width / 2,
      rectangle.top + height / 2 + 0.5,
      width - 14,
    );
  }

  private drawAnchor(
    rectangle: ScreenRectangle,
    pointX: number,
    pointY: number,
    selected: boolean,
    hovered: boolean,
    solarSystemLabel = false,
  ): void {
    const labelX = (rectangle.left + rectangle.right) / 2;
    const emphasized = selected || hovered;

    this.context.beginPath();
    this.context.moveTo(labelX, rectangle.bottom + 2);
    this.context.lineTo(pointX, pointY - 3);
    this.context.strokeStyle = solarSystemLabel
      ? emphasized
        ? 'rgba(255, 221, 145, 0.9)'
        : 'rgba(241, 188, 91, 0.56)'
      : emphasized
        ? 'rgba(124, 205, 248, 0.78)'
        : 'rgba(151, 184, 215, 0.34)';
    this.context.lineWidth = emphasized ? 1.2 : 0.75;
    this.context.stroke();

    this.context.beginPath();
    this.context.arc(pointX, pointY, emphasized ? 2.6 : 1.8, 0, Math.PI * 2);
    this.context.fillStyle = solarSystemLabel
      ? emphasized
        ? 'rgba(255, 236, 190, 0.98)'
        : 'rgba(255, 211, 124, 0.86)'
      : emphasized
        ? 'rgba(157, 220, 255, 0.96)'
        : 'rgba(208, 226, 244, 0.72)';
    this.context.fill();
  }

  private overlapsExistingLabel(rectangle: ScreenRectangle): boolean {
    const padding = 4;

    return this.occupiedRectangles.some(
      (occupied) =>
        rectangle.left < occupied.right + padding &&
        rectangle.right > occupied.left - padding &&
        rectangle.top < occupied.bottom + padding &&
        rectangle.bottom > occupied.top - padding,
    );
  }

  private moveLabelToNearbyFreeSlot(
    rectangle: ScreenRectangle,
    safeTop: number,
    safeBottom: number,
  ): boolean {
    const margin = 8;
    const width = rectangle.right - rectangle.left;
    const height = rectangle.bottom - rectangle.top;
    const originalLeft = rectangle.left;
    const originalTop = rectangle.top;
    const horizontalStep = width + margin;
    const verticalStep = height + margin;

    for (let ring = 1; ring <= 3; ring += 1) {
      for (let row = -ring; row <= ring; row += 1) {
        for (let column = -ring; column <= ring; column += 1) {
          if (Math.max(Math.abs(row), Math.abs(column)) !== ring) {
            continue;
          }
          const left = originalLeft + column * horizontalStep;
          const top = originalTop + row * verticalStep;
          const candidate = {
            left,
            top,
            right: left + width,
            bottom: top + height,
          };

          if (
            candidate.left < margin ||
            candidate.right > this.width - margin ||
            candidate.top < safeTop ||
            candidate.bottom > this.height - safeBottom ||
            this.overlapsExistingLabel(candidate)
          ) {
            continue;
          }
          Object.assign(rectangle, candidate);

          return true;
        }
      }
    }

    return false;
  }

  private moveLandmarkToFreeSlot(
    rectangle: ScreenRectangle,
    safeTop: number,
    safeBottom: number,
    safeLeft: number,
    safeRight: number,
  ): void {
    if (!this.overlapsExistingLabel(rectangle)) {
      return;
    }
    const width = rectangle.right - rectangle.left;
    const height = rectangle.bottom - rectangle.top;
    const maximumLeft = Math.max(safeLeft, this.width - safeRight - width);
    const maximumTop = Math.max(safeTop, this.height - safeBottom - height);
    const horizontalStep = width + LABEL_VIEWPORT_MARGIN_PX;
    const verticalStep = height + LABEL_VIEWPORT_MARGIN_PX;

    for (let top = safeTop; top <= maximumTop; top += verticalStep) {
      for (let left = safeLeft; left <= maximumLeft; left += horizontalStep) {
        const candidate = {
          left,
          top,
          right: left + width,
          bottom: top + height,
        };

        if (!this.overlapsExistingLabel(candidate)) {
          Object.assign(rectangle, candidate);

          return;
        }
      }
    }
  }
}

export function getLabelTextColor(object: LabelObject, active: boolean, lodLevel = -1): string {
  if (isSolarSystemLabelAtLevel(object, lodLevel)) {
    return getSolarSystemMapAccent(object.id, active);
  }
  if (active) {
    return ACTIVE_LABEL_TEXT_COLOR;
  }
  if (isConstellationLabel(object)) {
    return CONSTELLATION_LABEL_TEXT_COLOR;
  }

  return LABEL_TEXT_COLORS[object.type];
}

export function isLabelVisibleAtLevel(
  object: LabelObject,
  lodLevel: number,
  quality: GraphicQuality = 'high',
  density: LabelDensity = 'balanced',
): boolean {
  const catalogRecordIndex = object.metadata?.['catalogRecordIndex'];
  const exoplanetHostRank = object.metadata?.['exoplanetHostRank'];
  const cosmicLabelRank = getCosmicLabelRank(object);
  const constellationLabelRank = object.metadata?.['constellationLabelRank'];

  if (typeof catalogRecordIndex === 'number') {
    return catalogRecordIndex < getMaximumCatalogLabelRank(quality, lodLevel, density);
  }
  if (typeof exoplanetHostRank === 'number') {
    return exoplanetHostRank < getMaximumExoplanetHostLabelRank(quality, lodLevel, density);
  }
  if (cosmicLabelRank !== null) {
    return cosmicLabelRank < getMaximumCosmicLabelRank(quality, lodLevel, density);
  }
  if (typeof constellationLabelRank === 'number') {
    return constellationLabelRank < getMaximumConstellationLabelRank(quality, lodLevel, density);
  }
  if (object.type === 'galaxy') {
    if (object.id === 'milky-way') {
      return lodLevel >= 3;
    }
    const nearbyUniverseLabelRank = object.metadata?.['nearbyUniverseLabelRank'];

    if (typeof nearbyUniverseLabelRank === 'number') {
      return lodLevel >= 5;
    }

    return lodLevel >= 3 && lodLevel <= 4 && isGalaxyMapRankVisible(object, quality, density);
  }
  if (object.type === 'star') {
    if (object.id === 'sun') {
      return lodLevel <= 2;
    }

    return lodLevel >= 1 && lodLevel <= 2;
  }
  if (object.type === 'black-hole') {
    return lodLevel >= 1 && lodLevel <= 3;
  }
  if (object.type === 'supernova' || object.type === 'supernova-remnant') {
    return lodLevel >= 1 && lodLevel <= 3;
  }

  return lodLevel <= 1;
}

export function isScaleLandmarkAtLevel(object: LabelObject, lodLevel: number): boolean {
  return object.id === (lodLevel <= 2 ? 'sun' : 'milky-way');
}

export function getMaximumLabelCount(
  quality: GraphicQuality,
  lodLevel: number,
  density: LabelDensity = 'balanced',
): number {
  if (lodLevel === 6) {
    return scaleLabelLimit(MAXIMUM_COSMIC_LABELS[quality], density);
  }
  const qualityLimit = quality === 'low' ? 28 : quality === 'medium' ? 56 : 96;
  const lodLimit = MAXIMUM_LABELS_BY_LOD[lodLevel] ?? MAXIMUM_LABELS_BY_LOD.at(-1)!;

  return scaleLabelLimit(Math.min(qualityLimit, lodLimit), density);
}

export function getMaximumCatalogLabelRank(
  quality: GraphicQuality,
  lodLevel: number,
  density: LabelDensity = 'balanced',
): number {
  return scaleLabelLimit(MAXIMUM_CATALOG_LABEL_RANKS[quality][lodLevel] ?? 0, density);
}

export function getMaximumConstellationLabelRank(
  quality: GraphicQuality,
  lodLevel: number,
  density: LabelDensity = 'balanced',
): number {
  return scaleLabelLimit(MAXIMUM_CONSTELLATION_LABEL_RANKS[quality][lodLevel] ?? 0, density);
}

export function getMaximumExoplanetHostLabelRank(
  quality: GraphicQuality,
  lodLevel: number,
  density: LabelDensity = 'balanced',
): number {
  return scaleLabelLimit(MAXIMUM_EXOPLANET_HOST_LABEL_RANKS[quality][lodLevel] ?? 0, density);
}

export function getMaximumCosmicLabelRank(
  quality: GraphicQuality,
  lodLevel: number,
  density: LabelDensity = 'balanced',
): number {
  return lodLevel === 6 ? scaleLabelLimit(MAXIMUM_COSMIC_LABEL_RANKS[quality], density) : 0;
}

export function getMaximumCatalogLabelPoolRank(
  quality: GraphicQuality,
  density: LabelDensity,
): number {
  return Math.max(
    ...MAXIMUM_CATALOG_LABEL_RANKS[quality].map((rank) => scaleLabelLimit(rank, density)),
  );
}

export function findLabelHit(
  regions: readonly LabelHitRegion[],
  x: number,
  y: number,
  padding = LABEL_HIT_PADDING_PX,
): string | null {
  for (const region of regions) {
    const rectangle = region.rectangle;

    if (
      x >= rectangle.left - padding &&
      x <= rectangle.right + padding &&
      y >= rectangle.top - padding &&
      y <= rectangle.bottom + padding
    ) {
      return region.objectId;
    }
  }

  return null;
}

function fitRectangleHorizontally(
  rectangle: ScreenRectangle,
  viewportWidth: number,
  safeLeft = LABEL_VIEWPORT_MARGIN_PX,
  safeRight = LABEL_VIEWPORT_MARGIN_PX,
): void {
  const leftOverflow = safeLeft - rectangle.left;
  const rightOverflow = rectangle.right - (viewportWidth - safeRight);
  const offset = leftOverflow > 0 ? leftOverflow : rightOverflow > 0 ? -rightOverflow : 0;

  rectangle.left += offset;
  rectangle.right += offset;
}

function fitLandmarkRectangle(
  rectangle: ScreenRectangle,
  viewportWidth: number,
  viewportHeight: number,
  safeTop: number,
  safeBottom: number,
  safeLeft: number,
  safeRight: number,
): void {
  fitRectangleHorizontally(rectangle, viewportWidth, safeLeft, safeRight);
  const maximumBottom = Math.max(safeTop, viewportHeight - safeBottom);
  const offset =
    rectangle.top < safeTop
      ? safeTop - rectangle.top
      : rectangle.bottom > maximumBottom
        ? maximumBottom - rectangle.bottom
        : 0;

  rectangle.top += offset;
  rectangle.bottom += offset;
}

function circleIntersectsRectangle(
  centerX: number,
  centerY: number,
  radius: number,
  rectangle: ScreenRectangle,
): boolean {
  const closestX = THREE.MathUtils.clamp(centerX, rectangle.left, rectangle.right);
  const closestY = THREE.MathUtils.clamp(centerY, rectangle.top, rectangle.bottom);

  return Math.hypot(centerX - closestX, centerY - closestY) <= radius;
}

function getLabelPriority(object: LabelObject, lodLevel: number): number {
  if (object.id === 'sun' || object.id === 'milky-way') {
    return Number.MAX_SAFE_INTEGER;
  }
  if (lodLevel === 1) {
    if (object.type === 'planet') {
      return -300;
    }
    if (object.type === 'dwarf-planet') {
      return -240;
    }
    if (object.type === 'moon') {
      return -180;
    }
  }
  const catalogRecordIndex = object.metadata?.['catalogRecordIndex'];

  if (typeof catalogRecordIndex === 'number') {
    return 1_000 + catalogRecordIndex;
  }
  const cosmicCatalogRank = object.metadata?.['cosmicCatalogRank'];

  if (typeof cosmicCatalogRank === 'number') {
    return COSMIC_LABEL_PRIORITY_BASE + cosmicCatalogRank * 2;
  }
  const cosmicStructureRank = object.metadata?.['cosmicStructureRank'];

  if (typeof cosmicStructureRank === 'number') {
    return COSMIC_LABEL_PRIORITY_BASE + cosmicStructureRank * 2 + 1;
  }
  const constellationLabelRank = object.metadata?.['constellationLabelRank'];

  if (typeof constellationLabelRank === 'number') {
    return 400 + constellationLabelRank;
  }
  const exoplanetHostRank = object.metadata?.['exoplanetHostRank'];

  if (typeof exoplanetHostRank === 'number') {
    return 600 + exoplanetHostRank;
  }
  const mapLabelRank = object.metadata?.['mapLabelRank'];
  const nearbyUniverseLabelRank = object.metadata?.['nearbyUniverseLabelRank'];

  if (object.type === 'galaxy' && typeof nearbyUniverseLabelRank === 'number') {
    return 25 + nearbyUniverseLabelRank;
  }

  return object.type === 'galaxy' && typeof mapLabelRank === 'number' ? 50 + mapLabelRank : 0;
}

function isSolarSystemPrimaryLabel(object: LabelObject, lodLevel: number): boolean {
  return (
    lodLevel === 1 &&
    (object.type === 'planet' || object.type === 'dwarf-planet' || object.type === 'moon')
  );
}

function isSolarSystemLabelAtLevel(object: LabelObject, lodLevel: number): boolean {
  if (lodLevel < 0 || lodLevel > 2) {
    return false;
  }

  return object.id === 'sun' || SOLAR_SYSTEM_LABEL_TYPES.has(object.type);
}

function isCatalogLabel(object: LabelObject): boolean {
  return (
    typeof object.metadata?.['catalogRecordIndex'] === 'number' ||
    typeof object.metadata?.['exoplanetHostRank'] === 'number' ||
    isCosmicCatalogLabel(object)
  );
}

function isCosmicCatalogLabel(object: LabelObject): boolean {
  return getCosmicLabelRank(object) !== null;
}

function getCosmicLabelRank(object: LabelObject): number | null {
  const catalogRank = object.metadata?.['cosmicCatalogRank'];

  if (typeof catalogRank === 'number') {
    return catalogRank;
  }
  const structureRank = object.metadata?.['cosmicStructureRank'];

  return typeof structureRank === 'number' ? structureRank : null;
}

function isConstellationLabel(object: LabelObject): boolean {
  return typeof object.metadata?.['constellationLabelRank'] === 'number';
}
