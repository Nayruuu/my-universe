export type ScientificConfidence =
  'observed' | 'calculated' | 'extrapolated' | 'simulated' | 'procedural' | 'illustrative';

export type SpaceObjectType =
  | 'universe'
  | 'galaxy-cluster'
  | 'galaxy'
  | 'black-hole'
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

export type ReferenceFrame =
  'solar-system' | 'stellar' | 'galactic' | 'local-group' | 'nearby-universe' | 'cosmic-web';
export type TemporalMode = 'state' | 'observable';
export type GraphicQuality = 'low' | 'medium' | 'high';
export type LabelDensity = 'minimal' | 'balanced' | 'dense';
export type GalaxyVisualShape = 'spiral' | 'elliptical' | 'irregular';
export type BlackHoleActivity = 'dormant' | 'quiescent' | 'active';
export type JovianMoon = 'io' | 'europa' | 'ganymede' | 'callisto';
export type EphemerisBody =
  | 'mercury'
  | 'venus'
  | 'earth'
  | 'moon'
  | 'mars'
  | 'jupiter'
  | 'saturn'
  | 'uranus'
  | 'neptune'
  | 'pluto'
  | JovianMoon;
export type EphemerisOrigin = 'sun' | 'earth' | 'jupiter';

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
  blackHoleActivity?: BlackHoleActivity;
  accretionDiskInclinationDegrees?: number;
}

export type PositionProviderDefinition =
  | {
      type: 'static';
      position: [number, number, number];
      unit: DistanceUnit;
    }
  | {
      type: 'catalog';
      catalogId: string;
      identifier: string;
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
      distanceScale?: number;
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

export interface SpaceTileBounds {
  min: [number, number, number];
  max: [number, number, number];
  unit: DistanceUnit;
}

export interface SpaceTileIndexEntry {
  id: string;
  level: number;
  parentId?: string;
  childIds?: readonly string[];
  referenceFrame: ReferenceFrame;
  url: string;
  bounds: SpaceTileBounds;
  objectIds: string[];
}

export interface NearbyGalaxyOverviewEntry {
  id: string;
  position: [number, number, number];
  unit: DistanceUnit;
  color: string;
  visualRadius: number;
}

export interface SpaceTileIndex {
  version: string;
  tiles: SpaceTileIndexEntry[];
  searchEntries: SearchEntry[];
  overviewEntries?: NearbyGalaxyOverviewEntry[];
}

export interface StarTileBounds {
  min: [number, number, number];
  max: [number, number, number];
}

export interface StarTileIndexNode {
  id: string;
  lodLevel: number;
  parentId?: string;
  childIds: readonly string[];
  boundsParsec: StarTileBounds;
  sourceStarCount: number;
  clusterCount: number;
  cellSizeParsec: number;
  url: string;
}

export interface StarTileIndex {
  version: string;
  sourceCatalog: string;
  sourceStarCount: number;
  referenceEpochJulianDay: number;
  referenceFrame: 'equatorial-j2000';
  distanceUnit: 'parsec';
  scientificConfidence: 'calculated';
  representation: 'illustrative-aggregation';
  rootIds: readonly string[];
  nodes: readonly StarTileIndexNode[];
}

export interface StarClusterTile {
  id: string;
  parentId?: string;
  version: string;
  sourceCatalog: string;
  sourceStarCount: number;
  referenceEpochJulianDay: number;
  lodLevel: number;
  cellSizeParsec: number;
  clusterCount: number;
  cellCoordinates: Int32Array;
  positionsParsec: Float32Array;
  starCounts: Uint32Array;
  apparentMagnitudes: Float32Array;
  colorIndicesBv: Float32Array;
}

export interface StarClusterTilePack {
  version: string;
  sourceCatalog: string;
  referenceEpochJulianDay: number;
  tiles: readonly StarClusterTile[];
}

export interface StarTileSource {
  id: string;
  url: string;
  starCatalogId: string;
}

export type ConstellationSegment = readonly [number, number];

export interface ConstellationFigure {
  id: string;
  name: string;
  abbreviation: string;
  segments: readonly ConstellationSegment[];
}

export interface ConstellationCatalog {
  version: string;
  source: {
    name: string;
    url: string;
    license: string;
  };
  referenceFrame: 'equatorial-j2000';
  scientificConfidence: 'illustrative';
  starCatalog: string;
  figures: readonly ConstellationFigure[];
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
    }
  | {
      id: string;
      url: string;
      type: 'space-tile-index';
      format: 'space-tiles-v1' | 'space-tiles-v2';
    }
  | {
      id: string;
      url: string;
      type: 'constellation-lines';
      format: 'constellation-lines-v1';
    }
  | {
      id: string;
      url: string;
      type: 'star-tile-index';
      format: 'star-tiles-v2';
      starCatalogId: string;
    }
  | {
      id: string;
      url: string;
      type: 'cosmic-group-catalog';
      format: 'cosmicflows4-group-catalog-v1';
    };

export interface DatasetManifest {
  version: string;
  datasets: DatasetManifestEntry[];
}

export interface DisplayOptions {
  showOrbits: boolean;
  showConstellations: boolean;
  showLabels: boolean;
  quality: GraphicQuality;
  labelDensity: LabelDensity;
  temporalMode: TemporalMode;
}

export type ZoomDebugStatus = 'applied' | 'minimum' | 'maximum' | 'ignored' | 'unchanged';

export interface ZoomDebugStats {
  anchorType: 'object' | 'pointer' | 'target';
  anchorObjectId: string | null;
  deltaY: number;
  beforeDistance: number;
  requestedDistance: number;
  appliedDistance: number;
  minimumDistance: number;
  maximumDistance: number;
  status: ZoomDebugStatus;
}

export interface EngineDebugStats {
  fps: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  visibleObjects: number;
  catalogStars: number;
  cosmicGroups: number;
  cosmicFilaments: number;
  batchedGalaxies: number;
  loadedTiles: number;
  indexedGalaxyTiles: number;
  cachedGalaxyTiles: number;
  activeStarTiles: number;
  cachedStarPacks: number;
  cachedStarTiles: number;
  activeStarClusters: number;
  cachedStarClusters: number;
  visibleStarClusters: number;
  cameraPosition: Vector3Like;
  cameraTarget: Vector3Like;
  cameraDistance: number;
  floatingOrigin: Vector3Like;
  targetId: string | null;
  navigationOriginId: string | null;
  navigationReferenceFrame: ReferenceFrame;
  lodLevel: number;
  julianDay: number;
  quality: GraphicQuality;
  pixelRatio: number;
  zoom: ZoomDebugStats | null;
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
  | { type: 'objects-changed'; objects: readonly SpaceObject[] }
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
  labelDensity: LabelDensity;
  showOrbits: boolean;
  showConstellations: boolean;
  showLabels: boolean;
}

export interface TimeSpeedOption {
  id: string;
  label: string;
  daysPerSecond: number;
}
