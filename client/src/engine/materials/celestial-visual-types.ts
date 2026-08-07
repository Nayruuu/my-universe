import * as THREE from 'three';
import type { GalaxyVisualShape } from '../../data/models/universe.models';
import type { LunarEclipseVisual } from './lunar-eclipse-visual';
import type { SolarEclipseVisual } from './solar-eclipse-visual';
import type { SupernovaVisual } from './supernova-visual';
import type { CometActivityVisual } from './comet-activity-visual';

export interface ManagedLodMaterial {
  material: THREE.Material;
  baseOpacity: number;
  baseDepthWrite: boolean;
}

export interface DeferredCelestialResource {
  request(): Promise<void>;
  dispose(): void;
}

export interface CelestialLodRepresentation {
  nearRoot: THREE.Group | null;
  farSprite: THREE.Sprite | null;
  nearMaterials: ManagedLodMaterial[];
  deferredTextures: THREE.Texture[];
  deferredTexturesRequested: boolean;
  deferredResources?: DeferredCelestialResource[];
  nearBlend: number;
  visibilityBlend: number;
  farAlpha: number;
  farBaseOpacity: number;
  farBaseDiameter: number;
  farAspectRatio: number;
}

export interface CelestialVisual {
  root: THREE.Group;
  lensingForeground: THREE.Object3D | null;
  rotatingBody: THREE.Object3D | null;
  lunarEclipse: LunarEclipseVisual | null;
  solarEclipse: SolarEclipseVisual | null;
  supernova: SupernovaVisual | null;
  cometActivity?: CometActivityVisual;
  observerCorona: THREE.Sprite | null;
  pickables: THREE.Object3D[];
  lod: CelestialLodRepresentation;
}

export interface CelestialVisualAssets {
  glowTexture: THREE.Texture;
  photonRingTexture: THREE.Texture;
  galaxyTextures: Readonly<Record<GalaxyVisualShape, THREE.Texture>>;
  sphereGeometry: THREE.SphereGeometry;
  selectionGeometry: THREE.SphereGeometry;
  ringGeometry: THREE.RingGeometry;
  selectionMaterial: THREE.MeshBasicMaterial;
}

export function manageMaterial(material: THREE.Material): ManagedLodMaterial {
  return {
    material,
    baseOpacity: material.opacity,
    baseDepthWrite: material.depthWrite,
  };
}
