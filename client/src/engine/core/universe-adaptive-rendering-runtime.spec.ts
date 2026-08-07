import type { AdaptiveRenderingStats } from '../../data/models/universe.models';
import {
  type UniverseAdaptiveRenderingResources,
  UniverseAdaptiveRenderingRuntime,
} from './universe-adaptive-rendering-runtime';

describe('UniverseAdaptiveRenderingRuntime', () => {
  it('observe chaque frame et applique une nouvelle résolution aux ressources actives', () => {
    const resources = renderingResources();
    const harness = createHarness(resources);

    harness.performanceManager.observeFrame.mockReturnValue(1.25);
    harness.runtime.update(0.016);

    expect(harness.performanceManager.observeFrame).toHaveBeenCalledWith('high', 0.016, false);
    expect(harness.setPixelRatio).toHaveBeenCalledWith(1.25);
    expect(resources.renderer.setPixelRatio).toHaveBeenCalledWith(1.25);
    expect(resources.universeScene.setPixelRatio).toHaveBeenCalledWith(1.25);
    expect(harness.resize).toHaveBeenCalledOnce();
  });

  it('mesure sans redimensionner lorsqu’aucun nouveau palier n’est choisi', () => {
    const resources = renderingResources();
    const harness = createHarness(resources);

    harness.runtime.update(0.02);

    expect(harness.performanceManager.observeFrame).toHaveBeenCalledWith('high', 0.02, false);
    expect(harness.setPixelRatio).not.toHaveBeenCalled();
    expect(resources.renderer.setPixelRatio).not.toHaveBeenCalled();
    expect(resources.universeScene.setPixelRatio).not.toHaveBeenCalled();
    expect(harness.resize).not.toHaveBeenCalled();
  });

  it('suspend la politique pendant une transition sans exiger de ressources', () => {
    const harness = createHarness(null, true);

    harness.runtime.update(0.04);

    expect(harness.performanceManager.observeFrame).toHaveBeenCalledWith('high', 0.04, true);
    expect(harness.setPixelRatio).not.toHaveBeenCalled();
  });

  it('conserve la décision si les ressources disparaissent avant son application', () => {
    const harness = createHarness(null);

    harness.performanceManager.observeFrame.mockReturnValue(1);
    harness.runtime.update(0.04);

    expect(harness.setPixelRatio).not.toHaveBeenCalled();
    expect(harness.resize).not.toHaveBeenCalled();
  });
});

function createHarness(
  resources: UniverseAdaptiveRenderingResources | null,
  paused = false,
): AdaptiveRenderingHarness {
  const performanceManager = {
    observeFrame: vi.fn(() => null as number | null),
    adaptiveRenderingStats: adaptiveStats(),
  };
  const setPixelRatio = vi.fn();
  const resize = vi.fn();

  return {
    runtime: new UniverseAdaptiveRenderingRuntime(performanceManager, {
      getResources: () => resources,
      getQuality: () => 'high',
      isSamplingPaused: () => paused,
      setPixelRatio,
      resize,
    }),
    performanceManager,
    setPixelRatio,
    resize,
  };
}

function renderingResources(): UniverseAdaptiveRenderingResources {
  return {
    renderer: { setPixelRatio: vi.fn() },
    universeScene: { setPixelRatio: vi.fn() },
  };
}

function adaptiveStats(): AdaptiveRenderingStats {
  return {
    status: 'stable',
    p95FrameMs: 16,
    longFrameRatio: 0,
    targetPixelRatio: 1.5,
    currentPixelRatio: 1.5,
  };
}

interface AdaptiveRenderingHarness {
  readonly runtime: UniverseAdaptiveRenderingRuntime;
  readonly performanceManager: {
    readonly observeFrame: ReturnType<typeof vi.fn>;
    readonly adaptiveRenderingStats: AdaptiveRenderingStats;
  };
  readonly setPixelRatio: ReturnType<typeof vi.fn>;
  readonly resize: ReturnType<typeof vi.fn>;
}
