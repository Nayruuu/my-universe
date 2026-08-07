import type * as THREE from 'three';
import type {
  FrameContentCameraController,
  FrameContentScene,
  UniverseFrameContent,
  UniverseFrameContentServices,
} from './universe-frame-content';
import type {
  FrameCameraController,
  UniverseFrameNavigation,
  UniverseFrameNavigationServices,
} from './universe-frame-navigation';
import type {
  UniverseFrameRenderer,
  UniverseFrameRenderingServices,
} from './universe-frame-renderer';
import type { FrameSimulationRegistry, UniverseFrameSimulation } from './universe-frame-simulation';

export type UniverseFrameScene = FrameContentScene & {
  readonly scene: THREE.Scene;
};

export type UniverseFrameController = FrameCameraController & FrameContentCameraController;

export type UniverseFrameServices = UniverseFrameContentServices &
  UniverseFrameNavigationServices &
  UniverseFrameRenderingServices & {
    readonly registry: FrameSimulationRegistry;
  };

export interface UniverseFrameRuntimeBindings {
  getRenderer(): THREE.WebGLRenderer | null;
  getCamera(): THREE.PerspectiveCamera | null;
  getUniverseScene(): UniverseFrameScene | null;
  getRegistry(): FrameSimulationRegistry | null;
  getController(): UniverseFrameController | null;
  getLensingPass(): UniverseFrameRenderingServices['lensingPass'] | null;
  getViewportSize(renderer: THREE.WebGLRenderer): {
    readonly width: number;
    readonly height: number;
  };
  updateDebugStats(deltaSeconds: number): void;
}

export class UniverseFrameRuntime {
  constructor(
    private readonly simulation: Pick<UniverseFrameSimulation, 'update'>,
    private readonly navigation: Pick<UniverseFrameNavigation, 'update'>,
    private readonly content: Pick<UniverseFrameContent, 'update'>,
    private readonly frameRenderer: Pick<UniverseFrameRenderer, 'render'>,
    private readonly bindings: UniverseFrameRuntimeBindings,
  ) {}

  public render(deltaSeconds: number): void {
    const services = this.resolveServices();

    if (!services) {
      return;
    }

    this.simulation.update(deltaSeconds, services.registry);
    const lodLevel = this.navigation.update(deltaSeconds, services);

    this.content.update(deltaSeconds, services, lodLevel);
    this.frameRenderer.render(deltaSeconds, services, lodLevel);
    this.bindings.updateDebugStats(deltaSeconds);
  }

  private resolveServices(): UniverseFrameServices | null {
    const renderer = this.bindings.getRenderer();
    const camera = this.bindings.getCamera();
    const universeScene = this.bindings.getUniverseScene();
    const registry = this.bindings.getRegistry();
    const controller = this.bindings.getController();
    const lensingPass = this.bindings.getLensingPass();

    if (!renderer || !camera || !universeScene || !registry || !controller || !lensingPass) {
      return null;
    }
    const viewport = this.bindings.getViewportSize(renderer);

    return {
      renderer,
      camera,
      scene: universeScene.scene,
      spaceRoot: universeScene.spaceRoot,
      universeScene,
      registry,
      controller,
      lensingPass,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
    };
  }
}
