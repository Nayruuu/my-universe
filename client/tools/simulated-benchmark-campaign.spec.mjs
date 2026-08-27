import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import test from 'node:test';
import { PERFORMANCE_CAMPAIGN_PROTOCOLS } from './benchmark-campaign.mjs';
import {
  SIMULATED_CAMPAIGN_LIMITATIONS,
  SIMULATED_PERFORMANCE_PROFILES,
  createSimulatedCampaignBenchmarkEnvironment,
  createSimulatedCampaignManifest,
  parseSimulatedCampaignConfiguration,
  runSimulatedPerformanceCampaign,
  validateSimulatedCampaignReports,
} from './simulated-benchmark-campaign.mjs';

test('simulated campaign configuration fixes two explicit nonphysical profiles', () => {
  const configuration = parseSimulatedCampaignConfiguration(simulatedEnvironment());

  assert.equal(configuration.baseUrl, 'http://127.0.0.1:4203/');
  assert.equal(configuration.hostDeviceClass, 'high');
  assert.equal(configuration.hostDeviceLabel, 'Source M5 Max');
  assert.equal(configuration.failOnBudgetRegression, true);
  assert.equal(configuration.runs, 3);
  assert.equal(configuration.resourceCycles, 3);
  assert.deepEqual(
    configuration.profiles.map(({ id, quality, cpuThrottleRate, observerDeviceScaleFactor }) => ({
      id,
      quality,
      cpuThrottleRate,
      observerDeviceScaleFactor,
    })),
    [
      {
        id: 'medium',
        quality: 'medium',
        cpuThrottleRate: 4,
        observerDeviceScaleFactor: 1.25,
      },
      { id: 'low', quality: 'low', cpuThrottleRate: 6, observerDeviceScaleFactor: 1 },
    ],
  );
  assert.deepEqual(parseSimulatedCampaignConfiguration({}).hostDeviceClass, 'unclassified');
  assert.equal(
    parseSimulatedCampaignConfiguration({ UNIVERSE_BENCHMARK_STRICT: '0' }).failOnBudgetRegression,
    false,
  );
  assert.throws(
    () => parseSimulatedCampaignConfiguration({ UNIVERSE_BENCHMARK_STRICT: 'yes' }),
    /must be zero or one/u,
  );
  assert.throws(
    () =>
      parseSimulatedCampaignConfiguration({
        ...simulatedEnvironment(),
        UNIVERSE_BENCHMARK_RUNS: '2',
      }),
    /at least 3/u,
  );
  assert.throws(
    () =>
      parseSimulatedCampaignConfiguration({
        ...simulatedEnvironment(),
        UNIVERSE_RESOURCE_CYCLES: '2',
      }),
    /at least 3/u,
  );
  assert.throws(
    () =>
      parseSimulatedCampaignConfiguration({
        ...simulatedEnvironment(),
        UNIVERSE_BENCHMARK_BASE_URL: 'file:///tmp/map',
      }),
    /HTTP or HTTPS/u,
  );
});

