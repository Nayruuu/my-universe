import { type TempelFilamentSpineSource } from '../../data/models/universe.models';
import { type CoordinateSystem } from '../coordinates/coordinate-system';
import { type TempelFilamentSpineCatalog } from '../loaders/tempel-filament-spine-catalog';
import { type CosmicStructureCatalogRegistry } from '../objects/cosmic-structure-catalog-registry';
import {
  type UniverseTempelFilamentContext,
  type UniverseTempelFilamentLoaderBindings,
  UniverseTempelFilamentLoader,
} from './universe-tempel-filament-loader';

describe('UniverseTempelFilamentLoader', () => {
  it('ignore une configuration incomplète sans démarrer de chargement', async () => {
    const harness = createHarness({ contextAvailable: false });

    await harness.loader.ensureLoaded();

    expect(harness.loadCatalog).not.toHaveBeenCalled();
    expect(harness.loader.loadingPromise).toBeNull();
  });

  it('charge, installe et sélectionne les épines une seule fois', async () => {
    const harness = createHarness();

    const first = harness.loader.ensureLoaded();
    const second = harness.loader.ensureLoaded();

    expect(second).toBe(first);
    await first;
    expect(harness.loadCatalog).toHaveBeenCalledOnce();
    expect(harness.loadCatalog).toHaveBeenCalledWith(harness.context.source);
    expect(harness.scene.setTempelFilamentSpineCatalog).toHaveBeenCalledWith(
      harness.catalog,
      harness.context.registry,
      harness.context.coordinateSystem,
    );
    expect(harness.scene.selectCatalogObject).toHaveBeenCalledWith('filament-1');
    expect(harness.emitWarning).not.toHaveBeenCalled();
  });

  it('ignore un contexte remplacé avant l’installation du catalogue', async () => {
    const harness = createHarness({ contextCurrent: false });

    await harness.loader.ensureLoaded();

    expect(harness.scene.setTempelFilamentSpineCatalog).not.toHaveBeenCalled();
    expect(harness.scene.dispose).not.toHaveBeenCalled();
  });

  it('détruit une scène remplacée pendant son installation différée', async () => {
    const harness = createHarness();

    harness.scene.setTempelFilamentSpineCatalog.mockImplementation(async () => {
      harness.state.sceneCurrent = false;
    });
    await harness.loader.ensureLoaded();

    expect(harness.scene.dispose).toHaveBeenCalledOnce();
    expect(harness.scene.selectCatalogObject).not.toHaveBeenCalled();
  });

  it('normalise les erreurs et n’avertit que lorsque le moteur est actif', async () => {
    const documented = createHarness();

    documented.loadCatalog.mockRejectedValue(new Error('catalogue indisponible'));
    await documented.loader.ensureLoaded();
    expect(documented.emitWarning).toHaveBeenCalledWith(
      'Épines Tempel indisponibles : catalogue indisponible',
    );

    const unknown = createHarness();

    unknown.loadCatalog.mockRejectedValue('échec brut');
    await unknown.loader.ensureLoaded();
    expect(unknown.emitWarning).toHaveBeenCalledWith(
      'Épines Tempel indisponibles : erreur inconnue',
    );

    const inactive = createHarness({ active: false });

    inactive.loadCatalog.mockRejectedValue(new Error('trop tard'));
    await inactive.loader.ensureLoaded();
    expect(inactive.emitWarning).not.toHaveBeenCalled();
  });

  it('réinitialise son cache pour un nouveau cycle de vie', async () => {
    const harness = createHarness();

    await harness.loader.ensureLoaded();
    harness.loader.reset();
    expect(harness.loader.loadingPromise).toBeNull();

    await harness.loader.ensureLoaded();
    expect(harness.loadCatalog).toHaveBeenCalledTimes(2);
  });
});

interface HarnessState {
  active: boolean;
  contextAvailable: boolean;
  contextCurrent: boolean;
  sceneCurrent: boolean;
}

function createHarness(overrides: Partial<HarnessState> = {}) {
  const state: HarnessState = {
    active: true,
    contextAvailable: true,
    contextCurrent: true,
    sceneCurrent: true,
    ...overrides,
  };
  const source: TempelFilamentSpineSource = {
    id: 'tempel-spines',
    url: '/tempel-spines.bin',
  };
  const catalog = {} as TempelFilamentSpineCatalog;
  const scene = {
    setTempelFilamentSpineCatalog: vi.fn(async () => undefined),
    selectCatalogObject: vi.fn(),
    dispose: vi.fn(),
  };
  const context: UniverseTempelFilamentContext = {
    runtimeIdentity: {},
    source,
    scene,
    registry: {} as CosmicStructureCatalogRegistry,
    coordinateSystem: {} as CoordinateSystem,
  };
  const loadCatalog = vi.fn(async () => catalog);
  const emitWarning = vi.fn();
  const bindings: UniverseTempelFilamentLoaderBindings = {
    getContext: () => (state.contextAvailable ? context : null),
    isActive: () => state.active,
    isContextCurrent: () => state.contextCurrent,
    isSceneCurrent: () => state.sceneCurrent,
    getSelectedId: () => 'filament-1',
    loadCatalog,
    emitWarning,
  };

  return {
    loader: new UniverseTempelFilamentLoader(bindings),
    bindings,
    state,
    context,
    scene,
    catalog,
    loadCatalog,
    emitWarning,
  };
}
