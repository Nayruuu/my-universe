import { type NavigationScaleDefinition } from '../../../engine/camera/navigation-scales';

const ZOOM_IN_FACTOR = 0.72;
const ZOOM_OUT_FACTOR = 1.38;

export interface UniverseViewCommandRuntimeEngine {
  setTarget(objectId: string): Promise<void>;
  viewRotation(objectId: string): Promise<void>;
  viewOrbit(objectId: string): void;
  viewScale(scale: NavigationScaleDefinition): void;
  selectObject(objectId: string | null): void;
  zoomBy(factor: number): void;
  resize(width: number, height: number): void;
}

export interface UniverseViewCommandRuntimeBindings {
  getSelectedId(): string | null;
  areOrbitsVisible(): boolean;
  resetPresentation(): void;
  showOrbits(): void;
  setError(message: string): void;
  describeTargetError(error: unknown): string;
  describeRotationError(error: unknown): string;
  describeOrbitError(error: unknown): string;
  getScaleUnavailableMessage(): string;
}

export class UniverseViewCommandRuntime {
  constructor(
    private readonly engine: UniverseViewCommandRuntimeEngine,
    private readonly bindings: UniverseViewCommandRuntimeBindings,
  ) {}

  public async focus(objectId: string): Promise<void> {
    this.bindings.resetPresentation();
    try {
      await this.engine.setTarget(objectId);
    } catch (error) {
      this.bindings.setError(this.bindings.describeTargetError(error));
    }
  }

  public focusSelected(): void {
    const selectedId = this.bindings.getSelectedId();

    if (selectedId) {
      void this.focus(selectedId);
    }
  }

  public async viewRotation(objectId: string): Promise<void> {
    this.bindings.resetPresentation();
    try {
      await this.engine.viewRotation(objectId);
    } catch (error) {
      this.bindings.setError(this.bindings.describeRotationError(error));
    }
  }

  public viewOrbit(objectId: string): void {
    this.bindings.resetPresentation();
    if (!this.bindings.areOrbitsVisible()) {
      this.bindings.showOrbits();
    }
    try {
      this.engine.viewOrbit(objectId);
    } catch (error) {
      this.bindings.setError(this.bindings.describeOrbitError(error));
    }
  }

  public viewScale(scale: NavigationScaleDefinition): void {
    this.bindings.resetPresentation();
    try {
      this.engine.viewScale(scale);
    } catch {
      this.bindings.setError(this.bindings.getScaleUnavailableMessage());
    }
  }

  public closeDetails(): void {
    this.engine.selectObject(null);
  }

  public zoomIn(): void {
    this.engine.zoomBy(ZOOM_IN_FACTOR);
  }

  public zoomOut(): void {
    this.engine.zoomBy(ZOOM_OUT_FACTOR);
  }

  public resize(width: number, height: number): void {
    this.engine.resize(width, height);
  }
}
