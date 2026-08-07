import { type UniverseTime } from '../../data/models/universe.models';
import { type SolarEclipseAppearance } from '../simulation/earth-eclipse';
import {
  type FrameSimulationRegistry,
  type FrameTimeController,
  UniverseFrameSimulation,
} from './universe-frame-simulation';

describe('UniverseFrameSimulation', () => {
  it('laisse une frame en pause intacte', () => {
    const harness = createHarness();

    harness.timeController.update.mockReturnValue(false);

    harness.simulation.update(0.02, harness.registry);

    expect(harness.registry.updateBodyRotations).not.toHaveBeenCalled();
    expect(harness.registry.updatePositions).not.toHaveBeenCalled();
    expect(harness.emitTimeChanged).not.toHaveBeenCalled();
  });

  it('cadence les positions et les événements temporels indépendamment du rendu', () => {
    const harness = createHarness();

    harness.timeController.update.mockReturnValue(true);

    harness.simulation.update(0.05, harness.registry);

    expect(harness.registry.updateBodyRotations).toHaveBeenCalledWith(
      harness.timeController.currentTime,
    );
    expect(harness.registry.updatePositions).toHaveBeenCalledWith(
      harness.timeController.currentTime,
    );
    expect(harness.exoplanetRegistry.updatePositions).toHaveBeenCalledWith(
      harness.timeController.currentTime,
    );
    expect(harness.exoplanetRegistry.updateBodyRotations).toHaveBeenCalledWith(
      harness.timeController.currentTime,
    );
    expect(harness.emitSolarEclipseState).toHaveBeenCalledWith(harness.appearance, false);
    expect(harness.followCurrentTarget).toHaveBeenCalledOnce();
    expect(harness.emitTimeChanged).not.toHaveBeenCalled();

    harness.simulation.update(0.07, harness.registry);

    expect(harness.emitTimeChanged).toHaveBeenCalledWith(harness.timeController.currentTime);
  });

  it('conserve le même temps scientifique pour tous les corps aux grandes vitesses', () => {
    const harness = createHarness();

    harness.timeController.speed = 365_250_000;
    harness.timeController.currentTime = { julianDay: 367_710_000 };
    harness.timeController.update.mockReturnValue(true);

    harness.simulation.update(0.02, harness.registry);

    expect(harness.registry.updateBodyRotations).toHaveBeenCalledWith(
      harness.timeController.currentTime,
    );
    expect(harness.exoplanetRegistry.updateBodyRotations).toHaveBeenCalledWith(
      harness.timeController.currentTime,
    );
  });

  it('accepte un registre secondaire absent', () => {
    const harness = createHarness(false);
    const resetTime = { julianDay: 2_460_500 };

    harness.timeController.update.mockReturnValue(true);
    harness.simulation.update(0.02, harness.registry);
    harness.simulation.setTime(resetTime, null);

    expect(harness.registry.updateBodyRotations).toHaveBeenCalledOnce();
    expect(harness.registry.updatePositions).not.toHaveBeenCalled();
    expect(harness.timeController.setTime).toHaveBeenCalledWith(resetTime);
    expect(harness.followCurrentTarget).toHaveBeenCalledOnce();
    expect(harness.emitTimeChanged).toHaveBeenCalledWith(resetTime);
  });

  it('applique immédiatement une date à tous les registres et publie le nouvel état', () => {
    const harness = createHarness();
    const requestedTime = { julianDay: 2_461_500 };

    harness.simulation.setTime(requestedTime, harness.registry);

    expect(harness.timeController.setTime).toHaveBeenCalledWith(requestedTime);
    expect(harness.registry.updatePositions).toHaveBeenCalledWith(requestedTime);
    expect(harness.registry.updateBodyRotations).toHaveBeenCalledWith(requestedTime);
    expect(harness.exoplanetRegistry.updatePositions).toHaveBeenCalledWith(requestedTime);
    expect(harness.exoplanetRegistry.updateBodyRotations).toHaveBeenCalledWith(requestedTime);
    expect(harness.emitSolarEclipseState).toHaveBeenCalledWith(harness.appearance, true);
    expect(harness.followCurrentTarget).toHaveBeenCalledOnce();
    expect(harness.emitTimeChanged).toHaveBeenCalledWith(requestedTime);
  });
});

function createHarness(withExoplanetRegistry = true): SimulationHarness {
  const appearance: SolarEclipseAppearance = {
    phase: 'partial',
    sunPositionInEarthRadii: { x: 100, y: 0, z: 0 },
    moonPositionInEarthRadii: { x: 10, y: 0, z: 0 },
    shadowDirection: { x: -1, y: 0, z: 0 },
    centralLatitude: 42,
    centralLongitude: -8,
  };
  const registry = createRegistry(appearance);
  const exoplanetRegistry = createRegistry(appearance);
  const timeController: MutableFrameTimeController = {
    currentTime: { julianDay: 2_460_000 },
    isPlaying: true,
    speed: 2,
    setTime: vi.fn(),
    update: vi.fn(),
  };

  timeController.setTime.mockImplementation((time) => {
    timeController.currentTime = time;
  });
  const emitSolarEclipseState = vi.fn();
  const followCurrentTarget = vi.fn();
  const emitTimeChanged = vi.fn();
  const simulation = new UniverseFrameSimulation(timeController, {
    getExoplanetSystemRegistry: () => (withExoplanetRegistry ? exoplanetRegistry : null),
    emitSolarEclipseState,
    followCurrentTarget,
    emitTimeChanged,
  });

  return {
    simulation,
    timeController,
    registry,
    exoplanetRegistry,
    appearance,
    emitSolarEclipseState,
    followCurrentTarget,
    emitTimeChanged,
  };
}

function createRegistry(appearance: SolarEclipseAppearance): MockFrameSimulationRegistry {
  return {
    updateBodyRotations: vi.fn(),
    updatePositions: vi.fn(() => appearance),
  };
}

interface SimulationHarness {
  readonly simulation: UniverseFrameSimulation;
  readonly timeController: MutableFrameTimeController;
  readonly registry: MockFrameSimulationRegistry;
  readonly exoplanetRegistry: MockFrameSimulationRegistry;
  readonly appearance: SolarEclipseAppearance;
  readonly emitSolarEclipseState: ReturnType<typeof vi.fn>;
  readonly followCurrentTarget: ReturnType<typeof vi.fn>;
  readonly emitTimeChanged: ReturnType<typeof vi.fn>;
}

type MutableFrameTimeController = FrameTimeController & {
  currentTime: UniverseTime;
  isPlaying: boolean;
  speed: number;
  readonly setTime: ReturnType<typeof vi.fn<(time: UniverseTime) => void>>;
  readonly update: ReturnType<typeof vi.fn<FrameTimeController['update']>>;
};

type MockFrameSimulationRegistry = FrameSimulationRegistry & {
  readonly updateBodyRotations: ReturnType<
    typeof vi.fn<FrameSimulationRegistry['updateBodyRotations']>
  >;
  readonly updatePositions: ReturnType<typeof vi.fn<FrameSimulationRegistry['updatePositions']>>;
};
