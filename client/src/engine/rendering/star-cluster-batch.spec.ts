import * as THREE from 'three';
import { type StarClusterTile } from '../../data/models/universe.models';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import {
  STELLAR_NEIGHBORHOOD_REVEAL_END,
  STELLAR_NEIGHBORHOOD_REVEAL_START,
} from '../coordinates/stellar-neighborhood-scale-model';
import { type StarCatalog } from '../loaders/star-catalog';
import { StarCatalogRegistry } from '../objects/star-catalog-registry';
import { StarClusterBatch } from './star-cluster-batch';

describe('StarClusterBatch', () => {
  it('affiche les cellules Gaia calculées uniquement dans le voisinage stellaire', () => {
    const batch = new StarClusterBatch(registry());

    batch.synchronizeTiles([tile('a', 3, [-1, 2]), tile('b', 3, [-3])]);
    batch.setPixelRatio(1.5);
    batch.setQuality('high');
    batch.updateLod(2, 10);

    expect(batch.root.children).toHaveLength(1);
    const points = batch.root.children[0];

    expect(points).toBeInstanceOf(THREE.Points);
    if (!(points instanceof THREE.Points)) {
      throw new Error('Batch de cellules stellaires absent.');
    }
    expect(points.userData['tileIds']).toEqual(['a', 'b']);
    expect(points.userData['sourceStarCount']).toBe(3);
    expect(points.userData['clusterCount']).toBe(3);
    expect(points.userData['scientificConfidence']).toBe('calculated');
    expect(points.geometry.drawRange.count).toBe(3);
    expect(points.visible).toBe(true);
    expect(points.name).toBe('calculated-dense-star-samples-lod-3');
    expect(points.userData['pointRepresentation']).toBe('sampled-source');
    expect(points.userData['visualScale']).toBe('measured-source-sample');
    expect(points.userData['visualStyle']).toBe('gaia-photometry-with-cool-catalog-halo');
    expect((points.material as THREE.ShaderMaterial).uniforms['clusterOpacity']!.value).toBeCloseTo(
      0.96,
      5,
    );
    expect((points.material as THREE.ShaderMaterial).uniforms['catalogSignature']!.value).toBe(
      0.14,
    );
    expect((points.material as THREE.ShaderMaterial).depthTest).toBe(false);
    expect(batch.activeTileCount).toBe(2);
    expect(batch.visibleClusterCount).toBe(3);
    expect(batch.representationCount).toBe(1);
    expect((points.material as THREE.ShaderMaterial).uniforms['pixelRatio']!.value).toBe(1.5);

    batch.setPhotographicRadiance(1.2);
    expect((points.material as THREE.ShaderMaterial).uniforms['radiance']!.value).toBe(1.2);
    batch.setPhotographicRadiance(0);
    expect((points.material as THREE.ShaderMaterial).uniforms['radiance']!.value).toBe(0.5);
    batch.setPhotographicRadiance(2);
    expect((points.material as THREE.ShaderMaterial).uniforms['radiance']!.value).toBe(1.5);

    const position = points.geometry.getAttribute('position');
    const expected = registry().toRenderPosition([20, 21, 22]);

    expect(position.getX(0)).toBeCloseTo(expected.x, 4);
    expect(position.getY(0)).toBeCloseTo(expected.y, 4);
    expect(position.getZ(0)).toBeCloseTo(expected.z, 4);
    batch.dispose();
  });

  it('préserve les faibles sources Gaia avec une taille bornée et une densité discrète', () => {
    const batch = new StarClusterBatch(registry());

    batch.synchronizeTiles([tile('photometry', 3, [12, 8, 0])]);
    const points = batch.root.children[0] as THREE.Points;
    const sizes = points.geometry.getAttribute('pointSize');
    const alphas = points.geometry.getAttribute('pointAlpha');

    expect(sizes.getX(0)).toBeCloseTo(1.909_09, 5);
    expect(sizes.getX(1)).toBeLessThan(sizes.getX(0));
    expect(sizes.getX(2)).toBeCloseTo(0.909_09, 5);
    expect(alphas.getX(0)).toBeCloseTo(0.927_27, 5);
    expect(alphas.getX(1)).toBeLessThan(alphas.getX(0));
    expect(alphas.getX(2)).toBeCloseTo(0.507_27, 5);
    batch.dispose();
  });

  it('distingue les sources détaillées, les cellules agrégées et leur projection écran', () => {
    const batch = new StarClusterBatch(registry());

    batch.synchronizeTiles([tile('detail', 3, [-2, -1]), tile('overview', 4, [1])]);
    batch.setQuality('high');
    batch.updateLod(2, 10);
    const points = batch.root.children[0] as THREE.Points;
    const positions = points.geometry.getAttribute('position');
    const focus = new THREE.Vector3().fromBufferAttribute(positions, 0);

    points.localToWorld(focus);
    const camera = new THREE.PerspectiveCamera(60, 1, 0.01, 10_000);

    camera.position.copy(focus).add(new THREE.Vector3(0, 0, 10));
    camera.lookAt(focus);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);

    expect(batch.getPresentationStats(camera)).toMatchObject({
      sampledSources: 2,
      aggregateCells: 1,
      projectedSampledSources: expect.any(Number),
      projectedAggregateCells: expect.any(Number),
    });
    expect(batch.getPresentationStats(camera).projectedSampledSources).toBeGreaterThan(0);

    camera.lookAt(camera.position.clone().add(new THREE.Vector3(0, 0, 10)));
    camera.updateMatrixWorld(true);
    expect(batch.getPresentationStats(camera)).toEqual({
      sampledSources: 2,
      projectedSampledSources: 0,
      aggregateCells: 1,
      projectedAggregateCells: 0,
    });
    batch.dispose();
  });

  it('fond puis libère un ancien lot remplacé', () => {
    const batch = new StarClusterBatch(registry());

    batch.synchronizeTiles([tile('old', 3, [-1, 0])]);
    batch.updateLod(2, 10);
    const oldPoints = batch.root.children[0] as THREE.Points;
    const geometryDispose = vi.spyOn(oldPoints.geometry, 'dispose');
    const materialDispose = vi.spyOn(oldPoints.material as THREE.Material, 'dispose');

    batch.synchronizeTiles([tile('new', 3, [-2])]);
    expect(batch.root.children).toHaveLength(2);
    expect(oldPoints.visible).toBe(true);

    batch.updateLod(2, 10);
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(batch.root.children).toHaveLength(1);
    batch.updateLod(2, 10);
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(batch.root.children).toHaveLength(1);
    expect(batch.activeTileCount).toBe(1);
    expect(batch.visibleClusterCount).toBe(1);
    batch.dispose();
  });

  it('borne les changements rapides à un lot actif et un seul lot sortant', () => {
    const batch = new StarClusterBatch(registry());

    batch.synchronizeTiles([tile('first', 3, [-1])]);
    batch.updateLod(2, 10);
    const firstPoints = batch.root.children[0] as THREE.Points;
    const firstGeometryDispose = vi.spyOn(firstPoints.geometry, 'dispose');

    batch.synchronizeTiles([tile('second', 3, [-2])]);
    batch.updateLod(2, 0.25);
    batch.synchronizeTiles([tile('third', 3, [-3])]);

    expect(batch.representationCount).toBe(2);
    expect(batch.root.children).toHaveLength(2);
    expect(firstGeometryDispose).toHaveBeenCalledOnce();
    expect(batch.root.children.map((child) => child.userData['tileIds'])).toEqual([
      ['second'],
      ['third'],
    ]);
    batch.dispose();
  });

  it('privilégie la résolution sortante différente pendant le fondu inter-échelles', () => {
    const batch = new StarClusterBatch(registry());

    batch.synchronizeTiles([tile('detail', 3, [-2, -1]), tile('old-overview', 4, [1])]);
    batch.updateLod(2, 10);

    batch.synchronizeTiles([tile('new-overview', 4, [2])]);

    expect(batch.representationCount).toBe(2);
    expect(batch.root.children.map((child) => child.userData['tileIds'])).toEqual([
      ['detail'],
      ['new-overview'],
    ]);
    batch.updateLod(3, 0.1, 3_600);
    expect(batch.visibleClusterCount).toBeGreaterThan(1);
    batch.updateLod(3, 10, 3_600);
    expect(batch.representationCount).toBe(1);
    batch.dispose();
  });

  it('affiche ensemble les résolutions mixtes et adapte leur densité à la qualité', () => {
    const batch = new StarClusterBatch(registry());

    batch.synchronizeTiles([tile('detail', 3, [-2, -1, 0]), tile('overview', 4, [1, 2])]);
    batch.setQuality('low');
    batch.setPixelRatio(0.1);
    batch.updateLod(2, 10);

    expect(batch.root.children).toHaveLength(2);
    expect(batch.visibleClusterCount).toBe(2);
    for (const child of batch.root.children) {
      const points = child as THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;

      expect(points.geometry.drawRange.count).toBe(1);
      expect(points.material.uniforms['pixelRatio']!.value).toBe(0.5);
    }

    batch.setQuality('medium');
    expect(batch.visibleClusterCount).toBe(3);
    expect(
      batch.root.children.reduce(
        (count, child) => count + (child as THREE.Points).geometry.drawRange.count,
        0,
      ),
    ).toBe(3);
    batch.setQuality('high');
    expect(batch.visibleClusterCount).toBe(5);
    expect(
      batch.root.children.reduce(
        (count, child) => count + (child as THREE.Points).geometry.drawRange.count,
        0,
      ),
    ).toBe(5);
    const aggregatePoints = batch.root.children.find(
      (child) => child.userData['pointRepresentation'] === 'aggregate-cell',
    ) as THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
    const aggregateSizes = aggregatePoints.geometry.getAttribute('pointSize');

    expect(
      Math.max(
        ...Array.from({ length: aggregateSizes.count }, (_, index) => aggregateSizes.getX(index)),
      ),
    ).toBeLessThanOrEqual(2.9);
    expect(aggregatePoints.material.uniforms['catalogSignature']!.value).toBe(0.22);

    batch.synchronizeTiles([]);
    batch.updateLod(2, 10);
    expect(batch.visibleClusterCount).toBe(0);
    expect(batch.representationCount).toBe(0);
    expect(batch.activeTileCount).toBe(0);
    batch.dispose();
  });

  it('réutilise un lot inchangé et libère toutes les ressources à la destruction', () => {
    const batch = new StarClusterBatch(registry());
    const active = [tile('stable', 4, [-1])];

    expect(batch.synchronizeTiles(active)).toBe(true);
    const points = batch.root.children[0] as THREE.Points;
    const geometryDispose = vi.spyOn(points.geometry, 'dispose');

    expect(batch.synchronizeTiles(active)).toBe(false);
    expect(batch.root.children[0]).toBe(points);
    batch.updateLod(99, 10);
    expect(batch.visibleClusterCount).toBe(0);

    const access = batch as unknown as { activeSignatures: readonly string[] };

    access.activeSignatures = ['missing'];
    expect(batch.activeTileCount).toBe(0);

    batch.dispose();
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(batch.root.children).toHaveLength(0);
  });

  it('masque sans erreur un niveau de tuile non pris en charge', () => {
    const batch = new StarClusterBatch(registry());

    batch.synchronizeTiles([{ ...tile('unsupported', 3, [-1]), lodLevel: 99 }]);
    batch.updateLod(2, 10);

    expect(batch.visibleClusterCount).toBe(0);
    batch.dispose();
  });

  it('fond les racines de la Voie lactée dans le Groupe local puis les masque', () => {
    const batch = new StarClusterBatch(registry());

    batch.synchronizeTiles([tile('overview', 4, [-1])]);
    batch.updateLod(2, 10);
    expect(batch.visibleClusterCount).toBe(1);

    batch.updateLod(3, 10);
    expect(batch.visibleClusterCount).toBe(1);
    const points = batch.root.children[0] as THREE.Points<
      THREE.BufferGeometry,
      THREE.ShaderMaterial
    >;

    expect(points.material.uniforms['clusterOpacity']!.value).toBeCloseTo(0.035, 5);

    batch.updateLod(4, 10);
    expect(points.material.uniforms['clusterOpacity']!.value).toBeCloseTo(0.012, 5);

    batch.updateLod(4, 10, 10_300);
    expect(points.material.uniforms['clusterOpacity']!.value).toBeCloseTo(0.0235, 5);
    expect(batch.visibleClusterCount).toBe(1);

    batch.updateLod(4, 10, 17_000);
    expect(points.material.uniforms['clusterOpacity']!.value).toBeCloseTo(0.012, 5);
    expect(batch.visibleClusterCount).toBe(1);

    batch.updateLod(5, 10, 120_000);
    expect(batch.visibleClusterCount).toBe(0);
    batch.dispose();
  });

  it('remplace progressivement les sources Gaia détaillées par une trame galactique discrète', () => {
    const batch = new StarClusterBatch(registry());

    batch.synchronizeTiles([tile('detail', 3, [-2]), tile('overview', 4, [1])]);
    batch.updateLod(2, 10, STELLAR_NEIGHBORHOOD_REVEAL_END);
    const detail = batch.root.children.find(
      (child) => child.userData['pointRepresentation'] === 'sampled-source',
    ) as THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
    const overview = batch.root.children.find(
      (child) => child.userData['pointRepresentation'] === 'aggregate-cell',
    ) as THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;

    expect(detail.visible).toBe(false);
    expect(detail.material.uniforms['clusterOpacity']!.value).toBe(0);
    expect(overview.visible).toBe(true);
    expect(overview.material.uniforms['clusterOpacity']!.value).toBeCloseTo(0.035, 5);

    const transitionMiddle = Math.sqrt(
      STELLAR_NEIGHBORHOOD_REVEAL_START * STELLAR_NEIGHBORHOOD_REVEAL_END,
    );

    batch.updateLod(2, 10, transitionMiddle);
    expect(detail.visible).toBe(true);
    expect(detail.material.uniforms['clusterOpacity']!.value).toBeGreaterThan(0);
    expect(detail.material.uniforms['clusterOpacity']!.value).toBeLessThan(0.96);
    expect(overview.material.uniforms['clusterOpacity']!.value).toBeLessThan(0.18);

    batch.updateLod(2, 10, STELLAR_NEIGHBORHOOD_REVEAL_START);
    expect(detail.material.uniforms['clusterOpacity']!.value).toBeCloseTo(0.96, 5);
    expect(overview.material.uniforms['clusterOpacity']!.value).toBeCloseTo(0.18, 5);
    batch.dispose();
  });
});