test('simulated campaign environments override inherited physical settings', () => {
  const configuration = parseSimulatedCampaignConfiguration(simulatedEnvironment());
  const profile = SIMULATED_PERFORMANCE_PROFILES[0];
  const environment = createSimulatedCampaignBenchmarkEnvironment(
    configuration,
    profile,
    '/tmp/medium-startup.json',
    {
      UNIVERSE_BENCHMARK_DEVICE_CLASS: 'high',
      UNIVERSE_BENCHMARK_DEVICE_LABEL: 'Source M5 Max',
      UNIVERSE_CPU_THROTTLE_RATE: '1',
      UNIVERSE_BENCHMARK_REQUIRE_PHYSICAL: '1',
      UNIVERSE_BENCHMARK_QUALITIES: 'high',
      UNIVERSE_OBSERVER_DPR: '2',
    },
  );

  assert.equal(environment.UNIVERSE_CPU_THROTTLE_RATE, '4');
  assert.equal(environment.UNIVERSE_BENCHMARK_REQUIRE_PHYSICAL, '0');
  assert.equal(environment.UNIVERSE_BENCHMARK_STRICT, '0');
  assert.equal(environment.UNIVERSE_BENCHMARK_PROFILES, 'desktop');
  assert.equal(environment.UNIVERSE_BENCHMARK_QUALITIES, 'medium');
  assert.equal(environment.UNIVERSE_BENCHMARK_QUALITY, 'medium');
  assert.equal(environment.UNIVERSE_OBSERVER_DPR, '1.25');
  assert.equal(environment.UNIVERSE_FRAME_COLD, '1');
  assert.equal(environment.UNIVERSE_FRAME_LABELS, '1');
  assert.equal(environment.UNIVERSE_BENCHMARK_REPORT_PATH, '/tmp/medium-startup.json');
  assert.throws(
    () =>
      createSimulatedCampaignBenchmarkEnvironment(
        configuration,
        { ...profile },
        '/tmp/report.json',
      ),
    /Unknown simulated performance profile/u,
  );
});

test('simulated campaign validation requires all five CPU-throttled hardware-rendered reports', () => {
  const configuration = parseSimulatedCampaignConfiguration(simulatedEnvironment());
  const profile = SIMULATED_PERFORMANCE_PROFILES[1];
  const reports = simulatedReports(configuration, profile).toReversed();
  const ordered = validateSimulatedCampaignReports(reports, configuration, profile);

  assert.deepEqual(
    ordered.map((report) => report.benchmark),
    PERFORMANCE_CAMPAIGN_PROTOCOLS.map((protocol) => protocol.benchmark),
  );
  assert.throws(
    () =>
      validateSimulatedCampaignReports(
        reports.map((report, index) =>
          index === 0
            ? {
                ...report,
                evidence: { ...report.evidence, measurementKind: 'physical-hardware' },
              }
            : report,
        ),
        configuration,
        profile,
      ),
    /not CPU-throttled/u,
  );
  assert.throws(
    () =>
      validateSimulatedCampaignReports(
        reports.map((report, index) =>
          index === 0
            ? {
                ...report,
                configuration: { ...report.configuration, cpuThrottleRate: 1 },
              }
            : report,
        ),
        configuration,
        profile,
      ),
    /CPU rate mismatch/u,
  );
  assert.throws(
    () =>
      validateSimulatedCampaignReports(
        reports.map((report, index) =>
          index === 0
            ? {
                ...report,
                browser: { ...report.browser, renderer: 'ANGLE Vulkan SwiftShader' },
              }
            : report,
        ),
        configuration,
        profile,
      ),
    /hardware-accelerated renderer/u,
  );
});

test('simulated campaign manifest binds both profiles without claiming physical evidence', () => {
  const configuration = parseSimulatedCampaignConfiguration(simulatedEnvironment());
  const artifacts = simulatedArtifacts(configuration);
  const manifest = createSimulatedCampaignManifest({
    artifacts,
    configuration,
    capturedAt: '2026-08-27T16:00:00.000Z',
  });

  assert.equal(manifest.schema, 'universe-map/simulated-performance-campaign@1');
  assert.equal(manifest.campaign.measurementKind, 'simulated-cpu');
  assert.equal(manifest.campaign.failOnBudgetRegression, true);
  assert.equal(manifest.campaign.withinBudget, true);
  assert.equal(manifest.campaign.profileCount, 2);
  assert.equal(manifest.campaign.protocolsPerProfile, 5);
  assert.deepEqual(manifest.limitations, [...SIMULATED_CAMPAIGN_LIMITATIONS]);
  assert.equal(manifest.profiles.length, 2);
  assert.equal(manifest.profiles[0].withinBudget, true);
  assert.equal(manifest.profiles[0].protocols.length, 5);
  assert.equal(manifest.profiles[0].protocols[0].withinBudget, true);
  assert.equal(manifest.profiles[0].protocols[0].file, 'medium/01-startup.json');
  assert.match(manifest.profiles[0].protocols[0].sha256, /^[\da-f]{64}$/u);
  assert.equal(manifest.profiles[1].cpuThrottleRate, 6);
  const failingArtifacts = artifacts.map((artifact) =>
    artifact.report.benchmark === 'scale-frame-stability' && artifact.profileId === 'medium'
      ? {
          ...artifact,
          report: { ...artifact.report, summary: [{ stable: false }] },
        }
      : artifact,
  );
  const failingManifest = createSimulatedCampaignManifest({
    artifacts: failingArtifacts,
    configuration,
  });

  assert.equal(failingManifest.campaign.withinBudget, false);
  assert.equal(failingManifest.profiles[0].withinBudget, false);
  assert.equal(failingManifest.profiles[0].protocols[3].withinBudget, false);
  assert.throws(
    () =>
      createSimulatedCampaignManifest({
        artifacts: artifacts.slice(1),
        configuration,
      }),
    /requires 10 artifacts/u,
  );
});

