import type { NavigationDebugReportContext } from './navigation-debug-report';
import { serializeNavigationDebugReport } from './navigation-debug-report';

describe('serializeNavigationDebugReport', () => {
  it('produit un rapport JSON versionné avec le contexte de reproduction', () => {
    const report = JSON.parse(serializeNavigationDebugReport(context())) as Record<string, unknown>;

    expect(report).toMatchObject({
      schema: 'universe-map/navigation-wheel-trace@2',
      capturedAt: '2026-08-19T18:30:00.000Z',
      pageUrl: 'https://super-universe.app/fr/?debug=true',
      viewport: { width: 1440, height: 900, devicePixelRatio: 2 },
      state: {
        targetId: 'earth',
        selectedId: 'earth',
        cameraDistance: 12,
      },
    });
    expect(report['entries']).toEqual([
      expect.objectContaining({ sequence: 1, decision: 'zoom-pointer' }),
    ]);
  });
});

function context(): NavigationDebugReportContext {
  return {
    capturedAt: '2026-08-19T18:30:00.000Z',
    pageUrl: 'https://super-universe.app/fr/?debug=true',
    userAgent: 'Test Browser',
    viewport: { width: 1440, height: 900, devicePixelRatio: 2 },
    state: {
      targetId: 'earth',
      selectedId: 'earth',
      cameraDistance: 12,
      time: { julianDay: 2_461_272.25 },
      displayOptions: {
        showOrbits: true,
        showConstellations: true,
        showLabels: true,
        quality: 'high',
        labelDensity: 'balanced',
        temporalMode: 'state',
      },
    },
    entries: [
      {
        sequence: 1,
        timestamp: '2026-08-19T18:29:59.000Z',
        deltaY: -120,
        rawDeltaY: -749,
        deltaMode: 0,
        pointer: { x: 0.2, y: -0.4 },
        interceptedObjectId: null,
        decision: 'zoom-pointer',
        anchor: { anchorType: 'pointer', anchorObjectId: null },
        zoom: null,
        before: state(12),
        after: state(6),
      },
    ],
  };
}

function state(distance: number) {
  return {
    cameraPosition: { x: 1, y: 2, z: 3 },
    cameraTarget: { x: 0, y: 0, z: 0 },
    distance,
    minimumDistance: 1.5,
    maximumDistance: 18_000,
    targetId: null,
    navigationOriginId: 'sun',
    referenceFrame: 'solar-system' as const,
    lodLevel: 1,
    atMinimumDistance: false,
    semanticZoomActive: true,
    transitioning: false,
  };
}