function registry(): StarCatalogRegistry {
  const catalog: StarCatalog = {
    count: 5,
    referenceEpochJulianDay: 2_451_545,
    positionsParsec: new Float32Array(15),
    velocitiesParsecPerYear: new Float32Array(15),
    apparentMagnitudes: new Float32Array(5),
    colorIndicesBv: new Float32Array(5),
    catalogIds: new Uint32Array([1, 2, 3, 4, 5]),
    names: ['A', 'B', 'C', 'D', 'E'],
    aliases: [[], [], [], [], []],
    spectralTypes: [null, null, null, null, null],
  };

  return new StarCatalogRegistry(catalog, new CoordinateSystem());
}

function tile(id: string, lodLevel: 3 | 4, magnitudes: number[]): StarClusterTile {
  const clusterCount = magnitudes.length;
  const start = id === 'b' ? 20 : lodLevel === 4 ? 40 : 1;

  return {
    id,
    parentId: lodLevel === 3 ? 'root' : undefined,
    version: '4.0.0',
    sourceCatalog: 'gaia-dr3-bright-high-confidence',
    sourceStarCount: clusterCount,
    referenceEpochJulianDay: 2_457_388.5,
    magnitudeBand: 'gaia-g',
    colorIndexSystem: 'gaia-bp-rp',
    lodLevel,
    cellSizeParsec: lodLevel === 3 ? 40 : 160,
    representation: lodLevel === 3 ? 'sampled-source' : 'aggregate-cell',
    clusterCount,
    cellCoordinates: Int32Array.from({ length: clusterCount * 3 }, (_, index) => index),
    positionsParsec: Float32Array.from({ length: clusterCount * 3 }, (_, index) => start + index),
    starCounts: Uint32Array.from({ length: clusterCount }, () => 1),
    apparentMagnitudes: Float32Array.from(magnitudes),
    colorIndices: Float32Array.from({ length: clusterCount }, (_, index) => index / 2),
  };
}
