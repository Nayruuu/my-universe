import { UniverseTime } from '../../data/models/universe.models';

export const MAX_EARTH_VISUAL_DAYS_PER_SECOND = 1 / 24;
export const EARTH_ROTATION_RECOVERY_RADIANS_PER_SECOND = Math.PI;

export type EarthRotationPlaybackUpdate =
  | { mode: 'exact'; time: UniverseTime }
  | { mode: 'stabilized'; time: UniverseTime }
  | { mode: 'synchronize'; time: UniverseTime };

export class EarthRotationPlayback {
  private visualJulianDay: number | null = null;
  private synchronizationRequired = false;

  public reset(time: UniverseTime): void {
    this.visualJulianDay = time.julianDay;
    this.synchronizationRequired = false;
  }

  public update(
    time: UniverseTime,
    playing: boolean,
    daysPerSecond: number,
    deltaSeconds: number,
  ): EarthRotationPlaybackUpdate {
    const stabilizationActive =
      playing && Math.abs(daysPerSecond) > MAX_EARTH_VISUAL_DAYS_PER_SECOND;

    if (stabilizationActive) {
      const direction = Math.sign(daysPerSecond);
      const initialVisualTime = time.julianDay - daysPerSecond * deltaSeconds;

      this.visualJulianDay ??= initialVisualTime;
      this.visualJulianDay +=
        direction * MAX_EARTH_VISUAL_DAYS_PER_SECOND * Math.max(0, deltaSeconds);
      this.synchronizationRequired = true;

      return {
        mode: 'stabilized',
        time: { julianDay: this.visualJulianDay },
      };
    }
    if (this.synchronizationRequired) {
      return { mode: 'synchronize', time };
    }

    this.visualJulianDay = time.julianDay;

    return { mode: 'exact', time };
  }

  public markSynchronized(time: UniverseTime): void {
    this.reset(time);
  }
}
