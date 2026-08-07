import * as THREE from 'three';
import { manageMaterial } from './celestial-visual-types';

describe('celestial visual types', () => {
  it('capture les valeurs LOD initiales d’un matériau', () => {
    const material = new THREE.MeshBasicMaterial({ opacity: 0.42, depthWrite: false });

    const managed = manageMaterial(material);

    expect(managed).toEqual({
      material,
      baseOpacity: 0.42,
      baseDepthWrite: false,
    });
    material.dispose();
  });
});
