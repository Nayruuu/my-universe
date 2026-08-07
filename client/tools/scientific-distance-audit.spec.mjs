import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertScientificDistanceAudit,
  auditScientificDistances,
  formatScientificDistanceAudit,
} from './scientific-distance-audit.mjs';

const dataRoot = new URL('../public/data/', import.meta.url);

test('every bundled scientific distance satisfies its declared coordinate contract', async () => {
  const report = await auditScientificDistances(dataRoot);

  assert.equal(report.anomalies.length, 0);
  assert.equal(report.totalRecordsInspected, 361_748);
  assert.deepEqual(report.curated, {
    objects: 115,
    staticPositions: 49,
    documentedDistances: 44,
    orbitalDefinitions: 50,
    visuallyScaledOrbits: 31,
  });
  assert.equal(report.nearbyUniverse.tiles, 115);
  assert.equal(report.nearbyUniverse.objects, 720);
  assert.ok(report.nearbyUniverse.maximumRelativeDistanceError < 0.000_025);
  assert.ok(report.nearbyUniverse.maximumCoordinateDeviationMpc < 0.000_5);
  assert.equal(report.hyg.records, 10_000);
  assert.ok(report.hyg.minimumDistanceParsec > 1.29);
  assert.ok(report.hyg.minimumDistanceParsec < 1.3);
  assert.ok(report.hyg.maximumDistanceParsec > 990);
  assert.ok(report.hyg.maximumDistanceParsec < 991);
  assert.deepEqual(report.exoplanets, {
    hosts: 4_747,
    planets: 6_333,
    positionedHosts: 4_720,
    missingDistanceHosts: 27,
    fallbackDistanceParsec: 1_000,
    planetsWithPublishedAxis: 5_906,
    planetsWithCalculatedAxis: 419,
    planetsWithIllustrativeAxis: 8,
    planetsWithPublishedPeriod: 5_989,
    planetsWithCalculatedPeriod: 330,
    planetsWithIllustrativePeriod: 14,
  });
  assert.equal(report.cosmicGroups.records, 37_730);
  assert.equal(report.cosmicStructures.records, 26_520);
  assert.deepEqual(report.tempelSpines, {
    filaments: 15_421,
    points: 275_599,
    segments: 260_178,
    minimumDistanceMpc: 36.846_534_729_003_906,
    maximumDistanceMpc: 644.445_068_359_375,
  });
  assert.doesNotThrow(() => assertScientificDistanceAudit(report));
});

test('the scientific gate reports the exact catalogue record that violates its distance', () => {
  const report = {
    totalRecordsInspected: 1,
    anomalies: [
      {
        family: 'black-holes',
        id: 'gaia-bh1',
        reason: 'distance mismatch',
      },
    ],
  };

  assert.throws(
    () => assertScientificDistanceAudit(report),
    /black-holes · gaia-bh1 · distance mismatch/,
  );
});

test('the command summary exposes inspected records and illustrative exceptions', async () => {
  const report = await auditScientificDistances(dataRoot);
  const output = formatScientificDistanceAudit(report);

  assert.match(output, /361,748 scientific records inspected/);
  assert.match(output, /27 exoplanet hosts use the labelled 1,000 pc fallback/);
  assert.match(output, /8 illustrative semi-major axes/);
  assert.match(output, /14 illustrative orbital periods/);
  assert.match(output, /0 distance-contract anomalies/);
});
