import * as THREE from 'three';
import type { SpaceObject } from '../../data/models/universe.models';
import type { LunarEclipseVisual } from '../materials/lunar-eclipse-visual';
import { PICKING_LAYER } from '../selection/selection-layers';
import {
  EarthObserverCelestialPresenter,
  type EarthObserverCelestialPresentation,
} from './earth-observer-celestial-presenter';
import type { ObjectRegistryEntry } from './object-registry-entry';

describe('EarthObserverCelestialPresenter', () => {
  it('ignore les présentations invalides et tolère un registre encore incomplet', () => {
    const registryRoot = new THREE.Group();
    const entries = new Map<string, ObjectRegistryEntry>();
    const presenter = new EarthObserverCelestialPresenter(registryRoot, entries);
    const camera = new THREE.PerspectiveCamera(48, 1, 0.025, 100);
    const invalidPresentations: EarthObserverCelestialPresentation[] = [
      presentation('', { x: 0, y: 0, z: -1 }, 20),
      presentation('jupiter', { x: Number.NaN, y: 0, z: -1 }, 20),
      presentation('jupiter', { x: 0, y: Number.NaN, z: -1 }, 20),
      presentation('jupiter', { x: 0, y: 0, z: Number.NaN }, 20),
      presentation('jupiter', { x: 0, y: 0, z: 0 }, 20),
      presentation('jupiter', { x: 0, y: 0, z: -1 }, Number.NaN),
      presentation('jupiter', { x: 0, y: 0, z: -1 }, 0),
      presentation('earth', { x: 0, y: 0, z: -1 }, 20),
    ];

    presenter.setPresentations(invalidPresentations);
    presenter.update(camera, 900, true);

    const parentlessJupiter = createEntry('jupiter', { attachVisualRoot: false });

    entries.set('jupiter', parentlessJupiter.entry);
    presenter.setPresentations([presentation('jupiter', { x: 0, y: 0, z: -1 }, 20)]);
    presenter.update(camera, 900, true);
    presenter.update(camera, 900, true);

    expect(parentlessJupiter.entry.visualRoot.parent).toBeNull();
    presenter.dispose();
    expect(registryRoot.children).toHaveLength(0);
  });

  it('gère les variantes LOD sans doublonner de ressource et restaure les entrées restantes', () => {
    const registryRoot = new THREE.Group();
    const layerMaterial = new THREE.ShaderMaterial({
      opacity: 0,
      uniforms: { layerOpacity: { value: 0 } },
    });
    const shaderWithoutLayer = new THREE.ShaderMaterial({ opacity: 0, uniforms: {} });
    const farSprite = new THREE.Sprite(new THREE.SpriteMaterial());
    const jupiter = createEntry('jupiter', {
      nearRoot: null,
      farSprite,
      deferredTexturesRequested: true,
      materials: [
        { material: layerMaterial, baseOpacity: 0.7, baseDepthWrite: true },
        { material: shaderWithoutLayer, baseOpacity: 0.4, baseDepthWrite: false },
      ],
      pickTarget: null,
    });
    const moonBlend = vi.fn();
    const moon = createEntry('moon', { lunarVisibilityBlend: moonBlend });
    const sun = createEntry('sun', { nearRoot: null, pickTarget: null });
    const detachedVenus = createEntry('venus', { attachVisualRoot: false });
    const entries = new Map<string, ObjectRegistryEntry>([
      ['jupiter', jupiter.entry],
      ['moon', moon.entry],
      ['sun', sun.entry],
      ['venus', detachedVenus.entry],
    ]);

    registryRoot.add(jupiter.node, moon.node, sun.node, detachedVenus.node);
    const presenter = new EarthObserverCelestialPresenter(registryRoot, entries);
    const camera = new THREE.PerspectiveCamera(48, 1, 0.025, 100);

    presenter.setPresentations([
      presentation('jupiter', { x: 0, y: 0, z: -1 }, 44),
      presentation('moon', { x: 0, y: 1, z: 0 }, 36),
    ]);
    presenter.update(camera, 900, true);

    expect(farSprite.visible).toBe(false);
    expect(layerMaterial.opacity).toBe(0.7);
    expect(layerMaterial.uniforms['layerOpacity']?.value).toBe(0.7);
    expect(shaderWithoutLayer.opacity).toBe(0.4);
    expect(shaderWithoutLayer.depthWrite).toBe(false);
    expect(moonBlend).toHaveBeenCalledWith(1);
    expect(sun.entry.visualRoot.visible).toBe(true);
    expect(detachedVenus.entry.visualRoot.parent).toBeNull();

    presenter.setPresentations([presentation('jupiter', { x: 0, y: 0, z: -1 }, 44)]);
    presenter.update(camera, 900, true);
    expect(moonBlend).toHaveBeenLastCalledWith(0);

    entries.delete('moon');
    presenter.update(camera, 900, false);

    expect(jupiter.entry.visualRoot.parent).toBe(jupiter.node);
    expect(sun.entry.visualRoot.userData['observerSunlightOnly']).toBeUndefined();
    presenter.dispose();
  });

  it('conserve une silhouette circulaire et un diamètre stable jusqu’au bord du ciel', () => {
    const viewport = { width: 2_304, height: 1_041 };
    const registryRoot = new THREE.Group();
    const moon = createEntry('moon');
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32));
    const entries = new Map<string, ObjectRegistryEntry>([['moon', moon.entry]]);
    const camera = new THREE.PerspectiveCamera(82, viewport.width / viewport.height, 0.025, 100);
    const presenter = new EarthObserverCelestialPresenter(registryRoot, entries);

    moon.entry.visualRoot.add(sphere);
    registryRoot.add(moon.node);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    presenter.setPresentations([presentation('moon', viewportDirection(camera, 0, 0), 34)]);
    presenter.update(camera, viewport.height, true);
    registryRoot.updateWorldMatrix(true, true);
    const centered = projectedBounds(sphere, camera, viewport);

    presenter.setPresentations([presentation('moon', viewportDirection(camera, -0.82, 0.28), 34)]);
    presenter.update(camera, viewport.height, true);
    registryRoot.updateWorldMatrix(true, true);
    const peripheral = projectedBounds(sphere, camera, viewport);

    expect(centered.width).toBeCloseTo(34, 0);
    expect(centered.height).toBeCloseTo(34, 0);
    expect(peripheral.width).toBeCloseTo(34, 0);
    expect(peripheral.height).toBeCloseTo(34, 0);
    expect(peripheral.width / peripheral.height).toBeCloseTo(1, 2);
    expect(moon.entry.visualRoot.userData['observerPresentationProjectionDepth']).toBeLessThan(0.6);

    presenter.dispose();
    sphere.geometry.dispose();
  });
});

