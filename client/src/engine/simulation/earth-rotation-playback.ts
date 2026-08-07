import { UniverseTime } from '../../data/models/universe.models';

export const MAX_EARTH_VISUAL_DAYS_PER_SECOND = 1 / 24;

export type EarthRotationPlaybackUpdate =
  | { mode: 'exact'; time: UniverseTime; forceUpdate: boolean }
  | { mode: 'stabilized'; time: UniverseTime; forceUpdate: false };

export class EarthRotationPlayback {
  private visualJulianDay: number | null = null;
  private stabilizedSinceReset = false;

  public reset(time: UniverseTime): void {
    this.visualJulianDay = time.julianDay;
    this.stabilizedSinceReset = false;
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
      this.stabilizedSinceReset = true;

      return {
        mode: 'stabilized',
        time: { julianDay: this.visualJulianDay },
        forceUpdate: false,
      };
    }
    const forceUpdate = this.stabilizedSinceReset;

    this.visualJulianDay = time.julianDay;
    this.stabilizedSinceReset = false;

    return { mode: 'exact', time, forceUpdate };
  }
}
