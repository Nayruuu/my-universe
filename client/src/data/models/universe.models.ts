export type ScientificConfidence =
  'observed' | 'calculated' | 'extrapolated' | 'simulated' | 'procedural' | 'illustrative';

export type SpaceObjectType =
  | 'universe'
  | 'galaxy-cluster'
  | 'galaxy'
  | 'nebula'
  | 'star'
  | 'planet'
  | 'dwarf-planet'
  | 'moon'
  | 'asteroid'
  | 'comet'
  | 'artificial-object'
  | 'region';

export type DistanceUnit =
  | 'meter'
  | 'kilometer'
  | 'astronomical-unit'
  | 'light-year'
  | 'parsec'
  | 'kiloparsec'
  | 'megaparsec';

export type ReferenceFrame = 'solar-system' | 'stellar' | 'galactic' | 'local-group';
export type TemporalMode = 'state' | 'observable';
export type GraphicQuality = 'low' | 'medium' | 'high';
export type GalaxyVisualShape = 'spiral' | 'elliptical' | 'irregular';
export type EphemerisBody =
  'mercury' | 'venus' | 'earth' | 'moon' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune';
export type EphemerisOrigin = 'sun' | 'earth';

export interface UniverseTime {
  julianDay: number;
}

export interface CosmologicalTime {
  yearsFromPresent: number;
}

export interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

export interface Transform64 {
  position: Vector3Like;
  rotation?: {
    x: number;
    y: number;
    z: number;
    w: number;
  };
  scale?: number;
}

export interface PhysicalProperties {
  radiusKm?: number;
  massKg?: number;
  temperatureK?: number;
  luminositySolar?: number;
  spectralType?: string;
}

export interface VisualDefinition {
  color?: string;
  secondaryColor?: string;
  emissiveColor?: string;
  emissiveIntensity?: number;
  visualRadius: number;
  scaleMode: 'physical' | 'exaggerated' | 'adaptive';
  atmosphereColor?: string;
  hasRings?: boolean;
  rotationPeriodHours?: number;
  galaxyShape?: GalaxyVisualShape;
  galaxyAxisRatio?: number;
  galaxyRotationDegrees?: number;
}

export type PositionProviderDefinition =
  | {
      type: 'static';
      position: [number, number, number];
      unit: DistanceUnit;
    }
  | {
      type: 'keplerian';
      semiMajorAxis: number;
      eccentricity: number;
      inclination: number;
      longitudeOfAscendingNode: number;
      argumentOfPeriapsis: number;
      meanAnomalyAtEpoch: number;
      epochJulianDay: number;
      orbitalPeriodDays: number;
      unit: DistanceUnit;
    }
  | {
      type: 'ephemeris';
      body: EphemerisBody;
      origin: EphemerisOrigin;
      orbitalPeriodDays: number;
      orbitEpochJulianDay: number;
      distanceScale?: number;
    }
  | {
      type: 'linear-motion';
      positionAtEpoch: [number, number, number];
      velocityPerDay: [number, number, number];
      epochJulianDay: number;
      unit: DistanceUnit;
    }
  | {
      type: 'procedural';
      generatorId: string;
      seed: number;
    };

export interface LodLevel {
  minScreenSize: number;
  maxScreenSize?: number;
  representationId: string;
}

export interface LodObjectDefinition {
  id: string;
  levels: LodLevel[];
}

export interface SpaceObject {
  id: string;
  name: string;
  aliases?: string[];
  type: SpaceObjectType;
  parentId?: string;
  referenceFrame: ReferenceFrame;
  scientificConfidence: ScientificConfidence;
  description?: string;
  referenceEpoch?: number;
  physical?: PhysicalProperties;
  visual: VisualDefinition;
  positionProvider: PositionProviderDefinition;
  lod?: LodObjectDefinition;
  metadata?: Record<string, string | number | boolean>;
}

export interface SearchEntry {
  id: string;
  name: string;
  aliases: readonly string[];
  type: SpaceObjectType;
  parentName?: string;
  keywords?: readonly string[];
}

export interface UniverseDataset {
  version: string;
  objects: SpaceObject[];
}

export type DatasetManifestEntry =
  | {
      id: string;
      url: string;
      type: 'json';
    }
  | {
      id: string;
      url: string;
      type: 'binary';
      format: 'star-catalog-v2';
    };

export interface DatasetManifest {
  version: string;
  datasets: DatasetManifestEntry[];
}

export interface DisplayOptions {
  showOrbits: boolean;
  showLabels: boolean;
  quality: GraphicQuality;
  temporalMode: TemporalMode;
}

export interface EngineDebugStats {
  fps: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  visibleObjects: number;
  catalogStars: number;
  cameraPosition: Vector3Like;
  cameraDistance: number;
  floatingOrigin: Vector3Like;
  targetId: string | null;
  lodLevel: number;
  julianDay: number;
  quality: GraphicQuality;
}

export interface SolarEclipseState {
  phase: 'none' | 'partial' | 'annular' | 'total';
  centralLatitude: number | null;
  centralLongitude: number | null;
}

export type UniverseEngineEvent =
  | {
      type: 'data-ready';
      objects: readonly SpaceObject[];
      catalogEntries: readonly SearchEntry[];
    }
  | {
      type: 'object-selected';
      objectId: string | null;
      object: SpaceObject | null;
    }
  | { type: 'target-changed'; objectId: string | null }
  | { type: 'camera-changed'; zoom: number }
  | { type: 'time-changed'; time: UniverseTime }
  | { type: 'solar-eclipse-state'; state: SolarEclipseState }
  | { type: 'lod-changed'; level: number }
  | { type: 'loading-state'; loading: boolean }
  | { type: 'performance-warning'; message: string }
  | { type: 'debug-stats'; stats: EngineDebugStats }
  | { type: 'error'; message: string };

export interface NavigationState {
  targetId: string | null;
  selectedId: string | null;
  julianDay: number;
  zoom: number;
  mode: TemporalMode;
  quality: GraphicQuality;
  showOrbits: boolean;
  showLabels: boolean;
}

export interface TimeSpeedOption {
  id: string;
  label: string;
  daysPerSecond: number;
}
