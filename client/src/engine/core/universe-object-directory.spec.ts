import * as THREE from 'three';
import { type SearchEntry, type SpaceObject } from '../../data/models/universe.models';
import { type LabelObject } from '../objects/label-manager';
import {
  type UniverseObjectDirectoryBindings,
  type UniverseObjectDirectoryCatalog,
  type UniverseObjectDirectoryObjectRuntime,
  type UniverseObjectDirectoryScene,
  UniverseObjectDirectory,
} from './universe-object-directory';

describe('UniverseObjectDirectory', () => {
  it('résout les définitions dans l’ordre registre, catalogue puis constellation', () => {
    const harness = createHarness();

    expect(harness.directory.getDefinition('runtime')).toBe(harness.runtimeObject);
    expect(harness.directory.getDefinition('catalog')).toBe(harness.catalogObject);
    expect(harness.directory.getDefinition('constellation')).toBe(harness.constellationObject);
    expect(harness.directory.getDefinition('missing')).toBeUndefined();
  });

  it('résout les positions dans l’ordre registre, catalogue puis constellation', () => {
    const harness = createHarness();
    const target = new THREE.Vector3();

    expect(harness.directory.getWorldPosition('runtime', target)?.toArray()).toEqual([1, 0, 0]);
    expect(harness.directory.getWorldPosition('catalog')?.toArray()).toEqual([0, 2, 0]);
    expect(harness.directory.getWorldPosition('constellation')?.toArray()).toEqual([0, 0, 3]);
    expect(harness.directory.getWorldPosition('missing')).toBeNull();
  });

  it('reconnaît un objet provenant de chacune des quatre sources', () => {
    const harness = createHarness();

    expect(harness.directory.has('runtime')).toBe(true);
    expect(harness.directory.has('catalog')).toBe(true);
    expect(harness.directory.has('constellation')).toBe(true);
    expect(harness.directory.has('streamed')).toBe(true);
    expect(harness.directory.has('missing')).toBe(false);
  });

  it('compose les objets publics et demande au catalogue le budget de labels courant', () => {
    const harness = createHarness();

    expect(harness.directory.getPublicObjects().map(({ id }) => id)).toEqual([
      'sun',
      'exo-b',
      'constellation',
    ]);
    expect(harness.directory.getLabelObjects().map(({ id }) => id)).toEqual([
      'sun',
      'exo-b',
      'constellation',
      'catalog-label',
    ]);
    expect(harness.catalog.getLabelObjects).toHaveBeenCalledWith(expect.any(Array), 4_500, 108);
  });

  it('construit les données de recherche sans dupliquer les objets déjà chargés', () => {
    const harness = createHarness();
    const payload = harness.directory.createDataReadyPayload({
      searchEntries: [searchEntry('sun'), searchEntry('streamed')],
    });

    expect(payload.objects.map(({ id }) => id)).toEqual(['sun', 'exo-b', 'constellation']);
    expect(payload.catalogEntries.map(({ id }) => id)).toEqual(['catalog', 'streamed']);
  });

  it('conserve les objets locaux lorsque les sources optionnelles sont absentes', () => {
    const harness = createHarness({ catalogAvailable: false, sceneAvailable: false });

    expect(harness.directory.getPublicObjects().map(({ id }) => id)).toEqual(['sun', 'exo-b']);
    expect(harness.directory.getLabelObjects().map(({ id }) => id)).toEqual(['sun', 'exo-b']);
    expect(harness.directory.createDataReadyPayload({ searchEntries: [] }).catalogEntries).toEqual(
      [],
    );
    expect(harness.directory.has('missing')).toBe(false);
  });
});

interface HarnessOptions {
  readonly catalogAvailable: boolean;
  readonly sceneAvailable: boolean;
}

function createHarness(overrides: Partial<HarnessOptions> = {}) {
  const options: HarnessOptions = {
    catalogAvailable: true,
    sceneAvailable: true,
    ...overrides,
  };
  const runtimeObject = object('runtime');
  const catalogObject = object('catalog');
  const constellationObject = object('constellation');
  const loadedObjects = [object('sun')];
  const activeExoplanetObjects = [object('exo-b')];
  const runtime: UniverseObjectDirectoryObjectRuntime = {
    has: vi.fn((objectId) => objectId === 'runtime'),
    getDefinition: vi.fn((objectId) => (objectId === 'runtime' ? runtimeObject : undefined)),
    getWorldPosition: vi.fn((objectId, target = new THREE.Vector3()) =>
      objectId === 'runtime' ? target.set(1, 0, 0) : null,
    ),
  };
  const catalog: UniverseObjectDirectoryCatalog = {
    has: vi.fn((objectId) => objectId === 'catalog'),
    getDefinition: vi.fn((objectId) => (objectId === 'catalog' ? catalogObject : undefined)),
    getLabelObjects: vi.fn(() => [object('catalog-label')]),
    getSearchEntries: vi.fn(() => [searchEntry('catalog')]),
  };
  const scene: UniverseObjectDirectoryScene = {
    constellationDefinitions: [constellationObject],
    hasConstellation: vi.fn((objectId) => objectId === 'constellation'),
    getConstellationDefinition: vi.fn((objectId) =>
      objectId === 'constellation' ? constellationObject : undefined,
    ),
    getCatalogWorldPosition: vi.fn((objectId, target = new THREE.Vector3()) =>
      objectId === 'catalog' ? target.set(0, 2, 0) : null,
    ),
    getConstellationWorldPosition: vi.fn((objectId, target = new THREE.Vector3()) =>
      objectId === 'constellation' ? target.set(0, 0, 3) : null,
    ),
  };
  const bindings: UniverseObjectDirectoryBindings = {
    getLoadedObjects: () => loadedObjects,
    getActiveExoplanetObjects: () => activeExoplanetObjects,
    getCatalog: () => (options.catalogAvailable ? catalog : null),
    getScene: () => (options.sceneAvailable ? scene : null),
    hasStreamedObject: (objectId) => objectId === 'streamed',
    getQuality: () => 'high',
    getLabelDensity: () => 'dense',
  };

  return {
    directory: new UniverseObjectDirectory(runtime, bindings),
    runtimeObject,
    catalogObject,
    constellationObject,
    catalog,
    scene,
  };
}

function object(id: string): SpaceObject & LabelObject {
  return {
    id,
    name: id,
    type: id === 'sun' ? 'star' : id === 'exo-b' ? 'exoplanet' : 'region',
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

function searchEntry(id: string): SearchEntry {
  return {
    id,
    name: id,
    aliases: [],
    type: id === 'sun' ? 'star' : 'galaxy',
  };
}
