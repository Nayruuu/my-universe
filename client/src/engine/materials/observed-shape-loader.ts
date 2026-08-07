import type * as THREE from 'three';
import type { ObservedBodyShapeDefinition } from './observed-body-shapes';

export async function loadObservedShapeAsset(
  definition: ObservedBodyShapeDefinition,
): Promise<THREE.Object3D> {
  if (definition.format === 'gltf') {
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
    const gltf = await new GLTFLoader().loadAsync(definition.assetPath);

    return gltf.scene;
  }

  const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');

  return new OBJLoader().loadAsync(definition.assetPath);
}
