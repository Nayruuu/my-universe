import * as THREE from 'three';
import { type SpaceTileIndex } from '../../data/models/universe.models';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import { type CosmicGroupCatalog } from '../loaders/cosmic-group-catalog';
import { CosmicGroupCatalogRegistry } from '../objects/cosmic-group-catalog-registry';
import { CosmicCatalogLayers } from './cosmic-catalog-layers';
import { DEFAULT_COSMIC_MAP_LAYERS } from './cosmic-map-policy';

describe('CosmicCatalogLayers', () => {
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
