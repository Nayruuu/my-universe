import type { NavigationDebugState, NavigationDebugTraceInput } from './navigation-debug-trace';
import { NavigationDebugTrace } from './navigation-debug-trace';

describe('NavigationDebugTrace', () => {
  it('reste inactive tant que le mode debug ne l’a pas activée', () => {
    const trace = new NavigationDebugTrace(2, () => 1_000);

    expect(trace.isEnabled).toBe(false);
    trace.record(input(-120, 'zoom-pointer'));

    expect(trace.size).toBe(0);
    expect(trace.snapshot()).toEqual([]);
  });

  it('conserve une copie bornée et ordonnée des dernières interactions', () => {
    const timestamps = [1_000, 2_000, 3_000];
    const trace = new NavigationDebugTrace(2, () => timestamps.shift()!);

    trace.setEnabled(true);
    expect(trace.isEnabled).toBe(true);
    trace.record(input(-120, 'adopt-wheel-target'));
    trace.record(input(-240, 'bypass-wheel-target'));
    trace.record(input(120, 'zoom-pointer'));

    const snapshot = trace.snapshot();

    expect(trace.size).toBe(2);
    expect(snapshot.map((entry) => entry.sequence)).toEqual([2, 3]);
    expect(snapshot.map((entry) => entry.timestamp)).toEqual([
      '1970-01-01T00:00:02.000Z',
      '1970-01-01T00:00:03.000Z',
    ]);
    expect(snapshot.map((entry) => entry.decision)).toEqual([
      'bypass-wheel-target',
      'zoom-pointer',
    ]);

    (snapshot[0]!.before.cameraPosition as { x: number }).x = 999;
    expect(trace.snapshot()[0]!.before.cameraPosition.x).toBe(1);
  });

  it('efface la trace et recommence la numérotation', () => {
    const trace = new NavigationDebugTrace(2, () => 1_000);

    trace.setEnabled(true);
    trace.record(input(-120, 'zoom-pointer'));
    trace.clear();
    trace.record({ ...input(120, 'zoom-pointer'), anchor: null, zoom: null });

    expect(trace.snapshot()).toEqual([
      expect.objectContaining({
        sequence: 1,
        deltaY: 120,
        rawDeltaY: 120,
        deltaMode: 0,
        anchor: null,
        zoom: null,
      }),
    ]);
  });
});

function input(
  deltaY: number,
  decision: NavigationDebugTraceInput['decision'],
): NavigationDebugTraceInput {
  return {
    deltaY,
    rawDeltaY: deltaY,
    deltaMode: 0,
    pointer: { x: 0.25, y: -0.5 },
    interceptedObjectId: 'mars',
    decision,
    anchor: { anchorType: 'object', anchorObjectId: 'mars' },
    zoom: {
      deltaY,
      beforeDistance: 10,
      requestedDistance: 5,
      appliedDistance: 5,
      minimumDistance: 1,
      maximumDistance: 100,
      status: 'applied',
    },
    before: state(10),
    after: state(5),
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
