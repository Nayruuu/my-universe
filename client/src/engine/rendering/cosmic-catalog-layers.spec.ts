import * as THREE from 'three';
import { type SpaceTileIndex } from '../../data/models/universe.models';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import { type CosmicGroupCatalog } from '../loaders/cosmic-group-catalog';
import { CosmicGroupCatalogRegistry } from '../objects/cosmic-group-catalog-registry';
import { CosmicStructureCatalogRegistry } from '../objects/cosmic-structure-catalog-registry';
import { CosmicCatalogLayers } from './cosmic-catalog-layers';
import { DEFAULT_COSMIC_MAP_LAYERS } from './cosmic-map-policy';
import { CATALOG_PREPARATION_CHUNK_SIZE } from '../core/catalog-preparation';

describe('CosmicCatalogLayers', () => {
  afterEach(() => vi.restoreAllMocks());

  it('publie les structures préparées atomiquement avec la dernière configuration', async () => {
    const root = new THREE.Group();
    let resume: () => void = () => undefined;
    const pause = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resume = resolve;
        }),
    );
    const layers = new CosmicCatalogLayers(root, pause);

    await layers.setCosmicStructureCatalog(cosmicStructureRegistry(1));
    const previous = root.getObjectByName('calculated-cosmic-structure-symbols') as THREE.Points;
    const frameRoot = previous.parent!.parent;
    const dispose = vi.spyOn(previous.geometry, 'dispose');
    const replacement = layers.setCosmicStructureCatalog(cosmicStructureRegistry(513));

    await vi.waitFor(() => expect(pause).toHaveBeenCalledOnce());
    expect(layers.cosmicStructureCount).toBe(1);
    expect(root.getObjectByName('calculated-cosmic-structure-symbols')).toBe(previous);
    expect(dispose).not.toHaveBeenCalled();
    layers.setQuality('low');
    layers.setPixelRatio(1.4);
    layers.setCosmicMapLayers({ ...DEFAULT_COSMIC_MAP_LAYERS, clusters: false });
    layers.updateReferenceFrameScale(420_000);
    layers.update(420_000, 1, 1.3);
    pause.mockImplementation(async () => undefined);
    resume();
    await replacement;
    const points = root.getObjectByName('calculated-cosmic-structure-symbols') as THREE.Points<
      THREE.BufferGeometry,
      THREE.ShaderMaterial
    >;

    expect(layers.cosmicStructureCount).toBe(513);
    expect(dispose).toHaveBeenCalledOnce();
    expect(points.material.uniforms['detailScale']!.value).toBe(0.75);
    expect(points.material.uniforms['pixelRatio']!.value).toBe(1.4);
    expect(points.material.uniforms['radiance']!.value).toBe(1.3);
    expect(points.userData['layerState'].clusters).toBe(false);
    expect(layers.visibleCosmicStructureCount).toBe(0);
    expect(points.parent!.parent).toBe(frameRoot);
    expect(points.parent!.parent!.scale.x).toBe(layers.intergalacticScale.cosmicWebScale);
    layers.dispose();
  });

  it.each(['replace', 'dispose'])(
    'annule la préparation des structures après %s',
    async (action) => {
      const root = new THREE.Group();
      let resume: () => void = () => undefined;
      const pause = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resume = resolve;
          }),
      );
      const layers = new CosmicCatalogLayers(root, pause);
      const pending = layers.setCosmicStructureCatalog(cosmicStructureRegistry(513));

      await vi.waitFor(() => expect(pause).toHaveBeenCalledOnce());
      if (action === 'replace') {
        await layers.setCosmicStructureCatalog(cosmicStructureRegistry(1));
      } else {
        layers.dispose();
      }
      resume();
      await pending;
      expect(pause).toHaveBeenCalledOnce();
      expect(layers.cosmicStructureCount).toBe(action === 'replace' ? 1 : 0);
      expect(layers.getCatalogWorldPosition('lss-test-clusters-test-512')).toBeNull();
      layers.dispose();
      expect(root.children).toHaveLength(0);
    },
  );

  it('annule les structures avant les imports ou juste avant leur publication sans fuite', async () => {
    const root = new THREE.Group();
    const layers = new CosmicCatalogLayers(root);
    const pending = layers.setCosmicStructureCatalog(cosmicStructureRegistry(1));

    layers.dispose();
    await pending;
    expect(layers.cosmicStructureCount).toBe(0);
    const compute = THREE.BufferGeometry.prototype.computeBoundingSphere;
    const dispose = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');

    vi.spyOn(THREE.BufferGeometry.prototype, 'computeBoundingSphere').mockImplementation(function (
      this: THREE.BufferGeometry,
    ) {
      compute.call(this);
      layers.dispose();
    });
    await layers.setCosmicStructureCatalog(cosmicStructureRegistry(1));
    expect(dispose).toHaveBeenCalledOnce();
    expect(layers.cosmicStructureCount).toBe(0);
    expect(root.children).toHaveLength(0);
  });

  it('conserve les anciennes structures et propage un échec réel du planificateur', async () => {
    const error = new Error('scheduler failed');
    const root = new THREE.Group();
    const layers = new CosmicCatalogLayers(root, () => Promise.reject(error));

    await layers.setCosmicStructureCatalog(cosmicStructureRegistry(1));
    const previous = root.getObjectByName('calculated-cosmic-structure-symbols');

    await expect(layers.setCosmicStructureCatalog(cosmicStructureRegistry(513))).rejects.toBe(
      error,
    );
    expect(layers.cosmicStructureCount).toBe(1);
    expect(root.getObjectByName('calculated-cosmic-structure-symbols')).toBe(previous);
    layers.dispose();
  });

  it('conserve le catalogue installé jusqu’à la publication atomique du nouveau', async () => {
    const root = new THREE.Group();
    let resume: () => void = () => undefined;
    const pause = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resume = resolve;
        }),
    );
    const layers = new CosmicCatalogLayers(root, pause);

    await layers.setCosmicGroupCatalog(cosmicGroupRegistry(42));
    const previous = root.getObjectByName('calculated-cosmicflows4-groups') as THREE.Points;
    const dispose = vi.spyOn(previous.geometry, 'dispose');
    const replacement = layers.setCosmicGroupCatalog(largeCosmicGroupRegistry());

    await vi.waitFor(() => expect(pause).toHaveBeenCalledOnce());
    expect(layers.cosmicGroupCount).toBe(1);
    expect(root.getObjectByName('calculated-cosmicflows4-groups')).toBe(previous);
    expect(dispose).not.toHaveBeenCalled();
    layers.setQuality('low');
    layers.setPixelRatio(1.4);
    layers.setCosmicMapLayers({ ...DEFAULT_COSMIC_MAP_LAYERS, groups: false });
    layers.updateReferenceFrameScale(420_000);
    layers.update(420_000, 1, 1.3);
    pause.mockImplementation(async () => undefined);
    resume();
    await replacement;
    const points = root.getObjectByName('calculated-cosmicflows4-groups') as THREE.Points<
      THREE.BufferGeometry,
      THREE.ShaderMaterial
    >;

    expect(layers.cosmicGroupCount).toBe(CATALOG_PREPARATION_CHUNK_SIZE + 1);
    expect(dispose).toHaveBeenCalledOnce();
    expect(points.material.uniforms['pixelRatio']!.value).toBe(1.4);
    expect(points.material.uniforms['radiance']!.value).toBe(1.3);
    expect(points.userData['layerState'].groups).toBe(false);
    expect(layers.visibleCosmicGroupCount).toBe(0);
    layers.dispose();
  });

  it.each(['replace', 'dispose'])('annule une préparation suspendue après %s', async (action) => {
    const root = new THREE.Group();
    let resume: () => void = () => undefined;
    const pause = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resume = resolve;
        }),
    );
    const layers = new CosmicCatalogLayers(root, pause);
    const pending = layers.setCosmicGroupCatalog(largeCosmicGroupRegistry());

    await vi.waitFor(() => expect(pause).toHaveBeenCalledOnce());
    if (action === 'replace') {
      await layers.setCosmicGroupCatalog(cosmicGroupRegistry(84));
    } else {
      layers.dispose();
    }
    resume();
    await pending;
    expect(pause).toHaveBeenCalledOnce();
    expect(layers.cosmicGroupCount).toBe(action === 'replace' ? 1 : 0);
    expect(layers.getCatalogWorldPosition('cf4-pgc-100')).toBeNull();
    layers.dispose();
    expect(root.children).toHaveLength(0);
  });

  it('annule avant les imports et libère aussi un résultat devenu obsolète juste avant publication', async () => {
    const layers = new CosmicCatalogLayers(new THREE.Group());
    const pending = layers.setCosmicGroupCatalog(cosmicGroupRegistry(42));

    layers.dispose();
    await pending;
    expect(layers.cosmicGroupCount).toBe(0);
    const compute = THREE.BufferGeometry.prototype.computeBoundingSphere;
    const dispose = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');
    let computed = 0;

    vi.spyOn(THREE.BufferGeometry.prototype, 'computeBoundingSphere').mockImplementation(function (
      this: THREE.BufferGeometry,
    ) {
      compute.call(this);
      computed += 1;
      if (computed === 2) {
        layers.dispose();
      }
    });
    await layers.setCosmicGroupCatalog(cosmicGroupRegistry(84));
    expect(layers.cosmicGroupCount).toBe(0);
    expect(dispose).toHaveBeenCalledTimes(3);
  });

  it('propage un échec réel de préparation en conservant le catalogue précédent', async () => {
    const error = new Error('scheduler failed');
    const layers = new CosmicCatalogLayers(new THREE.Group(), () => Promise.reject(error));

    await layers.setCosmicGroupCatalog(cosmicGroupRegistry(42));
    await expect(layers.setCosmicGroupCatalog(largeCosmicGroupRegistry())).rejects.toBe(error);
    expect(layers.cosmicGroupCount).toBe(1);
    expect(layers.getCatalogWorldPosition('cf4-pgc-42')).not.toBeNull();
    layers.dispose();
  });
  it('expose un état vide sûr avant le chargement des catalogues', async () => {
    const root = new THREE.Group();
    const layers = new CosmicCatalogLayers(root);
    const target = new THREE.Vector3();

    layers.setQuality('low');
    layers.setPixelRatio(1.25);
    layers.setCosmicMapLayers({ ...DEFAULT_COSMIC_MAP_LAYERS, groups: false });
    layers.selectCatalogObject('unknown');
    layers.hoverCatalogObject('unknown');
    layers.update(210_000, 1 / 60, 1.1);
    await layers.setNearbyGalaxyOverview(emptyNearbyGalaxyIndex(), new CoordinateSystem());

    expect(layers.intergalacticScale.sceneUnitsPerMegaparsec).toBe(10_000);
    expect(layers.intergalacticScale.referenceFrameBlend).toBe('local-group');
    expect(layers.getCatalogWorldPosition('unknown')).toBeNull();
    expect(layers.getCatalogWorldPosition('unknown', target)).toBeNull();
    expect(layers.getPickables()).toEqual([]);
    expect(layers.isObjectVisibleForLabels('unknown')).toBeNull();
    expect(layers.visibleCosmicGroupCount).toBe(0);
    expect(layers.visibleNearbyGalaxyOverviewCount).toBe(0);
    expect(layers.cosmicGroupCount).toBe(0);
    expect(layers.visibleCosmicStructureCount).toBe(0);
    expect(layers.cosmicStructureCount).toBe(0);
    expect(layers.tempelFilamentSpineTileCount).toBe(0);
    expect(layers.tempelFilamentSpineCount).toBe(0);
    expect(layers.tempelFilamentSpinePointCount).toBe(0);
    expect(layers.tempelFilamentSpineSegmentCount).toBe(0);
    expect(layers.visibleTempelFilamentSpineSegmentCount).toBe(0);
    expect(layers.cosmicFilamentCount).toBe(0);
    expect(layers.activeCosmicFilamentCount).toBe(0);
    expect(layers.visibleCosmicFilamentCount).toBe(0);

    layers.dispose();
    expect(root.children).toHaveLength(0);
  });

  it('remplace les groupes cosmiques en conservant la configuration visuelle', async () => {
    const root = new THREE.Group();
    const layers = new CosmicCatalogLayers(root);

    layers.setQuality('high');
    layers.setPixelRatio(1.25);
    await layers.setCosmicGroupCatalog(cosmicGroupRegistry(42));
    layers.update(210_000, 10, 1.2);
    layers.selectCatalogObject('cf4-pgc-42');

    const firstPoints = root.getObjectByName('calculated-cosmicflows4-groups') as THREE.Points<
      THREE.BufferGeometry,
      THREE.ShaderMaterial
    >;
    const firstBackdrop = root.getObjectByName(
      'calculated-local-volume-depth-backdrop',
    ) as THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
    const firstPointsDispose = vi.spyOn(firstPoints.geometry, 'dispose');
    const firstBackdropDispose = vi.spyOn(firstBackdrop.geometry, 'dispose');

    expect(layers.cosmicGroupCount).toBe(1);
    expect(layers.visibleCosmicGroupCount).toBe(1);
    expect(layers.getCatalogWorldPosition('cf4-pgc-42')).toBeInstanceOf(THREE.Vector3);
    expect(layers.getPickables()).toHaveLength(2);
    expect(layers.isObjectVisibleForLabels('cf4-pgc-42')).toBe(true);
    expect(firstPoints.material.uniforms['pixelRatio']!.value).toBe(1.25);
    expect(firstPoints.material.uniforms['radiance']!.value).toBe(1.2);
    expect(firstBackdrop.material.uniforms['pixelRatio']!.value).toBe(1.25);
    expect(firstBackdrop.material.uniforms['radiance']!.value).toBe(1.2);

    layers.setCosmicMapLayers({ ...DEFAULT_COSMIC_MAP_LAYERS, groups: false });
    expect(layers.visibleCosmicGroupCount).toBe(0);
    expect(layers.isObjectVisibleForLabels('cf4-pgc-42')).toBe(false);

    await layers.setCosmicGroupCatalog(cosmicGroupRegistry(84));
    expect(firstPointsDispose).toHaveBeenCalledOnce();
    expect(firstBackdropDispose).toHaveBeenCalledOnce();
    expect(layers.getCatalogWorldPosition('cf4-pgc-42')).toBeNull();
    expect(layers.getCatalogWorldPosition('cf4-pgc-84')).toBeInstanceOf(THREE.Vector3);

    layers.selectCatalogObject(null);
    layers.dispose();
    expect(layers.cosmicGroupCount).toBe(0);
    expect(root.children).toHaveLength(0);
  });
});

