import type { ActiveObjectAdornmentDiagnostics } from '../../../engine/objects/active-object-adornment-controller';
import type { ObjectVisualDiagnostics } from '../../../engine/objects/object-visual-diagnostics';
import {
  installUniverseEngineObservability,
  shouldInstallUniverseEngineObservability,
  type UniverseEngineObservabilityWindow,
} from './universe-engine-observability';

describe('installUniverseEngineObservability', () => {
  it('ne publie rien lorsque le pont est désactivé', () => {
    const target = {} as UniverseEngineObservabilityWindow;
    const remove = installUniverseEngineObservability(engine(), false, target);

    expect(target.__UNIVERSE_MAP_OBSERVABILITY__).toBeUndefined();
    expect(remove).not.toThrow();
  });

  it('publie un contrat typé, le délègue puis le nettoie sans écraser un successeur', () => {
    const target = {} as UniverseEngineObservabilityWindow;
    const source = engine();
    const remove = installUniverseEngineObservability(source, true, target);
    const bridge = target.__UNIVERSE_MAP_OBSERVABILITY__!;

    expect(bridge.isCameraTransitioning()).toBe(true);
    expect(bridge.getAdaptiveRenderingStats()).toEqual(adaptiveRenderingStats());
    expect(bridge.getObjectAdornmentDiagnostics('earth')).toEqual(diagnostics());
    expect(bridge.getObjectVisualDiagnostics('earth')).toEqual(visualDiagnostics());
    expect(source.getObjectAdornmentDiagnostics).toHaveBeenCalledWith('earth');
    expect(source.getObjectVisualDiagnostics).toHaveBeenCalledWith('earth');

    const replacement = {
      isCameraTransitioning: vi.fn(() => false),
      getAdaptiveRenderingStats: vi.fn(() => adaptiveRenderingStats()),
      getObjectAdornmentDiagnostics: vi.fn(() => null),
      getObjectVisualDiagnostics: vi.fn(() => null),
    };

    target.__UNIVERSE_MAP_OBSERVABILITY__ = replacement;
    remove();
    expect(target.__UNIVERSE_MAP_OBSERVABILITY__).toBe(replacement);

    const removeReplacement = installUniverseEngineObservability(source, true, target);

    removeReplacement();
    expect(target.__UNIVERSE_MAP_OBSERVABILITY__).toBeUndefined();
  });

  it('active le pont uniquement pour les URLs de test ou de debug', () => {
    expect(shouldInstallUniverseEngineObservability(new URL('https://example.test/'))).toBe(false);
    expect(shouldInstallUniverseEngineObservability(new URL('https://example.test/?e2e=1'))).toBe(
      true,
    );
    expect(
      shouldInstallUniverseEngineObservability(new URL('https://example.test/?debug=true')),
    ).toBe(true);
  });
});

function engine() {
  return {
    cameraTransitioning: true,
    adaptiveRenderingStats: adaptiveRenderingStats(),
    getObjectAdornmentDiagnostics: vi.fn(() => diagnostics()),
    getObjectVisualDiagnostics: vi.fn(() => visualDiagnostics()),
  };
}

function adaptiveRenderingStats() {
  return {
    status: 'stable' as const,
    p95FrameMs: 16,
    longFrameRatio: 0,
    targetPixelRatio: 1.5,
    currentPixelRatio: 1.5,
  };
}

function visualDiagnostics(): ObjectVisualDiagnostics {
  return {
    objectId: 'earth',
    bodyPresent: true,
    bodyVisible: true,
    visualVisible: true,
    nearVisible: true,
    nearBlend: 1,
    visibilityBlend: 1,
    opacity: 1,
    transparent: true,
    depthTest: true,
    depthWrite: true,
    surfaceTexture: {
      requested: true,
      loaded: true,
      source: 'textures/earth-blue-marble-2048.jpg',
      width: 2048,
      height: 1024,
    },
  };
}

function diagnostics(): ActiveObjectAdornmentDiagnostics {
  return {
    selectionMarker: { depthTest: true },
    rotationGuide: {
      visible: true,
      objectId: 'earth',
      direction: 'prograde',
      style: 'moving-highlight',
      parentName: 'earth-body',
      directionScale: 1,
      vertexCount: 82,
      hasVertexColors: true,
    },
  };
}
