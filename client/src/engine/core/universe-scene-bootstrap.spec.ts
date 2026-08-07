import * as THREE from 'three';
import type { DisplayOptions, SpaceObject } from '../../data/models/universe.models';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import type { LoadedUniverseAssets } from '../loaders/asset-loader';
import { ObjectRegistry } from '../objects/object-registry';
import { PerformanceManager } from '../performance/performance-manager';
import { UniverseScene } from '../rendering/universe-scene';
import { UniverseCatalogRuntime } from './universe-catalog-runtime';
import { UniverseSceneBootstrap } from './universe-scene-bootstrap';

describe('UniverseSceneBootstrap', () => {
  beforeEach(() => installCanvasContext());

  afterEach(() => vi.restoreAllMocks());

  it('construit le catalogue, la scène et le registre primaire au temps initial', async () => {
    const objects = [spaceObject('sun', 'star'), spaceObject('earth', 'planet', 'sun')];
    const assets = loadedAssets(objects);
    const catalogRuntime = catalog(objects);
    const createCatalogRuntime = vi.fn(async () => catalogRuntime);
    const setQuality = vi.spyOn(UniverseScene.prototype, 'setQuality');
    const setPixelRatio = vi.spyOn(UniverseScene.prototype, 'setPixelRatio');
    const setConstellationsEnabled = vi.spyOn(UniverseScene.prototype, 'setConstellationsEnabled');
    const setStellarOrigin = vi.spyOn(UniverseScene.prototype, 'setStellarOrigin');
    const updatePositions = vi.spyOn(ObjectRegistry.prototype, 'updatePositions');
    const updateBodyRotations = vi.spyOn(ObjectRegistry.prototype, 'updateBodyRotations');
    const setDisplayOptions = vi.spyOn(ObjectRegistry.prototype, 'setDisplayOptions');
    const coordinateSystem = new CoordinateSystem();
    const bootstrap = new UniverseSceneBootstrap(new PerformanceManager(), coordinateSystem);
    const options = displayOptions();
    const initialTime = { julianDay: 2_451_545 };

    const runtime = await bootstrap.create({
      assets,
      createCatalogRuntime,
      displayOptions: options,
      pixelRatio: 1.25,
      initialTime,
    });

    expect(createCatalogRuntime).toHaveBeenCalledWith(assets, coordinateSystem, runtime.scene);
    expect(runtime.catalogRuntime).toBe(catalogRuntime);
    expect(runtime.baseObjects).toEqual(objects);
    expect(runtime.baseObjects).not.toBe(catalogRuntime.baseObjects);
    expect(runtime.objects).toEqual(objects);
    expect(runtime.objects).not.toBe(runtime.baseObjects);
    expect(runtime.registry.has('sun')).toBe(true);
    expect(setQuality).toHaveBeenCalledWith('high');
    expect(setPixelRatio).toHaveBeenLastCalledWith(1.25);
    expect(setConstellationsEnabled).toHaveBeenCalledWith(false);
    expect(updatePositions).toHaveBeenCalledWith(initialTime);
    expect(updateBodyRotations).toHaveBeenCalledWith(initialTime);
    expect(setDisplayOptions).toHaveBeenCalledWith(options);
    expect(setStellarOrigin).toHaveBeenCalledWith(expect.any(THREE.Vector3));
    expect(runtime.solarEclipseAppearance).toEqual(
      expect.objectContaining({ phase: expect.any(String) }),
    );

    runtime.registry.dispose();
    runtime.scene.dispose();
  });

  it('utilise l’origine neutre lorsque le Soleil est absent', async () => {
    const setStellarOrigin = vi.spyOn(UniverseScene.prototype, 'setStellarOrigin');
    const assets = loadedAssets([]);
    const bootstrap = new UniverseSceneBootstrap(new PerformanceManager(), new CoordinateSystem());

    const runtime = await bootstrap.create({
      assets,
      createCatalogRuntime: async () => catalog([]),
      displayOptions: displayOptions(),
      pixelRatio: 1,
      initialTime: { julianDay: 2_451_545 },
    });

    expect(setStellarOrigin.mock.calls.at(-1)?.[0]).toEqual({ x: 0, y: 0, z: 0 });

    runtime.registry.dispose();
    runtime.scene.dispose();
  });
});

function catalog(objects: readonly SpaceObject[]): UniverseCatalogRuntime {
  return new UniverseCatalogRuntime({
    baseObjects: objects,
    starCatalogRegistry: null,
    exoplanetCatalogRegistry: null,
    cosmicGroupCatalogRegistry: null,
    cosmicStructureCatalogRegistry: null,
    spaceTileManager: null,
    starTileManager: null,
    tempelFilamentSpineSource: null,
  });
}

function loadedAssets(objects: SpaceObject[]): LoadedUniverseAssets {
  return {
    objects,
    starCatalog: null,
    cosmicGroupCatalog: null,
    cosmicStructureCatalog: null,
    cosmicWebVolume: null,
    exoplanetCatalog: null,
    constellationCatalog: null,
    spaceTileIndex: null,
    starTileSource: null,
    tempelFilamentSpineSource: null,
    warnings: [],
  };
}

function displayOptions(): DisplayOptions {
  return {
    showOrbits: true,
    showConstellations: false,
    showLabels: true,
    quality: 'high',
    labelDensity: 'balanced',
    temporalMode: 'state',
  };
}

function spaceObject(id: string, type: SpaceObject['type'], parentId?: string): SpaceObject {
  return {
    id,
    name: id,
    type,
    ...(parentId ? { parentId } : {}),
    referenceFrame: 'solar-system',
    scientificConfidence: 'calculated',
    visual: { visualRadius: id === 'sun' ? 5 : 1, scaleMode: 'adaptive' },
    positionProvider: {
      type: 'static',
      position: [0, 0, 0],
      unit: 'astronomical-unit',
    },
  };
}

function installCanvasContext(): void {
  const gradient = { addColorStop: vi.fn() };
  const context = {
    createRadialGradient: vi.fn(() => gradient),
    fillRect: vi.fn(),
    save: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    clearRect: vi.fn(),
    setLineDash: vi.fn(),
    stroke: vi.fn(),
    createImageData: vi.fn((width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
    })),
    putImageData: vi.fn(),
  };

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
}
