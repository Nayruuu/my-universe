import type {
  EngineDebugStats,
  SearchEntry,
  SolarEclipseState,
  SpaceObject,
  UniverseEngineEvent,
  UniverseTime,
} from '../../../data/models/universe.models';

export interface UniverseEngineEventBridgeBindings {
  setObjects(objects: readonly SpaceObject[]): void;
  setSearchData(objects: readonly SpaceObject[], catalogEntries: readonly SearchEntry[]): void;
  setSelection(objectId: string | null, object: SpaceObject | null): void;
  setTarget(objectId: string | null): void;
  setCameraDistance(zoom: number): void;
  setTime(time: UniverseTime): void;
  setSolarEclipseState(state: SolarEclipseState): void;
  setLodLevel(level: number): void;
  setLoading(loading: boolean): void;
  setPerformanceWarning(message: string): void;
  setDebugStats(stats: EngineDebugStats): void;
  setError(message: string): void;
  scheduleNavigationWrite(): void;
}

export class UniverseEngineEventBridge {
  constructor(private readonly bindings: UniverseEngineEventBridgeBindings) {}

  public handle(event: UniverseEngineEvent): void {
    switch (event.type) {
      case 'data-ready':
        this.bindings.setObjects(event.objects);
        this.bindings.setSearchData(event.objects, event.catalogEntries);
        break;
      case 'objects-changed':
        this.bindings.setObjects(event.objects);
        break;
      case 'object-selected':
        this.bindings.setSelection(event.objectId, event.object);
        this.bindings.scheduleNavigationWrite();
        break;
      case 'target-changed':
        this.bindings.setTarget(event.objectId);
        this.bindings.scheduleNavigationWrite();
        break;
      case 'camera-changed':
        this.bindings.setCameraDistance(event.zoom);
        this.bindings.scheduleNavigationWrite();
        break;
      case 'time-changed':
        this.bindings.setTime(event.time);
        this.bindings.scheduleNavigationWrite();
        break;
      case 'solar-eclipse-state':
        this.bindings.setSolarEclipseState(event.state);
        break;
      case 'lod-changed':
        this.bindings.setLodLevel(event.level);
        break;
      case 'loading-state':
        this.bindings.setLoading(event.loading);
        break;
      case 'performance-warning':
        this.bindings.setPerformanceWarning(event.message);
        break;
      case 'debug-stats':
        this.bindings.setDebugStats(event.stats);
        break;
      case 'error':
        this.bindings.setError(event.message);
        break;
    }
  }
}
