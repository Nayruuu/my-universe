import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import test from 'node:test';
import {
  PERFORMANCE_CAMPAIGN_PROTOCOLS,
  assertCampaignOutputOutsideRepository,
  assertCleanCampaignSource,
  createCampaignBenchmarkEnvironment,
  createPerformanceCampaignManifest,
  parsePerformanceCampaignConfiguration,
  runPerformanceCampaign,
  validatePerformanceCampaignReports,
} from './benchmark-campaign.mjs';

test('performance campaign configuration requires repeatable classified physical evidence', () => {
  assert.deepEqual(parsePerformanceCampaignConfiguration(campaignEnvironment()), {
    baseUrl: 'http://127.0.0.1:4203/',
    declaredDeviceClass: 'medium',
    deviceLabel: 'Representative laptop',
    quality: 'medium',
    runs: 3,
    resourceCycles: 3,
    observerDeviceScaleFactor: 2,
  });
  assert.throws(
    () => parsePerformanceCampaignConfiguration({}),
    /requires a declared device class/u,
  );
  assert.throws(
    () =>
      parsePerformanceCampaignConfiguration({
        UNIVERSE_BENCHMARK_DEVICE_CLASS: 'low',
      }),
    /requires a device label/u,
  );
  assert.throws(
    () =>
      parsePerformanceCampaignConfiguration({
        ...campaignEnvironment(),
        UNIVERSE_BENCHMARK_RUNS: '2',
      }),
    /at least 3/u,
  );
  assert.throws(
    () =>
      parsePerformanceCampaignConfiguration({
        ...campaignEnvironment(),
        UNIVERSE_RESOURCE_CYCLES: '2',
      }),
    /at least 3/u,
  );
  assert.throws(
    () =>
      parsePerformanceCampaignConfiguration({
        ...campaignEnvironment(),
        UNIVERSE_BENCHMARK_QUALITY: 'ultra',
      }),
    /low, medium, or high/u,
  );
  assert.throws(
    () =>
      parsePerformanceCampaignConfiguration({
        ...campaignEnvironment(),
        UNIVERSE_BENCHMARK_BASE_URL: 'file:///tmp/map',
      }),
    /HTTP or HTTPS/u,
  );
});

test('campaign environments neutralize simulation and enforce comparable protocols', () => {
  const configuration = parsePerformanceCampaignConfiguration(campaignEnvironment());
  const environment = createCampaignBenchmarkEnvironment(configuration, '/tmp/startup.json', {
    UNIVERSE_CPU_THROTTLE_RATE: '6',
    UNIVERSE_BENCHMARK_REQUIRE_PHYSICAL: '0',
    UNIVERSE_FRAME_COLD: '0',
    UNIVERSE_FRAME_LABELS: '0',
  });

  assert.equal(environment.UNIVERSE_CPU_THROTTLE_RATE, '1');
  assert.equal(environment.UNIVERSE_BENCHMARK_REQUIRE_PHYSICAL, '1');
  assert.equal(environment.UNIVERSE_BENCHMARK_STRICT, '1');
  assert.equal(environment.UNIVERSE_BENCHMARK_PROFILES, 'desktop');
  assert.equal(environment.UNIVERSE_BENCHMARK_QUALITIES, 'medium');
  assert.equal(environment.UNIVERSE_BENCHMARK_QUALITY, 'medium');
  assert.equal(environment.UNIVERSE_FRAME_COLD, '1');
  assert.equal(environment.UNIVERSE_FRAME_LABELS, '1');
  assert.equal(environment.UNIVERSE_BENCHMARK_REPORT_PATH, '/tmp/startup.json');
});

test('physical campaign source and output stay reproducible and outside the checkout', () => {
  assert.doesNotThrow(() => assertCleanCampaignSource({ commit: 'abc123', dirty: false }));
  assert.throws(() => assertCleanCampaignSource({ commit: null, dirty: null }), /Git revision/u);
  assert.throws(() => assertCleanCampaignSource({ commit: 'abc123', dirty: true }), /clean Git/u);
  assert.doesNotThrow(() =>
    assertCampaignOutputOutsideRepository('/tmp/universe-map-medium', '/workspace/universe-map'),
  );
  assert.throws(
    () =>
      assertCampaignOutputOutsideRepository(
        '/workspace/universe-map/results',
        '/workspace/universe-map',
      ),
    /outside the repository/u,
  );
});

test('campaign validation orders all five matching physical reports', () => {
  const configuration = parsePerformanceCampaignConfiguration(campaignEnvironment());
  const reports = campaignReports(configuration).toReversed();
  const ordered = validatePerformanceCampaignReports(reports, configuration);

  assert.deepEqual(
    ordered.map((report) => report.benchmark),
    PERFORMANCE_CAMPAIGN_PROTOCOLS.map((protocol) => protocol.benchmark),
  );
  assert.throws(
    () => validatePerformanceCampaignReports(reports.slice(1), configuration),
    /requires 5 reports/u,
  );
  assert.throws(
    () =>
      validatePerformanceCampaignReports(
        reports.map((report, index) =>
          index === 0
            ? {
                ...report,
                evidence: { ...report.evidence, measurementKind: 'simulated-cpu' },
              }
            : report,
        ),
        configuration,
      ),
    /is not physical/u,
  );
  assert.throws(
    () =>
      validatePerformanceCampaignReports(
        reports.map((report, index) =>
          index === 0
            ? { ...report, browser: { ...report.browser, renderer: 'Other GPU' } }
            : report,
        ),
        configuration,
      ),
    /same browser and WebGL renderer/u,
  );
});

