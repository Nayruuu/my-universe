import { type EarthEclipseEvent } from '../simulation/earth-eclipse';

export interface SolarEclipsePresentationRegistry {
  setSolarObserverActive(active: boolean, moonVisualScale?: number): void;
  clearSolarEclipsePath(): void;
  showSolarEclipsePath(
    time: EarthEclipseEvent['peak'],
    kind: EarthEclipseEvent['kind'],
  ): Promise<void>;
}

export class SolarEclipsePresentationController {
  private event: EarthEclipseEvent | null = null;
  private showPath = false;
  private observing = false;
  private moonScale = 1;

  public get activeEvent(): EarthEclipseEvent | null {
    return this.event;
  }

  public get pathVisible(): boolean {
    return this.showPath;
  }

  public get observerActive(): boolean {
    return this.observing;
  }

  public get observerMoonScale(): number {
    return this.moonScale;
  }

  public get labelsAllowed(): boolean {
    return !this.observing && this.event === null;
  }

  public showOrbitalView(
    event: EarthEclipseEvent,
    registry: SolarEclipsePresentationRegistry,
  ): void {
    this.event = event;
    this.showPath = false;
    this.observing = false;
    this.moonScale = 1;
    registry.setSolarObserverActive(false);
    registry.clearSolarEclipsePath();
  }

  public showObserverView(
    event: EarthEclipseEvent,
    moonScale: number,
    registry: SolarEclipsePresentationRegistry,
  ): void {
    this.event = event;
    this.showPath = false;
    this.observing = true;
    this.moonScale = moonScale;
    registry.clearSolarEclipsePath();
    registry.setSolarObserverActive(true, moonScale);
  }

  public setPathVisible(
    event: EarthEclipseEvent,
    visible: boolean,
    registry: SolarEclipsePresentationRegistry | null,
  ): void {
    this.event = event;
    this.showPath = visible;
    if (visible) {
      void registry?.showSolarEclipsePath(event.peak, event.kind);
    } else {
      registry?.clearSolarEclipsePath();
    }
  }

  public restore(registry: SolarEclipsePresentationRegistry): void {
    registry.setSolarObserverActive(this.observing, this.moonScale);
    if (this.event && this.showPath && !this.observing) {
      void registry.showSolarEclipsePath(this.event.peak, this.event.kind);
    }
  }

  public clear(registry: SolarEclipsePresentationRegistry | null): void {
    this.event = null;
    this.showPath = false;
    this.observing = false;
    this.moonScale = 1;
    registry?.setSolarObserverActive(false);
    registry?.clearSolarEclipsePath();
  }
}
