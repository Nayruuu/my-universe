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
}

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
  const project = createEarthSkyProjector({
    centerAltitudeDegrees,
    centerAzimuthDegrees,
    verticalFieldOfViewDegrees: observerView?.verticalFieldOfViewDegrees ?? 82,
    width,
    height,
  });

  return bodies.flatMap((body): readonly ProjectedEarthSkyBody[] => {
    if (!body.observation.isAboveHorizon) {
      return [];
    }
    const point = project(body.observation.altitudeDegrees, body.observation.azimuthDegrees);

    return point
      ? [
          {
            ...body,
            xPercent: (point.x / width) * 100,
            yPercent: (point.y / height) * 100,
          },
        ]
      : [];
  });
}

function clampAltitude(value: number): number {
  return Math.max(-89.999, Math.min(89.999, value));
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}
