import { type UniverseTime } from '../../../data/models/universe.models';
import { TIME_SPEED_OPTIONS } from '../settings/time-speeds';
import {
  type UniverseTimeCommandRuntimeBindings,
  type UniverseTimeCommandRuntimeEngine,
  UniverseTimeCommandRuntime,
} from './universe-time-command-runtime';

describe('UniverseTimeCommandRuntime', () => {
  it('bascule la lecture et réinitialise une présentation active à la reprise', () => {
    const harness = createHarness();

    harness.runtime.togglePlaying();
    expect(harness.state.playing).toBe(true);
    expect(harness.resetPresentation).not.toHaveBeenCalled();
    expect(harness.engine.setPlaying).toHaveBeenLastCalledWith(true);

    harness.state.presentationActive = true;
    harness.runtime.togglePlaying();
    expect(harness.state.playing).toBe(false);
    expect(harness.resetPresentation).not.toHaveBeenCalled();

    harness.runtime.togglePlaying();
    expect(harness.resetPresentation).toHaveBeenCalledOnce();
    expect(harness.engine.setPlaying).toHaveBeenLastCalledWith(true);
  });

  it('applique une vitesse et parcourt les vitesses disponibles dans leurs limites', () => {
    const harness = createHarness();

    harness.runtime.setSpeed(42);
    expect(harness.state.speed).toBe(42);
    expect(harness.engine.setTimeSpeed).toHaveBeenLastCalledWith(42);

    harness.state.speed = TIME_SPEED_OPTIONS[0]!.daysPerSecond;
    harness.runtime.cycleSpeed(-1);
    expect(harness.state.speed).toBe(TIME_SPEED_OPTIONS[0]!.daysPerSecond);

    harness.state.speed = TIME_SPEED_OPTIONS.at(-1)!.daysPerSecond;
    harness.runtime.cycleSpeed(1);
    expect(harness.state.speed).toBe(TIME_SPEED_OPTIONS.at(-1)!.daysPerSecond);

    harness.state.speed = TIME_SPEED_OPTIONS[2]!.daysPerSecond;
    harness.runtime.cycleSpeed(1);
    expect(harness.state.speed).toBe(TIME_SPEED_OPTIONS[3]!.daysPerSecond);
  });

  it('ignore une date invalide et applique une date valide hors de la Terre', () => {
    const harness = createHarness();

    harness.runtime.setDateTime('date impossible');
    expect(harness.engine.setTime).not.toHaveBeenCalled();

    harness.state.targetId = 'mars';
    harness.runtime.setDateTime('2026-08-12T17:45');
    expect(harness.resetPresentation).toHaveBeenCalledOnce();
    expect(harness.engine.setTime).toHaveBeenCalledOnce();
    expect(harness.presentCurrentSolarEclipse).not.toHaveBeenCalled();
  });

  it('présente l’éclipse courante après un changement de date terrestre', () => {
    const harness = createHarness();

    harness.state.targetId = 'earth';
    harness.runtime.setDateTime('2026-08-12T17:45');
    expect(harness.presentCurrentSolarEclipse).toHaveBeenCalledOnce();
  });

  it('applique une date numérique et revient au présent fourni', () => {
    const harness = createHarness();
    const time = { julianDay: 2_451_545 };

    harness.runtime.setTime(time);
    harness.runtime.returnToPresent();

    expect(harness.resetPresentation).toHaveBeenCalledTimes(2);
    expect(harness.engine.setTime).toHaveBeenNthCalledWith(1, time);
    expect(harness.engine.setTime).toHaveBeenNthCalledWith(2, harness.presentTime);
  });
});

function createHarness() {
  const state = {
    playing: false,
    presentationActive: false,
    speed: 1,
    targetId: null as string | null,
  };
  const presentTime = { julianDay: 2_461_500 } satisfies UniverseTime;
  const engine = new FakeTimeCommandEngine();
  const resetPresentation = vi.fn();
  const presentCurrentSolarEclipse = vi.fn();
  const bindings: UniverseTimeCommandRuntimeBindings = {
    isPlaying: () => state.playing,
    isPresentationActive: () => state.presentationActive,
    getSpeed: () => state.speed,
    getTargetId: () => state.targetId,
    getPresentTime: () => presentTime,
    setPlaying: (playing) => {
      state.playing = playing;
    },
    setSpeed: (speed) => {
      state.speed = speed;
    },
    resetPresentation,
    presentCurrentSolarEclipse,
  };

  return {
    runtime: new UniverseTimeCommandRuntime(engine, bindings),
    engine,
    state,
    presentTime,
    resetPresentation,
    presentCurrentSolarEclipse,
  };
}

class FakeTimeCommandEngine implements UniverseTimeCommandRuntimeEngine {
  public readonly setPlaying = vi.fn();
  public readonly setTimeSpeed = vi.fn();
  public readonly setTime = vi.fn();
}
