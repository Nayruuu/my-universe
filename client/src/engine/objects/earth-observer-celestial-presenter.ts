import * as THREE from 'three';
import type { Vector3Like } from '../../data/models/universe.models';
import { calculateWorldDiameterForPixels } from '../lod/screen-space-lod';
import { requestCelestialLodTextures } from '../materials/celestial-visual-factory';
import { PICKING_LAYER } from '../selection/selection-layers';
import type { ObjectRegistryEntry } from './object-registry-entry';

export interface EarthObserverCelestialPresentation {
  readonly objectId: string;
  readonly direction: Vector3Like;
  readonly diameterPixels: number;
}

interface ObserverTransformSnapshot {
  readonly parent: THREE.Object3D;
  readonly visualRoot: THREE.Object3D;
  readonly position: THREE.Vector3;
  readonly quaternion: THREE.Quaternion;
  readonly scale: THREE.Vector3;
}

const EARTH_OBSERVER_BODY_IDS = new Set([
  'moon',
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
]);
const OBSERVER_PRESENTATION_DISTANCE = 1;
const OBSERVER_PRESENTATION_MODE = 'topocentric-angular-existing-object';
const MINIMUM_PROJECTION_DEPTH = 1e-6;

export class EarthObserverCelestialPresenter {
  private readonly observerRoot = new THREE.Group();
  private readonly presentations = new Map<string, EarthObserverCelestialPresentation>();
  private readonly presentationRoots = new Map<string, THREE.Group>();
  private readonly snapshots = new Map<string, ObserverTransformSnapshot>();
  private readonly cameraForward = new THREE.Vector3();
  private readonly compensationBasis = new THREE.Matrix4();
  private readonly compensationQuaternion = new THREE.Quaternion();
  private readonly direction = new THREE.Vector3();
  private readonly localPosition = new THREE.Vector3();
  private readonly observerQuaternion = new THREE.Quaternion();
  private readonly radialTangent = new THREE.Vector3();
  private readonly screenTangent = new THREE.Vector3();
  private readonly worldPosition = new THREE.Vector3();
  private active = false;

  constructor(
    registryRoot: THREE.Group,
    private readonly entries: ReadonlyMap<string, ObjectRegistryEntry>,
  ) {
    this.observerRoot.name = 'earth-observer-celestial-presentation';
    this.observerRoot.userData['scientificConfidence'] = 'calculated-angular-position';
    this.observerRoot.userData['visualScale'] = 'illustrative-readability-floor';
    registryRoot.add(this.observerRoot);
  }

  public setPresentations(presentations: readonly EarthObserverCelestialPresentation[]): void {
    this.presentations.clear();

    for (const presentation of presentations) {
      if (isValidPresentation(presentation) && EARTH_OBSERVER_BODY_IDS.has(presentation.objectId)) {
        this.presentations.set(presentation.objectId, presentation);
      }
    }
  }

  public update(
    camera: THREE.PerspectiveCamera,
    viewportHeight: number,
    observerActive: boolean,
  ): void {
    const shouldPresent = observerActive && this.presentations.size > 0;

    if (!shouldPresent) {
      this.restore();

      return;
    }
    if (!this.active) {
      this.adoptVisuals();
    }
    this.showExistingSunlight();
    this.observerRoot.updateWorldMatrix(true, false);

    for (const objectId of EARTH_OBSERVER_BODY_IDS) {
      const entry = this.entries.get(objectId);
      const presentation = this.presentations.get(objectId);
      const presentationRoot = this.presentationRoots.get(objectId);

      if (!entry || !presentationRoot) {
        continue;
      }
      if (!presentation) {
        this.hideEntry(entry);

        continue;
      }
      this.presentEntry(entry, presentationRoot, presentation, camera, viewportHeight);
    }
  }

  public dispose(): void {
    this.restore();
    this.observerRoot.removeFromParent();
    this.presentations.clear();
  }

  private adoptVisuals(): void {
    this.active = true;

    for (const objectId of EARTH_OBSERVER_BODY_IDS) {
      const entry = this.entries.get(objectId);
      const parent = entry?.visualRoot.parent;

      if (!entry || !parent) {
        continue;
      }
      this.snapshots.set(objectId, {
        parent,
        visualRoot: entry.visualRoot,
        position: entry.visualRoot.position.clone(),
        quaternion: entry.visualRoot.quaternion.clone(),
        scale: entry.visualRoot.scale.clone(),
      });
      const presentationRoot = new THREE.Group();

      presentationRoot.name = `${objectId}-earth-observer-presentation`;
      this.observerRoot.add(presentationRoot);
      presentationRoot.add(entry.visualRoot);
      this.presentationRoots.set(objectId, presentationRoot);
      entry.visualRoot.userData['observerPresentationMode'] = OBSERVER_PRESENTATION_MODE;
    }
  }

