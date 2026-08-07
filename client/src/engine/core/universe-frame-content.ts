import * as THREE from 'three';
import { type GraphicQuality } from '../../data/models/universe.models';
import { type SpaceStreamingFrame } from './space-streaming-coordinator';

export interface FrameContentStreamingCoordinator {
  update(frame: SpaceStreamingFrame, deltaSeconds: number): void;
}

export interface FrameContentObjectRuntime {
  updateLod(
    camera: THREE.PerspectiveCamera,
    viewportHeight: number,
    lodLevel: number,
    deltaSeconds: number,
    earthObserverActive?: boolean,
  ): void;
}

export interface FrameContentScene {
  readonly spaceRoot: THREE.Group;
  ensureMilkyWayAtlas(): Promise<boolean>;
  updateLod(
    lodLevel: number,
    deltaSeconds: number,
    cameraDistance: number,
    cameraPosition: THREE.Vector3,
    earthObserverActive?: boolean,
    navigationTargetId?: string | null,
  ): void;
}

export interface FrameContentCameraController {
  readonly distanceToTarget: number;
  readonly isTransitioning: boolean;
  readonly observerModeActive: boolean;
  readonly observerPresentationActive?: boolean;
  readonly observerSkyContentActive?: boolean;
}

export interface UniverseFrameContentBindings {
  getStreamingCoordinator(): FrameContentStreamingCoordinator | null;
  getQuality(): GraphicQuality;
  getTargetId(): string | null;
  getSelectedId(): string | null;
  preloadTempelFilamentSpines(): Promise<void>;
  ensureTempelFilamentSpines(): Promise<void>;
}

export interface UniverseFrameContentServices {
  readonly camera: THREE.PerspectiveCamera;
  readonly universeScene: FrameContentScene;
  readonly controller: FrameContentCameraController;
  readonly viewportHeight: number;
}

export class UniverseFrameContent {
  constructor(
    private readonly objectRuntime: FrameContentObjectRuntime,
    private readonly bindings: UniverseFrameContentBindings,
  ) {}

  public update(
    deltaSeconds: number,
    services: UniverseFrameContentServices,
    lodLevel: number,
  ): void {
    const { camera, universeScene, controller, viewportHeight } = services;
    const earthObserverActive =
      controller.observerSkyContentActive ?? controller.observerModeActive === true;
    const earthObserverPresentationActive =
      controller.observerPresentationActive === true || earthObserverActive;

    this.bindings.getStreamingCoordinator()?.update(
      {
        camera,
        viewportHeight,
        lodLevel,
        quality: this.bindings.getQuality(),
        worldOffset: universeScene.spaceRoot.position,
        transitioning: controller.isTransitioning,
        targetId: this.bindings.getTargetId(),
        selectedId: this.bindings.getSelectedId(),
      },
      deltaSeconds,
    );
    if (lodLevel >= 0 && lodLevel <= 4) {
      void universeScene.ensureMilkyWayAtlas();
    }
    if (lodLevel === 5) {
      void this.bindings.preloadTempelFilamentSpines();
    } else if (lodLevel >= 6) {
      void this.bindings.ensureTempelFilamentSpines();
    }
    this.objectRuntime.updateLod(
      camera,
      viewportHeight,
      lodLevel,
      deltaSeconds,
      earthObserverActive,
    );
    universeScene.updateLod(
      lodLevel,
      deltaSeconds,
      controller.distanceToTarget,
      camera.position,
      earthObserverPresentationActive,
      this.bindings.getTargetId(),
    );
  }
}
