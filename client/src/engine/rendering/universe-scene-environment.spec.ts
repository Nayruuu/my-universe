import * as THREE from 'three';
import { PerformanceManager } from '../performance/performance-manager';
import { getPhotographicProfile } from './photographic-profile';
import { UniverseSceneEnvironment } from './universe-scene-environment';

describe('UniverseSceneEnvironment', () => {
  it('installe, anime puis retire les couches photographiques autour des racines de scène', () => {
    const scene = new THREE.Scene();
    const spaceRoot = new THREE.Group();
    const stellarNeighborhoodRoot = new THREE.Group();

    scene.add(spaceRoot);
    spaceRoot.add(stellarNeighborhoodRoot);

    const environment = new UniverseSceneEnvironment(
      scene,
      spaceRoot,
      stellarNeighborhoodRoot,
      new PerformanceManager(),
    );
    const background = scene.getObjectByName('scale-aware-cosmic-background');

    expect(background).toBeInstanceOf(THREE.Mesh);
    expect(spaceRoot.getObjectByName('illustrative-milky-way-volume')).toBeInstanceOf(THREE.Group);
    expect(stellarNeighborhoodRoot.children.length).toBeGreaterThan(0);

    environment.setQuality('high');
    environment.setPixelRatio(1.25);
    environment.update(2, 1, 2_400, getPhotographicProfile(2, 'high'), { x: 12, y: 0, z: 0 });

    expect((scene.background as THREE.Color).getHex()).not.toBe(0x010208);
    expect((scene.fog as THREE.FogExp2).color.getHex()).not.toBe(0x02030a);

    environment.dispose();

    expect(background?.parent).toBeNull();
    expect(spaceRoot.getObjectByName('illustrative-milky-way-volume')).toBeUndefined();
  });
});