test('campaign manifest binds every evidence file with a SHA-256 digest', () => {
  const configuration = parsePerformanceCampaignConfiguration(campaignEnvironment());
  const reports = campaignReports(configuration);
  const artifacts = reports.map((report, index) => ({
    fileName: PERFORMANCE_CAMPAIGN_PROTOCOLS[index].fileName,
    contents: `${JSON.stringify(report)}\n`,
    report,
  }));
  const manifest = createPerformanceCampaignManifest({
    artifacts,
    configuration,
    capturedAt: '2026-08-27T15:00:00.000Z',
  });

  assert.equal(manifest.schema, 'universe-map/performance-campaign@1');
  assert.equal(manifest.campaign.protocolCount, 5);
  assert.equal(manifest.protocols.length, 5);
  assert.match(manifest.protocols[0].sha256, /^[\da-f]{64}$/u);
  assert.deepEqual(manifest.source, { commit: 'abc123', dirty: false });
  assert.throws(
    () =>
      createPerformanceCampaignManifest({
        artifacts: artifacts.map((artifact, index) =>
          index === 0 ? { ...artifact, fileName: 'wrong.json' } : artifact,
        ),
        configuration,
      }),
    /Unexpected artifact file/u,
  );
});

test('campaign runner executes the five protocols sequentially and writes the manifest', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'universe-campaign-runner-'));
  const outputDirectory = join(directory, 'evidence');
  const repositoryDirectory = join(directory, 'repository');
  const environment = {
    ...campaignEnvironment(),
    UNIVERSE_BENCHMARK_CAMPAIGN_DIR: outputDirectory,
  };
  const configuration = parsePerformanceCampaignConfiguration(environment);
  const reportsByFile = new Map(
    campaignReports(configuration).map((report, index) => [
      PERFORMANCE_CAMPAIGN_PROTOCOLS[index].fileName,
      report,
    ]),
  );
  const executedScripts = [];

  try {
    const result = await runPerformanceCampaign({
      environment,
      repositoryDirectory,
      clientDirectory: join(directory, 'client'),
      toolsDirectory: join(directory, 'tools'),
      readCampaignSource: () => ({ commit: 'abc123', dirty: false }),
      writeLine: () => undefined,
      runBenchmarkProcess: async (scriptPath, options) => {
        executedScripts.push(basename(scriptPath));
        const reportPath = options.environment.UNIVERSE_BENCHMARK_REPORT_PATH;
        const report = reportsByFile.get(basename(reportPath));

        await writeFile(reportPath, `${JSON.stringify(report)}\n`, 'utf8');
      },
    });
    const manifest = JSON.parse(await readFile(result.manifestPath, 'utf8'));

    assert.deepEqual(
      executedScripts,
      PERFORMANCE_CAMPAIGN_PROTOCOLS.map((protocol) => protocol.script),
    );
    assert.equal(manifest.schema, 'universe-map/performance-campaign@1');
    assert.equal(manifest.protocols.length, 5);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

function campaignEnvironment() {
  return {
    UNIVERSE_BENCHMARK_DEVICE_CLASS: 'medium',
    UNIVERSE_BENCHMARK_DEVICE_LABEL: 'Representative laptop',
  };
}

function campaignReports(configuration) {
  return PERFORMANCE_CAMPAIGN_PROTOCOLS.map((protocol) => ({
    schema: 'universe-map/performance-evidence@1',
    capturedAt: '2026-08-27T15:00:00.000Z',
    benchmark: protocol.benchmark,
    evidence: {
      measurementKind: 'physical-hardware',
      declaredDeviceClass: configuration.declaredDeviceClass,
      deviceLabel: configuration.deviceLabel,
    },
    source: { commit: 'abc123', dirty: false },
    host: { platform: 'darwin', logicalCpuCount: 8 },
    browser: { renderer: 'ANGLE Metal Renderer', userAgent: 'Chrome' },
    configuration: reportConfiguration(protocol.benchmark, configuration),
    samples: [{ value: 1 }],
    summary: { stable: true },
  }));
}

function reportConfiguration(benchmark, configuration) {
  if (benchmark === 'resource-stability') {
    return {
      qualities: [configuration.quality],
      cycles: configuration.resourceCycles,
      cpuThrottleRate: 1,
    };
  }
  if (benchmark === 'scale-frame-stability') {
    return {
      qualities: [configuration.quality],
      runs: configuration.runs,
      cpuThrottleRate: 1,
      mode: 'cold',
      labelsEnabled: true,
    };
  }
  if (benchmark === 'observable-planetarium') {
    return {
      quality: configuration.quality,
      runs: configuration.runs,
      cpuThrottleRate: 1,
      requestedDeviceScaleFactor: configuration.observerDeviceScaleFactor,
    };
  }

  return {
    qualities: [configuration.quality],
    runs: configuration.runs,
    cpuThrottleRate: 1,
  };
}
