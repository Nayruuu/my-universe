import * as THREE from 'three';

export function disposeObjectRegistryTree(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  root.traverse((object) => {
    if (
      object instanceof THREE.Mesh ||
      object instanceof THREE.Points ||
      object instanceof THREE.Line
    ) {
      geometries.add(object.geometry);
      const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];

      for (const material of objectMaterials) {
        materials.add(material);
      }
    } else if (object instanceof THREE.Sprite) {
      materials.add(object.material);
    }
  });

  for (const material of materials) {
    for (const value of Object.values(material)) {
      if (value instanceof THREE.Texture) {
        textures.add(value);
      }
    }
  }
  for (const texture of textures) {
    texture.dispose();
  }
  for (const material of materials) {
    material.dispose();
  }
  for (const geometry of geometries) {
    geometry.dispose();
  }
}
