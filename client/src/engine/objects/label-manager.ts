import * as THREE from 'three';
import { GraphicQuality, SpaceObject, SpaceObjectType } from '../../data/models/universe.models';

type WorldPositionReader = (objectId: string, target: THREE.Vector3) => THREE.Vector3 | null;

export interface LabelObject {
  readonly id: string;
  readonly name: string;
  readonly type: SpaceObjectType;
  readonly metadata?: SpaceObject['metadata'];
}

interface LabelCandidate {
  object: LabelObject;
  distanceSquared: number;
  priority: number;
  selected: boolean;
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
const DEFAULT_MAXIMUM_CATALOG_LABEL_RANK = 240;

export class LabelManager {
  private readonly canvas = document.createElement('canvas');
  private readonly context: CanvasRenderingContext2D;
  private readonly worldPosition = new THREE.Vector3();
  private readonly projectedPosition = new THREE.Vector3();
  private readonly occupiedRectangles: ScreenRectangle[] = [];
  private readonly hitRegions: LabelHitRegion[] = [];
  private readonly candidates: LabelCandidate[] = [];
  private transientObject: LabelObject | null = null;
  private quality: GraphicQuality;
  private enabled = true;
  private hoveredId: string | null = null;
  private width = 1;
  private height = 1;
  private pixelRatio = 1;
  private lastRenderTime = Number.NEGATIVE_INFINITY;

