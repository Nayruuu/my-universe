import { type UniverseTime } from '../../../data/models/universe.models';
import { isoDateTimeToUniverseTime } from '../../../engine/simulation/time-utils';
import { findSpeedIndex, TIME_SPEED_OPTIONS } from '../settings/time-speeds';

export interface UniverseTimeCommandRuntimeEngine {
  setPlaying(playing: boolean): void;
  setTimeSpeed(daysPerSecond: number): void;
  setTime(time: UniverseTime): void;
}

export interface UniverseTimeCommandRuntimeBindings {
  isPlaying(): boolean;
  isPresentationActive(): boolean;
  getSpeed(): number;
  getTargetId(): string | null;
  getPresentTime(): UniverseTime;
  setPlaying(playing: boolean): void;
  setSpeed(speed: number): void;
  resetPresentation(): void;
  presentCurrentSolarEclipse(): void;
}

export class UniverseTimeCommandRuntime {
  constructor(
    private readonly engine: UniverseTimeCommandRuntimeEngine,
    private readonly bindings: UniverseTimeCommandRuntimeBindings,
  ) {}

  public togglePlaying(): void {
    const playing = !this.bindings.isPlaying();

    if (playing && this.bindings.isPresentationActive()) {
      this.bindings.resetPresentation();
    }
    this.bindings.setPlaying(playing);
    this.engine.setPlaying(playing);
  }

  public setSpeed(daysPerSecond: number): void {
    this.bindings.setSpeed(daysPerSecond);
    this.engine.setTimeSpeed(daysPerSecond);
  }

  public cycleSpeed(direction: 1 | -1): void {
    const currentIndex = findSpeedIndex(this.bindings.getSpeed());
    const nextIndex = Math.max(
      0,
      Math.min(TIME_SPEED_OPTIONS.length - 1, currentIndex + direction),
    );

    this.setSpeed(TIME_SPEED_OPTIONS[nextIndex]!.daysPerSecond);
  }

  public setDateTime(isoDateTime: string): void {
    const time = isoDateTimeToUniverseTime(isoDateTime);

    if (!time) {
      return;
    }
    this.bindings.resetPresentation();
    this.engine.setTime(time);
    if (this.bindings.getTargetId() === 'earth') {
      this.bindings.presentCurrentSolarEclipse();
    }
  }

  public setTime(time: UniverseTime): void {
    this.bindings.resetPresentation();
    this.engine.setTime(time);
  }

  public returnToPresent(): void {
    this.bindings.resetPresentation();
    this.engine.setTime(this.bindings.getPresentTime());
  }
}
