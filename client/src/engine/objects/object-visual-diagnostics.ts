import * as THREE from 'three';
import type { CelestialLodRepresentation } from '../materials/celestial-visual-types';
import { DEFERRED_TEXTURE_SOURCE } from '../materials/planetary-textures';

export interface ObjectSurfaceTextureDiagnostics {
  readonly requested: boolean;
  readonly loaded: boolean;
  readonly source: string | null;
  readonly width: number;
  readonly height: number;
}

export interface ObjectVisualDiagnostics {
  readonly objectId: string;
  readonly bodyPresent: boolean;
  readonly bodyVisible: boolean;
  readonly visualVisible: boolean;
  readonly nearVisible: boolean;
  readonly nearBlend: number;
  readonly visibilityBlend: number;
  readonly opacity: number;
  readonly transparent: boolean;
  readonly depthTest: boolean;
  readonly depthWrite: boolean;
  readonly surfaceTexture: ObjectSurfaceTextureDiagnostics;
}

export interface ObjectVisualDiagnosticsSource {
  readonly objectId: string;
  readonly visualRoot: THREE.Object3D;
  readonly rotatingBody: THREE.Object3D | null;
  readonly lod: CelestialLodRepresentation;
}

const NO_SURFACE_TEXTURE: ObjectSurfaceTextureDiagnostics = {
  requested: false,
  loaded: false,
  source: null,
  width: 0,
  height: 0,
};

export function createObjectVisualDiagnostics(
  source: ObjectVisualDiagnosticsSource,
): ObjectVisualDiagnostics {
  const body = source.rotatingBody;
  const bodyMesh = findVisibleBodyMesh(body);
  const material = bodyMesh ? firstMaterial(bodyMesh.material) : null;
  const texture = material ? surfaceTexture(material) : null;

  return {
    objectId: source.objectId,
    bodyPresent: body !== null,
    bodyVisible: body?.visible ?? false,
    visualVisible: source.visualRoot.visible,
    nearVisible: source.lod.nearRoot?.visible ?? false,
    nearBlend: source.lod.nearBlend,
    visibilityBlend: source.lod.visibilityBlend,
    opacity: material?.opacity ?? 0,
    transparent: material?.transparent ?? false,
    depthTest: material?.depthTest ?? false,
    depthWrite: material?.depthWrite ?? false,
    surfaceTexture: texture ? textureDiagnostics(texture, source.lod) : NO_SURFACE_TEXTURE,
  };
}

function findVisibleBodyMesh(body: THREE.Object3D | null): THREE.Mesh | null {
  if (body instanceof THREE.Mesh) {
    return body;
  }
  let bodyMesh: THREE.Mesh | null = null;

  body?.traverse((object) => {
    if (!bodyMesh && object instanceof THREE.Mesh && object.visible) {
      bodyMesh = object;
    }
  });

  return bodyMesh;
}

function firstMaterial(material: THREE.Material | THREE.Material[]): THREE.Material | null {
  return Array.isArray(material) ? (material[0] ?? null) : material;
}

function surfaceTexture(material: THREE.Material): THREE.Texture | null {
  const candidate = Reflect.get(material, 'map') as unknown;

  return candidate instanceof THREE.Texture ? candidate : null;
}

function textureDiagnostics(
  texture: THREE.Texture,
  lod: CelestialLodRepresentation,
): ObjectSurfaceTextureDiagnostics {
  const image = texture.image as unknown;
  const deferredSource = texture.userData[DEFERRED_TEXTURE_SOURCE];
  const source =
    typeof deferredSource === 'string'
      ? deferredSource
      : (readImageString(image, 'currentSrc') ??
        readImageAttribute(image, 'src') ??
        readImageString(image, 'src'));
  const width = readImageDimension(image, 'naturalWidth', 'width');
  const height = readImageDimension(image, 'naturalHeight', 'height');
  const loaded = width > 0 && height > 0;

  return {
    requested: lod.deferredTexturesRequested || loaded || source !== null,
    loaded,
    source,
    width,
    height,
  };
}

function readImageDimension(image: unknown, preferred: string, fallback: string): number {
  return readImageNumber(image, preferred) ?? readImageNumber(image, fallback) ?? 0;
}

function readImageNumber(image: unknown, property: string): number | null {
  const value = readImageProperty(image, property);

  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function readImageString(image: unknown, property: string): string | null {
  const value = readImageProperty(image, property);

  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readImageAttribute(image: unknown, attribute: string): string | null {
  const getter = readImageProperty(image, 'getAttribute');

  if (typeof getter !== 'function') {
    return null;
  }
  const value: unknown = Reflect.apply(getter, image, [attribute]);

  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readImageProperty(image: unknown, property: string): unknown {
  return typeof image === 'object' && image !== null ? Reflect.get(image, property) : undefined;
}
