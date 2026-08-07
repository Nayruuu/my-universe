import { type UniverseTime } from '../../data/models/universe.models';
import { type SolarEclipseAppearance } from '../simulation/earth-eclipse';
import { type EarthRotationPlaybackUpdate } from '../simulation/earth-rotation-playback';

const POSITION_UPDATE_INTERVAL_SECONDS = 1 / 24;
const TIME_EVENT_INTERVAL_SECONDS = 0.12;

export interface FrameTimeController {
  readonly currentTime: UniverseTime;
  readonly isPlaying: boolean;
  readonly speed: number;
  setTime(time: UniverseTime): void;
  update(deltaSeconds: number): boolean;
}

export interface FrameEarthRotationPlayback {
  reset(time: UniverseTime): void;
  update(
    time: UniverseTime,
    playing: boolean,
    daysPerSecond: number,
    deltaSeconds: number,
  ): EarthRotationPlaybackUpdate;
}

export interface FrameSimulationRegistry {
  updateBodyRotations(time: UniverseTime, earthRotationTime?: UniverseTime): void;
  updatePositions(time: UniverseTime): SolarEclipseAppearance;
}

export interface UniverseFrameSimulationBindings {
  getExoplanetSystemRegistry(): FrameSimulationRegistry | null;
  emitSolarEclipseState(appearance: SolarEclipseAppearance, force: boolean): void;
  followCurrentTarget(): void;
  emitTimeChanged(time: UniverseTime): void;
}

export class UniverseFrameSimulation {
  private positionAccumulator = 0;
  private timeEventAccumulator = 0;

  constructor(
    private readonly timeController: FrameTimeController,
    private readonly earthRotationPlayback: FrameEarthRotationPlayback,
    private readonly bindings: UniverseFrameSimulationBindings,
  ) {}

  public resetRotationPlayback(time: UniverseTime): void {
    this.earthRotationPlayback.reset(time);
  }

  public setTime(time: UniverseTime, registry: FrameSimulationRegistry | null): void {
    this.timeController.setTime(time);
    this.earthRotationPlayback.reset(time);
    const solarEclipseAppearance = registry?.updatePositions(time);

    registry?.updateBodyRotations(time);
    const exoplanetRegistry = this.bindings.getExoplanetSystemRegistry();

    exoplanetRegistry?.updatePositions(time);
    exoplanetRegistry?.updateBodyRotations(time);
    if (solarEclipseAppearance) {
      this.bindings.emitSolarEclipseState(solarEclipseAppearance, true);
    }
    this.bindings.followCurrentTarget();
    this.bindings.emitTimeChanged(this.timeController.currentTime);
  }

  public update(deltaSeconds: number, registry: FrameSimulationRegistry): void {
    const timeAdvanced = this.timeController.update(deltaSeconds);
    const currentTime = this.timeController.currentTime;
    const earthRotation = this.earthRotationPlayback.update(
      currentTime,
      this.timeController.isPlaying,
      this.timeController.speed,
      deltaSeconds,
    );

    this.positionAccumulator += deltaSeconds;
    this.timeEventAccumulator += deltaSeconds;
    if (timeAdvanced || earthRotation.forceUpdate) {
      registry.updateBodyRotations(currentTime, earthRotation.time);
      this.bindings.getExoplanetSystemRegistry()?.updateBodyRotations(currentTime);
    }

    if (timeAdvanced && this.positionAccumulator >= POSITION_UPDATE_INTERVAL_SECONDS) {
      const solarEclipseAppearance = registry.updatePositions(currentTime);

      this.bindings.getExoplanetSystemRegistry()?.updatePositions(currentTime);
      this.bindings.emitSolarEclipseState(solarEclipseAppearance, false);
      this.bindings.followCurrentTarget();
      this.positionAccumulator = 0;
    }

    if (timeAdvanced && this.timeEventAccumulator >= TIME_EVENT_INTERVAL_SECONDS) {
      this.bindings.emitTimeChanged(currentTime);
      this.timeEventAccumulator = 0;
    }
  }
}
