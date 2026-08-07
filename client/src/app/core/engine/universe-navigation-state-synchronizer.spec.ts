import type {
  DisplayOptions,
  NavigationState,
  UniverseTime,
} from '../../../data/models/universe.models';
import {
  type UniverseNavigationStateBindings,
  UniverseNavigationStateSynchronizer,
} from './universe-navigation-state-synchronizer';

describe('UniverseNavigationStateSynchronizer', () => {
  it('sérialise tout l’état partageable avec les trois priorités de zoom', () => {
    const harness = createHarness();

    expect(harness.synchronizer.create()).toEqual({
      targetId: 'earth',
      selectedId: 'moon',
      julianDay: 2_451_545,
      zoom: 15,
      mode: 'observable',
      quality: 'high',
      labelDensity: 'dense',
      showOrbits: false,
      showConstellations: false,
      showLabels: false,
    });

    harness.cameraDistance.current = 0;
    expect(harness.synchronizer.create().zoom).toBe(42);

    harness.engineCameraDistance.current = 0;
    expect(harness.synchronizer.create().zoom).toBe(24);
  });

  it('ne planifie l’écriture que lorsque la façade est prête', () => {
    const harness = createHarness();

    harness.ready.current = false;
    harness.synchronizer.schedule();
    expect(harness.scheduleWrite).not.toHaveBeenCalled();

    harness.ready.current = true;
    harness.synchronizer.schedule();
    expect(harness.scheduleWrite).toHaveBeenCalledWith(harness.synchronizer.create());
  });
});

function createHarness() {
  const ready = { current: true };
  const targetId = { current: 'earth' as string | null };
  const selectedId = { current: 'moon' as string | null };
  const time = { current: { julianDay: 2_451_545 } satisfies UniverseTime };
  const cameraDistance = { current: 15 };
  const engineCameraDistance = { current: 42 };
  const displayOptions = {
    current: {
      showOrbits: false,
      showConstellations: false,
      showLabels: false,
      quality: 'high',
      labelDensity: 'dense',
      temporalMode: 'observable',
    } satisfies DisplayOptions,
  };
  const scheduleWrite = vi.fn<(state: NavigationState) => void>();
  const bindings: UniverseNavigationStateBindings = {
    isReady: () => ready.current,
    getTargetId: () => targetId.current,
    getSelectedId: () => selectedId.current,
    getTime: () => time.current,
    getCameraDistance: () => cameraDistance.current,
    getEngineCameraDistance: () => engineCameraDistance.current,
    getDisplayOptions: () => displayOptions.current,
    scheduleWrite,
  };

  return {
    synchronizer: new UniverseNavigationStateSynchronizer(bindings),
    ready,
    cameraDistance,
    engineCameraDistance,
    scheduleWrite,
  };
}
