import * as THREE from 'three';
import { getObservedBodyShapeDefinition } from './observed-body-shapes';
import { loadObservedShapeAsset } from './observed-shape-loader';
import {
  manageMaterial,
  type DeferredCelestialResource,
  type ManagedLodMaterial,
} from './celestial-visual-types';

export type ObservedShapeAssetLoader = typeof loadObservedShapeAsset;

export interface DeferredObservedShapeOptions {
  readonly objectId: string;
  readonly rotatingRoot: THREE.Group;
  readonly fallbackBody: THREE.Mesh;
  readonly visualRadius: number;
  readonly nearMaterials: ManagedLodMaterial[];
  readonly loadAsset?: ObservedShapeAssetLoader;
}

export function createDeferredObservedShape(
  options: DeferredObservedShapeOptions,
): DeferredCelestialResource | null {
  const definition = getObservedBodyShapeDefinition(options.objectId);

  if (!definition) {
    return null;
  }
  const loadAsset = options.loadAsset ?? loadObservedShapeAsset;
  let requestPromise: Promise<void> | null = null;
  let observedRoot: THREE.Group | null = null;
  let disposed = false;

  return {
    request(): Promise<void> {
      if (requestPromise) {
        return requestPromise;
      }
      if (disposed) {
        return Promise.resolve();
      }
      requestPromise = loadAndAttachObservedShape(
        definition,
        options,
        loadAsset,
        () => disposed,
        (root) => {
          observedRoot = root;
        },
      );

      return requestPromise;
    },
    dispose(): void {
      disposed = true;
      options.fallbackBody.visible = true;
      if (observedRoot) {
        observedRoot.removeFromParent();
        disposeShapeTree(observedRoot);
        observedRoot = null;
      }
    },
  };
}

async function loadAndAttachObservedShape(
  definition: NonNullable<ReturnType<typeof getObservedBodyShapeDefinition>>,
  options: DeferredObservedShapeOptions,
  loadAsset: ObservedShapeAssetLoader,
  isDisposed: () => boolean,
  onAttached: (root: THREE.Group) => void,
): Promise<void> {
  let loaded: THREE.Object3D | null = null;
  let normalized: THREE.Group | null = null;

  try {
    loaded = await loadAsset(definition);

    if (isDisposed()) {
      disposeShapeTree(loaded);
      loaded = null;

      return;
    }
    normalized = normalizeObservedShape(loaded, definition, options.objectId, options.visualRadius);

    prepareObservedShapeMaterials(loaded, definition, options.nearMaterials);
    options.rotatingRoot.add(normalized);
    options.fallbackBody.visible = false;
    options.rotatingRoot.userData['observedShapeSource'] = definition.sourceName;
    options.rotatingRoot.userData['observedShapeSourceUrl'] = definition.sourceUrl;
    onAttached(normalized);
    loaded = null;
    normalized = null;
  } catch (error) {
    normalized?.removeFromParent();
    if (normalized) {
      disposeShapeTree(normalized);
    } else if (loaded) {
      disposeShapeTree(loaded);
    }
    options.rotatingRoot.userData['observedShapeLoadError'] = String(error);
  }
}

function normalizeObservedShape(
  loaded: THREE.Object3D,
  definition: NonNullable<ReturnType<typeof getObservedBodyShapeDefinition>>,
  objectId: string,
  visualRadius: number,
): THREE.Group {
  alignObservedShapeAxes(loaded, definition);
  const bounds = new THREE.Box3().setFromObject(loaded);
  const size = bounds.getSize(new THREE.Vector3());
  const maximumDimension = Math.max(size.x, size.y, size.z);

  if (!Number.isFinite(maximumDimension) || maximumDimension <= 0) {
    throw new Error(`Le modèle de ${objectId} ne contient aucune géométrie exploitable.`);
  }
  const center = bounds.getCenter(new THREE.Vector3());
  const centeredContent = new THREE.Group();
  const root = new THREE.Group();

  loaded.position.sub(center);
  centeredContent.scale.setScalar((visualRadius * 2) / maximumDimension);
  centeredContent.add(loaded);
  root.name = `${objectId}-observed-shape`;
  root.userData['scientificConfidence'] = definition.scientificConfidence;
  root.add(centeredContent);

  return root;
}

