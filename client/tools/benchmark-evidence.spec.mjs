import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  assertPhysicalBenchmarkEvidence,
  classifyBenchmarkEvidence,
  createBenchmarkEvidenceReport,
  createHostSnapshot,
  parseDeclaredDeviceClass,
  parseDeviceLabel,
  parsePhysicalEvidenceRequirement,
  printBenchmarkEvidence,
  publishBenchmarkEvidence,
  readBrowserHardwareSnapshot,
  writeBenchmarkEvidenceReport,
} from './benchmark-evidence.mjs';

test('benchmark evidence parsers preserve explicit device claims', () => {
  assert.equal(parseDeclaredDeviceClass(undefined), 'unclassified');
  assert.equal(parseDeclaredDeviceClass(' Medium '), 'medium');
  assert.equal(parseDeviceLabel(undefined), null);
  assert.equal(parseDeviceLabel(' Test laptop '), 'Test laptop');
  assert.equal(parsePhysicalEvidenceRequirement(undefined), false);
  assert.equal(parsePhysicalEvidenceRequirement('0'), false);
  assert.equal(parsePhysicalEvidenceRequirement('1'), true);
  assert.throws(() => parseDeclaredDeviceClass('tiny'), /high, medium, or low/u);
  assert.throws(() => parseDeviceLabel('  '), /between 1 and 120/u);
  assert.throws(() => parseDeviceLabel('x'.repeat(121)), /between 1 and 120/u);
  assert.throws(() => parsePhysicalEvidenceRequirement('yes'), /zero or one/u);
});

test('classifyBenchmarkEvidence never presents throttling or software WebGL as physical', () => {
  assert.equal(
    classifyBenchmarkEvidence(1, 'ANGLE Metal Renderer: Apple M5 Max'),
    'physical-hardware',
  );
  assert.equal(classifyBenchmarkEvidence(4, 'ANGLE Metal Renderer: Apple M5 Max'), 'simulated-cpu');
  assert.equal(
    classifyBenchmarkEvidence(1, 'ANGLE (Google, Vulkan SwiftShader)'),
    'software-rendered',
  );
  assert.equal(classifyBenchmarkEvidence(1, 'unavailable'), 'unverified-renderer');
  assert.throws(() => classifyBenchmarkEvidence(0, 'Metal'), /at least one/u);
  assert.throws(() => classifyBenchmarkEvidence(1, ''), /non-empty WebGL renderer/u);
});

test('createHostSnapshot reports stable non-identifying machine metadata', () => {
  assert.deepEqual(
    createHostSnapshot({
      platform: 'darwin',
      release: '25.6.0',
      architecture: 'arm64',
      cpuEntries: [{ model: 'Apple M5' }, { model: 'Apple M5' }],
      totalMemoryBytes: 32 * 1024 ** 3,
      nodeVersion: 'v24.0.0',
    }),
    {
      platform: 'darwin',
      release: '25.6.0',
      architecture: 'arm64',
      logicalCpuCount: 2,
      cpuModels: ['Apple M5'],
      totalMemoryBytes: 32 * 1024 ** 3,
      nodeVersion: 'v24.0.0',
    },
  );
  assert.throws(() => createHostSnapshot({ cpuEntries: [] }), /logical CPU/u);
  assert.throws(
    () => createHostSnapshot({ cpuEntries: [{ model: '' }], totalMemoryBytes: 0 }),
    /physical memory/u,
  );
});

