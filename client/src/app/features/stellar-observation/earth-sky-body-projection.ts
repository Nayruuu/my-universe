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

const REFERENCE_FIELD_OF_VIEW_DEGREES = 82;
const MINIMUM_FIELD_OF_VIEW_DEGREES = 2;

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

function clampAltitude(value: number): number {
  return Math.max(-89.999, Math.min(89.999, value));
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