function alignObservedShapeAxes(
  loaded: THREE.Object3D,
  definition: NonNullable<ReturnType<typeof getObservedBodyShapeDefinition>>,
): void {
  if (definition.sourceCoordinateSystem === 'damit-z-up') {
    // DAMIT: +Z is north and +Y is east. Renderer: +Y is north and +Z is west.
    loaded.rotateX(-Math.PI / 2);
  }
}

function prepareObservedShapeMaterials(
  loaded: THREE.Object3D,
  definition: NonNullable<ReturnType<typeof getObservedBodyShapeDefinition>>,
  nearMaterials: ManagedLodMaterial[],
): void {
  if (definition.format === 'obj') {
    replaceObjMaterials(loaded, definition, nearMaterials);

    return;
  }
  const materials = collectShapeMaterials(loaded);

  for (const material of materials) {
    material.transparent = true;
    material.userData['visualStyle'] = 'observed-textured-shape';
    material.userData['shapeConfidence'] = definition.scientificConfidence;
    material.userData['surfaceConfidence'] = definition.surfaceConfidence;
    if (material instanceof THREE.MeshStandardMaterial) {
      material.metalness = 0;
      material.roughness = 0.94;
      applyIllustrativeShadowFill(material, definition.illustrativeShadowFill);
    }
    nearMaterials.push(manageMaterial(material));
  }
}

function applyIllustrativeShadowFill(
  material: THREE.MeshStandardMaterial,
  intensity: number | undefined,
): void {
  if (!material.map || intensity === undefined) {
    return;
  }
  material.emissive.set(0xffffff);
  material.emissiveMap = material.map;
  material.emissiveIntensity = intensity;
  material.userData['shadowFill'] = 'illustrative';
}

function replaceObjMaterials(
  loaded: THREE.Object3D,
  definition: NonNullable<ReturnType<typeof getObservedBodyShapeDefinition>>,
  nearMaterials: ManagedLodMaterial[],
): void {
  const replacement = new THREE.MeshStandardMaterial({
    color: definition.fallbackColor,
    roughness: 0.96,
    metalness: 0,
    transparent: true,
  });
  const replacedMaterials = new Set<THREE.Material>();

  replacement.userData['visualStyle'] = 'observed-shape-illustrative-surface';
  replacement.userData['shapeConfidence'] = definition.scientificConfidence;
  replacement.userData['surfaceConfidence'] = definition.surfaceConfidence;
  if (definition.illustrativeShadowFill !== undefined) {
    replacement.emissive.set(definition.fallbackColor);
    replacement.emissiveIntensity = definition.illustrativeShadowFill;
    replacement.userData['shadowFill'] = 'illustrative';
  }
  loaded.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      addMaterials(replacedMaterials, object.material);
      object.material = replacement;
    }
  });
  disposeMaterials(replacedMaterials);
  nearMaterials.push(manageMaterial(replacement));
}

function collectShapeMaterials(root: THREE.Object3D): Set<THREE.Material> {
  const materials = new Set<THREE.Material>();

  root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      addMaterials(materials, object.material);
    }
  });

  return materials;
}

function addMaterials(
  target: Set<THREE.Material>,
  material: THREE.Material | THREE.Material[],
): void {
  for (const entry of Array.isArray(material) ? material : [material]) {
    target.add(entry);
  }
}

function disposeShapeTree(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = collectShapeMaterials(root);

  root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      geometries.add(object.geometry);
    }
  });
  disposeMaterials(materials);
  for (const geometry of geometries) {
    geometry.dispose();
  }
}

function disposeMaterials(materials: ReadonlySet<THREE.Material>): void {
  const textures = new Set<THREE.Texture>();

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
}
