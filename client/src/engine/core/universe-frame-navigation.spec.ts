import * as THREE from 'three';
import {
  dampPhotographicExposure,
  getPhotographicProfile,
} from '../rendering/photographic-profile';
import {
  type FrameCameraController,
  type FrameFloatingOriginManager,
  type FrameLodManager,
  type UniverseFrameNavigationBindings,
  type UniverseFrameNavigationServices,
  UniverseFrameNavigation,
} from './universe-frame-navigation';

describe('UniverseFrameNavigation', () => {
  it('actualise la caméra, translate son suivi après un floating origin et publie le LOD', () => {
    const harness = createHarness();
    const originalTarget = new THREE.Vector3(2_000, 3, -4);

    harness.controller.controls.target.copy(originalTarget);
    harness.updateFloatingOrigin.mockImplementation((_spaceRoot, _camera, controlsTarget) => {
      controlsTarget.set(0, 0, 0);

      return true;
    });
    harness.selectLodLevel.mockReturnValue(2);
    harness.renderer.toneMappingExposure = 1;

    const lodLevel = harness.navigation.update(0.25, harness.services);

    expect(lodLevel).toBe(2);
    expect(harness.updateCamera).toHaveBeenCalledWith(0.25, harness.currentTime);
    expect(harness.updateFloatingOrigin).toHaveBeenCalledWith(
      harness.spaceRoot,
      harness.camera,
      harness.controller.controls.target,
      false,
    );
    expect(harness.shiftTrackedPosition).toHaveBeenCalledWith(originalTarget);
    expect(harness.selectLodLevel).toHaveBeenCalledWith(24);
    expect(harness.renderer.toneMappingExposure).toBeCloseTo(
      dampPhotographicExposure(1, getPhotographicProfile(2, 'high').exposure, 0.25),
    );
    expect(harness.emitLodChanged).toHaveBeenCalledWith(2);
    expect(harness.updateCamera.mock.invocationCallOrder[0]).toBeLessThan(
      harness.updateFloatingOrigin.mock.invocationCallOrder[0]!,
    );
  });

  it('ne translate pas la caméra et ne republie pas un LOD stable', () => {
    const harness = createHarness();

    harness.updateFloatingOrigin.mockReturnValue(false);
    harness.selectLodLevel.mockReturnValue(1);

    harness.navigation.update(0.1, harness.services);
    harness.navigation.update(0.1, harness.services);

    expect(harness.shiftTrackedPosition).not.toHaveBeenCalled();
    expect(harness.emitLodChanged).toHaveBeenCalledOnce();
    expect(harness.emitLodChanged).toHaveBeenCalledWith(1);
  });

  it('republie le niveau lorsque la distance franchit un seuil de LOD', () => {
    const harness = createHarness();

    harness.updateFloatingOrigin.mockReturnValue(false);
    harness.selectLodLevel.mockReturnValueOnce(1).mockReturnValueOnce(4);

    expect(harness.navigation.update(0, harness.services)).toBe(1);
    expect(harness.navigation.update(0, harness.services)).toBe(4);
    expect(harness.emitLodChanged.mock.calls).toEqual([[1], [4]]);
  });
});

function createHarness() {
  const camera = new THREE.PerspectiveCamera(48, 16 / 9, 0.1, 100_000);
  const spaceRoot = new THREE.Group();
  const renderer = { toneMappingExposure: 1 } as THREE.WebGLRenderer;
  const currentTime = { julianDay: 2_461_500 };
  const updateCamera = vi.fn<(deltaSeconds: number, time?: { julianDay: number }) => void>();
  const shiftTrackedPosition = vi.fn<(shift: THREE.Vector3) => void>();
  const controller: FrameCameraController = {
    controls: { target: new THREE.Vector3() },
    distanceToTarget: 24,
    isTransitioning: false,
    update: updateCamera,
    shiftTrackedPosition,
  };
  const updateFloatingOrigin = vi.fn<FrameFloatingOriginManager['update']>(() => false);
  const floatingOriginManager: FrameFloatingOriginManager = {
    update: updateFloatingOrigin,
  };
  const selectLodLevel = vi.fn<FrameLodManager['selectLevel']>(() => 0);
  const lodManager: FrameLodManager = {
    selectLevel: selectLodLevel,
  };
  const emitLodChanged = vi.fn<(lodLevel: number) => void>();
  const bindings: UniverseFrameNavigationBindings = {
    getQuality: () => 'high',
    getCurrentTime: () => currentTime,
    emitLodChanged,
  };
  const services: UniverseFrameNavigationServices = {
    renderer,
    camera,
    spaceRoot,
    controller,
  };

  return {
    navigation: new UniverseFrameNavigation(floatingOriginManager, lodManager, bindings),
    services,
    renderer,
    camera,
    spaceRoot,
    controller,
    currentTime,
    updateCamera,
    shiftTrackedPosition,
    floatingOriginManager,
    updateFloatingOrigin,
    lodManager,
    selectLodLevel,
    emitLodChanged,
  };
}
