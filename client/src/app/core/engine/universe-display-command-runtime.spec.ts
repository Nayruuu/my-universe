import { type DisplayOptions } from '../../../data/models/universe.models';
import {
  DEFAULT_COSMIC_MAP_LAYERS,
  type CosmicMapLayers,
} from '../../../engine/rendering/cosmic-map-policy';
import {
  type UniverseDisplayCommandRuntimeBindings,
  type UniverseDisplayCommandRuntimeEngine,
  UniverseDisplayCommandRuntime,
} from './universe-display-command-runtime';

describe('UniverseDisplayCommandRuntime', () => {
  it('fusionne une option, synchronise le moteur et programme le partage URL', () => {
    const harness = createHarness();

    harness.runtime.updateDisplayOptions({ quality: 'high' });

    expect(harness.state.options).toEqual({ ...defaultOptions(), quality: 'high' });
    expect(harness.engine.setDisplayOptions).toHaveBeenCalledWith(harness.state.options);
    expect(harness.scheduleUrlUpdate).toHaveBeenCalledOnce();
  });

  it('pilote les orbites, labels, constellations, qualité et densité', () => {
    const harness = createHarness();

    harness.runtime.toggleOrbits();
    harness.runtime.toggleLabels();
    harness.runtime.toggleConstellations();
    harness.runtime.setQuality('low');
    harness.runtime.setLabelDensity('dense');

    expect(harness.state.options).toEqual({
      showOrbits: false,
      showConstellations: false,
      showLabels: false,
      quality: 'low',
      labelDensity: 'dense',
      temporalMode: 'state',
    });
  });

  it('synchronise les modes temporels avec le moteur et l’URL', () => {
    const harness = createHarness();

    harness.runtime.setTemporalMode('state');
    expect(harness.state.options.temporalMode).toBe('state');
    expect(harness.engine.setDisplayOptions).toHaveBeenLastCalledWith(harness.state.options);

    harness.runtime.setTemporalMode('observable');
    expect(harness.state.options.temporalMode).toBe('observable');
    expect(harness.engine.setDisplayOptions).toHaveBeenLastCalledWith(harness.state.options);
    expect(harness.scheduleUrlUpdate).toHaveBeenCalledTimes(2);
  });

  it('bascule puis réinitialise les couches de la carte cosmique', () => {
    const harness = createHarness();

    harness.runtime.toggleCosmicMapLayer('filaments');
    expect(harness.state.layers.filaments).toBe(false);
    expect(harness.engine.setCosmicMapLayers).toHaveBeenLastCalledWith(
      expect.objectContaining({ filaments: false }),
    );

    harness.runtime.toggleCosmicMapLayer('filaments');
    expect(harness.state.layers.filaments).toBe(true);

    harness.state.layers = { ...harness.state.layers, groups: false, voids: false };
    harness.runtime.resetCosmicMapLayers();
    expect(harness.state.layers).toEqual(DEFAULT_COSMIC_MAP_LAYERS);
    expect(harness.engine.setCosmicMapLayers).toHaveBeenLastCalledWith(DEFAULT_COSMIC_MAP_LAYERS);
  });
});

function createHarness() {
  const state = {
    options: defaultOptions(),
    layers: { ...DEFAULT_COSMIC_MAP_LAYERS } as CosmicMapLayers,
  };
  const engine = new FakeDisplayCommandEngine();
  const scheduleUrlUpdate = vi.fn();
  const bindings: UniverseDisplayCommandRuntimeBindings = {
    getDisplayOptions: () => state.options,
    setDisplayOptions: (options) => {
      state.options = options;
    },
    getCosmicMapLayers: () => state.layers,
    setCosmicMapLayers: (layers) => {
      state.layers = layers;
    },
    scheduleUrlUpdate,
  };

  return {
    runtime: new UniverseDisplayCommandRuntime(engine, bindings),
    engine,
    state,
    scheduleUrlUpdate,
  };
}

function defaultOptions(): DisplayOptions {
  return {
    showOrbits: true,
    showConstellations: true,
    showLabels: true,
    quality: 'medium',
    labelDensity: 'balanced',
    temporalMode: 'state',
  };
}

class FakeDisplayCommandEngine implements UniverseDisplayCommandRuntimeEngine {
  public readonly setDisplayOptions = vi.fn();
  public readonly setCosmicMapLayers = vi.fn();
}
