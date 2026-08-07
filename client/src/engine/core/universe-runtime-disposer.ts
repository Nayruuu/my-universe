export interface DisposableRuntimeResource {
  dispose(): void;
}

export interface RuntimeRendererResource extends DisposableRuntimeResource {
  readonly renderLists: DisposableRuntimeResource;
  readonly domElement: {
    remove(): void;
  };
}

export type UniverseDisposableResources = readonly [
  streamingCoordinator: DisposableRuntimeResource | null,
  selectionManager: DisposableRuntimeResource | null,
  cameraController: DisposableRuntimeResource | null,
  labelManager: DisposableRuntimeResource | null,
  objectRuntime: DisposableRuntimeResource,
  universeScene: DisposableRuntimeResource | null,
  lensingPass: DisposableRuntimeResource | null,
];

export class UniverseRuntimeDisposer {
  public dispose(
    resources: UniverseDisposableResources,
    renderer: RuntimeRendererResource | null,
  ): void {
    for (const resource of resources) {
      resource?.dispose();
    }
    renderer?.renderLists.dispose();
    renderer?.dispose();
    renderer?.domElement.remove();
  }
}
