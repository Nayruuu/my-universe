import type {
  EngineDebugStats,
  SearchEntry,
  SolarEclipseState,
  SpaceObject,
  UniverseEngineEvent,
  UniverseTime,
} from '../../../data/models/universe.models';
import {
  type UniverseEngineEventBridgeBindings,
  UniverseEngineEventBridge,
} from './universe-engine-event-bridge';

describe('UniverseEngineEventBridge', () => {
  it('projette chaque événement moteur vers son état UI dédié', () => {
    const harness = createHarness();
    const earth = spaceObject('earth');
    const mars = spaceObject('mars');
    const catalogEntries: readonly SearchEntry[] = [searchEntry('earth')];
    const time = { julianDay: 2_451_545 };
    const eclipseState: SolarEclipseState = {
      phase: 'partial',
      centralLatitude: 1,
      centralLongitude: 2,
    };
    const stats = debugStats();
    const events: readonly UniverseEngineEvent[] = [
      { type: 'data-ready', objects: [earth], catalogEntries },
      { type: 'objects-changed', objects: [earth, mars] },
      { type: 'object-selected', objectId: earth.id, object: earth },
      { type: 'target-changed', objectId: earth.id },
      { type: 'camera-changed', zoom: 12 },
      { type: 'time-changed', time },
      { type: 'solar-eclipse-state', state: eclipseState },
      { type: 'lod-changed', level: 3 },
      { type: 'loading-state', loading: false },
      { type: 'performance-warning', message: 'lent' },
      { type: 'debug-stats', stats },
      { type: 'error', message: 'erreur' },
    ];

    for (const event of events) {
      harness.bridge.handle(event);
    }

    expect(harness.setObjects.mock.calls).toEqual([[[earth]], [[earth, mars]]]);
    expect(harness.setSearchData).toHaveBeenCalledWith([earth], catalogEntries);
    expect(harness.setSelection).toHaveBeenCalledWith(earth.id, earth);
    expect(harness.setTarget).toHaveBeenCalledWith(earth.id);
    expect(harness.setCameraDistance).toHaveBeenCalledWith(12);
    expect(harness.setTime).toHaveBeenCalledWith(time);
    expect(harness.setSolarEclipseState).toHaveBeenCalledWith(eclipseState);
    expect(harness.setLodLevel).toHaveBeenCalledWith(3);
    expect(harness.setLoading).toHaveBeenCalledWith(false);
    expect(harness.setPerformanceWarning).toHaveBeenCalledWith('lent');
    expect(harness.setDebugStats).toHaveBeenCalledWith(stats);
    expect(harness.setError).toHaveBeenCalledWith('erreur');
  });

  it('ne planifie une URL que pour les événements qui modifient la navigation partageable', () => {
    const harness = createHarness();
    const events: readonly UniverseEngineEvent[] = [
      { type: 'data-ready', objects: [], catalogEntries: [] },
      { type: 'objects-changed', objects: [] },
      { type: 'object-selected', objectId: null, object: null },
      { type: 'target-changed', objectId: null },
      { type: 'camera-changed', zoom: 24 },
      { type: 'time-changed', time: { julianDay: 2_451_545 } },
      {
        type: 'solar-eclipse-state',
        state: { phase: 'none', centralLatitude: null, centralLongitude: null },
      },
      { type: 'lod-changed', level: 0 },
      { type: 'loading-state', loading: true },
      { type: 'performance-warning', message: 'warning' },
      { type: 'debug-stats', stats: debugStats() },
      { type: 'error', message: 'failure' },
    ];

    for (const event of events) {
      harness.bridge.handle(event);
    }

    expect(harness.scheduleNavigationWrite).toHaveBeenCalledTimes(4);
  });
});

function createHarness() {
  const setObjects = vi.fn<(objects: readonly SpaceObject[]) => void>();
  const setSearchData =
    vi.fn<(objects: readonly SpaceObject[], catalogEntries: readonly SearchEntry[]) => void>();
  const setSelection = vi.fn<(objectId: string | null, object: SpaceObject | null) => void>();
  const setTarget = vi.fn<(objectId: string | null) => void>();
  const setCameraDistance = vi.fn<(zoom: number) => void>();
  const setTime = vi.fn<(time: UniverseTime) => void>();
  const setSolarEclipseState = vi.fn<(state: SolarEclipseState) => void>();
  const setLodLevel = vi.fn<(level: number) => void>();
  const setLoading = vi.fn<(loading: boolean) => void>();
  const setPerformanceWarning = vi.fn<(message: string) => void>();
  const setDebugStats = vi.fn<(stats: EngineDebugStats) => void>();
  const setError = vi.fn<(message: string) => void>();
  const scheduleNavigationWrite = vi.fn();
  const bindings: UniverseEngineEventBridgeBindings = {
    setObjects,
    setSearchData,
    setSelection,
    setTarget,
    setCameraDistance,
    setTime,
    setSolarEclipseState,
    setLodLevel,
    setLoading,
    setPerformanceWarning,
    setDebugStats,
    setError,
    scheduleNavigationWrite,
  };

  return {
    bridge: new UniverseEngineEventBridge(bindings),
    setObjects,
    setSearchData,
    setSelection,
    setTarget,
    setCameraDistance,
    setTime,
    setSolarEclipseState,
    setLodLevel,
    setLoading,
    setPerformanceWarning,
    setDebugStats,
    setError,
    scheduleNavigationWrite,
  };
}

function spaceObject(id: string): SpaceObject {
  return {
    id,
    name: id,
    type: 'planet',
    referenceFrame: 'solar-system',
    scientificConfidence: 'calculated',
    visual: { visualRadius: 1, scaleMode: 'adaptive' },
    positionProvider: {
      type: 'static',
      position: [0, 0, 0],
      unit: 'astronomical-unit',
    },
  };
}

function searchEntry(id: string): SearchEntry {
  return {
    id,
    name: id,
    aliases: [],
    type: 'planet',
  };
}

function debugStats(): EngineDebugStats {
  return {
    fps: 60,
    drawCalls: 1,
    triangles: 2,
    geometries: 3,
    textures: 4,
    visibleObjects: 5,
    catalogStars: 6,
    exoplanetHosts: 7,
    exoplanets: 8,
    cosmicGroups: 9,
    cosmicFilaments: 10,
    cosmicStructures: 11,
    tempelFilamentSpines: 12,
    tempelSpineSegments: 13,
    visibleTempelSpineSegments: 14,
    tempelSpineTiles: 15,
    batchedGalaxies: 16,
    loadedTiles: 17,
    indexedGalaxyTiles: 18,
    cachedGalaxyTiles: 19,
    activeStarTiles: 20,
    cachedStarPacks: 21,
    cachedStarTiles: 22,
    activeStarClusters: 23,
    cachedStarClusters: 24,
    visibleStarClusters: 25,
    cameraPosition: { x: 1, y: 2, z: 3 },
    cameraTarget: { x: 4, y: 5, z: 6 },
    cameraDistance: 7,
    floatingOrigin: { x: 8, y: 9, z: 10 },
    targetId: 'earth',
    navigationOriginId: 'sun',
    navigationReferenceFrame: 'solar-system',
    lodLevel: 2,
    julianDay: 2_451_545,
    quality: 'high',
    pixelRatio: 2,
    zoom: null,
  };
}
