import { createEarthSkyProjector } from '../../../engine/coordinates/earth-sky-perspective';
import type { EarthObserverViewState } from '../../../engine/camera/earth-observer-camera-control';
import type { SolarSystemSkyObservation } from '../../../engine/simulation/solar-system-sky';
import type { StellarObservation } from '../../../engine/simulation/stellar-observation';

export interface EarthSkyViewport {
  readonly width: number;
  readonly height: number;
}

export interface ProjectedEarthSkyBody extends SolarSystemSkyObservation {
  readonly xPercent: number;
  readonly yPercent: number;
  readonly apparentDiameterPixels: number;
  readonly displayDiameterPixels: number;
  readonly displayScaleMode: 'calculated-angular-size-with-illustrative-readability-floor';
  readonly resolvedAppearance: boolean;
}

export type EarthSkyBodyLabelPlacement = 'above' | 'below' | 'left' | 'right';

export interface EarthSkyBodyLabelLayout {
  readonly labelOffsetXPixels: number;
  readonly labelOffsetYPixels: number;
  readonly labelPlacement: EarthSkyBodyLabelPlacement;
  readonly labelVisible: boolean;
}

interface EarthSkyBodyWithLabel extends ProjectedEarthSkyBody {
  readonly name: string;
}

interface LabelRectangle {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

interface LabelCandidate extends EarthSkyBodyLabelLayout {
  readonly rectangle: LabelRectangle;
}

const REFERENCE_FIELD_OF_VIEW_DEGREES = 82;
const MINIMUM_FIELD_OF_VIEW_DEGREES = 2;
const LABEL_CHARACTER_WIDTH_PIXELS = 7;
const LABEL_HORIZONTAL_PADDING_PIXELS = 14;
const LABEL_HEIGHT_PIXELS = 20;
const LABEL_MARKER_GAP_PIXELS = 6;
const LABEL_COLLISION_GAP_PIXELS = 4;
const LABEL_VIEWPORT_MARGIN_PIXELS = 4;
const LABEL_LANE_COUNT = 6;

export function projectEarthSkyBodies(
  bodies: readonly SolarSystemSkyObservation[],
  target: StellarObservation,
  observerView: EarthObserverViewState | null,
  viewport: EarthSkyViewport,
): readonly ProjectedEarthSkyBody[] {
  const width = Math.max(1, viewport.width);
  const height = Math.max(1, viewport.height);
  const centerAltitudeDegrees = clampAltitude(
    observerView?.centerAltitudeDegrees ??
      target.geometricAltitudeDegrees + (observerView?.pitchOffsetDegrees ?? 0),
  );
  // The observer control reports its horizontal turn in the same eastward-positive convention
  // as astronomical azimuth. Keeping both projections on that shared center makes planets,
  // labels, and catalog stars travel together while the observer looks around.
  const centerAzimuthDegrees = normalizeDegrees(
    observerView?.centerAzimuthDegrees ??
      target.azimuthDegrees + (observerView?.azimuthOffsetDegrees ?? 0),
  );
  const verticalFieldOfViewDegrees = observerView?.verticalFieldOfViewDegrees ?? 82;
  const project = createEarthSkyProjector({
    centerAltitudeDegrees,
    centerAzimuthDegrees,
    verticalFieldOfViewDegrees,
    width,
    height,
  });

  return bodies.flatMap((body): readonly ProjectedEarthSkyBody[] => {
    if (!body.observation.isAboveHorizon) {
      return [];
    }
    const point = project(body.observation.altitudeDegrees, body.observation.azimuthDegrees);
    const apparentDiameterPixels = calculateAngularDiameterPixels(
      body.angularDiameterDegrees,
      verticalFieldOfViewDegrees,
      height,
    );
    const appearance = calculateBodyDisplayAppearance(
      body.angularSizeClass,
      apparentDiameterPixels,
      verticalFieldOfViewDegrees,
    );

    return point
      ? [
          {
            ...body,
            xPercent: (point.x / width) * 100,
            yPercent: (point.y / height) * 100,
            apparentDiameterPixels,
            displayDiameterPixels: appearance.displayDiameterPixels,
            displayScaleMode: 'calculated-angular-size-with-illustrative-readability-floor',
            resolvedAppearance: appearance.resolvedAppearance,
          },
        ]
      : [];
  });
}

/**
 * Places the DOM labels around their exact projected anchors. The astronomical body coordinates
 * never move: only a label offset is selected, and lower-priority labels are suppressed when a
 * crowded planetary system cannot provide a collision-free slot.
 */
export function layoutEarthSkyBodyLabels<T extends EarthSkyBodyWithLabel>(
  bodies: readonly T[],
  viewport: EarthSkyViewport,
  priorityObjectIds: readonly (string | null | undefined)[] = [],
): readonly (T & EarthSkyBodyLabelLayout)[] {
  const width = Math.max(1, viewport.width);
  const height = Math.max(1, viewport.height);
  const priorityIds = new Set(
    priorityObjectIds.filter((objectId): objectId is string => Boolean(objectId)),
  );
  const indexedBodies = bodies.map((body, index) => ({ body, index }));
  const orderedBodies = [...indexedBodies].sort(
    (first, second) =>
      labelPriority(first.body, priorityIds) - labelPriority(second.body, priorityIds) ||
      second.body.displayDiameterPixels - first.body.displayDiameterPixels ||
      first.index - second.index,
  );
  const markerRectangles = indexedBodies.map(({ body }) =>
    bodyMarkerRectangle(body, width, height),
  );
  const occupiedLabelRectangles: LabelRectangle[] = [];
  const layouts: (EarthSkyBodyLabelLayout | undefined)[] = Array.from({ length: bodies.length });

  for (const { body, index } of orderedBodies) {
    const candidates = createLabelCandidates(body, width, height);
    const candidate = candidates.find(
      ({ rectangle }) =>
        isInsideViewport(rectangle, width, height) &&
        !occupiedLabelRectangles.some((occupied) => labelsOverlap(rectangle, occupied)) &&
        !markerRectangles.some(
          (marker, markerIndex) => markerIndex !== index && rectanglesOverlap(rectangle, marker),
        ),
    );
    const fallback =
      candidates.find(({ rectangle }) => isInsideViewport(rectangle, width, height)) ??
      candidates[0]!;

    layouts[index] = candidate
      ? {
          labelOffsetXPixels: candidate.labelOffsetXPixels,
          labelOffsetYPixels: candidate.labelOffsetYPixels,
          labelPlacement: candidate.labelPlacement,
          labelVisible: true,
        }
      : {
          labelOffsetXPixels: fallback.labelOffsetXPixels,
          labelOffsetYPixels: fallback.labelOffsetYPixels,
          labelPlacement: fallback.labelPlacement,
          labelVisible: false,
        };
    if (candidate) {
      occupiedLabelRectangles.push(candidate.rectangle);
    }
  }

  return bodies.map((body, index) => ({ ...body, ...layouts[index]! }));
}

export function calculateAngularDiameterPixels(
  angularDiameterDegrees: number,
  verticalFieldOfViewDegrees: number,
  viewportHeight: number,
): number {
  const angularRadiusRadians = (angularDiameterDegrees * Math.PI) / 360;
  const fieldOfViewRadiusRadians = (verticalFieldOfViewDegrees * Math.PI) / 360;

  return viewportHeight * (Math.tan(angularRadiusRadians) / Math.tan(fieldOfViewRadiusRadians));
}

function calculateBodyDisplayAppearance(
  sizeClass: SolarSystemSkyObservation['angularSizeClass'],
  apparentDiameterPixels: number,
  verticalFieldOfViewDegrees: number,
): { readonly displayDiameterPixels: number; readonly resolvedAppearance: boolean } {
  const zoomProgress = clamp(
    Math.log(REFERENCE_FIELD_OF_VIEW_DEGREES / verticalFieldOfViewDegrees) /
      Math.log(REFERENCE_FIELD_OF_VIEW_DEGREES / MINIMUM_FIELD_OF_VIEW_DEGREES),
    0,
    1,
  );
  const initialFloor = sizeClass === 'moon' ? 34 : sizeClass === 'stellar' ? 4 : 7;
  const resolvedFloor = sizeClass === 'moon' ? 34 : sizeClass === 'stellar' ? 16 : 32;
  const readabilityMagnification =
    sizeClass === 'moon' ? 1 : 1 + zoomProgress * (sizeClass === 'stellar' ? 3 : 5);
  const maximumDiameter = sizeClass === 'moon' ? 320 : sizeClass === 'stellar' ? 48 : 96;
  const displayDiameterPixels = Math.min(
    maximumDiameter,
    Math.max(
      initialFloor + (resolvedFloor - initialFloor) * zoomProgress,
      apparentDiameterPixels * readabilityMagnification,
    ),
  );

  return {
    displayDiameterPixels: Math.round(displayDiameterPixels * 100) / 100,
    resolvedAppearance:
      sizeClass === 'moon' || (zoomProgress >= 0.18 && displayDiameterPixels >= 8),
  };
}

function labelPriority(body: EarthSkyBodyWithLabel, priorityIds: ReadonlySet<string>): number {
  if (priorityIds.has(body.id)) {
    return 0;
  }

  return body.skyObjectKind === 'moon' ? 1 : body.skyObjectKind === 'planet' ? 2 : 3;
}

function createLabelCandidates(
  body: EarthSkyBodyWithLabel,
  viewportWidth: number,
  viewportHeight: number,
): readonly LabelCandidate[] {
  const anchorX = (body.xPercent / 100) * viewportWidth;
  const anchorY = (body.yPercent / 100) * viewportHeight;
  const labelWidth =
    [...body.name].length * LABEL_CHARACTER_WIDTH_PIXELS + LABEL_HORIZONTAL_PADDING_PIXELS;
  const markerRadius = Math.max(24, body.displayDiameterPixels) / 2;
  const horizontalOffset = markerRadius + LABEL_MARKER_GAP_PIXELS + labelWidth / 2;
  const verticalOffset = markerRadius + LABEL_MARKER_GAP_PIXELS + LABEL_HEIGHT_PIXELS / 2;
  const verticalStep = LABEL_HEIGHT_PIXELS + LABEL_COLLISION_GAP_PIXELS;
  const candidates: LabelCandidate[] = [];
  const add = (
    labelOffsetXPixels: number,
    labelOffsetYPixels: number,
    labelPlacement: EarthSkyBodyLabelPlacement,
  ): void => {
    const centerX = anchorX + labelOffsetXPixels;
    const centerY = anchorY + labelOffsetYPixels;

    candidates.push({
      labelOffsetXPixels,
      labelOffsetYPixels,
      labelPlacement,
      labelVisible: true,
      rectangle: {
        left: centerX - labelWidth / 2,
        top: centerY - LABEL_HEIGHT_PIXELS / 2,
        right: centerX + labelWidth / 2,
        bottom: centerY + LABEL_HEIGHT_PIXELS / 2,
      },
    });
  };
  const addVerticalPair = (lane: number): void => {
    const laneOffset = lane * verticalStep;

    if (body.skyObjectKind === 'moon') {
      add(0, -verticalOffset - laneOffset, 'above');
      add(0, verticalOffset + laneOffset, 'below');
    } else {
      add(0, verticalOffset + laneOffset, 'below');
      add(0, -verticalOffset - laneOffset, 'above');
    }
  };

  addVerticalPair(0);
  add(horizontalOffset, 0, 'right');
  add(-horizontalOffset, 0, 'left');
  for (let lane = 1; lane <= LABEL_LANE_COUNT; lane += 1) {
    addVerticalPair(lane);
    add(horizontalOffset, lane * verticalStep, 'right');
    add(-horizontalOffset, lane * verticalStep, 'left');
    add(horizontalOffset, -lane * verticalStep, 'right');
    add(-horizontalOffset, -lane * verticalStep, 'left');
  }

  return candidates;
}

function bodyMarkerRectangle(
  body: EarthSkyBodyWithLabel,
  viewportWidth: number,
  viewportHeight: number,
): LabelRectangle {
  const radius = Math.max(24, body.displayDiameterPixels) / 2;
  const centerX = (body.xPercent / 100) * viewportWidth;
  const centerY = (body.yPercent / 100) * viewportHeight;

  return {
    left: centerX - radius,
    top: centerY - radius,
    right: centerX + radius,
    bottom: centerY + radius,
  };
}

function isInsideViewport(
  rectangle: LabelRectangle,
  viewportWidth: number,
  viewportHeight: number,
): boolean {
  return (
    rectangle.left >= LABEL_VIEWPORT_MARGIN_PIXELS &&
    rectangle.top >= LABEL_VIEWPORT_MARGIN_PIXELS &&
    rectangle.right <= viewportWidth - LABEL_VIEWPORT_MARGIN_PIXELS &&
    rectangle.bottom <= viewportHeight - LABEL_VIEWPORT_MARGIN_PIXELS
  );
}

function labelsOverlap(first: LabelRectangle, second: LabelRectangle): boolean {
  return (
    first.left < second.right + LABEL_COLLISION_GAP_PIXELS &&
    first.right + LABEL_COLLISION_GAP_PIXELS > second.left &&
    first.top < second.bottom + LABEL_COLLISION_GAP_PIXELS &&
    first.bottom + LABEL_COLLISION_GAP_PIXELS > second.top
  );
}

function rectanglesOverlap(first: LabelRectangle, second: LabelRectangle): boolean {
  return (
    first.left < second.right &&
    first.right > second.left &&
    first.top < second.bottom &&
    first.bottom > second.top
  );
}

function clampAltitude(value: number): number {
  return Math.max(-89.999, Math.min(89.999, value));
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
