import type { ScreenRectangle } from './label-screen-layout';
import {
  getLabelTextColor,
  isCatalogLabel,
  isSolarSystemLabelAtLevel,
  isSolarSystemPrimaryLabel,
  type LabelObject,
} from './label-visibility-policy';
import { getSolarSystemMapAccent } from './solar-system-map-palette';

export type LabelNameResolver = (objectId: string, fallback: string) => string;

export class LabelCanvasPainter {
  constructor(
    private readonly context: CanvasRenderingContext2D,
    private nameResolver: LabelNameResolver,
  ) {}

  public setNameResolver(resolver: LabelNameResolver): void {
    this.nameResolver = resolver;
  }

  public clear(canvasWidth: number, canvasHeight: number, pixelRatio: number): void {
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    this.context.clearRect(0, 0, canvasWidth, canvasHeight);
    this.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  public measureRectangle(
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

  public drawLabel(
    object: LabelObject,
    rectangle: ScreenRectangle,
    selected: boolean,
    hovered: boolean,
    lodLevel = -1,
    opacity = 1,
  ): void {
    const previousGlobalAlpha = this.context.globalAlpha;

    this.context.globalAlpha = clampOpacity(opacity);
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
    this.context.globalAlpha = previousGlobalAlpha;
  }

  public drawAnchor(
    rectangle: ScreenRectangle,
    pointX: number,
    pointY: number,
    selected: boolean,
    hovered: boolean,
    solarSystemLabel = false,
    opacity = 1,
  ): void {
    const previousGlobalAlpha = this.context.globalAlpha;

    this.context.globalAlpha = clampOpacity(opacity);
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
    this.context.globalAlpha = previousGlobalAlpha;
  }
}

function clampOpacity(opacity: number): number {
  return Math.max(0, Math.min(1, opacity));
}
