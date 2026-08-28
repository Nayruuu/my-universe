export type ScientificConfidence =
  'observed' | 'calculated' | 'extrapolated' | 'simulated' | 'procedural' | 'illustrative';

export type SpaceObjectType =
  | 'universe'
  | 'galaxy-cluster'
  | 'supercluster'
  | 'cosmic-wall'
  | 'cosmic-filament'
  | 'cosmic-void'
  | 'cosmic-basin'
  | 'cosmic-attractor'
  | 'cosmic-repeller'
  | 'galaxy'
  | 'black-hole'
  | 'nebula'
  | 'supernova'
  | 'supernova-remnant'
  | 'star'
  | 'planet'
  | 'exoplanet'
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
export type CosmicStructureType =
  'cluster' | 'supercluster' | 'wall' | 'filament' | 'void' | 'basin' | 'attractor' | 'repeller';
export type BlackHoleActivity = 'dormant' | 'quiescent' | 'active';
export type RotationDirection = 'prograde' | 'retrograde';
export type RotationOrientationModel =
  'earth-geographic' | 'iau-wgccre-2009' | 'iau-wgccre-2015' | 'damit-iau-2020';
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
  shape?: TriaxialBodyShapeDefinition;
}

export interface TriaxialBodyShapeDefinition {
  type: 'triaxial-ellipsoid';
  dimensionsKm: readonly [equatorialXKm: number, equatorialYKm: number, polarKm: number];
  scientificConfidence: ScientificConfidence;
  source: string;
}

export interface RotationDefinition {
  siderealPeriodHours: number;
  direction: RotationDirection;
  bodyFixedFrame: string;
  orientationModel: RotationOrientationModel;
  scientificConfidence: ScientificConfidence;
  source: string;
}

export interface CometActivityDefinition {
  activationDistanceAu: number;
  saturatedDistanceAu: number;
  scientificConfidence: ScientificConfidence;
  source: string;
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
  galaxyShape?: GalaxyVisualShape;
  galaxyAxisRatio?: number;
  galaxyRotationDegrees?: number;
  blackHoleActivity?: BlackHoleActivity;
  accretionDiskInclinationDegrees?: number;
}

export interface EquatorialPoleDefinition {
  rightAscensionDegrees: number;
  declinationDegrees: number;
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
      referencePlanePole?: EquatorialPoleDefinition;
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
      type: 'illustrative-orbit';
      semiMajorAxis: number;
      orbitalPeriodDays: number;
      epochJulianDay: number;
      visualPhaseAtEpochDegrees: number;
      visualInclinationDegrees: number;
      unit: DistanceUnit;
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
  rotation?: RotationDefinition;
  cometActivity?: CometActivityDefinition;
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
  metadata?: Readonly<Record<string, string | number | boolean>>;
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
  representation: StarTilePointRepresentation;
  url: string;
}

export type StarTileReferenceFrame = 'equatorial-j2000' | 'icrs';
export type StarMagnitudeBand = 'johnson-v' | 'gaia-g';
export type StarColorIndexSystem = 'johnson-b-v' | 'gaia-bp-rp';
export type StarTilePointRepresentation = 'aggregate-cell' | 'sampled-source';

export interface StarTileSampling {
  method: 'brightest-plus-deterministic-uniform';
  maximumSamplesPerLeaf: number;
  brightestSamplesPerLeaf: number;
}

export interface StarTileCatalogSource {
  name: string;
  url: string;
  doi: string | null;
  credit: string;
  retrievedAt: string;
  query: string;
}

export interface StarTileCatalogSelection {
  maximumDistanceParsec: number;
  maximumApparentMagnitude: number;
  minimumParallaxOverError: number;
}

export interface StarTileIndex {
  version: string;
  sourceCatalog: string;
  sourceStarCount: number;
  referenceEpochJulianDay: number;
  referenceFrame: StarTileReferenceFrame;
  distanceUnit: 'parsec';
  magnitudeBand: StarMagnitudeBand;
  colorIndexSystem: StarColorIndexSystem;
  source: StarTileCatalogSource;
  selection: StarTileCatalogSelection;
  sampling: StarTileSampling;
  scientificConfidence: 'calculated';
  representation: 'hierarchical-aggregation-with-deterministic-samples';
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
  magnitudeBand: StarMagnitudeBand;
  colorIndexSystem: StarColorIndexSystem;
  lodLevel: number;
  cellSizeParsec: number;
  representation: StarTilePointRepresentation;
  clusterCount: number;
  cellCoordinates: Int32Array;
  positionsParsec: Float32Array;
  starCounts: Uint32Array;
  apparentMagnitudes: Float32Array;
  colorIndices: Float32Array;
}

