import type { SolarEclipseState } from '../../data/models/universe.models';
import type { SolarEclipseAppearance } from '../simulation/earth-eclipse';

export type SolarEclipseStateEmitter = (state: SolarEclipseState) => void;

export class SolarEclipseStatePublisher {
  private lastPhase: SolarEclipseState['phase'] | null = null;

  constructor(private readonly emit: SolarEclipseStateEmitter) {}

  public publish(appearance: SolarEclipseAppearance, force: boolean): void {
    if (!force && appearance.phase === this.lastPhase) {
      return;
    }
    this.lastPhase = appearance.phase;
    this.emit({
      phase: appearance.phase,
      centralLatitude: appearance.centralLatitude,
      centralLongitude: appearance.centralLongitude,
    });
  }

  public reset(): void {
    this.lastPhase = null;
  }
}
