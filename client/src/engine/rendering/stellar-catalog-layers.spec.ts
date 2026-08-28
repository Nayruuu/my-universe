import * as THREE from 'three';
import { type StarClusterTile } from '../../data/models/universe.models';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import { type StarCatalog } from '../loaders/star-catalog';
import { StarCatalogRegistry } from '../objects/star-catalog-registry';
import { StellarCatalogLayers } from './stellar-catalog-layers';

describe('StellarCatalogLayers', () => {
  it('expose un état vide sûr avant le chargement des catalogues', () => {
    const root = new THREE.Group();
    const layers = new StellarCatalogLayers(root);
    const target = new THREE.Vector3();

    layers.setQuality('low');
    layers.setPixelRatio(1.25);
    layers.setConstellationsEnabled(true);
    layers.selectCatalogObject('unknown');
    layers.selectConstellation('unknown');
    layers.hoverConstellation('unknown');
    layers.updateLod(2, 1 / 60, 1, target);
    layers.updateTime({ julianDay: 2_451_545 });

    expect(layers.getCatalogWorldPosition('unknown')).toBeNull();
    expect(layers.getCatalogWorldPosition('unknown', target)).toBeNull();
    expect(layers.getConstellationWorldPosition('unknown')).toBeNull();
    expect(layers.getConstellationFocusRadius('unknown')).toBeNull();
    expect(layers.getConstellationDefinition('unknown')).toBeUndefined();
    expect(layers.hasConstellation('unknown')).toBe(false);
    expect(layers.constellationDefinitions).toEqual([]);
    expect(layers.getPickables()).toEqual([]);
    expect(layers.isObjectVisibleForLabels('unknown')).toBeNull();
    expect(layers.visibleCatalogStarCount).toBe(0);
    expect(layers.catalogStarCount).toBe(0);
    expect(layers.visibleExoplanetHostCount).toBe(0);
    expect(layers.exoplanetHostCount).toBe(0);
    expect(layers.exoplanetCount).toBe(0);
    expect(layers.activeStarTileCount).toBe(0);
    expect(layers.starClusterRepresentationCount).toBe(0);
    expect(layers.visibleStarClusterCount).toBe(0);
    expect(layers.getGaiaPresentationStats(new THREE.PerspectiveCamera())).toEqual({
      sampledSources: 0,
      projectedSampledSources: 0,
      aggregateCells: 0,
      projectedAggregateCells: 0,
    });

    layers.dispose();
    expect(root.children).toHaveLength(0);
  });

  it('remplace le catalogue stellaire et réinitialise ses amas sans fuite GPU', async () => {
    const root = new THREE.Group();
    const layers = new StellarCatalogLayers(root);
    const first = starRegistry(3_229);
    const second = starRegistry(6_960);

    layers.setQuality('high');
    layers.setPixelRatio(1.25);
    await layers.setStarCatalog(first);
    first.catalog.velocitiesParsecPerYear[0] = 0.01;
    await layers.setStarClusterTiles([starClusterTile()], first);
    layers.updateLod(1, 10, 1.2);
    layers.selectCatalogObject('hyg-3229');
    layers.updateLod(1, 10, 1.2, undefined, 'hyg-3229');
    layers.updateTime({ julianDay: 2_451_545 + 10 * 365.25 });

    const firstPoints = root.getObjectByName('observed-hyg-star-catalog') as THREE.Points<
      THREE.BufferGeometry,
      THREE.ShaderMaterial
    >;
    const firstCluster = root.getObjectByName(
      'calculated-dense-star-samples-lod-3',
    ) as THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
    const firstGeometryDispose = vi.spyOn(firstPoints.geometry, 'dispose');
    const firstClusterGeometryDispose = vi.spyOn(firstCluster.geometry, 'dispose');

    expect(layers.catalogStarCount).toBe(1);
    expect(layers.visibleCatalogStarCount).toBe(1);
    expect(layers.activeStarTileCount).toBe(1);
    expect(layers.getGaiaPresentationStats(new THREE.PerspectiveCamera()).sampledSources).toBe(0);
    expect(layers.getCatalogWorldPosition('hyg-3229')).toBeInstanceOf(THREE.Vector3);
    expect(layers.getPickables()).toHaveLength(2);
    expect(firstPoints.material.uniforms['pixelRatio']!.value).toBe(1.25);
    expect(firstPoints.material.uniforms['radiance']!.value).toBe(1.2);
    expect(root.getObjectByName('active-hyg-star-detail')?.userData).toMatchObject({
      objectId: 'hyg-3229',
      activation: 'navigation-target',
    });

    await layers.setStarCatalog(second);

    expect(firstGeometryDispose).toHaveBeenCalledOnce();
    expect(firstClusterGeometryDispose).toHaveBeenCalledOnce();
    expect(layers.activeStarTileCount).toBe(0);
    expect(layers.getCatalogWorldPosition('hyg-3229')).toBeNull();
    expect(layers.getCatalogWorldPosition('hyg-6960')).toBeInstanceOf(THREE.Vector3);

    layers.selectCatalogObject(null);
    layers.dispose();
    expect(layers.catalogStarCount).toBe(0);
    expect(root.children).toHaveLength(0);
  });
});

function starRegistry(id: number): StarCatalogRegistry {
  const catalog: StarCatalog = {
    count: 1,
    referenceEpochJulianDay: 2_451_545,
    catalogIds: new Uint32Array([id]),
    positionsParsec: new Float32Array([1, 2, 3]),
    velocitiesParsecPerYear: new Float32Array(3),
    apparentMagnitudes: new Float32Array([0.5]),
    colorIndicesBv: new Float32Array([0.2]),
    names: [`Étoile ${id}`],
    aliases: [[]],
    spectralTypes: ['G2V'],
  };

  return new StarCatalogRegistry(catalog, new CoordinateSystem());
}

function starClusterTile(): StarClusterTile {
  return {
    id: 'detail',
    parentId: 'root',
    version: '4.0.0',
    sourceCatalog: 'gaia-dr3-bright-high-confidence',
    sourceStarCount: 1,
    referenceEpochJulianDay: 2_457_388.5,
    magnitudeBand: 'gaia-g',
    colorIndexSystem: 'gaia-bp-rp',
    lodLevel: 3,
    cellSizeParsec: 40,
    representation: 'sampled-source',
    clusterCount: 1,
    cellCoordinates: Int32Array.from([0, 0, 0]),
    positionsParsec: Float32Array.from([1, 2, 3]),
    starCounts: Uint32Array.from([1]),
    apparentMagnitudes: Float32Array.from([0.5]),
    colorIndices: Float32Array.from([0.2]),
  };
}
