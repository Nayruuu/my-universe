import type * as THREE from 'three';

export interface TexturePrewarmTarget {
  initTexture(texture: THREE.Texture): void;
}

export interface RenderingPrewarmTarget extends TexturePrewarmTarget {
  compileAsync(scene: THREE.Object3D, camera: THREE.Camera): Promise<THREE.Object3D>;
}

export function prewarmTexture(target: TexturePrewarmTarget, texture: THREE.Texture): boolean {
  try {
    target.initTexture(texture);

    return true;
  } catch {
    return false;
  }
}

export async function prewarmSceneMaterials(
  target: RenderingPrewarmTarget,
  scene: THREE.Scene,
  camera: THREE.Camera,
): Promise<boolean> {
  try {
    await target.compileAsync(scene, camera);

    return true;
  } catch {
    return false;
  }
}
