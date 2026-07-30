import { UniverseTime } from '../../data/models/universe.models';
import { currentUniverseTime } from './time-utils';

export class TimeController {
  private time = currentUniverseTime();
  private playing = false;
  private daysPerSecond = 1;

  public get currentTime(): UniverseTime {
    return { ...this.time };
  }

  public get isPlaying(): boolean {
    return this.playing;
  }

  public get speed(): number {
    return this.daysPerSecond;
  }

  public setTime(time: UniverseTime): void {
    if (!Number.isFinite(time.julianDay)) {
      throw new Error('Le jour julien doit être un nombre fini.');
    }
    this.time = { ...time };
  }

  public setPlaying(playing: boolean): void {
    this.playing = playing;
  }

  public setSpeed(daysPerSecond: number): void {
    if (!Number.isFinite(daysPerSecond)) {
      throw new Error('La vitesse temporelle doit être un nombre fini.');
    }
    this.daysPerSecond = daysPerSecond;
  }

  public update(deltaSeconds: number): boolean {
    if (!this.playing || deltaSeconds <= 0) {
      return false;
    }

    this.time = {
      julianDay: this.time.julianDay + deltaSeconds * this.daysPerSecond,
    };

    return true;
  }
}
