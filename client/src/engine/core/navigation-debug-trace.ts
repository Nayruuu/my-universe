import type {
  ReferenceFrame,
  Vector3Like,
  ZoomDebugStats,
} from '../../data/models/universe.models';
import type { NavigationZoomDecision } from './universe-navigation-runtime';

export interface NavigationDebugState {
  readonly cameraPosition: Vector3Like;
  readonly cameraTarget: Vector3Like;
  readonly distance: number;
  readonly minimumDistance: number;
  readonly maximumDistance: number;
  readonly targetId: string | null;
  readonly navigationOriginId: string | null;
  readonly referenceFrame: ReferenceFrame;
  readonly lodLevel: number;
  readonly atMinimumDistance: boolean;
  readonly semanticZoomActive: boolean;
  readonly transitioning: boolean;
}

export interface NavigationDebugTraceInput {
  readonly deltaY: number;
  readonly rawDeltaY: number;
  readonly deltaMode: number;
  readonly pointer: { readonly x: number; readonly y: number };
  readonly interceptedObjectId: string | null;
  readonly decision: NavigationZoomDecision;
  readonly anchor: Pick<ZoomDebugStats, 'anchorType' | 'anchorObjectId'> | null;
  readonly zoom: Omit<ZoomDebugStats, 'anchorType' | 'anchorObjectId'> | null;
  readonly before: NavigationDebugState;
  readonly after: NavigationDebugState;
}

export interface NavigationDebugTraceEntry extends NavigationDebugTraceInput {
  readonly sequence: number;
  readonly timestamp: string;
}

const DEFAULT_TRACE_CAPACITY = 128;

export class NavigationDebugTrace {
  private readonly entries: NavigationDebugTraceEntry[] = [];
  private sequence = 0;
  private enabled = false;

  constructor(
    private readonly capacity = DEFAULT_TRACE_CAPACITY,
    private readonly now: () => number = Date.now,
  ) {}

  public get size(): number {
    return this.entries.length;
  }

  public get isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public record(input: NavigationDebugTraceInput): void {
    if (!this.enabled) {
      return;
    }
    if (this.entries.length === this.capacity) {
      this.entries.shift();
    }
    this.sequence += 1;
    this.entries.push(cloneEntry(input, this.sequence, this.now()));
  }

  public snapshot(): readonly NavigationDebugTraceEntry[] {
    return this.entries.map((entry) =>
      cloneEntry(entry, entry.sequence, Date.parse(entry.timestamp)),
    );
  }

  public clear(): void {
    this.entries.length = 0;
    this.sequence = 0;
  }
}

function cloneEntry(
  input: NavigationDebugTraceInput,
  sequence: number,
  timestampMs: number,
): NavigationDebugTraceEntry {
  return {
    sequence,
    timestamp: new Date(timestampMs).toISOString(),
    deltaY: input.deltaY,
    rawDeltaY: input.rawDeltaY,
    deltaMode: input.deltaMode,
    pointer: { ...input.pointer },
    interceptedObjectId: input.interceptedObjectId,
    decision: input.decision,
    anchor: input.anchor ? { ...input.anchor } : null,
    zoom: input.zoom ? { ...input.zoom } : null,
    before: cloneState(input.before),
    after: cloneState(input.after),
  };
}

function cloneState(state: NavigationDebugState): NavigationDebugState {
  return {
    ...state,
    cameraPosition: { ...state.cameraPosition },
    cameraTarget: { ...state.cameraTarget },
  };
}
