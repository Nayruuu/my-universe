import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const NAVIGATION_TRACE_SCHEMA = 'universe-map/navigation-wheel-trace@2';
const DEFAULT_TRACE_URL = new URL(
  '../tmp/navigation-debug/navigation-wheel-trace.latest.json',
  import.meta.url,
);
const MODEL_CONFIG_URL = new URL('../src/engine/camera/zoom-model.config.json', import.meta.url);
const DEFAULT_MODEL_CONFIG = JSON.parse(readFileSync(MODEL_CONFIG_URL, 'utf8'));

export function analyzeNavigationZoomTrace(report, modelConfig = DEFAULT_MODEL_CONFIG) {
  assertTrace(report);
  const logScalePerUnit = modelConfig.logScalePerNormalizedWheelUnit;
  const separationErrors = report.entries.map(calculateCameraTargetSeparationError);
  const releaseIndex = report.entries.findIndex((entry) => entry.decision === 'release-target');
  const exponentialSamples = report.entries
    .slice(0, releaseIndex < 0 ? report.entries.length : releaseIndex)
    .filter((entry) => entry.after.semanticZoomActive === false)
    .map((entry) => {
      const expectedRequestedDistance =
        entry.zoom.beforeDistance * Math.exp(entry.deltaY * logScalePerUnit);
      const scale = Math.max(Math.abs(expectedRequestedDistance), Number.EPSILON);

      return Math.abs(entry.zoom.requestedDistance - expectedRequestedDistance) / scale;
    });

  return {
    schema: report.schema,
    entryCount: report.entries.length,
    exponentialLaw: {
      sampleCount: exponentialSamples.length,
      maximumRelativeError: maximum(exponentialSamples),
    },
    geometry: {
      maximumCameraTargetSeparationError: maximum(separationErrors),
    },
    minimumTraversal:
      releaseIndex < 0
        ? null
        : analyzeMinimumTraversal(report.entries.slice(releaseIndex), logScalePerUnit),
  };
}

export function formatNavigationZoomAudit(audit) {
  const lines = [
    `Navigation zoom audit (${audit.entryCount} events)`,
    `  exponential law: ${formatScientific(audit.exponentialLaw.maximumRelativeError)} max relative error over ${audit.exponentialLaw.sampleCount} samples`,
    `  trace geometry: ${formatScientific(audit.geometry.maximumCameraTargetSeparationError)} max camera-target distance error`,
  ];

  if (!audit.minimumTraversal) {
    lines.push('  minimum traversal: not present in this trace');

    return lines.join('\n');
  }
  const traversal = audit.minimumTraversal;
  const status = traversal.firstPrematureDistanceSequence === null ? 'PASS' : 'FAIL';

  lines.push(
    `  minimum traversal: ${status}`,
    `    release sequence: ${traversal.releaseSequence}`,
    `    inward / outward input: ${traversal.inwardNormalizedAmount.toFixed(6)} / ${traversal.outwardNormalizedAmount.toFixed(6)}`,
    `    remaining logarithmic debt: ${traversal.finalTraversalLogarithmicAmount.toFixed(9)}`,
    `    model / captured final distance: ${traversal.expectedFinalDistance.toFixed(9)} / ${traversal.capturedFinalDistance.toFixed(9)}`,
  );
  if (traversal.firstPrematureDistanceSequence !== null) {
    lines.push(
      `    distance zoom resumed prematurely at sequence ${traversal.firstPrematureDistanceSequence}`,
    );
  }

  return lines.join('\n');
}

function analyzeMinimumTraversal(entries, logScalePerUnit) {
  const firstEntry = entries[0];
  const minimumDistance = firstEntry.before.minimumDistance;
  const maximumDistance = firstEntry.before.maximumDistance;
  const initialDistance = Math.max(firstEntry.before.distance, minimumDistance);
  const maximumCoordinate = Math.log(maximumDistance / minimumDistance);
  const tolerance = Math.max(1e-9, minimumDistance * 1e-6);
  let coordinate = Math.max(0, Math.log(initialDistance / minimumDistance));
  let firstPrematureDistanceSequence = null;
  let inwardNormalizedAmount = 0;
  let outwardNormalizedAmount = 0;

  for (const entry of entries) {
    if (entry.deltaY < 0) {
      inwardNormalizedAmount -= entry.deltaY;
    } else {
      outwardNormalizedAmount += entry.deltaY;
    }
    coordinate = Math.min(maximumCoordinate, coordinate + entry.deltaY * logScalePerUnit);
    const expectedDistance =
      coordinate <= 0 ? minimumDistance : minimumDistance * Math.exp(coordinate);

    if (
      firstPrematureDistanceSequence === null &&
      coordinate < 0 &&
      entry.after.distance > minimumDistance + tolerance
    ) {
      firstPrematureDistanceSequence = entry.sequence;
    }
    if (!Number.isFinite(expectedDistance)) {
      throw new Error(`Non-finite model distance at navigation sequence ${entry.sequence}.`);
    }
  }
  const expectedFinalDistance =
    coordinate <= 0 ? minimumDistance : minimumDistance * Math.exp(coordinate);

  return {
    releaseSequence: firstEntry.sequence,
    inwardNormalizedAmount,
    outwardNormalizedAmount,
    finalCoordinate: coordinate,
    finalTraversalLogarithmicAmount: Math.max(0, -coordinate),
    expectedFinalDistance,
    capturedFinalDistance: entries.at(-1).after.distance,
    firstPrematureDistanceSequence,
  };
}

function calculateCameraTargetSeparationError(entry) {
  const camera = entry.after.cameraPosition;
  const target = entry.after.cameraTarget;
  const separation = Math.hypot(camera.x - target.x, camera.y - target.y, camera.z - target.z);

  return Math.abs(separation - entry.after.distance);
}

function assertTrace(report) {
  if (report?.schema !== NAVIGATION_TRACE_SCHEMA) {
    throw new Error(`Expected ${NAVIGATION_TRACE_SCHEMA}.`);
  }
  if (!Array.isArray(report.entries) || report.entries.length === 0) {
    throw new Error('The navigation trace does not contain any wheel entries.');
  }
}

function maximum(values) {
  return values.length === 0 ? 0 : Math.max(...values);
}

function formatScientific(value) {
  return Number.isFinite(value) ? value.toExponential(3) : String(value);
}

function runCli() {
  const tracePath = process.argv[2] ?? fileURLToPath(DEFAULT_TRACE_URL);
  const report = JSON.parse(readFileSync(tracePath, 'utf8'));
  const audit = analyzeNavigationZoomTrace(report);

  console.log(formatNavigationZoomAudit(audit));
  if (audit.minimumTraversal && audit.minimumTraversal.firstPrematureDistanceSequence !== null) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}
