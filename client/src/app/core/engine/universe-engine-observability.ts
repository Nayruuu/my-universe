import type { ActiveObjectAdornmentDiagnostics } from '../../../engine/objects/active-object-adornment-controller';
import type { ObjectVisualDiagnostics } from '../../../engine/objects/object-visual-diagnostics';

export interface UniverseEngineObservability {
  getObjectAdornmentDiagnostics(objectId: string): ActiveObjectAdornmentDiagnostics | null;
  getObjectVisualDiagnostics(objectId: string): ObjectVisualDiagnostics | null;
}

export interface UniverseEngineObservabilityWindow extends Window {
  __UNIVERSE_MAP_OBSERVABILITY__?: UniverseEngineObservability;
}

interface UniverseEngineObservabilitySource {
  getObjectAdornmentDiagnostics(objectId: string): ActiveObjectAdornmentDiagnostics | null;
  getObjectVisualDiagnostics(objectId: string): ObjectVisualDiagnostics | null;
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
    getObjectAdornmentDiagnostics: (objectId) => engine.getObjectAdornmentDiagnostics(objectId),
    getObjectVisualDiagnostics: (objectId) => engine.getObjectVisualDiagnostics(objectId),
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
