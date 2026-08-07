import * as THREE from 'three';
import type { CameraController } from '../camera/camera-controller';
import type { LabelManager, LabelNameResolver } from '../objects/label-manager';
import type { SelectionManager } from '../selection/selection-manager';
import type { RenderLoop } from './render-loop';
import {
  UniverseInteractionBootstrap,
  type UniverseInteractionFactories,
} from './universe-interaction-bootstrap';

describe('UniverseInteractionBootstrap', () => {
  it('assemble la caméra, les labels, la sélection et la boucle autour des mêmes interactions', () => {
    const container = document.createElement('div');
    const canvas = document.createElement('canvas');
    const camera = new THREE.PerspectiveCamera();
    const labelObjects = [{ id: 'earth', name: 'Terre', type: 'planet' as const }];
    const resolver: LabelNameResolver = (objectId, fallback) =>
      objectId === 'earth' ? 'Earth' : fallback;
    const cameraController = { distanceToTarget: 42 } as CameraController;
    const labelManager = {
      setEnabled: vi.fn(),
      hitTest: vi.fn(() => 'earth'),
      setHoveredObject: vi.fn(),
    } as unknown as LabelManager;
    const selectionManager = {} as SelectionManager;
    const renderLoop = {} as RenderLoop;
    const bindings = {
      handleCameraSettled: vi.fn(),
      isObjectVisible: vi.fn(() => true),
      getPickables: vi.fn(() => [new THREE.Object3D()]),
      handlePick: vi.fn(),
      handleNavigationIntent: vi.fn(),
      getReferenceDistance: vi.fn(() => 42),
      isBackgroundObject: vi.fn(() => true),
      hoverObject: vi.fn(),
      handleSemanticZoomIntent: vi.fn(),
      supportsWheelNavigation: vi.fn(() => true),
      renderFrame: vi.fn(),
    };
    const factories = {
      createCameraController: vi.fn(
        (...args: Parameters<UniverseInteractionFactories['createCameraController']>) => {
          void args;

          return cameraController;
        },
      ),
      createLabelManager: vi.fn(
        (...args: Parameters<UniverseInteractionFactories['createLabelManager']>) => {
          void args;

          return labelManager;
        },
      ),
      createSelectionManager: vi.fn(
        (...args: Parameters<UniverseInteractionFactories['createSelectionManager']>) => {
          void args;

          return selectionManager;
        },
      ),
      createRenderLoop: vi.fn(
        (...args: Parameters<UniverseInteractionFactories['createRenderLoop']>) => {
          void args;

          return renderLoop;
        },
      ),
    };
    const bootstrap = new UniverseInteractionBootstrap(bindings, factories);

    const runtime = bootstrap.create({
      container,
      canvas,
      camera,
      labelObjects,
      quality: 'high',
      labelDensity: 'dense',
      labelsEnabled: false,
      labelNameResolver: resolver,
    });

    expect(runtime).toEqual({ cameraController, labelManager, selectionManager, renderLoop });
    expect(labelManager.setEnabled).toHaveBeenCalledWith(false);
    expect(factories.createCameraController).toHaveBeenCalledWith(
      camera,
      canvas,
      expect.any(Function),
    );
    expect(factories.createLabelManager).toHaveBeenCalledWith(
      container,
      labelObjects,
      'high',
      'dense',
      expect.any(Function),
      resolver,
    );

    const settle = factories.createCameraController.mock.calls[0]![2];
    const visibility = factories.createLabelManager.mock.calls[0]![4];
    const selectionArguments = factories.createSelectionManager.mock.calls[0]!;
    const render = factories.createRenderLoop.mock.calls[0]![0];
    const pointer = { x: 0.25, y: -0.5 };

    settle(18, 'pinch');
    expect(bindings.handleCameraSettled).toHaveBeenCalledWith(18, 'pinch');
    expect(visibility('earth')).toBe(true);
    expect(selectionArguments[2]()).toEqual(bindings.getPickables.mock.results[0]!.value);
    expect(selectionArguments[3](10, 20)).toBe('earth');
    expect(labelManager.hitTest).toHaveBeenCalledWith(10, 20);
    selectionArguments[4]('earth', true);
    selectionArguments[5]('earth');
    expect(selectionArguments[6]()).toBe(42);
    expect(selectionArguments[7]('earth')).toBe(true);
    selectionArguments[8]('earth');
    selectionArguments[9]?.('earth', -120, pointer);
    expect(selectionArguments[10]?.('earth')).toBe(true);
    render(0.016, 1);

    expect(bindings.handlePick).toHaveBeenCalledWith('earth', true);
    expect(bindings.handleNavigationIntent).toHaveBeenCalledWith('earth');
    expect(labelManager.setHoveredObject).toHaveBeenCalledWith('earth');
    expect(bindings.hoverObject).toHaveBeenCalledWith('earth');
    expect(bindings.handleSemanticZoomIntent).toHaveBeenCalledWith('earth', -120, pointer);
    expect(bindings.supportsWheelNavigation).toHaveBeenCalledWith('earth');
    expect(bindings.renderFrame).toHaveBeenCalledWith(0.016, 1);
  });

  it('libère les interactions déjà créées si une fabrique suivante échoue', () => {
    const cameraController = { dispose: vi.fn() } as unknown as CameraController;
    const labelManager = {
      setEnabled: vi.fn(),
      dispose: vi.fn(),
    } as unknown as LabelManager;
    const selectionManager = { dispose: vi.fn() } as unknown as SelectionManager;
    const failure = new Error('render loop failure');
    const factories: UniverseInteractionFactories = {
      createCameraController: vi.fn(() => cameraController),
      createLabelManager: vi.fn(() => labelManager),
      createSelectionManager: vi.fn(() => selectionManager),
      createRenderLoop: vi.fn(() => {
        throw failure;
      }),
    };
    const bootstrap = new UniverseInteractionBootstrap(
      {
        handleCameraSettled: vi.fn(),
        isObjectVisible: vi.fn(() => true),
        getPickables: vi.fn(() => []),
        handlePick: vi.fn(),
        handleNavigationIntent: vi.fn(),
        getReferenceDistance: vi.fn(() => 1),
        isBackgroundObject: vi.fn(() => false),
        hoverObject: vi.fn(),
        handleSemanticZoomIntent: vi.fn(),
        supportsWheelNavigation: vi.fn(() => true),
        renderFrame: vi.fn(),
      },
      factories,
    );

    expect(() =>
      bootstrap.create({
        container: document.createElement('div'),
        canvas: document.createElement('canvas'),
        camera: new THREE.PerspectiveCamera(),
        labelObjects: [],
        quality: 'low',
        labelDensity: 'minimal',
        labelsEnabled: true,
        labelNameResolver: (_objectId, fallback) => fallback,
      }),
    ).toThrow(failure);
    expect(selectionManager.dispose).toHaveBeenCalledOnce();
    expect(labelManager.dispose).toHaveBeenCalledOnce();
    expect(cameraController.dispose).toHaveBeenCalledOnce();
  });
});
