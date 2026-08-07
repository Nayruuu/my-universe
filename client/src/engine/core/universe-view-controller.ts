import * as THREE from 'three';
import { type SpaceObject } from '../../data/models/universe.models';
import type { EarthObserverFraming } from '../camera/earth-observer-camera-control';
import {
  getMinimumNavigationDistance,
  getOrbitOverviewDistance,
} from '../camera/navigation-policy';
import { type NavigationScaleDefinition } from '../camera/navigation-scales';

const CATALOG_STAR_FOCUS_DISTANCE = 800;
const EXOPLANET_SYSTEM_FOCUS_DISTANCE = 72;

export interface UniverseViewCameraController {
  focusOn(position: THREE.Vector3, object: SpaceObject, distance?: number): void;
  focusOnFromDirection(
    position: THREE.Vector3,
    object: SpaceObject,
    direction: THREE.Vector3,
    distance?: number,
  ): void;
  observeFrom(position: THREE.Vector3, target: THREE.Vector3, framing?: EarthObserverFraming): void;
  completeFocusTransition(): void;
}

export interface UniverseViewRegistry {
  getDefinition(objectId: string): SpaceObject | undefined;
  getWorldPosition(objectId: string): THREE.Vector3 | null;
  getOrbitRadius(objectId: string): number | null;
}

export interface UniverseViewBindings {
  hasPrimaryRegistry(): boolean;
  getPrimaryRegistry(): UniverseViewRegistry | null;
  getRegistry(objectId: string): UniverseViewRegistry | null;
  getCameraController(): UniverseViewCameraController | null;
  getVerticalFieldOfView(): number | null;
  hasObject(objectId: string): boolean;
  getDefinition(objectId: string): SpaceObject | undefined;
  getWorldPosition(objectId: string): THREE.Vector3 | null;
  getConstellationFocusRadius(objectId: string): number | null | undefined;
  isExoplanetHost(objectId: string): boolean;
  isCatalogStar(objectId: string): boolean;
  ensureSpaceTileObject(objectId: string): Promise<void>;
  ensureActiveExoplanetSystem(objectId: string): void;
  ensureTempelFilamentSpines(): Promise<void>;
  clearPresentation(): void;
  clearNavigationLock(): void;
  adoptTarget(objectId: string): void;
  selectObject(objectId: string | null): void;
  emitTargetChanged(objectId: string): void;
}

export class UniverseViewController {
  constructor(private readonly bindings: UniverseViewBindings) {}

  public async setTarget(objectId: string, zoom?: number): Promise<void> {
    const cameraController = this.bindings.getCameraController();

    if (
      !this.bindings.hasPrimaryRegistry() ||
      !cameraController ||
      !this.bindings.hasObject(objectId)
    ) {
      throw new Error(`Objet astronomique introuvable : ${objectId}.`);
    }
    await this.bindings.ensureSpaceTileObject(objectId);
    this.bindings.ensureActiveExoplanetSystem(objectId);
    const position = this.bindings.getWorldPosition(objectId);
    const object = this.bindings.getDefinition(objectId);

    if (!this.bindings.hasPrimaryRegistry() || !position || !object) {
      throw new Error(`Position indisponible pour ${objectId}.`);
    }
    if (object.type === 'cosmic-filament') {
      await this.bindings.ensureTempelFilamentSpines();
    }

    this.prepareView(objectId, objectId);
    const constellationRadius = this.bindings.getConstellationFocusRadius(objectId);
    const verticalFieldOfView = this.bindings.getVerticalFieldOfView();
    const earthFacingDirection = this.getEarthFacingCatalogDirection(objectId, position);

    if (
      constellationRadius !== null &&
      constellationRadius !== undefined &&
      verticalFieldOfView !== null
    ) {
      cameraController.focusOnFromDirection(
        position,
        object,
        position.clone().negate(),
        zoom ?? getOrbitOverviewDistance(constellationRadius, verticalFieldOfView),
      );
    } else if (earthFacingDirection) {
      cameraController.focusOnFromDirection(
        position,
        object,
        earthFacingDirection,
        zoom ?? this.getCatalogFocusDistance(objectId),
      );
    } else {
      cameraController.focusOn(position, object, zoom ?? this.getCatalogFocusDistance(objectId));
    }
    this.bindings.emitTargetChanged(objectId);
  }

  public completeTargetTransition(): void {
    this.bindings.getCameraController()?.completeFocusTransition();
  }

