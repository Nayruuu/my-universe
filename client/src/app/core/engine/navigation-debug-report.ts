import type { DisplayOptions, UniverseTime } from '../../../data/models/universe.models';
import type { NavigationDebugTraceEntry } from '../../../engine/core/navigation-debug-trace';

export type NavigationDebugCopyResult = 'copied' | 'empty' | 'failed';

export interface NavigationDebugReportContext {
  readonly capturedAt: string;
  readonly pageUrl: string;
  readonly userAgent: string;
  readonly viewport: {
    readonly width: number;
    readonly height: number;
    readonly devicePixelRatio: number;
  };
  readonly state: {
    readonly targetId: string | null;
    readonly selectedId: string | null;
    readonly cameraDistance: number;
    readonly time: UniverseTime;
    readonly displayOptions: DisplayOptions;
  };
  readonly entries: readonly NavigationDebugTraceEntry[];
}

export function serializeNavigationDebugReport(context: NavigationDebugReportContext): string {
  return JSON.stringify(
    {
      schema: 'universe-map/navigation-wheel-trace@2',
      ...context,
    },
    null,
    2,
  );
}