  constructor(
    container: HTMLElement,
    private readonly objects: readonly LabelObject[],
    quality: GraphicQuality,
  ) {
    const context = this.canvas.getContext('2d');

    if (!context) {
      throw new Error('Canvas 2D indisponible pour les labels astronomiques.');
    }
    this.context = context;
    this.quality = quality;
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

    const maximumLabels = getMaximumLabelCount(this.quality, lodLevel);
    let renderedLabels = 0;

    this.occupiedRectangles.length = 0;

    for (const candidate of this.candidates) {
      if (renderedLabels >= maximumLabels && !candidate.selected) {
        break;
      }
      const position = readWorldPosition(candidate.object.id, this.worldPosition);

      if (!position) {
        continue;
      }
      this.projectedPosition.copy(position).project(camera);
      if (this.projectedPosition.z < -1 || this.projectedPosition.z > 1) {
        continue;
      }

      const x = (this.projectedPosition.x * 0.5 + 0.5) * this.width;
      const y = (-this.projectedPosition.y * 0.5 + 0.5) * this.height - 18;
      const safeTop = this.width <= 720 ? 112 : 76;
      const safeBottom = this.width <= 720 ? 124 : 88;

      if (x < -40 || x > this.width + 40 || y < safeTop || y > this.height - safeBottom) {
        continue;
      }

      const rectangle = this.measureRectangle(candidate.object, x, y, candidate.selected);

      fitRectangleHorizontally(rectangle, this.width);
      if (!candidate.selected && this.overlapsExistingLabel(rectangle)) {
        continue;
      }
      const hovered = candidate.object.id === this.hoveredId;

      if (candidate.object.type === 'star' && candidate.object.id !== 'sun') {
        this.drawAnchor(rectangle, x, y + 18, candidate.selected, hovered);
      }
      this.drawLabel(candidate.object, rectangle, candidate.selected, hovered);
      this.occupiedRectangles.push(rectangle);
      this.hitRegions.push({
        objectId: candidate.object.id,
        rectangle,
      });
      renderedLabels += 1;
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

    if (object.type === 'region') {
      return;
    }
    if (!selected && !isLabelVisibleAtLevel(object, lodLevel)) {
      return;
    }
    const position = readWorldPosition(object.id, this.worldPosition);

    if (!position) {
      return;
    }
    this.candidates.push({
      object,
      distanceSquared: camera.position.distanceToSquared(position),
      priority: getLabelPriority(object),
      selected,
    });
  }

  private clearCanvas(): void {
    this.hitRegions.length = 0;
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
  }

  private measureRectangle(
    object: LabelObject,
    centerX: number,
    baselineY: number,
    selected: boolean,
  ): ScreenRectangle {
    const catalogLabel = isCatalogLabel(object);
    const fontSize = selected ? 13 : object.type === 'galaxy' ? 12 : catalogLabel ? 10 : 11;

    this.context.font = `${selected ? 600 : 500} ${fontSize}px Inter, system-ui, sans-serif`;
    const width =
      Math.min(this.context.measureText(object.name).width, 176) + (catalogLabel ? 16 : 18);
    const height = selected ? 27 : catalogLabel ? 21 : 23;

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
  ): void {
    const width = rectangle.right - rectangle.left;
    const height = rectangle.bottom - rectangle.top;
    const radius = height / 2;
    const catalogLabel = isCatalogLabel(object);

    this.context.beginPath();
    this.context.roundRect(rectangle.left, rectangle.top, width, height, radius);
    this.context.fillStyle =
      selected || hovered
        ? 'rgba(9, 27, 43, 0.92)'
        : catalogLabel
          ? 'rgba(5, 12, 22, 0.48)'
          : 'rgba(5, 9, 18, 0.72)';
    this.context.fill();

    if (selected || hovered) {
      this.context.strokeStyle = hovered ? 'rgba(137, 207, 246, 0.88)' : 'rgba(137, 207, 246, 0.6)';
      this.context.lineWidth = 1;
      this.context.stroke();
    }

    const fontSize = selected ? 13 : object.type === 'galaxy' ? 12 : catalogLabel ? 10 : 11;

    this.context.font = `${selected ? 600 : 500} ${fontSize}px Inter, system-ui, sans-serif`;
    this.context.fillStyle =
      catalogLabel && !selected && !hovered
        ? '#cbd8e7'
        : object.type === 'star'
          ? '#fff5df'
          : '#dce9f8';
    this.context.textAlign = 'center';
    this.context.textBaseline = 'middle';
    this.context.fillText(
      object.name,
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
  ): void {
    const labelX = (rectangle.left + rectangle.right) / 2;
    const emphasized = selected || hovered;

    this.context.beginPath();
    this.context.moveTo(labelX, rectangle.bottom + 2);
    this.context.lineTo(pointX, pointY - 3);
    this.context.strokeStyle = emphasized
      ? 'rgba(124, 205, 248, 0.78)'
      : 'rgba(151, 184, 215, 0.34)';
    this.context.lineWidth = emphasized ? 1.2 : 0.75;
    this.context.stroke();

    this.context.beginPath();
    this.context.arc(pointX, pointY, emphasized ? 2.6 : 1.8, 0, Math.PI * 2);
    this.context.fillStyle = emphasized ? 'rgba(157, 220, 255, 0.96)' : 'rgba(208, 226, 244, 0.72)';
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
}

export function isLabelVisibleAtLevel(object: LabelObject, lodLevel: number): boolean {
  const catalogRecordIndex = object.metadata?.['catalogRecordIndex'];

  if (typeof catalogRecordIndex === 'number') {
    if (lodLevel <= 0) {
      return catalogRecordIndex < 16;
    }
    if (lodLevel === 1) {
      return catalogRecordIndex < 80;
    }
    if (lodLevel === 2) {
      return catalogRecordIndex < DEFAULT_MAXIMUM_CATALOG_LABEL_RANK;
    }
    if (lodLevel === 3) {
      return catalogRecordIndex < 64;
    }

    return false;
  }
  if (object.type === 'galaxy') {
    return object.id === 'milky-way' ? lodLevel >= 3 : lodLevel >= 4;
  }
  if (object.type === 'star' && object.id !== 'sun') {
    return (
      (lodLevel >= 1 && lodLevel <= 2) ||
      (lodLevel === 3 && object.metadata?.['galacticLabel'] === true)
    );
  }

  return lodLevel <= 1;
}

export function getMaximumLabelCount(quality: GraphicQuality, lodLevel: number): number {
  const qualityLimit = quality === 'low' ? 14 : quality === 'medium' ? 26 : 40;
  const lodLimit = lodLevel <= 0 ? 14 : lodLevel === 1 ? 26 : lodLevel === 2 ? 40 : 28;

  return Math.min(qualityLimit, lodLimit);
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

function fitRectangleHorizontally(rectangle: ScreenRectangle, viewportWidth: number): void {
  const margin = 8;
  const leftOverflow = margin - rectangle.left;
  const rightOverflow = rectangle.right - (viewportWidth - margin);
  const offset = leftOverflow > 0 ? leftOverflow : rightOverflow > 0 ? -rightOverflow : 0;

  rectangle.left += offset;
  rectangle.right += offset;
}

function getLabelPriority(object: LabelObject): number {
  const catalogRecordIndex = object.metadata?.['catalogRecordIndex'];

  return typeof catalogRecordIndex === 'number' ? 1_000 + catalogRecordIndex : 0;
}

function isCatalogLabel(object: LabelObject): boolean {
  return typeof object.metadata?.['catalogRecordIndex'] === 'number';
}
