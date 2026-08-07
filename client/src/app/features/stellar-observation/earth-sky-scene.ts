import type { UniverseTime } from '../../../data/models/universe.models';
import { createEarthSkyProjector } from '../../../engine/coordinates/earth-sky-perspective';
import type { EarthObserverLocation } from '../../../engine/simulation/earth-observer-location';
import { createStellarObservationCalculator } from '../../../engine/simulation/stellar-observation';
import type { StellarObservationConstellation } from '../../../engine/simulation/stellar-observation';
import type { EarthSkyCatalogStar } from './earth-sky-catalog';
import type { EarthSkyViewpoint } from './earth-sky-navigation';
import { earthSkyAppearanceForMagnitude } from './earth-sky-photometry';

export interface EarthSkySceneInput {
  readonly catalog: readonly EarthSkyCatalogStar[];
  readonly target: EarthSkyCatalogStar;
  readonly time: UniverseTime;
  readonly location: EarthObserverLocation;
  readonly width: number;
  readonly height: number;
  readonly verticalFieldOfViewDegrees: number;
  readonly viewpoint?: EarthSkyViewpoint | null;
  readonly constellations?: readonly StellarObservationConstellation[];
  readonly showConstellations?: boolean;
  readonly showLabels?: boolean;
}

export interface EarthSkySprite {
  readonly id: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly depth: number;
  readonly radius: number;
  readonly opacity: number;
  readonly haloOpacity: number;
  readonly color: string;
  readonly showLabel: boolean;
}

export interface EarthSkyTargetMarker {
  readonly x: number;
  readonly y: number;
  readonly altitudeDegrees: number;
  readonly azimuthDegrees: number;
  readonly isAboveHorizon: boolean;
  readonly isInView: boolean;
}

export interface EarthSkyLineSegment {
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
}

export interface EarthSkyConstellationStroke {
  readonly id: string;
  readonly name: string;
  readonly abbreviation: string;
  readonly segments: readonly EarthSkyLineSegment[];
  readonly labelX: number;
  readonly labelY: number;
  readonly highlighted: boolean;
  readonly showLabel: boolean;
}

export interface EarthSkyScene {
  readonly width: number;
  readonly height: number;
  readonly centerAltitudeDegrees: number;
  readonly centerAzimuthDegrees: number;
  readonly verticalFieldOfViewDegrees: number;
  readonly horizonY: number;
  readonly target: EarthSkyTargetMarker;
  readonly stars: readonly EarthSkySprite[];
  readonly constellations: readonly EarthSkyConstellationStroke[];
}

export function createEarthSkyScene(input: EarthSkySceneInput): EarthSkyScene | null {
  const calculateObservation = createStellarObservationCalculator(input.time, input.location);

  if (calculateObservation === null) {
    return null;
  }
  const targetObservation = calculateObservation(input.target.coordinates);
  const centerAltitudeDegrees =
    input.viewpoint?.centerAltitudeDegrees ??
    (targetObservation.isAboveHorizon ? targetObservation.altitudeDegrees : 5);
  const centerAzimuthDegrees =
    input.viewpoint?.centerAzimuthDegrees ?? targetObservation.azimuthDegrees;
  const verticalFieldOfViewDegrees =
    input.viewpoint?.verticalFieldOfViewDegrees ?? input.verticalFieldOfViewDegrees;
  const project = createEarthSkyProjector({
    centerAltitudeDegrees,
    centerAzimuthDegrees,
    verticalFieldOfViewDegrees,
    width: input.width,
    height: input.height,
  });
  const horizonPoint = project(0, centerAzimuthDegrees);
  const projectedTarget = targetObservation.isAboveHorizon
    ? project(targetObservation.altitudeDegrees, targetObservation.azimuthDegrees)
    : null;
  const targetPoint = projectedTarget ?? horizonPoint ?? { x: -1, y: -1, depth: 0 };
  const stars: EarthSkySprite[] = [];

  if (targetObservation.isAboveHorizon && projectedTarget) {
    stars.push(createStarSprite(input.target, projectedTarget, false));
  }

  for (const star of input.catalog) {
    if (star.id === input.target.id) {
      continue;
    }
    const observation = calculateObservation(star.coordinates);

    if (!observation.isAboveHorizon) {
      continue;
    }
    const point = project(observation.altitudeDegrees, observation.azimuthDegrees);

    if (point === null) {
      continue;
    }
    stars.push(
      createStarSprite(star, point, (input.showLabels ?? true) && star.apparentMagnitude <= 0.5),
    );
  }
  const constellations =
    input.showConstellations === false
      ? []
      : createConstellationStrokes(
          input.constellations ?? [],
          input.target,
          calculateObservation,
          project,
          input.showLabels ?? true,
        );

  return {
    width: input.width,
    height: input.height,
    centerAltitudeDegrees,
    centerAzimuthDegrees,
    verticalFieldOfViewDegrees,
    horizonY: horizonPoint?.y ?? input.height + 1,
    target: {
      x: targetPoint.x,
      y: targetPoint.y,
      altitudeDegrees: targetObservation.altitudeDegrees,
      azimuthDegrees: targetObservation.azimuthDegrees,
      isAboveHorizon: targetObservation.isAboveHorizon,
      isInView: projectedTarget !== null,
    },
    stars,
    constellations,
  };
}

function createConstellationStrokes(
  constellations: readonly StellarObservationConstellation[],
  target: EarthSkyCatalogStar,
  calculateObservation: NonNullable<ReturnType<typeof createStellarObservationCalculator>>,
  project: ReturnType<typeof createEarthSkyProjector>,
  showLabels: boolean,
): EarthSkyConstellationStroke[] {
  return constellations.flatMap((constellation): readonly EarthSkyConstellationStroke[] => {
    const segments: EarthSkyLineSegment[] = [];
    const labelPoints: { readonly x: number; readonly y: number }[] = [];
    let highlighted = false;

    for (const segment of constellation.segments) {
      highlighted ||= segment.from.id === target.id || segment.to.id === target.id;
      const fromObservation = calculateObservation(segment.from.coordinates);
      const toObservation = calculateObservation(segment.to.coordinates);

      if (!fromObservation.isAboveHorizon || !toObservation.isAboveHorizon) {
        continue;
      }
      const from = project(fromObservation.altitudeDegrees, fromObservation.azimuthDegrees);
      const to = project(toObservation.altitudeDegrees, toObservation.azimuthDegrees);

      if (!from || !to) {
        continue;
      }
      segments.push({ fromX: from.x, fromY: from.y, toX: to.x, toY: to.y });
      labelPoints.push(from, to);
    }
    if (segments.length === 0) {
      return [];
    }
    const labelX = average(labelPoints.map(({ x }) => x));
    const labelY = average(labelPoints.map(({ y }) => y));

    return [
      {
        id: constellation.id,
        name: constellation.name,
        abbreviation: constellation.abbreviation,
        segments,
        labelX,
        labelY,
        highlighted,
        showLabel: showLabels && (highlighted || segments.length >= 3),
      },
    ];
  });
}

function createStarSprite(
  star: EarthSkyCatalogStar,
  point: { readonly x: number; readonly y: number; readonly depth: number },
  showLabel: boolean,
): EarthSkySprite {
  const appearance = earthSkyAppearanceForMagnitude(star.apparentMagnitude);

  return {
    id: star.id,
    name: star.name,
    x: point.x,
    y: point.y,
    depth: point.depth,
    ...appearance,
    color: star.color,
    showLabel,
  };
}

function average(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}
