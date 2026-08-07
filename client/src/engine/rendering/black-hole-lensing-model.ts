import * as THREE from 'three';
import { GraphicQuality, type SpaceObject } from '../../data/models/universe.models';
import { calculateApparentRadiusPixels } from '../lod/screen-space-lod';

export interface BlackHoleLensingEffect {
  readonly objectId: string;
  readonly centerX: number;
  readonly centerY: number;
  readonly coreRadius: number;
  readonly einsteinRadius: number;
  readonly influenceRadius: number;
  readonly foregroundScale: number;
  readonly strength: number;
  readonly scientificConfidence: 'illustrative';
}

const MINIMUM_CORE_RADIUS_PIXELS = 12;
const MAXIMUM_CORE_RADIUS = 0.16;
const MAXIMUM_INFLUENCE_RADIUS = 0.48;
const EINSTEIN_RADIUS_SCALE = 1.68;
const MAXIMUM_EINSTEIN_INFLUENCE_RATIO = 0.72;
const LENSING_RESPONSE = 12;

const QUALITY_PROFILE = {
  low: { strength: 0, influenceScale: 0, captureSize: 1 },
  medium: {
    strength: 0.78,
    influenceScale: 4.2,
    captureSize: 768,
  },
  high: {
    strength: 0.96,
    influenceScale: 4.8,
    captureSize: 1_024,
  },
} as const satisfies Record<
  GraphicQuality,
  {
    strength: number;
    influenceScale: number;
    captureSize: number;
  }
>;

export function projectBlackHoleLensing(
  object: SpaceObject | undefined,
  worldPosition: THREE.Vector3 | null,
  camera: THREE.PerspectiveCamera,
  viewportWidth: number,
  viewportHeight: number,
  quality: GraphicQuality,
): BlackHoleLensingEffect | null {
  if (
    object?.type !== 'black-hole' ||
    worldPosition === null ||
    quality === 'low' ||
    viewportWidth <= 0 ||
    viewportHeight <= 0
  ) {
    return null;
  }

  const cameraDirection = camera.getWorldDirection(new THREE.Vector3());
  const cameraToObject = worldPosition.clone().sub(camera.position);

  if (cameraToObject.dot(cameraDirection) <= 0) {
    return null;
  }
  const distance = cameraToObject.length();
  const apparentRadiusPixels = calculateApparentRadiusPixels(
    object.visual.visualRadius,
    distance,
    viewportHeight,
    camera.fov,
  );

  if (apparentRadiusPixels < MINIMUM_CORE_RADIUS_PIXELS) {
    return null;
  }

  const projected = worldPosition.clone().project(camera);
  const profile = QUALITY_PROFILE[quality];
  const apparentCoreRadius = apparentRadiusPixels / viewportHeight;
  const coreRadius = Math.min(apparentCoreRadius, MAXIMUM_CORE_RADIUS);
  const influenceRadius = Math.min(
    (apparentRadiusPixels * profile.influenceScale) / viewportHeight,
    MAXIMUM_INFLUENCE_RADIUS,
  );
  const einsteinRadius = Math.min(
    coreRadius * EINSTEIN_RADIUS_SCALE,
    influenceRadius * MAXIMUM_EINSTEIN_INFLUENCE_RATIO,
  );
  const centerX = (projected.x + 1) * 0.5;
  const centerY = (projected.y + 1) * 0.5;

  if (
    projected.z < -1 ||
    projected.z > 1 ||
    centerX < -influenceRadius ||
    centerX > 1 + influenceRadius ||
    centerY < -influenceRadius ||
    centerY > 1 + influenceRadius
  ) {
    return null;
  }

  return {
    objectId: object.id,
    centerX,
    centerY,
    coreRadius,
    einsteinRadius,
    influenceRadius,
    foregroundScale: Math.min(1, coreRadius / apparentCoreRadius),
    strength: profile.strength,
    scientificConfidence: 'illustrative',
  };
}

export function dampLensingStrength(current: number, target: number, deltaSeconds: number): number {
  if (deltaSeconds <= 0) {
    return current;
  }

  return current + (target - current) * (1 - Math.exp(-LENSING_RESPONSE * deltaSeconds));
}

export function calculateThinLensSourceRadius(
  distanceToLens: number,
  coreRadius: number,
  einsteinRadius: number,
): number {
  const safeDistance = Math.max(distanceToLens, coreRadius * 0.92);

  return safeDistance - (einsteinRadius * einsteinRadius) / Math.max(safeDistance, 0.0001);
}

export function calculateFullColorLensingColor(
  originalColor: readonly [number, number, number],
  lensedColor: readonly [number, number, number],
  distortionMask: number,
): [number, number, number] {
  const mask = THREE.MathUtils.clamp(distortionMask, 0, 1);

  return originalColor.map((channel, index) => {
    return THREE.MathUtils.clamp(THREE.MathUtils.lerp(channel, lensedColor[index]!, mask), 0, 1);
  }) as [number, number, number];
}

export function blackHoleLensingCaptureSize(quality: GraphicQuality): number {
  return QUALITY_PROFILE[quality].captureSize;
}
