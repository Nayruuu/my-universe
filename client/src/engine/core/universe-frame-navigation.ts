import * as THREE from 'three';
import { type GraphicQuality } from '../../data/models/universe.models';
import {
  dampPhotographicExposure,
  getPhotographicProfile,
} from '../rendering/photographic-profile';

export interface FrameCameraController {
  readonly controls: { readonly target: THREE.Vector3 };
  readonly distanceToTarget: number;
  readonly isTransitioning: boolean;
  update(deltaSeconds: number): void;
  shiftTrackedPosition(shift: THREE.Vector3): void;
}

export interface FrameFloatingOriginManager {
  update(
    spaceRoot: THREE.Group,
    camera: THREE.Camera,
    controlsTarget: THREE.Vector3,
    transitionInProgress: boolean,
  ): boolean;
}

export interface FrameLodManager {
  selectLevel(cameraDistance: number): number;
}

export interface UniverseFrameNavigationBindings {
  getQuality(): GraphicQuality;
  emitLodChanged(lodLevel: number): void;
}

export interface UniverseFrameNavigationServices {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;
  readonly spaceRoot: THREE.Group;
  readonly controller: FrameCameraController;
}

export class UniverseFrameNavigation {
  private readonly floatingOriginShift = new THREE.Vector3();
  private lastEmittedLodLevel = -1;

  constructor(
    private readonly floatingOriginManager: FrameFloatingOriginManager,
    private readonly lodManager: FrameLodManager,
    private readonly bindings: UniverseFrameNavigationBindings,
  ) {}

  public update(deltaSeconds: number, services: UniverseFrameNavigationServices): number {
    const { renderer, camera, spaceRoot, controller } = services;

    controller.update(deltaSeconds);
    this.floatingOriginShift.copy(controller.controls.target);
    const originShifted = this.floatingOriginManager.update(
      spaceRoot,
      camera,
      controller.controls.target,
      controller.isTransitioning,
    );

    if (originShifted) {
      controller.shiftTrackedPosition(this.floatingOriginShift);
    }

    const lodLevel = this.lodManager.selectLevel(controller.distanceToTarget);
    const photographicProfile = getPhotographicProfile(lodLevel, this.bindings.getQuality());

    renderer.toneMappingExposure = dampPhotographicExposure(
      renderer.toneMappingExposure,
      photographicProfile.exposure,
      deltaSeconds,
    );

    if (lodLevel !== this.lastEmittedLodLevel) {
      this.lastEmittedLodLevel = lodLevel;
      this.bindings.emitLodChanged(lodLevel);
    }

    return lodLevel;
  }
}
