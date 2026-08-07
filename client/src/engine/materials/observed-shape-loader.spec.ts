import * as THREE from 'three';
import { getObservedBodyShapeDefinition } from './observed-body-shapes';
import { loadObservedShapeAsset } from './observed-shape-loader';

const loaderMocks = vi.hoisted(() => ({
  gltf: vi.fn(),
  obj: vi.fn(),
}));

vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    public readonly loadAsync = loaderMocks.gltf;
  },
}));

vi.mock('three/examples/jsm/loaders/OBJLoader.js', () => ({
  OBJLoader: class {
    public readonly loadAsync = loaderMocks.obj;
  },
}));

describe('loadObservedShapeAsset', () => {
  beforeEach(() => {
    loaderMocks.gltf.mockReset();
    loaderMocks.obj.mockReset();
  });

  it('charge différément une scène glTF', async () => {
    const scene = new THREE.Group();

    loaderMocks.gltf.mockResolvedValue({ scene });
    const definition = getObservedBodyShapeDefinition('bennu')!;

    await expect(loadObservedShapeAsset(definition)).resolves.toBe(scene);
    expect(loaderMocks.gltf).toHaveBeenCalledWith('models/bennu-nasa-vtad.glb');
  });

  it('charge différément un objet OBJ', async () => {
    const object = new THREE.Group();

    loaderMocks.obj.mockResolvedValue(object);
    const definition = getObservedBodyShapeDefinition('67p-churyumov-gerasimenko')!;

    await expect(loadObservedShapeAsset(definition)).resolves.toBe(object);
    expect(loaderMocks.obj).toHaveBeenCalledWith('models/67p-osiris-esa.obj');
  });
});
