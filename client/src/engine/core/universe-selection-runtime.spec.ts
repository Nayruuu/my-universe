import { type SpaceObject } from '../../data/models/universe.models';
import {
  type UniverseSelectionBindings,
  UniverseSelectionRuntime,
} from './universe-selection-runtime';

describe('UniverseSelectionRuntime', () => {
  it('sélectionne un objet détaillé et publie sa fiche', () => {
    const harness = createHarness();

    harness.runtime.select('earth');

    expect(harness.ensureActiveExoplanetSystem).toHaveBeenCalledWith('earth');
    expect(harness.selectDetailedObject).toHaveBeenCalledWith('earth');
    expect(harness.selectCatalogObject).toHaveBeenCalledWith(null);
    expect(harness.selectConstellation).toHaveBeenCalledWith(null);
    expect(harness.setTransientObject).toHaveBeenCalledWith(null);
    expect(harness.setDetailsPanelVisible).toHaveBeenCalledWith(true);
    expect(harness.emitSelected).toHaveBeenCalledWith('earth', harness.objects.earth);
    expect(harness.runtime.selectedId).toBe('earth');
  });

  it('route un objet du catalogue vers la scène et le label transitoire', () => {
    const harness = createHarness();

    harness.runtime.select('hyg-1');

    expect(harness.selectDetailedObject).toHaveBeenCalledWith(null);
    expect(harness.selectCatalogObject).toHaveBeenCalledWith('hyg-1');
    expect(harness.selectConstellation).toHaveBeenCalledWith(null);
    expect(harness.setTransientObject).toHaveBeenCalledWith(harness.objects['hyg-1']);
  });

  it('route une constellation sans la confondre avec le catalogue', () => {
    const harness = createHarness();

    harness.runtime.select('constellation-orion');

    expect(harness.selectDetailedObject).toHaveBeenCalledWith(null);
    expect(harness.selectCatalogObject).toHaveBeenCalledWith(null);
    expect(harness.selectConstellation).toHaveBeenCalledWith('constellation-orion');
    expect(harness.setTransientObject).toHaveBeenCalledWith(null);
  });

  it('précharge les épines lorsqu’un filament cosmique est sélectionné', () => {
    const harness = createHarness();

    harness.runtime.select('filament-1');

    expect(harness.ensureTempelFilamentSpines).toHaveBeenCalledOnce();
  });

  it('ignore une référence inconnue après avoir tenté de matérialiser son système', () => {
    const harness = createHarness();

    harness.runtime.select('missing');

    expect(harness.ensureActiveExoplanetSystem).toHaveBeenCalledWith('missing');
    expect(harness.emitSelected).not.toHaveBeenCalled();
    expect(harness.runtime.selectedId).toBeNull();
  });

  it('efface la sélection, restaure un identifiant et ne cadre que la sélection courante', () => {
    const harness = createHarness();

    harness.runtime.focusSelected();
    expect(harness.setTarget).not.toHaveBeenCalled();

    harness.runtime.restoreSelectedId('earth');
    harness.runtime.focusSelected();
    expect(harness.setTarget).toHaveBeenCalledWith('earth');

    harness.runtime.select(null);
    expect(harness.ensureActiveExoplanetSystem).not.toHaveBeenCalled();
    expect(harness.selectDetailedObject).toHaveBeenLastCalledWith(null);
    expect(harness.setDetailsPanelVisible).toHaveBeenLastCalledWith(false);
    expect(harness.emitSelected).toHaveBeenLastCalledWith(null, null);
    expect(harness.runtime.selectedId).toBeNull();
  });
});

function createHarness() {
  const objects = {
    earth: object('earth', 'planet'),
    'hyg-1': object('hyg-1', 'star'),
    'constellation-orion': object('constellation-orion', 'region'),
    'filament-1': object('filament-1', 'cosmic-filament'),
  } as const;
  const ensureActiveExoplanetSystem = vi.fn();
  const selectDetailedObject = vi.fn();
  const selectCatalogObject = vi.fn();
  const selectConstellation = vi.fn();
  const setTransientObject = vi.fn();
  const setDetailsPanelVisible = vi.fn();
  const ensureTempelFilamentSpines = vi.fn();
  const emitSelected = vi.fn();
  const setTarget = vi.fn();
  const bindings: UniverseSelectionBindings = {
    ensureActiveExoplanetSystem,
    getDefinition: (objectId) => objects[objectId as keyof typeof objects],
    hasDetailedObject: (objectId) => objectId === 'earth' || objectId === 'filament-1',
    isCatalogObject: (objectId) => objectId === 'hyg-1',
    isConstellation: (objectId) => objectId === 'constellation-orion',
    selectDetailedObject,
    selectCatalogObject,
    selectConstellation,
    setTransientObject,
    setDetailsPanelVisible,
    ensureTempelFilamentSpines,
    emitSelected,
    setTarget,
  };

  return {
    runtime: new UniverseSelectionRuntime(bindings),
    objects,
    ensureActiveExoplanetSystem,
    selectDetailedObject,
    selectCatalogObject,
    selectConstellation,
    setTransientObject,
    setDetailsPanelVisible,
    ensureTempelFilamentSpines,
    emitSelected,
    setTarget,
  };
}

function object(id: string, type: SpaceObject['type']): SpaceObject {
  return {
    id,
    name: id,
    type,
    referenceFrame: 'stellar',
    scientificConfidence: 'observed',
    visual: {
      visualRadius: 1,
      scaleMode: 'adaptive',
    },
    positionProvider: {
      type: 'static',
      position: [0, 0, 0],
      unit: 'parsec',
    },
  };
}