test('simulated campaign runner collects ten reports before enforcing the aggregate budget', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'universe-simulated-campaign-runner-'));
  const outputDirectory = join(directory, 'evidence');
  const repositoryDirectory = join(directory, 'repository');
  const environment = {
    ...simulatedEnvironment(),
    UNIVERSE_BENCHMARK_CAMPAIGN_DIR: outputDirectory,
  };
  const configuration = parseSimulatedCampaignConfiguration(environment);
  const reportsByProfileAndFile = new Map(
    SIMULATED_PERFORMANCE_PROFILES.flatMap((profile) =>
      simulatedReports(configuration, profile).map((report, index) => [
        `${profile.id}:${PERFORMANCE_CAMPAIGN_PROTOCOLS[index].fileName}`,
        report,
      ]),
    ),
  );
  const executedScripts = [];
  const throttleRates = [];

  try {
    const result = await runSimulatedPerformanceCampaign({
      environment,
      repositoryDirectory,
      clientDirectory: join(directory, 'client'),
      toolsDirectory: join(directory, 'tools'),
      readCampaignSource: () => ({ commit: 'abc123', dirty: false }),
      writeLine: () => undefined,
      runBenchmarkProcess: async (scriptPath, options) => {
        executedScripts.push(basename(scriptPath));
        throttleRates.push(options.environment.UNIVERSE_CPU_THROTTLE_RATE);
        const reportPath = options.environment.UNIVERSE_BENCHMARK_REPORT_PATH;
        const profileId = basename(dirname(reportPath));
        const report = reportsByProfileAndFile.get(`${profileId}:${basename(reportPath)}`);

        await writeFile(reportPath, `${JSON.stringify(report)}\n`, 'utf8');
      },
    });
    const manifest = JSON.parse(await readFile(result.manifestPath, 'utf8'));

    assert.deepEqual(executedScripts, [
      ...PERFORMANCE_CAMPAIGN_PROTOCOLS.map((protocol) => protocol.script),
      ...PERFORMANCE_CAMPAIGN_PROTOCOLS.map((protocol) => protocol.script),
    ]);
    assert.deepEqual(throttleRates, [
      ...Array(PERFORMANCE_CAMPAIGN_PROTOCOLS.length).fill('4'),
      ...Array(PERFORMANCE_CAMPAIGN_PROTOCOLS.length).fill('6'),
    ]);
    assert.equal(manifest.schema, 'universe-map/simulated-performance-campaign@1');
    assert.equal(manifest.profiles.length, 2);
    assert.equal(manifest.campaign.withinBudget, true);

    const failingOutputDirectory = join(directory, 'failing-evidence');
    const failingReports = new Map(reportsByProfileAndFile);
    const failingKey = `medium:${PERFORMANCE_CAMPAIGN_PROTOCOLS[3].fileName}`;

    failingReports.set(failingKey, {
      ...failingReports.get(failingKey),
      summary: [{ stable: false }],
    });
    let failingExecutions = 0;

    await assert.rejects(
      () =>
        runSimulatedPerformanceCampaign({
          environment: {
            ...environment,
            UNIVERSE_BENCHMARK_CAMPAIGN_DIR: failingOutputDirectory,
          },
          repositoryDirectory,
          clientDirectory: join(directory, 'client'),
          toolsDirectory: join(directory, 'tools'),
          readCampaignSource: () => ({ commit: 'abc123', dirty: false }),
          writeLine: () => undefined,
          runBenchmarkProcess: async (_scriptPath, options) => {
            failingExecutions += 1;
            const reportPath = options.environment.UNIVERSE_BENCHMARK_REPORT_PATH;
            const profileId = basename(dirname(reportPath));
            const report = failingReports.get(`${profileId}:${basename(reportPath)}`);

            await writeFile(reportPath, `${JSON.stringify(report)}\n`, 'utf8');
          },
        }),
      /Evidence preserved/u,
    );
    const failingManifest = JSON.parse(
      await readFile(join(failingOutputDirectory, 'campaign.json'), 'utf8'),
    );

    assert.equal(failingExecutions, 10);
    assert.equal(failingManifest.campaign.withinBudget, false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

function simulatedEnvironment() {
  return {
    UNIVERSE_BENCHMARK_DEVICE_CLASS: 'high',
    UNIVERSE_BENCHMARK_DEVICE_LABEL: 'Source M5 Max',
  };
}

function simulatedArtifacts(configuration) {
  return SIMULATED_PERFORMANCE_PROFILES.flatMap((profile) =>
    simulatedReports(configuration, profile).map((report, index) => ({
      profileId: profile.id,
      fileName: PERFORMANCE_CAMPAIGN_PROTOCOLS[index].fileName,
      contents: `${JSON.stringify(report)}\n`,
      report,
    })),
  );
}

function simulatedReports(configuration, profile) {
  return PERFORMANCE_CAMPAIGN_PROTOCOLS.map((protocol) => ({
    schema: 'universe-map/performance-evidence@1',
    capturedAt: '2026-08-27T16:00:00.000Z',
    benchmark: protocol.benchmark,
    evidence: {
      measurementKind: 'simulated-cpu',
      declaredDeviceClass: configuration.hostDeviceClass,
      deviceLabel: configuration.hostDeviceLabel,
    },
    source: { commit: 'abc123', dirty: false },
    host: { platform: 'darwin', logicalCpuCount: 18 },
    browser: { renderer: 'ANGLE Metal Renderer: Apple M5 Max', userAgent: 'Chrome' },
    configuration: reportConfiguration(protocol.benchmark, configuration, profile),
    samples: [{ value: 1 }],
    summary: passingSummary(protocol.benchmark),
  }));
}

function passingSummary(benchmark) {
  if (benchmark === 'startup') {
    return [{ withinBudget: true }];
  }
  if (benchmark === 'tempel-transition') {
    return [{ frameBudget: '60-fps' }];
  }
  if (['resource-stability', 'scale-frame-stability'].includes(benchmark)) {
    return [{ stable: true }];
  }

  return { allStable: true, allPlanetsResolved: true };
}

function reportConfiguration(benchmark, configuration, profile) {
  if (benchmark === 'resource-stability') {
    return {
      qualities: [profile.quality],
      cycles: configuration.resourceCycles,
      cpuThrottleRate: profile.cpuThrottleRate,
    };
  }
  if (benchmark === 'scale-frame-stability') {
    return {
      qualities: [profile.quality],
      runs: configuration.runs,
      cpuThrottleRate: profile.cpuThrottleRate,
      mode: 'cold',
      labelsEnabled: true,
    };
  }
  if (benchmark === 'observable-planetarium') {
    return {
      quality: profile.quality,
      runs: configuration.runs,
      cpuThrottleRate: profile.cpuThrottleRate,
      requestedDeviceScaleFactor: profile.observerDeviceScaleFactor,
    };
  }

  return {
    qualities: [profile.quality],
    runs: configuration.runs,
    cpuThrottleRate: profile.cpuThrottleRate,
  };
}
