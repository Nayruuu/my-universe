import * as THREE from 'three';
import type { ManagedLodMaterial } from './celestial-visual-types';
import {
  createDeferredObservedShape,
  type ObservedShapeAssetLoader,
} from './deferred-observed-shape';

describe('deferred observed shape', () => {
  it('ne crée aucune ressource pour un corps sans forme embarquée', () => {
    expect(
      createDeferredObservedShape({
        objectId: 'eris',
        rotatingRoot: new THREE.Group(),
        fallbackBody: new THREE.Mesh(),
        visualRadius: 1,
        nearMaterials: [],
      }),
    ).toBeNull();
  });

  it('n’engage aucun chargement après une destruction anticipée', async () => {
    const root = new THREE.Group();
    const fallback = new THREE.Mesh();
    const resource = createDeferredObservedShape({
      objectId: 'bennu',
      rotatingRoot: root,
      fallbackBody: fallback,
      visualRadius: 1,
      nearMaterials: [],
    })!;

    resource.dispose();
    await expect(resource.request()).resolves.toBeUndefined();
    expect(fallback.visible).toBe(true);
  });

  it('remplace le fallback par le modèle Dawn texturé, lisible, centré et normalisé', async () => {
    const texture = new THREE.Texture();
    const material = new THREE.MeshStandardMaterial({ map: texture, metalness: 0.5 });
    const geometry = new THREE.BoxGeometry(4, 2, 1);
    const mesh = new THREE.Mesh(geometry, material);
    const basicMaterial = new THREE.MeshBasicMaterial();
    const basicMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), basicMaterial);
    const loaded = new THREE.Group();
    const fixture = createFixture('ceres', async () => loaded);

    mesh.position.set(6, -2, 1);
    loaded.add(mesh, basicMesh);
    const firstRequest = fixture.resource!.request();
    const secondRequest = fixture.resource!.request();

    expect(fixture.fallback.visible).toBe(true);
    expect(firstRequest).toBe(secondRequest);
    await firstRequest;

    const observed = fixture.root.getObjectByName('ceres-observed-shape');
    const bounds = new THREE.Box3().setFromObject(observed!);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());

    expect(fixture.loader).toHaveBeenCalledOnce();
    expect(fixture.fallback.visible).toBe(false);
    expect(observed).toBeInstanceOf(THREE.Group);
    expect(observed?.userData['scientificConfidence']).toBe('observed');
    expect(Math.max(size.x, size.y, size.z)).toBeCloseTo(0.24);
    expect(center.length()).toBeLessThan(1e-6);
    expect(material.transparent).toBe(true);
    expect(material.metalness).toBe(0);
    expect(material.roughness).toBeCloseTo(0.94);
    expect(material.emissive.getHex()).toBe(0xffffff);
    expect(material.emissiveMap).toBe(texture);
    expect(material.emissiveIntensity).toBeCloseTo(0.16);
    expect(material.userData['shadowFill']).toBe('illustrative');
    expect(material.userData['shapeConfidence']).toBe('observed');
    expect(material.userData['surfaceConfidence']).toBe('observed');
    expect(basicMaterial.transparent).toBe(true);
    expect(basicMaterial.userData['visualStyle']).toBe('observed-textured-shape');
    expect(fixture.nearMaterials.map(({ material: entry }) => entry)).toContain(material);
    expect(fixture.nearMaterials.map(({ material: entry }) => entry)).toContain(basicMaterial);
  });

  it('applique une surface neutre au modèle OSIRIS et libère ses matières importées', async () => {
    const sourceTexture = new THREE.Texture();
    const firstSource = new THREE.MeshBasicMaterial({ map: sourceTexture });
    const secondSource = new THREE.MeshBasicMaterial();
    const geometry = new THREE.BoxGeometry(2, 1, 1);
    const mesh = new THREE.Mesh(geometry, [firstSource, secondSource]);
    const loaded = new THREE.Group();
    const firstDispose = vi.spyOn(firstSource, 'dispose');
    const secondDispose = vi.spyOn(secondSource, 'dispose');
    const textureDispose = vi.spyOn(sourceTexture, 'dispose');
    const fixture = createFixture('67p-churyumov-gerasimenko', async () => loaded);

    loaded.add(mesh);
    await fixture.resource!.request();

    expect(firstDispose).toHaveBeenCalledOnce();
    expect(secondDispose).toHaveBeenCalledOnce();
    expect(textureDispose).toHaveBeenCalledOnce();
    expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
    const material = mesh.material as unknown as THREE.MeshStandardMaterial;

    expect(material.color.getHexString()).toBe('85817b');
    expect(material.userData['visualStyle']).toBe('observed-shape-illustrative-surface');
    expect(material.userData['shapeConfidence']).toBe('observed');
    expect(material.userData['surfaceConfidence']).toBe('illustrative');
    expect(fixture.nearMaterials.map(({ material: entry }) => entry)).toContain(material);
  });

  it('aligne le pôle Z du modèle DAMIT sur le pôle Y du moteur', async () => {
    const geometry = new THREE.BoxGeometry(2, 4, 6);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    const loaded = new THREE.Group();
    const fixture = createFixture('pallas', async () => loaded);

    loaded.add(mesh);
    await fixture.resource!.request();

    const observed = fixture.root.getObjectByName('pallas-observed-shape');
    const size = new THREE.Box3().setFromObject(observed!).getSize(new THREE.Vector3());

    expect(size.x).toBeCloseTo(0.08);
    expect(size.y).toBeCloseTo(0.24);
    expect(size.z).toBeCloseTo(0.16);
    expect(observed?.userData['scientificConfidence']).toBe('calculated');
    const material = mesh.material as unknown as THREE.MeshStandardMaterial;

    expect(material.emissive.getHexString()).toBe('8e8b86');
    expect(material.emissiveIntensity).toBeCloseTo(0.12);
    expect(material.userData['shadowFill']).toBe('illustrative');
  });

  it('conserve la sphère de secours quand le chargement échoue', async () => {
    const fixture = createFixture('bennu', async () => {
      throw new Error('asset unavailable');
    });

    await expect(fixture.resource!.request()).resolves.toBeUndefined();
    expect(fixture.fallback.visible).toBe(true);
    expect(fixture.root.getObjectByName('bennu-observed-shape')).toBeUndefined();
    expect(fixture.root.userData['observedShapeLoadError']).toContain('asset unavailable');
  });

  it('libère le modèle chargé et rend le fallback à nouveau visible', async () => {
    const texture = new THREE.Texture();
    const material = new THREE.MeshStandardMaterial({ map: texture });
    const geometry = new THREE.BoxGeometry();
    const loaded = new THREE.Group();
    const fixture = createFixture('bennu', async () => loaded);
    const textureDispose = vi.spyOn(texture, 'dispose');
    const materialDispose = vi.spyOn(material, 'dispose');
    const geometryDispose = vi.spyOn(geometry, 'dispose');

    loaded.add(new THREE.Mesh(geometry, material));
    await fixture.resource!.request();
    fixture.resource!.dispose();

    expect(fixture.root.getObjectByName('bennu-observed-shape')).toBeUndefined();
    expect(fixture.fallback.visible).toBe(true);
    expect(textureDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(geometryDispose).toHaveBeenCalledOnce();
    await fixture.resource!.request();
    expect(fixture.loader).toHaveBeenCalledOnce();
  });

  it('libère aussi une réponse tardive après destruction sans l’attacher à la scène', async () => {
    let resolveAsset!: (asset: THREE.Object3D) => void;
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial();
    const texture = new THREE.Texture();

    material.map = texture;
    const loaded = new THREE.Group();

    loaded.add(new THREE.Mesh(geometry, material));
    const fixture = createFixture(
      'bennu',
      () =>
        new Promise((resolve) => {
          resolveAsset = resolve;
        }),
    );
    const geometryDispose = vi.spyOn(geometry, 'dispose');
    const materialDispose = vi.spyOn(material, 'dispose');
    const textureDispose = vi.spyOn(texture, 'dispose');
    const request = fixture.resource!.request();

    fixture.resource!.dispose();
    resolveAsset(loaded);
    await request;

    expect(fixture.root.getObjectByName('bennu-observed-shape')).toBeUndefined();
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(textureDispose).toHaveBeenCalledOnce();
  });

  it('rejette proprement un modèle sans étendue géométrique', async () => {
    const geometry = new THREE.BufferGeometry();
    const texture = new THREE.Texture();
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const loaded = new THREE.Group();
    const geometryDispose = vi.spyOn(geometry, 'dispose');
    const materialDispose = vi.spyOn(material, 'dispose');
    const textureDispose = vi.spyOn(texture, 'dispose');

    loaded.add(new THREE.Mesh(geometry, material));
    const fixture = createFixture('bennu', async () => loaded);

    await fixture.resource!.request();

    expect(fixture.fallback.visible).toBe(true);
    expect(fixture.root.userData['observedShapeLoadError']).toContain('géométrie exploitable');
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(textureDispose).toHaveBeenCalledOnce();
  });

  it('libère le groupe normalisé si la préparation de sa matière échoue', async () => {
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshStandardMaterial();
    const loaded = new THREE.Group();
    const root = new THREE.Group();
    const fallback = new THREE.Mesh();
    const geometryDispose = vi.spyOn(geometry, 'dispose');
    const materialDispose = vi.spyOn(material, 'dispose');

    loaded.add(new THREE.Mesh(geometry, material));
    root.add(fallback);
    const resource = createDeferredObservedShape({
      objectId: 'bennu',
      rotatingRoot: root,
      fallbackBody: fallback,
      visualRadius: 0.12,
      nearMaterials: Object.freeze([]) as unknown as ManagedLodMaterial[],
      loadAsset: async () => loaded,
    })!;

    await resource.request();

    expect(root.getObjectByName('bennu-observed-shape')).toBeUndefined();
    expect(fallback.visible).toBe(true);
    expect(root.userData['observedShapeLoadError']).toBeDefined();
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
  });
});

function createFixture(objectId: string, loadAsset: ObservedShapeAssetLoader) {
  const root = new THREE.Group();
  const fallback = new THREE.Mesh(new THREE.SphereGeometry(), new THREE.MeshStandardMaterial());
  const nearMaterials: ManagedLodMaterial[] = [];
  const loader = vi.fn(loadAsset);
  const resource = createDeferredObservedShape({
    objectId,
    rotatingRoot: root,
    fallbackBody: fallback,
    visualRadius: 0.12,
    nearMaterials,
    loadAsset: loader,
  });

  root.add(fallback);

  return { root, fallback, nearMaterials, loader, resource };
}
