import type {
  EarthTerrainHorizonDistanceBandId,
  EarthTerrainHorizonProfile,
} from './earth-terrain-horizon-catalog.types';
import {
  earthTerrainDistanceLayerObstructionDegrees,
  earthTerrainObstructionDegrees,
} from './earth-terrain-horizon-catalog';
import type { EarthHorizonPerspective } from './earth-horizon-profile';

export interface ProjectedEarthTerrainHorizon {
  readonly heightPixels: number;
  readonly distanceLayers: readonly ProjectedEarthTerrainDistanceLayer[];
  readonly path: string;
  readonly ridgePath: string;
  readonly viewBox: string;
}

export interface ProjectedEarthTerrainDistanceLayer {
  readonly id: EarthTerrainHorizonDistanceBandId;
  readonly minimumDistanceMeters: number;
  readonly maximumDistanceMeters: number;
  readonly path: string;
  readonly ridgePath: string;
}

const PROJECTION_WIDTH = 1_024;
const MINIMUM_PROJECTION_HEIGHT = 180;
const RIDGE_EFFECT_PADDING = 16;
const MINIMUM_SEGMENTS = 64;
const MAXIMUM_SEGMENTS = 512;

export function projectEarthTerrainHorizon(
  profile: EarthTerrainHorizonProfile,
  perspective: EarthHorizonPerspective,
): ProjectedEarthTerrainHorizon {
  const viewportWidth = Math.max(1, perspective.viewport.width);
  const viewportHeight = Math.max(1, perspective.viewport.height);
  const verticalFieldOfViewDegrees = Math.min(
    160,
    Math.max(1, perspective.verticalFieldOfViewDegrees),
  );
  const verticalTangent = Math.tan(degreesToRadians(verticalFieldOfViewDegrees) / 2);
  const horizontalTangent = verticalTangent * (viewportWidth / viewportHeight);
  const horizontalFieldOfViewDegrees = radiansToDegrees(2 * Math.atan(horizontalTangent));
  const segments = Math.min(
    MAXIMUM_SEGMENTS,
    Math.max(
      MINIMUM_SEGMENTS,
      Math.ceil(horizontalFieldOfViewDegrees / profile.azimuthStepDegrees) * 2,
    ),
  );
  const pixelsPerAltitudeDegree = viewportHeight / verticalFieldOfViewDegrees;
  const projectedSamples: Array<{
    readonly x: number;
    readonly obstructionDegrees: number;
    readonly distanceLayerObstructionDegrees: readonly number[];
  }> = [];

  for (let segment = 0; segment <= segments; segment += 1) {
    const x = (segment / segments) * PROJECTION_WIDTH;
    const normalizedX = (x / PROJECTION_WIDTH) * 2 - 1;
    const relativeAzimuthDegrees = radiansToDegrees(Math.atan(normalizedX * horizontalTangent));
    const obstructionDegrees = earthTerrainObstructionDegrees(
      profile,
      perspective.centerAzimuthDegrees + relativeAzimuthDegrees,
    );

    projectedSamples.push({
      x,
      obstructionDegrees,
      distanceLayerObstructionDegrees: profile.distanceLayers.map((layer) =>
        earthTerrainDistanceLayerObstructionDegrees(
          profile,
          layer,
          perspective.centerAzimuthDegrees + relativeAzimuthDegrees,
        ),
      ),
    });
  }
  const maximumProjectedHeight = projectedSamples.reduce(
    (maximum, sample) => Math.max(maximum, sample.obstructionDegrees * pixelsPerAltitudeDegree),
    0,
  );
  const projectionHeight = Math.min(
    viewportHeight,
    Math.max(
      Math.min(MINIMUM_PROJECTION_HEIGHT, viewportHeight),
      Math.ceil(maximumProjectedHeight) + RIDGE_EFFECT_PADDING,
    ),
  );
  const obstructionPaths = pathsForObstructions(
    projectedSamples.map((sample) => ({
      x: sample.x,
      obstructionDegrees: sample.obstructionDegrees,
    })),
  );
  const distanceLayers = profile.distanceLayers
    .map((layer, layerIndex) => ({
      id: layer.id,
      minimumDistanceMeters: layer.minimumDistanceMeters,
      maximumDistanceMeters: layer.maximumDistanceMeters,
      ...pathsForObstructions(
        projectedSamples.map((sample) => ({
          x: sample.x,
          obstructionDegrees: sample.distanceLayerObstructionDegrees[layerIndex]!,
        })),
      ),
    }))
    .reverse();

  return {
    heightPixels: projectionHeight,
    distanceLayers,
    path: obstructionPaths.path,
    ridgePath: obstructionPaths.ridgePath,
    viewBox: `0 0 ${PROJECTION_WIDTH} ${projectionHeight}`,
  };

  function pathsForObstructions(
    samples: readonly { readonly x: number; readonly obstructionDegrees: number }[],
  ): { readonly path: string; readonly ridgePath: string } {
    const ridgeCommands = samples.map((sample, index) => {
      const command = index === 0 ? 'M' : 'L';

      return `${command} ${format(sample.x)} ${terrainY(sample.obstructionDegrees)}`;
    });
    const areaCommands = [
      `M 0 ${projectionHeight}`,
      ...ridgeCommands.map((command, index) =>
        index === 0 ? command.replace(/^M/u, 'L') : command,
      ),
      `L ${PROJECTION_WIDTH} ${projectionHeight}`,
      'Z',
    ];

    return { path: areaCommands.join(' '), ridgePath: ridgeCommands.join(' ') };
  }

  function terrainY(obstructionDegrees: number): string {
    return format(Math.max(0, projectionHeight - obstructionDegrees * pixelsPerAltitudeDegree));
  }
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

function format(value: number): string {
  return value.toFixed(3);
}
