import type {
  DisplayOptions,
  NavigationState,
  UniverseTime,
} from '../../../data/models/universe.models';

const DEFAULT_CAMERA_DISTANCE = 24;

export interface UniverseNavigationStateBindings {
  isReady(): boolean;
  getTargetId(): string | null;
  getSelectedId(): string | null;
  getTime(): UniverseTime;
  getCameraDistance(): number;
  getEngineCameraDistance(): number;
  getDisplayOptions(): DisplayOptions;
  scheduleWrite(state: NavigationState): void;
}

export class UniverseNavigationStateSynchronizer {
  constructor(private readonly bindings: UniverseNavigationStateBindings) {}

  public schedule(): void {
    if (this.bindings.isReady()) {
      this.bindings.scheduleWrite(this.create());
    }
  }

  public create(): NavigationState {
    const options = this.bindings.getDisplayOptions();

    return {
      targetId: this.bindings.getTargetId(),
      selectedId: this.bindings.getSelectedId(),
      julianDay: this.bindings.getTime().julianDay,
      zoom:
        this.bindings.getCameraDistance() ||
        this.bindings.getEngineCameraDistance() ||
        DEFAULT_CAMERA_DISTANCE,
      mode: options.temporalMode,
      quality: options.quality,
      labelDensity: options.labelDensity,
      showOrbits: options.showOrbits,
      showConstellations: options.showConstellations,
      showLabels: options.showLabels,
    };
  }
}
