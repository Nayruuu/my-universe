import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeNavigationZoomTrace, formatNavigationZoomAudit } from './audit-navigation-zoom.mjs';

const MODEL = {
  logScalePerNormalizedWheelUnit: 0.0015,
};

test('analyzeNavigationZoomTrace accepts a reversible minimum-distance journey', () => {
  const report = createReport([
    createEntry(1, -100, 0.3584, 0.3584, 'release-target'),
    createEntry(2, 100, 0.3584, 0.3584),
  ]);
  const audit = analyzeNavigationZoomTrace(report, MODEL);

  assert.equal(audit.minimumTraversal.firstPrematureDistanceSequence, null);
  assert.equal(audit.minimumTraversal.finalTraversalLogarithmicAmount, 0);
  assert.equal(audit.minimumTraversal.expectedFinalDistance, 0.3584);
  assert.match(formatNavigationZoomAudit(audit), /minimum traversal: PASS/);
});

test('analyzeNavigationZoomTrace identifies distance zoom before traversal is unwound', () => {
  const report = createReport([
    createEntry(10, -100, 0.3584, 0.3584, 'release-target'),
    createEntry(11, 50, 0.3584, 0.5),
  ]);
  const audit = analyzeNavigationZoomTrace(report, MODEL);

  assert.equal(audit.minimumTraversal.firstPrematureDistanceSequence, 11);
  assert.ok(audit.minimumTraversal.finalTraversalLogarithmicAmount > 0);
  assert.match(formatNavigationZoomAudit(audit), /minimum traversal: FAIL/);
  assert.match(formatNavigationZoomAudit(audit), /sequence 11/);
});

test('analyzeNavigationZoomTrace checks the exponential law before release', () => {
  const requestedDistance = 2 * Math.exp(-20 * MODEL.logScalePerNormalizedWheelUnit);
  const report = createReport([createEntry(1, -20, 2, requestedDistance)]);
  const audit = analyzeNavigationZoomTrace(report, MODEL);

  assert.equal(audit.minimumTraversal, null);
  assert.ok(audit.exponentialLaw.maximumRelativeError < 1e-12);
  assert.match(formatNavigationZoomAudit(audit), /minimum traversal: not present/);
});

test('analyzeNavigationZoomTrace rejects incompatible and empty reports', () => {
  assert.throws(
    () => analyzeNavigationZoomTrace({ schema: 'old', entries: [] }, MODEL),
    /navigation-wheel-trace@2/,
  );
  assert.throws(
    () =>
      analyzeNavigationZoomTrace(
        { schema: 'universe-map/navigation-wheel-trace@2', entries: [] },
        MODEL,
      ),
    /does not contain/,
  );
});

function createReport(entries) {
  return {
    schema: 'universe-map/navigation-wheel-trace@2',
    entries,
  };
}

function createEntry(sequence, deltaY, beforeDistance, afterDistance, decision = 'zoom-pointer') {
  const minimumDistance = 0.3584;
  const maximumDistance = 600_000;
  const requestedDistance =
    beforeDistance * Math.exp(deltaY * MODEL.logScalePerNormalizedWheelUnit);

  return {
    sequence,
    deltaY,
    decision,
    zoom: {
      beforeDistance,
      requestedDistance,
    },
    before: {
      distance: beforeDistance,
      minimumDistance,
      maximumDistance,
    },
    after: {
      distance: afterDistance,
      minimumDistance,
      maximumDistance,
      semanticZoomActive: false,
      cameraPosition: { x: 0, y: 0, z: afterDistance },
      cameraTarget: { x: 0, y: 0, z: 0 },
    },
  };
}
