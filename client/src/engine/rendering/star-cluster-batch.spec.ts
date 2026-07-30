import * as THREE from 'three';
import { type StarClusterTile } from '../../data/models/universe.models';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import { type StarCatalog } from '../loaders/star-catalog';
import { StarCatalogRegistry } from '../objects/star-catalog-registry';
import { StarClusterBatch } from './star-cluster-batch';

describe('StarClusterBatch', () => {
  it('conserve les cellules en cache sans les afficher comme un amas galactique', () => {
    const batch = new StarClusterBatch(registry());

    batch.synchronizeTiles([tile('a', 3, [-1, 2]), tile('b', 3, [-3])]);
    batch.setPixelRatio(1.5);
    batch.setQuality('high');
    batch.updateLod(3, 10);

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
    expect(points.visible).toBe(false);
    expect((points.material as THREE.ShaderMaterial).uniforms['clusterOpacity']!.value).toBe(0);
    expect(batch.activeTileCount).toBe(2);
    expect(batch.visibleClusterCount).toBe(0);
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

  it('libère immédiatement un ancien lot masqué', () => {
    const batch = new StarClusterBatch(registry());

    batch.synchronizeTiles([tile('old', 3, [-1, 0])]);
    batch.updateLod(3, 10);
    const oldPoints = batch.root.children[0] as THREE.Points;
    const geometryDispose = vi.spyOn(oldPoints.geometry, 'dispose');
    const materialDispose = vi.spyOn(oldPoints.material as THREE.Material, 'dispose');

    batch.synchronizeTiles([tile('new', 3, [-2])]);
    expect(batch.root.children).toHaveLength(2);
    expect(oldPoints.visible).toBe(false);

    batch.updateLod(3, 0);
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(batch.root.children).toHaveLength(1);
    batch.updateLod(3, 10);
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(batch.root.children).toHaveLength(1);
    expect(batch.activeTileCount).toBe(1);
    expect(batch.visibleClusterCount).toBe(0);
    batch.dispose();
  });

  it('borne les changements rapides à un lot actif et un seul lot sortant', () => {
    const batch = new StarClusterBatch(registry());

    batch.synchronizeTiles([tile('first', 3, [-1])]);
    batch.updateLod(3, 10);
    const firstPoints = batch.root.children[0] as THREE.Points;
    const firstGeometryDispose = vi.spyOn(firstPoints.geometry, 'dispose');

    batch.synchronizeTiles([tile('second', 3, [-2])]);
    batch.updateLod(3, 0.25);
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

  it('affiche ensemble les résolutions mixtes et adapte leur densité à la qualité', () => {
    const batch = new StarClusterBatch(registry());

    batch.synchronizeTiles([tile('detail', 3, [-2, -1, 0]), tile('overview', 4, [1, 2])]);
    batch.setQuality('low');
    batch.setPixelRatio(0.1);
    batch.updateLod(3, 10);

    expect(batch.root.children).toHaveLength(2);
    expect(batch.visibleClusterCount).toBe(0);
    for (const child of batch.root.children) {
      const points = child as THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;

      expect(points.geometry.drawRange.count).toBe(1);
      expect(points.material.uniforms['pixelRatio']!.value).toBe(0.5);
    }

    batch.setQuality('medium');
    expect(batch.visibleClusterCount).toBe(0);
    expect(
      batch.root.children.reduce(
        (count, child) => count + (child as THREE.Points).geometry.drawRange.count,
        0,
      ),
    ).toBe(3);
    batch.setQuality('high');
    expect(batch.visibleClusterCount).toBe(0);
    expect(
      batch.root.children.reduce(
        (count, child) => count + (child as THREE.Points).geometry.drawRange.count,
        0,
      ),
    ).toBe(5);

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
    batch.updateLod(3, 10);

    expect(batch.visibleClusterCount).toBe(0);
    batch.dispose();
  });

  it('masque aussi l’aperçu agrégé dans la Voie lactée', () => {
    const batch = new StarClusterBatch(registry());

    batch.synchronizeTiles([tile('overview', 4, [-1])]);
    batch.updateLod(3, 10);
    expect(batch.visibleClusterCount).toBe(0);

    batch.updateLod(4, 10);
    expect(batch.visibleClusterCount).toBe(0);
    batch.dispose();
  });
});

function registry(): StarCatalogRegistry {
  const catalog: StarCatalog = {
    count: 5,
    referenceEpochJulianDay: 2_451_545,
    positionsParsec: new Float32Array(15),
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
    version: '2.0.0',
    sourceCatalog: 'hyg-v41-bright-stars',
    sourceStarCount: clusterCount,
    referenceEpochJulianDay: 2_451_545,
    lodLevel,
    cellSizeParsec: lodLevel === 3 ? 40 : 160,
    clusterCount,
    cellCoordinates: Int32Array.from({ length: clusterCount * 3 }, (_, index) => index),
    positionsParsec: Float32Array.from({ length: clusterCount * 3 }, (_, index) => start + index),
    starCounts: Uint32Array.from({ length: clusterCount }, () => 1),
    apparentMagnitudes: Float32Array.from(magnitudes),
    colorIndicesBv: Float32Array.from({ length: clusterCount }, (_, index) => index / 2),
  };
}
