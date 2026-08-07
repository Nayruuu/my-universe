export const EARTH_TERRAIN_HORIZON_SCHEMA = 'universe-map/earth-terrain-horizons@2';
export const EARTH_TERRAIN_HORIZON_BINARY_ENCODING = 'int16-le-centidegrees-distance-band-major';

export type EarthTerrainHorizonDistanceBandId = 'near' | 'mid' | 'far';

export interface EarthTerrainHorizonDistanceBand {
  readonly id: EarthTerrainHorizonDistanceBandId;
  readonly minimumDistanceMeters: number;
  readonly maximumDistanceMeters: number;
}

export interface EarthTerrainHorizonSource {
  readonly id: string;
  readonly title: string;
  readonly productUrl: string;
  readonly dataUrl: string;
  readonly doi: string;
  readonly horizontalDatum: string;
  readonly verticalDatum: string;
  readonly resolutionArcSeconds: number;
}

export interface EarthTerrainHorizonCalculation {
  readonly model: 'spherical-geometric-line-of-sight';
  readonly earthRadiusMeters: number;
  readonly observerEyeHeightMeters: number;
  readonly maximumDistanceMeters: number;
  readonly sampleStepMeters: number;
  readonly azimuthStepDegrees: number;
  readonly distanceBands: readonly EarthTerrainHorizonDistanceBand[];
  readonly atmosphericRefraction: 'excluded';
  readonly terrainInterpolation: 'bilinear';
  readonly locationAnchor: 'catalogued-city-center';
}

export interface EarthTerrainHorizonBinary {
  readonly file: string;
  readonly byteLength: number;
  readonly sha256: string;
  readonly encoding: typeof EARTH_TERRAIN_HORIZON_BINARY_ENCODING;
}

export interface EarthTerrainHorizonManifestProfile {
  readonly locationId: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly observerElevationMeters: number;
  readonly sampleOffset: number;
  readonly sampleCount: number;
}

export interface EarthTerrainHorizonManifest {
  readonly schema: typeof EARTH_TERRAIN_HORIZON_SCHEMA;
  readonly generatedAt: string;
  readonly dataClassification: 'calculated-from-measured-global-relief-model';
  readonly source: EarthTerrainHorizonSource;
  readonly calculation: EarthTerrainHorizonCalculation;
  readonly binary: EarthTerrainHorizonBinary;
  readonly profileCount: number;
  readonly profiles: readonly EarthTerrainHorizonManifestProfile[];
}

export interface EarthTerrainHorizonProfile {
  readonly locationId: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly observerElevationMeters: number;
  readonly azimuthStepDegrees: number;
  readonly distanceLayers: readonly EarthTerrainHorizonDistanceLayer[];
  readonly obstructionAnglesCentidegrees: Int16Array<ArrayBuffer>;
  readonly source: EarthTerrainHorizonSource;
  readonly calculation: EarthTerrainHorizonCalculation;
}

export interface EarthTerrainHorizonDistanceLayer extends EarthTerrainHorizonDistanceBand {
  readonly obstructionAnglesCentidegrees: Int16Array<ArrayBuffer>;
}

export type EarthTerrainHorizonFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type EarthTerrainHorizonDigest = (buffer: ArrayBuffer) => Promise<string>;
