import * as THREE from 'three';
import { type GraphicQuality, type SpaceObject } from '../../data/models/universe.models';
import {
  type BlackHoleLensingPass,
  projectBlackHoleLensing,
} from '../rendering/black-hole-lensing-pass';

export type BlackHoleLensingProjector = typeof projectBlackHoleLensing;

export interface UniverseFrameLensingRegistry {
  getLensingForeground(objectId: string): THREE.Object3D | null;
}

export type UniverseFrameWorldPositionReader = (
  objectId: string,
  target: THREE.Vector3,
) => THREE.Vector3 | null;

export interface UniverseFrameRendererBindings {
  getTargetId(): string | null;
  getSelectedId(): string | null;
  getQuality(): GraphicQuality;
  labelsAllowed(): boolean;
  getDefinition(objectId: string): SpaceObject | undefined;
  getWorldPosition(objectId: string, target: THREE.Vector3): THREE.Vector3 | null;
  getRegistry(objectId: string): UniverseFrameLensingRegistry | null;
  renderLabels(
    camera: THREE.Camera,
    readWorldPosition: UniverseFrameWorldPositionReader,
    lodLevel: number,
    activeObjectId: string | null,
  ): void;
  clearLabels(): void;
}

export interface UniverseFrameRenderingServices {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;
  readonly scene: THREE.Scene;
  readonly lensingPass: Pick<BlackHoleLensingPass, 'render'>;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
}

export class UniverseFrameRenderer {
  private readonly lensingPosition = new THREE.Vector3();
  private readonly readWorldPosition: UniverseFrameWorldPositionReader;

  constructor(
    private readonly bindings: UniverseFrameRendererBindings,
    private readonly projectLensing: BlackHoleLensingProjector = projectBlackHoleLensing,
  ) {
    this.readWorldPosition = (objectId, target) => this.bindings.getWorldPosition(objectId, target);
  }

  public render(
    deltaSeconds: number,
    services: UniverseFrameRenderingServices,
    lodLevel: number,
  ): void {
    const { renderer, camera, scene, lensingPass, viewportWidth, viewportHeight } = services;
    const targetId = this.bindings.getTargetId();
    const selectedId = this.bindings.getSelectedId();
    const lensingObjectId = targetId ?? selectedId;
    const lensingObject = lensingObjectId
      ? this.bindings.getDefinition(lensingObjectId)
      : undefined;
    const lensingPosition = lensingObjectId
      ? this.bindings.getWorldPosition(lensingObjectId, this.lensingPosition)
      : null;
    const lensingEffect = this.projectLensing(
      lensingObject,
      lensingPosition,
      camera,
      viewportWidth,
      viewportHeight,
      this.bindings.getQuality(),
    );
    const lensingRegistry = lensingObjectId ? this.bindings.getRegistry(lensingObjectId) : null;
    const lensingForeground =
      lensingObjectId && lensingRegistry
        ? lensingRegistry.getLensingForeground(lensingObjectId)
        : null;

    lensingPass.render(renderer, scene, camera, lensingEffect, lensingForeground, deltaSeconds);

    if (this.bindings.labelsAllowed()) {
      this.bindings.renderLabels(camera, this.readWorldPosition, lodLevel, selectedId ?? targetId);

      return;
    }
    this.bindings.clearLabels();
  }
}