test('createBenchmarkEvidenceReport qualifies evidence and enforces physical reports', () => {
  const report = evidenceReport();

  assert.equal(report.schema, 'universe-map/performance-evidence@1');
  assert.equal(report.evidence.measurementKind, 'physical-hardware');
  assert.doesNotThrow(() => assertPhysicalBenchmarkEvidence(report));
  assert.throws(
    () =>
      assertPhysicalBenchmarkEvidence({
        ...report,
        evidence: { ...report.evidence, measurementKind: 'simulated-cpu' },
      }),
    /received simulated-cpu/u,
  );
  assert.throws(
    () =>
      assertPhysicalBenchmarkEvidence({
        ...report,
        evidence: { ...report.evidence, declaredDeviceClass: 'unclassified' },
      }),
    /declared device class/u,
  );
  assert.throws(
    () => createBenchmarkEvidenceReport({ ...reportInput(), benchmark: '' }),
    /benchmark name/u,
  );
});

test('writeBenchmarkEvidenceReport creates a formatted portable JSON artifact', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'universe-benchmark-'));
  const outputPath = join(directory, 'nested', 'observer.json');

  try {
    const absolutePath = await writeBenchmarkEvidenceReport(outputPath, evidenceReport());
    const written = JSON.parse(await readFile(absolutePath, 'utf8'));

    assert.equal(absolutePath, outputPath);
    assert.equal(written.schema, 'universe-map/performance-evidence@1');
    await assert.rejects(() => writeBenchmarkEvidenceReport('', written), /non-empty/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('readBrowserHardwareSnapshot uses the shared Universe canvas', async () => {
  const snapshot = {
    renderer: 'ANGLE Metal Renderer: Apple M5 Max',
    vendor: 'Google Inc.',
  };
  const page = {
    locator(selector) {
      assert.equal(selector, 'canvas.universe-canvas');

      return {
        evaluate(callback) {
          assert.equal(typeof callback, 'function');

          return snapshot;
        },
      };
    },
  };

  assert.equal(await readBrowserHardwareSnapshot(page), snapshot);
});

test('publishBenchmarkEvidence shares output and physical guards across benchmarks', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'universe-published-benchmark-'));
  const outputPath = join(directory, 'startup.json');
  const input = {
    ...reportInput(),
    benchmark: 'startup',
    environment: {
      UNIVERSE_BENCHMARK_DEVICE_CLASS: 'medium',
      UNIVERSE_BENCHMARK_DEVICE_LABEL: 'Test laptop',
      UNIVERSE_BENCHMARK_REPORT_PATH: outputPath,
      UNIVERSE_BENCHMARK_REQUIRE_PHYSICAL: '1',
    },
  };

  try {
    const published = await publishBenchmarkEvidence(input);

    assert.equal(published.outputPath, outputPath);
    assert.equal(published.report.benchmark, 'startup');
    assert.equal(JSON.parse(await readFile(outputPath, 'utf8')).benchmark, 'startup');
    const output = [];

    printBenchmarkEvidence(published, (line) => output.push(line));
    assert.deepEqual(output, [
      'Evidence: physical-hardware · class medium',
      `Evidence report: ${outputPath}`,
    ]);
    await assert.rejects(
      () =>
        publishBenchmarkEvidence({
          ...input,
          cpuThrottleRate: 4,
          environment: {
            ...input.environment,
            UNIVERSE_BENCHMARK_REPORT_PATH: join(directory, 'must-not-exist.json'),
          },
        }),
      /received simulated-cpu/u,
    );
    await assert.rejects(() => readFile(join(directory, 'must-not-exist.json'), 'utf8'), /ENOENT/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

function evidenceReport() {
  return createBenchmarkEvidenceReport(reportInput());
}

function reportInput() {
  return {
    benchmark: 'observable-planetarium',
    browser: {
      renderer: 'ANGLE Metal Renderer: Apple M5 Max',
      vendor: 'Google Inc.',
    },
    configuration: { quality: 'high' },
    cpuThrottleRate: 1,
    declaredDeviceClass: 'high',
    deviceLabel: 'Test laptop',
    host: { platform: 'darwin' },
    samples: [{ p95Ms: 9.1 }],
    source: { commit: 'abc123', dirty: false },
    summary: { allStable: true },
    capturedAt: '2026-08-27T12:00:00.000Z',
  };
}
