import * as THREE from 'three';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import { StarCatalog } from '../loaders/star-catalog';
import { StarCatalogRegistry } from '../objects/star-catalog-registry';
import { PerformanceManager } from '../performance/performance-manager';
import { UniverseScene } from './universe-scene';

describe('UniverseScene', () => {
  it('fonctionne sans catalogue dense et adapte la Voie lactée', () => {
    const scene = new UniverseScene(new PerformanceManager());
    const target = new THREE.Vector3();

    scene.setQuality('low');
    scene.setQuality('medium');
    scene.setQuality('high');
    scene.updateLod(2, 0);
    scene.updateLod(4, 1);
    scene.selectCatalogObject(null);
    expect(scene.getCatalogWorldPosition('unknown')).toBeNull();
    expect(scene.getCatalogWorldPosition('unknown', target)).toBeNull();
    expect(scene.getCatalogPickables()).toEqual([]);
    expect(scene.visibleCatalogStarCount).toBe(0);
    expect(scene.catalogStarCount).toBe(0);

    scene.dispose();
    expect(scene.scene.children).toHaveLength(0);
  });

  it('installe, remplace, sélectionne et détruit un catalogue stellaire', async () => {
    const scene = new UniverseScene(new PerformanceManager());
    const first = catalogRegistry(3_229);
    const second = catalogRegistry(6_960);

    await scene.setStarCatalog(first);
    await scene.setStarCatalog(second);
    scene.setQuality('high');
    scene.updateLod(1, 1);
    scene.selectCatalogObject('hyg-6960');

    expect(scene.catalogStarCount).toBe(1);
    expect(scene.visibleCatalogStarCount).toBe(1);
    expect(scene.getCatalogWorldPosition('hyg-6960')).toBeInstanceOf(THREE.Vector3);
    expect(scene.getCatalogWorldPosition('unknown')).toBeNull();
    expect(scene.getCatalogPickables()).toHaveLength(2);

    scene.selectCatalogObject(null);
    scene.dispose();
    expect(scene.catalogStarCount).toBe(0);
  });

  it('libère tous les types de ressources Three.js ajoutés à la scène', () => {
    const scene = new UniverseScene(new PerformanceManager());
    const texture = new THREE.Texture();
    const meshMaterial = new THREE.MeshBasicMaterial({ map: texture });
    const secondMaterial = new THREE.MeshBasicMaterial();
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const meshGeometry = new THREE.BoxGeometry();
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(1, 0, 0),
    ]);
    const lineMaterial = new THREE.LineBasicMaterial();
    const mesh = new THREE.Mesh(meshGeometry, [meshMaterial, secondMaterial]);
    const line = new THREE.Line(lineGeometry, lineMaterial);
    const sprite = new THREE.Sprite(spriteMaterial);
    const textureDispose = vi.spyOn(texture, 'dispose');
    const meshDispose = vi.spyOn(meshGeometry, 'dispose');
    const lineDispose = vi.spyOn(lineGeometry, 'dispose');

    scene.scene.add(mesh, line, sprite);
    scene.dispose();

    expect(textureDispose).toHaveBeenCalledTimes(2);
    expect(meshDispose).toHaveBeenCalledOnce();
    expect(lineDispose).toHaveBeenCalledOnce();
  });
});

function catalogRegistry(id: number): StarCatalogRegistry {
  const catalog: StarCatalog = {
    count: 1,
    referenceEpochJulianDay: 2_451_545,
    catalogIds: new Uint32Array([id]),
    positionsParsec: new Float32Array([1, 2, 3]),
    apparentMagnitudes: new Float32Array([0.5]),
    colorIndicesBv: new Float32Array([0.2]),
    names: [`Étoile ${id}`],
    aliases: [[]],
    spectralTypes: ['G2V'],
  };

  return new StarCatalogRegistry(catalog, new CoordinateSystem());
}