function emptyNearbyGalaxyIndex(): SpaceTileIndex {
  return {
    version: '2.0.0',
    tiles: [],
    searchEntries: [],
    overviewEntries: [],
  };
}

function cosmicStructureRegistry(count: number): CosmicStructureCatalogRegistry {
  return new CosmicStructureCatalogRegistry(
    {
      count,
      referenceEpochJulianDay: 2_451_545,
      minimumDistanceMpc: 100,
      maximumDistanceMpc: 100,
      positionsMpc: Float32Array.from({ length: count * 3 }, (_, i) => (i % 3 === 0 ? 100 : 0)),
      distancesMpc: new Float32Array(count).fill(100),
      radiiMpc: new Float32Array(count).fill(1),
      confidences: new Float32Array(count).fill(1),
      densityContrasts: new Float32Array(count).fill(Number.NaN),
      boundaryDistancesMpc: new Float32Array(count).fill(Number.NaN),
      galaxyCounts: new Uint32Array(count).fill(10),
      sourceIndices: new Uint16Array(count),
      catalogNumericIds: Uint16Array.from({ length: count }, (_, i) => i + 1),
      flags: new Uint8Array(count),
      identifiers: Array.from({ length: count }, (_, i) => `test-${i}`),
      structureTypes: Array.from({ length: count }, () => 'cluster'),
      metadata: {
        version: '1.0.0',
        recordCount: count,
        referenceEpochJulianDay: 2_451_545,
        referenceFrame: 'equatorial-j2000',
        distanceUnit: 'megaparsec',
        scientificConfidence: 'calculated',
        sources: [
          {
            id: 'test-clusters',
            name: 'Test clusters',
            citation: 'Synthetic fixture',
            sourceUrl: 'https://example.test/clusters',
            structureType: 'cluster',
            method: 'Test',
            objectNamePrefix: 'Cluster',
            scientificConfidence: 'calculated',
            recordCount: count,
          },
        ],
      },
    },
    new CoordinateSystem(),
  );
}