  public async prepareEarthObservation(
    objectId: string,
    framing?: EarthObserverFraming,
    selectedObjectId: string | null = objectId,
  ): Promise<void> {
    const cameraController = this.bindings.getCameraController();

    if (
      !this.bindings.hasPrimaryRegistry() ||
      !cameraController ||
      !this.bindings.hasObject(objectId) ||
      !this.bindings.hasObject('earth')
    ) {
      throw new Error(`Observation terrestre indisponible pour ${objectId}.`);
    }
    await this.bindings.ensureSpaceTileObject(objectId);
    const targetPosition = this.bindings.getWorldPosition(objectId);
    const target = this.bindings.getDefinition(objectId);
    const earthPosition = this.bindings.getWorldPosition('earth');
    const earth = this.bindings.getDefinition('earth');

    if (!targetPosition || !target || !earthPosition || !earth) {
      throw new Error(`Observation terrestre indisponible pour ${objectId}.`);
    }
    const directionToTarget = targetPosition.clone().sub(earthPosition);

    if (directionToTarget.lengthSq() < Number.EPSILON) {
      throw new Error(`Observation terrestre indisponible pour ${objectId}.`);
    }
    const zenithDirection = framing?.zenithDirection;
    const surfaceDirection = zenithDirection
      ? new THREE.Vector3(zenithDirection.x, zenithDirection.y, zenithDirection.z).normalize()
      : directionToTarget.normalize();
    const observerPosition = earthPosition
      .clone()
      .addScaledVector(surfaceDirection, getMinimumNavigationDistance(earth));

    this.prepareView(objectId, selectedObjectId);
    cameraController.observeFrom(observerPosition, targetPosition, framing);
    this.bindings.emitTargetChanged(objectId);
  }

  public async viewRotation(objectId: string): Promise<void> {
    const object = this.bindings.getDefinition(objectId);

    if (!object?.rotation) {
      throw new Error(`Rotation indisponible pour ${object?.name ?? objectId}.`);
    }
    const distance = Math.max(
      object.visual.visualRadius * 4.4,
      getMinimumNavigationDistance(object) * 1.35,
    );

    await this.setTarget(objectId, distance);
  }

  public viewOrbit(objectId: string): void {
    this.bindings.ensureActiveExoplanetSystem(objectId);
    const registry = this.bindings.getRegistry(objectId);
    const cameraController = this.bindings.getCameraController();
    const verticalFieldOfView = this.bindings.getVerticalFieldOfView();
    const object = registry?.getDefinition(objectId);
    const parentId = object?.parentId;
    const parent = parentId ? registry?.getDefinition(parentId) : undefined;
    const parentPosition = parentId ? registry?.getWorldPosition(parentId) : null;
    const orbitRadius = registry?.getOrbitRadius(objectId);

    if (
      !registry ||
      !cameraController ||
      verticalFieldOfView === null ||
      !object ||
      !parentId ||
      !parent ||
      !parentPosition ||
      typeof orbitRadius !== 'number' ||
      orbitRadius <= 0
    ) {
      throw new Error(`Orbite indisponible pour ${object?.name ?? objectId}.`);
    }

    this.prepareView(parentId, objectId);
    cameraController.focusOnFromDirection(
      parentPosition,
      parent,
      new THREE.Vector3(1, 0.82, 1),
      getOrbitOverviewDistance(orbitRadius, verticalFieldOfView),
    );
    this.bindings.emitTargetChanged(parentId);
  }

  public viewScale(scale: NavigationScaleDefinition): void {
    const registry = this.bindings.getPrimaryRegistry();
    const cameraController = this.bindings.getCameraController();
    const target = registry?.getDefinition(scale.targetId);
    const targetPosition = registry?.getWorldPosition(scale.targetId);

    if (!registry || !cameraController || !target || !targetPosition) {
      throw new Error('Cadrage indisponible.');
    }

    this.prepareView(scale.targetId, null);
    cameraController.focusOnFromDirection(
      targetPosition,
      target,
      new THREE.Vector3(...scale.direction),
      scale.distance,
    );
    this.bindings.emitTargetChanged(scale.targetId);
  }

  private prepareView(targetId: string, selectedId: string | null): void {
    this.bindings.clearPresentation();
    this.bindings.clearNavigationLock();
    this.bindings.adoptTarget(targetId);
    this.bindings.selectObject(selectedId);
  }

  private getEarthFacingCatalogDirection(
    objectId: string,
    objectPosition: THREE.Vector3,
  ): THREE.Vector3 | null {
    if (!this.bindings.isCatalogStar(objectId)) {
      return null;
    }
    const earthPosition = this.bindings.getWorldPosition('earth');

    if (!earthPosition) {
      return null;
    }
    const direction = earthPosition.clone().sub(objectPosition);

    return direction.lengthSq() > Number.EPSILON ? direction.normalize() : null;
  }

  private getCatalogFocusDistance(objectId: string): number | undefined {
    if (this.bindings.isExoplanetHost(objectId)) {
      return EXOPLANET_SYSTEM_FOCUS_DISTANCE;
    }
    if (this.bindings.isCatalogStar(objectId)) {
      return CATALOG_STAR_FOCUS_DISTANCE;
    }

    return undefined;
  }
}
