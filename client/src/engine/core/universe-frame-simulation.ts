import { type TemporalMode, type UniverseTime } from '../../data/models/universe.models';
import { type SolarEclipseAppearance } from '../simulation/earth-eclipse';

const POSITION_UPDATE_INTERVAL_SECONDS = 1 / 24;
const TIME_EVENT_INTERVAL_SECONDS = 0.12;

export interface FrameTimeController {
  readonly currentTime: UniverseTime;
  readonly isPlaying: boolean;
  readonly speed: number;
  setTime(time: UniverseTime): void;
  update(deltaSeconds: number): boolean;
}

export interface FrameSimulationRegistry {
  updateBodyRotations(time: UniverseTime): void;
  updatePositions(time: UniverseTime): SolarEclipseAppearance;
}

export interface UniverseFrameSimulationBindings {
  getExoplanetSystemRegistry(): FrameSimulationRegistry | null;
  getTemporalMode(): TemporalMode;
  updateStellarCatalog(time: UniverseTime, temporalMode: TemporalMode): void;
  emitSolarEclipseState(appearance: SolarEclipseAppearance, force: boolean): void;
  followCurrentTarget(): void;
  emitTimeChanged(time: UniverseTime): void;
}

export class UniverseFrameSimulation {
  private positionAccumulator = 0;
  private timeEventAccumulator = 0;

  constructor(
    private readonly timeController: FrameTimeController,
    private readonly bindings: UniverseFrameSimulationBindings,
  ) {}

  public setTime(time: UniverseTime, registry: FrameSimulationRegistry | null): void {
    this.timeController.setTime(time);
    const solarEclipseAppearance = registry?.updatePositions(time);

    registry?.updateBodyRotations(time);
    const exoplanetRegistry = this.bindings.getExoplanetSystemRegistry();

    exoplanetRegistry?.updatePositions(time);
    exoplanetRegistry?.updateBodyRotations(time);
    this.bindings.updateStellarCatalog(time, this.bindings.getTemporalMode());
    if (solarEclipseAppearance) {
      this.bindings.emitSolarEclipseState(solarEclipseAppearance, true);
    }
    this.bindings.followCurrentTarget();
    this.bindings.emitTimeChanged(this.timeController.currentTime);
  }

  public update(deltaSeconds: number, registry: FrameSimulationRegistry): void {
    const timeAdvanced = this.timeController.update(deltaSeconds);
    const currentTime = this.timeController.currentTime;

    this.positionAccumulator += deltaSeconds;
    this.timeEventAccumulator += deltaSeconds;
    if (timeAdvanced) {
      registry.updateBodyRotations(currentTime);
      this.bindings.getExoplanetSystemRegistry()?.updateBodyRotations(currentTime);
    }

    const positionUpdateDue =
      timeAdvanced && this.positionAccumulator >= POSITION_UPDATE_INTERVAL_SECONDS;

    if (positionUpdateDue) {
      const solarEclipseAppearance = registry.updatePositions(currentTime);

      this.bindings.getExoplanetSystemRegistry()?.updatePositions(currentTime);
      this.bindings.updateStellarCatalog(currentTime, this.bindings.getTemporalMode());
      this.bindings.emitSolarEclipseState(solarEclipseAppearance, false);
      this.bindings.followCurrentTarget();
      this.positionAccumulator = 0;
    }

    if (timeAdvanced && this.timeEventAccumulator >= TIME_EVENT_INTERVAL_SECONDS) {
      this.bindings.emitTimeChanged(currentTime);
      this.timeEventAccumulator = 0;
    }
  }

  public refreshTemporalPresentation(registry: FrameSimulationRegistry | null): void {
    const currentTime = this.timeController.currentTime;
    const solarEclipseAppearance = registry?.updatePositions(currentTime);

    registry?.updateBodyRotations(currentTime);
    const exoplanetRegistry = this.bindings.getExoplanetSystemRegistry();

    exoplanetRegistry?.updatePositions(currentTime);
    exoplanetRegistry?.updateBodyRotations(currentTime);
    this.bindings.updateStellarCatalog(currentTime, this.bindings.getTemporalMode());
    if (solarEclipseAppearance) {
      this.bindings.emitSolarEclipseState(solarEclipseAppearance, true);
    }
    this.bindings.followCurrentTarget();
  }
}
