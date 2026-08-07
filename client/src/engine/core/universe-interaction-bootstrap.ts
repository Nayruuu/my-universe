import * as THREE from 'three';
import type { GraphicQuality, LabelDensity } from '../../data/models/universe.models';
import { CameraController, type CameraSettledSource } from '../camera/camera-controller';
import { LabelManager, type LabelNameResolver, type LabelObject } from '../objects/label-manager';
import {
  SelectionManager,
  type BackgroundObjectReader,
  type LabelHoverCallback,
  type LabelObjectReader,
  type NavigationIntentCallback,
  type SelectionCallback,
  type SemanticZoomCallback,
} from '../selection/selection-manager';
import { RenderLoop, type RenderLoopCallback } from './render-loop';

type CameraSettledCallback = (distance: number, source: CameraSettledSource) => void;
type PickableReader = () => readonly THREE.Object3D[];

export interface UniverseInteractionBindings {
  handleCameraSettled: CameraSettledCallback;
  isObjectVisible(objectId: string): boolean;
  getPickables: PickableReader;
  handlePick: SelectionCallback;
  handleNavigationIntent: NavigationIntentCallback;
  getReferenceDistance(): number;
  isBackgroundObject: BackgroundObjectReader;
  hoverObject: LabelHoverCallback;
  handleSemanticZoomIntent: SemanticZoomCallback;
  supportsWheelNavigation: BackgroundObjectReader;
  renderFrame(deltaSeconds: number): void;
}

export interface UniverseInteractionFactories {
  createCameraController(
    camera: THREE.PerspectiveCamera,
    canvas: HTMLCanvasElement,
    onCameraSettled: CameraSettledCallback,
  ): CameraController;
  createLabelManager(
    container: HTMLElement,
    objects: readonly LabelObject[],
    quality: GraphicQuality,
    density: LabelDensity,
    isObjectVisible: (objectId: string) => boolean,
    nameResolver: LabelNameResolver,
  ): LabelManager;
  createSelectionManager(
    canvas: HTMLCanvasElement,
    camera: THREE.Camera,
    getPickables: PickableReader,
    getLabelObjectAt: LabelObjectReader,
    callback: SelectionCallback,
    navigationIntentCallback: NavigationIntentCallback,
    getReferenceDistance: () => number,
    isBackgroundObject: BackgroundObjectReader,
    labelHoverCallback: LabelHoverCallback,
    semanticZoomCallback: SemanticZoomCallback,
    isWheelNavigationObject: BackgroundObjectReader,
  ): SelectionManager;
  createRenderLoop(callback: RenderLoopCallback): RenderLoop;
}

export interface UniverseInteractionOptions {
  readonly container: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly camera: THREE.PerspectiveCamera;
  readonly labelObjects: readonly LabelObject[];
  readonly quality: GraphicQuality;
  readonly labelDensity: LabelDensity;
  readonly labelsEnabled: boolean;
  readonly labelNameResolver: LabelNameResolver;
}

export interface UniverseInteractionRuntime {
  readonly cameraController: CameraController;
  readonly labelManager: LabelManager;
  readonly selectionManager: SelectionManager;
  readonly renderLoop: RenderLoop;
}

const DEFAULT_INTERACTION_FACTORIES: UniverseInteractionFactories = {
  createCameraController: (camera, canvas, onCameraSettled) =>
    new CameraController(camera, canvas, onCameraSettled),
  createLabelManager: (container, objects, quality, density, isObjectVisible, nameResolver) =>
    new LabelManager(container, objects, quality, density, isObjectVisible, nameResolver),
  createSelectionManager: (
    canvas,
    camera,
    getPickables,
    getLabelObjectAt,
    callback,
    navigationIntentCallback,
    getReferenceDistance,
    isBackgroundObject,
    labelHoverCallback,
    semanticZoomCallback,
    isWheelNavigationObject,
  ) =>
    new SelectionManager(
      canvas,
      camera,
      getPickables,
      getLabelObjectAt,
      callback,
      navigationIntentCallback,
      getReferenceDistance,
      isBackgroundObject,
      labelHoverCallback,
      semanticZoomCallback,
      isWheelNavigationObject,
    ),
  createRenderLoop: (callback) => new RenderLoop(callback),
};

export class UniverseInteractionBootstrap {
  constructor(
    private readonly bindings: UniverseInteractionBindings,
    private readonly factories: UniverseInteractionFactories = DEFAULT_INTERACTION_FACTORIES,
  ) {}

  public create(options: UniverseInteractionOptions): UniverseInteractionRuntime {
    const createdResources: Array<{ dispose(): void }> = [];

    try {
      const cameraController = this.factories.createCameraController(
        options.camera,
        options.canvas,
        this.bindings.handleCameraSettled,
      );

      createdResources.push(cameraController);
      const labelManager = this.factories.createLabelManager(
        options.container,
        options.labelObjects,
        options.quality,
        options.labelDensity,
        this.bindings.isObjectVisible,
        options.labelNameResolver,
      );

      createdResources.push(labelManager);
      labelManager.setEnabled(options.labelsEnabled);
      const selectionManager = this.factories.createSelectionManager(
        options.canvas,
        options.camera,
        this.bindings.getPickables,
        (clientX, clientY) => labelManager.hitTest(clientX, clientY),
        this.bindings.handlePick,
        this.bindings.handleNavigationIntent,
        this.bindings.getReferenceDistance,
        this.bindings.isBackgroundObject,
        (objectId) => {
          labelManager.setHoveredObject(objectId);
          this.bindings.hoverObject(objectId);
        },
        this.bindings.handleSemanticZoomIntent,
        this.bindings.supportsWheelNavigation,
      );

      createdResources.push(selectionManager);
      const renderLoop = this.factories.createRenderLoop(this.bindings.renderFrame);

      return {
        cameraController,
        labelManager,
        selectionManager,
        renderLoop,
      };
    } catch (error) {
      for (const resource of createdResources.reverse()) {
        resource.dispose();
      }
      throw error;
    }
  }
}
