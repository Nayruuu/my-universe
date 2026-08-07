import type { ZoomDebugStats } from '../../data/models/universe.models';
import type { NavigationDebugState, NavigationDebugTraceEntry } from './navigation-debug-trace';
import { NavigationDebugTrace } from './navigation-debug-trace';
import type { NavigationPointer, NavigationZoomDecision } from './universe-navigation-runtime';

export interface UniverseNavigationDebugBindings {
  getAnchor(): Pick<ZoomDebugStats, 'anchorType' | 'anchorObjectId'> | null;
  getZoom(): Omit<ZoomDebugStats, 'anchorType' | 'anchorObjectId'> | null;
}

export interface NavigationDebugWheelIntent {
  readonly objectId: string | null;
  readonly deltaY: number;
  readonly rawDeltaY: number;
  readonly deltaMode: number;
  readonly pointer: NavigationPointer;
}

export class UniverseNavigationDebugRuntime {
  constructor(
    private readonly bindings: UniverseNavigationDebugBindings,
    private readonly trace = new NavigationDebugTrace(),
  ) {}

  public get entryCount(): number {
    return this.trace.size;
  }

  public setEnabled(enabled: boolean): void {
    this.trace.setEnabled(enabled);
  }

  public handleWheelIntent(
    intent: NavigationDebugWheelIntent,
    captureState: () => NavigationDebugState,
    navigate: () => NavigationZoomDecision,
  ): NavigationZoomDecision {
    if (!this.trace.isEnabled) {
      return navigate();
    }
    const before = captureState();
    const decision = navigate();

    this.trace.record({
      deltaY: intent.deltaY,
      rawDeltaY: intent.rawDeltaY,
      deltaMode: intent.deltaMode,
      pointer: intent.pointer,
      interceptedObjectId: intent.objectId,
      decision,
      anchor: this.bindings.getAnchor(),
      zoom: this.bindings.getZoom(),
      before,
      after: captureState(),
    });

    return decision;
  }

  public snapshot(): readonly NavigationDebugTraceEntry[] {
    return this.trace.snapshot();
  }

  public clear(): void {
    this.trace.clear();
  }
}
