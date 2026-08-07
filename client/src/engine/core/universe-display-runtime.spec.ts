import type { DisplayOptions, GraphicQuality } from '../../data/models/universe.models';
import type { LabelNameResolver, LabelObject } from '../objects/label-manager';
import { UniverseDisplayRuntime } from './universe-display-runtime';

describe('UniverseDisplayRuntime', () => {
  it('prépare les options initiales avec la qualité recommandée ou explicitement demandée', () => {
    const harness = createHarness();

    expect(harness.runtime.options).toEqual(displayOptions());
    expect(harness.runtime.configureInitial({ showLabels: false })).toEqual({
      ...displayOptions(),
      showLabels: false,
      quality: 'high',
    });
    expect(harness.bindings.recommendQuality).toHaveBeenCalledOnce();

    expect(harness.runtime.configureInitial({ quality: 'low' })).toEqual({
      ...displayOptions(),
      showLabels: false,
      quality: 'low',
    });
    expect(harness.bindings.recommendQuality).toHaveBeenCalledOnce();
  });

  it('applique les options sans reconstruire lorsque seule la densité change', () => {
    const harness = createHarness();
    const options = displayOptions({
      showOrbits: false,
      showConstellations: false,
      showLabels: false,
      labelDensity: 'dense',
      temporalMode: 'observable',
    });

    harness.runtime.apply(options);

    expect(harness.bindings.setSceneQuality).toHaveBeenCalledWith('medium');
    expect(harness.bindings.setConstellationsEnabled).toHaveBeenCalledWith(false);
    expect(harness.bindings.setLabelsEnabled).toHaveBeenCalledWith(false);
    expect(harness.bindings.setLabelDensity).toHaveBeenCalledWith('dense');
    expect(harness.bindings.setScenePixelRatio).toHaveBeenCalledWith(1);
    expect(harness.bindings.setLabelObjects).toHaveBeenCalledWith(harness.labelObjects);
    expect(harness.bindings.setObjectDisplayOptions).toHaveBeenCalledWith(options);
    expect(harness.bindings.resetPixelRatio).not.toHaveBeenCalled();
    expect(harness.bindings.rebuildRegistry).not.toHaveBeenCalled();
    expect(harness.bindings.setLabelQuality).not.toHaveBeenCalled();
    expect(harness.bindings.applyRenderPixelRatio).not.toHaveBeenCalled();
  });

  it('reconfigure tout le rendu et reconstruit le registre lors d’un changement de qualité', () => {
    const harness = createHarness();
    const options = displayOptions({ quality: 'high' });

    harness.runtime.apply(options);

    expect(harness.runtime.pixelRatio).toBe(1.5);
    expect(harness.bindings.resetPixelRatio).toHaveBeenCalledWith('high');
    expect(harness.bindings.setScenePixelRatio).toHaveBeenCalledWith(1.5);
    expect(harness.bindings.invalidateStreamingViews).toHaveBeenCalledOnce();
    expect(harness.bindings.shouldRebuildRegistry).toHaveBeenCalledOnce();
    expect(harness.bindings.rebuildRegistry).toHaveBeenCalledOnce();
    expect(harness.bindings.setLabelQuality).toHaveBeenCalledWith('high');
    expect(harness.bindings.applyRenderPixelRatio).toHaveBeenCalledWith(1.5);
    expect(harness.bindings.setLabelObjects).toHaveBeenCalledWith(harness.labelObjects);
  });

  it('évite la reconstruction indisponible et le rafraîchissement inutile des labels', () => {
    const harness = createHarness({ shouldRebuildRegistry: false });

    harness.runtime.apply(displayOptions({ quality: 'low' }));
    expect(harness.bindings.rebuildRegistry).not.toHaveBeenCalled();
    expect(harness.bindings.setLabelObjects).toHaveBeenCalledOnce();

    vi.clearAllMocks();
    harness.runtime.apply(displayOptions({ quality: 'low' }));

    expect(harness.bindings.setScenePixelRatio).toHaveBeenCalledWith(1.5);
    expect(harness.bindings.setLabelObjects).not.toHaveBeenCalled();
    expect(harness.bindings.setObjectDisplayOptions).toHaveBeenCalledOnce();
  });

  it('conserve le ratio restauré et transmet le résolveur de noms', () => {
    const harness = createHarness();
    const resolver: LabelNameResolver = (objectId, fallback) =>
      objectId === 'earth' ? 'Earth' : fallback;

    harness.runtime.restorePixelRatio(1.25);
    harness.runtime.setLabelNameResolver(resolver);

    expect(harness.runtime.pixelRatio).toBe(1.25);
    expect(harness.runtime.labelNameResolver('earth', 'Terre')).toBe('Earth');
    expect(harness.bindings.applyLabelNameResolver).toHaveBeenCalledWith(resolver);
  });
});

function createHarness(options: { shouldRebuildRegistry?: boolean } = {}) {
  const labelObjects: LabelObject[] = [{ id: 'earth', name: 'Terre', type: 'planet' }];
  const bindings = {
    recommendQuality: vi.fn((): GraphicQuality => 'high'),
    setSceneQuality: vi.fn(),
    setConstellationsEnabled: vi.fn(),
    setLabelsEnabled: vi.fn(),
    setLabelDensity: vi.fn(),
    resetPixelRatio: vi.fn(() => 1.5),
    setScenePixelRatio: vi.fn(),
    invalidateStreamingViews: vi.fn(),
    shouldRebuildRegistry: vi.fn(() => options.shouldRebuildRegistry ?? true),
    rebuildRegistry: vi.fn(),
    setLabelQuality: vi.fn(),
    applyRenderPixelRatio: vi.fn(),
    getLabelObjects: vi.fn(() => labelObjects),
    setLabelObjects: vi.fn(),
    setObjectDisplayOptions: vi.fn(),
    applyLabelNameResolver: vi.fn(),
  };

  return {
    runtime: new UniverseDisplayRuntime(bindings),
    bindings,
    labelObjects,
  };
}

function displayOptions(overrides: Partial<DisplayOptions> = {}): DisplayOptions {
  return {
    showOrbits: true,
    showConstellations: true,
    showLabels: true,
    quality: 'medium',
    labelDensity: 'balanced',
    temporalMode: 'state',
    ...overrides,
  };
}