function presentation(
  objectId: string,
  direction: { readonly x: number; readonly y: number; readonly z: number },
  diameterPixels: number,
): EarthObserverCelestialPresentation {
  return { objectId, direction, diameterPixels };
}

function createEntry(
  objectId: string,
  options: {
    readonly attachVisualRoot?: boolean;
    readonly nearRoot?: THREE.Group | null;
    readonly farSprite?: THREE.Sprite | null;
    readonly deferredTexturesRequested?: boolean;
    readonly materials?: ObjectRegistryEntry['lod']['nearMaterials'];
    readonly pickTarget?: THREE.Object3D | null;
    readonly lunarVisibilityBlend?: ReturnType<typeof vi.fn>;
  } = {},
): { readonly entry: ObjectRegistryEntry; readonly node: THREE.Group } {
  const node = new THREE.Group();
  const visualRoot = new THREE.Group();
  const nearRoot = options.nearRoot === undefined ? new THREE.Group() : options.nearRoot;
  const pickTarget = options.pickTarget === undefined ? new THREE.Object3D() : options.pickTarget;
  const definition: SpaceObject = {
    id: objectId,
    name: objectId,
    type: objectId === 'moon' ? 'moon' : objectId === 'sun' ? 'star' : 'planet',
    referenceFrame: 'solar-system',
    scientificConfidence: 'calculated',
    visual: { scaleMode: 'adaptive', visualRadius: 1 },
    positionProvider: { type: 'static', position: [0, 0, 0], unit: 'kilometer' },
  };

  node.name = objectId;
  visualRoot.name = `${objectId}-visual`;
  if (nearRoot) {
    visualRoot.add(nearRoot);
  }
  if (options.farSprite) {
    visualRoot.add(options.farSprite);
  }
  if (pickTarget) {
    pickTarget.layers.enable(PICKING_LAYER);
    visualRoot.add(pickTarget);
  }
  if (options.attachVisualRoot !== false) {
    node.add(visualRoot);
  }
  const entry: ObjectRegistryEntry = {
    definition,
    node,
    visualRoot,
    lensingForeground: null,
    rotatingBody: null,
    lunarEclipse: options.lunarVisibilityBlend
      ? ({ setVisibilityBlend: options.lunarVisibilityBlend } as unknown as LunarEclipseVisual)
      : null,
    solarEclipse: null,
    supernova: null,
    cometActivity: null,
    observerCorona: null,
    lod: {
      nearRoot,
      farSprite: options.farSprite ?? null,
      nearMaterials: options.materials ?? [],
      deferredTextures: [],
      deferredTexturesRequested: options.deferredTexturesRequested ?? false,
      nearBlend: 0,
      visibilityBlend: 0,
      farAlpha: 0,
      farBaseOpacity: 0,
      farBaseDiameter: 0,
      farAspectRatio: 1,
    },
    farBatchIndex: null,
    pickTarget,
    provider: { getPositionAt: () => ({ x: 0, y: 0, z: 0 }) },
  };

  return { entry, node };
}

function viewportDirection(
  camera: THREE.PerspectiveCamera,
  normalizedX: number,
  normalizedY: number,
): { readonly x: number; readonly y: number; readonly z: number } {
  return new THREE.Vector3(normalizedX, normalizedY, 0.5)
    .unproject(camera)
    .sub(camera.position)
    .normalize();
}

function projectedBounds(
  mesh: THREE.Mesh<THREE.SphereGeometry>,
  camera: THREE.PerspectiveCamera,
  viewport: { readonly width: number; readonly height: number },
): { readonly width: number; readonly height: number } {
  const positions = mesh.geometry.attributes['position'];
  const projected = new THREE.Vector3();
  let minimumX = Number.POSITIVE_INFINITY;
  let maximumX = Number.NEGATIVE_INFINITY;
  let minimumY = Number.POSITIVE_INFINITY;
  let maximumY = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < positions.count; index += 1) {
    projected.fromBufferAttribute(positions, index).applyMatrix4(mesh.matrixWorld).project(camera);
    minimumX = Math.min(minimumX, projected.x);
    maximumX = Math.max(maximumX, projected.x);
    minimumY = Math.min(minimumY, projected.y);
    maximumY = Math.max(maximumY, projected.y);
  }

  return {
    width: ((maximumX - minimumX) * viewport.width) / 2,
    height: ((maximumY - minimumY) * viewport.height) / 2,
  };
}