  private presentEntry(
    entry: ObjectRegistryEntry,
    presentationRoot: THREE.Group,
    presentation: EarthObserverCelestialPresentation,
    camera: THREE.PerspectiveCamera,
    viewportHeight: number,
  ): void {
    this.direction
      .set(presentation.direction.x, presentation.direction.y, presentation.direction.z)
      .normalize();
    camera.getWorldDirection(this.cameraForward);
    const projectionDepth = Math.max(
      MINIMUM_PROJECTION_DEPTH,
      THREE.MathUtils.clamp(this.direction.dot(this.cameraForward), 0, 1),
    );

    this.worldPosition
      .copy(camera.position)
      .addScaledVector(this.direction, OBSERVER_PRESENTATION_DISTANCE);
    this.localPosition.copy(this.worldPosition);
    this.observerRoot.worldToLocal(this.localPosition);

    const worldDiameter = calculateWorldDiameterForPixels(
      presentation.diameterPixels,
      OBSERVER_PRESENTATION_DISTANCE * projectionDepth,
      viewportHeight,
      camera.fov,
    );
    const visualDiameter = Math.max(entry.definition.visual.visualRadius * 2, Number.EPSILON);
    const scale = worldDiameter / visualDiameter;

    this.applyPerspectiveCompensation(presentationRoot, entry.visualRoot, camera, projectionDepth);
    presentationRoot.position.copy(this.localPosition);
    entry.visualRoot.position.set(0, 0, 0);
    entry.visualRoot.scale.setScalar(scale);
    entry.visualRoot.visible = true;
    entry.visualRoot.userData['observerPresentationActive'] = true;
    entry.visualRoot.userData['observerPresentationDiameterPixels'] = presentation.diameterPixels;
    entry.visualRoot.userData['observerPresentationProjectionDepth'] = projectionDepth;
    if (entry.lod.nearRoot) {
      entry.lod.nearRoot.visible = true;
    }
    if (entry.lod.farSprite) {
      entry.lod.farSprite.visible = false;
    }
    entry.lunarEclipse?.setVisibilityBlend(1);
    entry.pickTarget?.layers.disable(PICKING_LAYER);

    if (!entry.lod.deferredTexturesRequested) {
      requestCelestialLodTextures(entry.lod);
    }
    for (const managed of entry.lod.nearMaterials) {
      managed.material.opacity = managed.baseOpacity;
      managed.material.depthWrite = managed.baseDepthWrite;
      synchronizeLayerOpacityUniform(managed.material);
    }
  }

  private applyPerspectiveCompensation(
    presentationRoot: THREE.Group,
    visualRoot: THREE.Object3D,
    camera: THREE.PerspectiveCamera,
    projectionDepth: number,
  ): void {
    // A rectilinear/gnomonic projection dilates a spherical silhouette radially as it approaches
    // a viewport edge. Scale in the local radial tangent by cos(view angle), while sizing from the
    // optical depth, so the existing textured 3D body keeps a circular, constant-pixel silhouette.
    this.radialTangent.copy(this.direction).multiplyScalar(projectionDepth).sub(this.cameraForward);
    if (this.radialTangent.lengthSq() <= Number.EPSILON) {
      this.radialTangent.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    } else {
      this.radialTangent.normalize();
    }
    this.screenTangent.crossVectors(this.direction, this.radialTangent).normalize();
    this.compensationBasis.makeBasis(this.radialTangent, this.screenTangent, this.direction);
    this.compensationQuaternion.setFromRotationMatrix(this.compensationBasis);
    this.observerRoot.getWorldQuaternion(this.observerQuaternion);
    this.compensationQuaternion.premultiply(this.observerQuaternion.invert());

    presentationRoot.quaternion.copy(this.compensationQuaternion);
    presentationRoot.scale.set(projectionDepth, 1, 1);
    visualRoot.quaternion.copy(this.compensationQuaternion).invert();
  }

  private hideEntry(entry: ObjectRegistryEntry): void {
    entry.visualRoot.visible = false;
    entry.visualRoot.userData['observerPresentationActive'] = false;
    entry.lunarEclipse?.setVisibilityBlend(0);
  }

  private showExistingSunlight(): void {
    const sun = this.entries.get('sun');

    if (!sun) {
      return;
    }
    // The Sun's PointLight is a direct child of its visual root. Keeping only that root visible
    // preserves the same planetary illumination while the oversized map sphere stays hidden.
    sun.visualRoot.visible = true;
    if (sun.lod.nearRoot) {
      sun.lod.nearRoot.visible = false;
    }
    sun.pickTarget?.layers.disable(PICKING_LAYER);
    sun.visualRoot.userData['observerSunlightOnly'] = true;
  }

  private restore(): void {
    if (!this.active) {
      return;
    }
    this.active = false;

    for (const [objectId, snapshot] of this.snapshots) {
      snapshot.parent.add(snapshot.visualRoot);
      snapshot.visualRoot.position.copy(snapshot.position);
      snapshot.visualRoot.quaternion.copy(snapshot.quaternion);
      snapshot.visualRoot.scale.copy(snapshot.scale);
      delete snapshot.visualRoot.userData['observerPresentationActive'];
      delete snapshot.visualRoot.userData['observerPresentationDiameterPixels'];
      delete snapshot.visualRoot.userData['observerPresentationMode'];
      delete snapshot.visualRoot.userData['observerPresentationProjectionDepth'];
      this.presentationRoots.get(objectId)?.removeFromParent();
    }
    const sun = this.entries.get('sun');

    if (sun) {
      delete sun.visualRoot.userData['observerSunlightOnly'];
    }
    this.presentationRoots.clear();
    this.snapshots.clear();
  }
}

function isValidPresentation(presentation: EarthObserverCelestialPresentation): boolean {
  return (
    presentation.objectId.length > 0 &&
    Number.isFinite(presentation.direction.x) &&
    Number.isFinite(presentation.direction.y) &&
    Number.isFinite(presentation.direction.z) &&
    Math.hypot(presentation.direction.x, presentation.direction.y, presentation.direction.z) >
      Number.EPSILON &&
    Number.isFinite(presentation.diameterPixels) &&
    presentation.diameterPixels > 0
  );
}

function synchronizeLayerOpacityUniform(material: THREE.Material): void {
  if (!(material instanceof THREE.ShaderMaterial)) {
    return;
  }
  const layerOpacity = material.uniforms['layerOpacity'];

  if (layerOpacity) {
    layerOpacity.value = material.opacity;
  }
}