function cosmicGroupRegistry(pgcId: number): CosmicGroupCatalogRegistry {
  const catalog: CosmicGroupCatalog = {
    count: 1,
    referenceEpochJulianDay: 2_451_545,
    minimumDistanceMpc: 12.1,
    maximumDistanceMpc: 12.1,
    positionsMpc: new Float32Array([12.1, 0, 0]),
    distancesMpc: new Float32Array([12.1]),
    distanceModulusErrors: new Float32Array([0.1]),
    velocitiesCmbKmPerSecond: new Int32Array([810]),
    pgcIds: new Uint32Array([pgcId]),
    distanceModuli: new Float32Array([30.413]),
    filamentPairs: new Uint32Array(),
  };

  return new CosmicGroupCatalogRegistry(catalog, new CoordinateSystem());
}

function largeCosmicGroupRegistry(): CosmicGroupCatalogRegistry {
  const base = cosmicGroupRegistry(100).catalog;
  const count = CATALOG_PREPARATION_CHUNK_SIZE + 1;

  return new CosmicGroupCatalogRegistry(
    {
      ...base,
      count,
      positionsMpc: new Float32Array(count * 3).fill(12.1),
      distancesMpc: new Float32Array(count).fill(12.1),
      distanceModulusErrors: new Float32Array(count).fill(0.1),
      velocitiesCmbKmPerSecond: new Int32Array(count).fill(810),
      pgcIds: Uint32Array.from({ length: count }, (_, index) => 100 + index),
      distanceModuli: new Float32Array(count).fill(30.413),
    },
    new CoordinateSystem(),
  );
}