export interface StarClusterTilePack {
  version: string;
  sourceCatalog: string;
  referenceEpochJulianDay: number;
  magnitudeBand: StarMagnitudeBand;
  colorIndexSystem: StarColorIndexSystem;
  tiles: readonly StarClusterTile[];
}

export interface StarTileSource {
  id: string;
  url: string;
  sourceCatalogId: string;
}

export interface TempelFilamentSpineSource {
  id: string;
  url: string;
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
      format: 'star-tiles-v4';
      sourceCatalogId: string;
    }
  | {
      id: string;
      url: string;
      type: 'cosmic-group-catalog';
      format: 'cosmicflows4-group-catalog-v2';
    }
  | {
      id: string;
      url: string;
      metadataUrl: string;
      type: 'cosmic-structure-catalog';
      format: 'cosmic-structure-catalog-v1';
    }
  | {
      id: string;
      url: string;
      type: 'cosmic-web-volume';
      format: 'cosmic-web-volume-v1';
    }
  | {
      id: string;
      url: string;
      type: 'tempel-filament-spine-catalog';
      format: 'tempel-filament-spines-v1';
    }
  | {
      id: string;
      url: string;
      metadataUrl: string;
      type: 'exoplanet-catalog';
      format: 'exoplanet-catalog-v1';
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

export type UniverseStartupPerformanceStatus = 'idle' | 'loading' | 'usable' | 'failed';
export type UniverseStartupBudgetStatus = 'pending' | 'within-budget' | 'over-budget';
export type UniverseStartupBudgetPhase =
  'engine-module' | 'data-ready' | 'scene-ready' | 'first-usable-map';

export interface UniverseStartupPerformanceStats {
  readonly status: UniverseStartupPerformanceStatus;
  readonly engineModuleMs: number | null;
  readonly dataReadyMs: number | null;
  readonly sceneReadyMs: number | null;
  readonly firstUsableMapMs: number | null;
  readonly budgetStatus: UniverseStartupBudgetStatus;
  readonly exceededBudgets: readonly UniverseStartupBudgetPhase[];
}

export type AdaptiveRenderingStatus = 'warming' | 'stable' | 'degraded' | 'recovering' | 'paused';

export interface AdaptiveRenderingStats {
  readonly status: AdaptiveRenderingStatus;
  readonly p95FrameMs: number | null;
  readonly longFrameRatio: number | null;
  readonly targetPixelRatio: number;
  readonly currentPixelRatio: number;
}

export interface GaiaPresentationStats {
  readonly sampledSources: number;
  readonly projectedSampledSources: number;
  readonly aggregateCells: number;
  readonly projectedAggregateCells: number;
}

export interface EngineDebugStats {
  fps: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  visibleObjects: number;
  catalogStars: number;
  exoplanetHosts: number;
  exoplanets: number;
  cosmicGroups: number;
  cosmicFilaments: number;
  cosmicStructures: number;
  tempelFilamentSpines: number;
  tempelSpineSegments: number;
  visibleTempelSpineSegments: number;
  tempelSpineTiles: number;
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
  gaiaPresentation: GaiaPresentationStats;
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
  adaptiveRendering: AdaptiveRenderingStats;
  zoom: ZoomDebugStats | null;
  startupPerformance: UniverseStartupPerformanceStats;
  tempelPerformance: TempelFilamentPerformanceStats;
}

export type TempelFilamentLoadExecution = 'worker' | 'main-thread-fallback';

export type TempelFilamentPerformanceStatus =
  'idle' | 'loading' | 'installed' | 'visible' | 'failed';

export interface TempelFilamentSceneInstallationMetrics {
  readonly geometryPreparationMs: number;
  readonly sceneInstallationMs: number;
}

export interface TempelFilamentPerformanceStats {
  readonly status: TempelFilamentPerformanceStatus;
  readonly execution: TempelFilamentLoadExecution | null;
  readonly fetchMs: number | null;
  readonly decodeMs: number | null;
  readonly workerRoundTripMs: number | null;
  readonly geometryPreparationMs: number | null;
  readonly sceneInstallationMs: number | null;
  readonly preloadHit: boolean | null;
  readonly preloadLeadMs: number | null;
  readonly firstVisibleFrameMs: number | null;
  readonly activationToFirstVisibleMs: number | null;
  readonly timeToFirstVisibleMs: number | null;
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

export type NavigationViewMode = 'map' | 'planetarium';

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
  view?: NavigationViewMode;
  observerLocationId?: string | null;
}
