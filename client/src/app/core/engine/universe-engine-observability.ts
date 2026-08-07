import type { AdaptiveRenderingStats } from '../../../data/models/universe.models';
import type { ActiveObjectAdornmentDiagnostics } from '../../../engine/objects/active-object-adornment-controller';
import type { ObjectVisualDiagnostics } from '../../../engine/objects/object-visual-diagnostics';
import type { NavigationDebugTraceEntry } from '../../../engine/core/navigation-debug-trace';

export interface UniverseEngineObservability {
  isCameraTransitioning(): boolean;
  getAdaptiveRenderingStats(): AdaptiveRenderingStats;
  getObjectAdornmentDiagnostics(objectId: string): ActiveObjectAdornmentDiagnostics | null;
  getObjectVisualDiagnostics(objectId: string): ObjectVisualDiagnostics | null;
  getNavigationDebugTrace(): readonly NavigationDebugTraceEntry[];
  clearNavigationDebugTrace(): void;
}

export interface UniverseEngineObservabilityWindow extends Window {
  __UNIVERSE_MAP_OBSERVABILITY__?: UniverseEngineObservability;
}

interface UniverseEngineObservabilitySource {
  readonly cameraTransitioning: boolean;
  readonly adaptiveRenderingStats: AdaptiveRenderingStats;
  getObjectAdornmentDiagnostics(objectId: string): ActiveObjectAdornmentDiagnostics | null;
  getObjectVisualDiagnostics(objectId: string): ObjectVisualDiagnostics | null;
  getNavigationDebugTrace(): readonly NavigationDebugTraceEntry[];
  clearNavigationDebugTrace(): void;
}

export function installUniverseEngineObservability(
  engine: UniverseEngineObservabilitySource,
  enabled: boolean,
  target: UniverseEngineObservabilityWindow = window,
): () => void {
  if (!enabled) {
    return () => undefined;
  }
  const bridge: UniverseEngineObservability = {
    isCameraTransitioning: () => engine.cameraTransitioning,
    getAdaptiveRenderingStats: () => engine.adaptiveRenderingStats,
    getObjectAdornmentDiagnostics: (objectId) => engine.getObjectAdornmentDiagnostics(objectId),
    getObjectVisualDiagnostics: (objectId) => engine.getObjectVisualDiagnostics(objectId),
    getNavigationDebugTrace: () => engine.getNavigationDebugTrace(),
    clearNavigationDebugTrace: () => engine.clearNavigationDebugTrace(),
  };

  target.__UNIVERSE_MAP_OBSERVABILITY__ = bridge;

  return () => {
    if (target.__UNIVERSE_MAP_OBSERVABILITY__ === bridge) {
      delete target.__UNIVERSE_MAP_OBSERVABILITY__;
    }
  };
}

export function shouldInstallUniverseEngineObservability(url: URL): boolean {
  return url.searchParams.get('e2e') === '1' || url.searchParams.get('debug') === 'true';
}

declare global {
  interface Window {
    __UNIVERSE_MAP_OBSERVABILITY__?: UniverseEngineObservability;
  }
}
