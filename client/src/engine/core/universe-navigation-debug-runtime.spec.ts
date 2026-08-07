import type { NavigationDebugState } from './navigation-debug-trace';
import { NavigationDebugTrace } from './navigation-debug-trace';
import { UniverseNavigationDebugRuntime } from './universe-navigation-debug-runtime';

describe('UniverseNavigationDebugRuntime', () => {
  it('ne capture aucun état lorsque la trace est désactivée', () => {
    const captureState = vi.fn(() => state(10));
    const navigate = vi.fn(() => 'zoom-pointer' as const);
    const runtime = createRuntime();

    expect(runtime.handleWheelIntent(intent(-120), captureState, navigate)).toBe('zoom-pointer');
    expect(navigate).toHaveBeenCalledOnce();
    expect(captureState).not.toHaveBeenCalled();
    expect(runtime.entryCount).toBe(0);
  });

  it('capture les états avant et après ainsi que la décision du moteur', () => {
    const states = [state(10), state(5)];
    const captureState = vi.fn(() => states.shift()!);
    const runtime = createRuntime();

    runtime.setEnabled(true);
    const decision = runtime.handleWheelIntent(
      intent(-120),
      captureState,
      () => 'adopt-wheel-target',
    );

    expect(decision).toBe('adopt-wheel-target');
    expect(runtime.entryCount).toBe(1);
    expect(runtime.snapshot()).toEqual([
      expect.objectContaining({
        deltaY: -120,
        rawDeltaY: -749,
        deltaMode: 0,
        interceptedObjectId: 'mars',
        decision: 'adopt-wheel-target',
        before: expect.objectContaining({ distance: 10 }),
        after: expect.objectContaining({ distance: 5 }),
        anchor: { anchorType: 'object', anchorObjectId: 'mars' },
        zoom: expect.objectContaining({ status: 'applied' }),
      }),
    ]);

    runtime.clear();
    expect(runtime.entryCount).toBe(0);
  });
});

function createRuntime(): UniverseNavigationDebugRuntime {
  return new UniverseNavigationDebugRuntime(
    {
      getAnchor: () => ({ anchorType: 'object', anchorObjectId: 'mars' }),
      getZoom: () => ({
        deltaY: -120,
        beforeDistance: 10,
        requestedDistance: 5,
        appliedDistance: 5,
        minimumDistance: 1,
        maximumDistance: 100,
        status: 'applied',
      }),
    },
    new NavigationDebugTrace(4, () => 1_000),
  );
}

function intent(deltaY: number) {
  return {
    objectId: 'mars',
    deltaY,
    rawDeltaY: -749,
    deltaMode: 0,
    pointer: { x: 0.2, y: -0.4 },
  };
}

function state(distance: number): NavigationDebugState {
  return {
    cameraPosition: { x: 1, y: 2, z: 3 },
    cameraTarget: { x: 4, y: 5, z: 6 },
    distance,
    minimumDistance: 1,
    maximumDistance: 100,
    targetId: 'mars',
    navigationOriginId: 'sun',
    referenceFrame: 'solar-system',
    lodLevel: 1,
    atMinimumDistance: distance === 1,
    semanticZoomActive: false,
    transitioning: false,
  };
}
