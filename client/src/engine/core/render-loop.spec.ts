import { RenderLoop } from './render-loop';

describe('RenderLoop', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('ne démarre qu’une fois, borne les frames lentes et peut être arrêté', () => {
    let scheduledCallback: FrameRequestCallback = () => undefined;
    let nextFrameId = 1;
    const requestFrame = vi.fn((callback: FrameRequestCallback): number => {
      scheduledCallback = callback;

      return nextFrameId++;
    });
    const cancelFrame = vi.fn();

    vi.stubGlobal('requestAnimationFrame', requestFrame);
    vi.stubGlobal('cancelAnimationFrame', cancelFrame);
    vi.spyOn(performance, 'now').mockReturnValue(1_000);
    const callback = vi.fn();
    const loop = new RenderLoop(callback);

    loop.start();
    loop.start();
    expect(requestFrame).toHaveBeenCalledTimes(1);

    const firstFrame = scheduledCallback;

    firstFrame(1_050);
    expect(callback).toHaveBeenLastCalledWith(0.05, 0.05);

    const secondFrame = scheduledCallback;

    secondFrame(1_300);
    const lastCall = callback.mock.lastCall;

    expect(lastCall?.[0]).toBe(0.1);
    expect(lastCall?.[1]).toBeCloseTo(0.15);

    loop.stop();
    loop.stop();
    expect(cancelFrame).toHaveBeenCalledTimes(1);
  });
});
