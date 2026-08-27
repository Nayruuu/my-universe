import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import {
  PERFORMANCE_CAMPAIGN_PROTOCOLS,
  assertCampaignOutputOutsideRepository,
  assertCleanCampaignSource,
} from './benchmark-campaign.mjs';
import {
  classifyBenchmarkEvidence,
  parseDeclaredDeviceClass,
  parseDeviceLabel,
  readSourceRevision,
} from './benchmark-evidence.mjs';

const TOOL_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const CLIENT_DIRECTORY = resolve(TOOL_DIRECTORY, '..');
const REPOSITORY_DIRECTORY = resolve(CLIENT_DIRECTORY, '..');
const DEFAULT_BASE_URL = 'http://127.0.0.1:4203';
const MINIMUM_REPETITIONS = 3;

export const SIMULATED_PERFORMANCE_PROFILES = Object.freeze(
  [
    {
      id: 'medium',
      targetDeviceClass: 'medium',
      quality: 'medium',
      cpuThrottleRate: 4,
      observerDeviceScaleFactor: 1.25,
    },
    {
      id: 'low',
      targetDeviceClass: 'low',
      quality: 'low',
      cpuThrottleRate: 6,
      observerDeviceScaleFactor: 1,
    },
  ].map((profile) => Object.freeze(profile)),
);

export const SIMULATED_CAMPAIGN_LIMITATIONS = Object.freeze([
  'Chrome CPU throttling is a controlled same-host stress factor, not a physical device emulator.',
  'The source host GPU, graphics memory, driver, memory bandwidth, and thermal behavior remain unchanged.',
  'The medium and low names identify regression profiles and must not be presented as representative hardware measurements.',
]);

export function parseSimulatedCampaignConfiguration(environment = process.env) {
  return {
    baseUrl: parseBaseUrl(environment['UNIVERSE_BENCHMARK_BASE_URL'] ?? DEFAULT_BASE_URL),
    hostDeviceClass: parseDeclaredDeviceClass(environment['UNIVERSE_BENCHMARK_DEVICE_CLASS']),
    hostDeviceLabel: parseDeviceLabel(environment['UNIVERSE_BENCHMARK_DEVICE_LABEL']),
    failOnBudgetRegression: parseStrictMode(environment['UNIVERSE_BENCHMARK_STRICT']),
    runs: readRepetitionCount(environment['UNIVERSE_BENCHMARK_RUNS'] ?? '3', 'runs'),
    resourceCycles: readRepetitionCount(
      environment['UNIVERSE_RESOURCE_CYCLES'] ?? '3',
      'resource cycles',
    ),
    profiles: SIMULATED_PERFORMANCE_PROFILES,
  };
}

export function createSimulatedCampaignBenchmarkEnvironment(
  configuration,
  profile,
  reportPath,
  environment = process.env,
) {
  assertKnownSimulatedProfile(profile);
  const benchmarkEnvironment = {
    ...environment,
    UNIVERSE_BENCHMARK_BASE_URL: configuration.baseUrl,
    UNIVERSE_BENCHMARK_PROFILES: 'desktop',
    UNIVERSE_BENCHMARK_QUALITIES: profile.quality,
    UNIVERSE_BENCHMARK_QUALITY: profile.quality,
    UNIVERSE_BENCHMARK_RUNS: String(configuration.runs),
    UNIVERSE_RESOURCE_CYCLES: String(configuration.resourceCycles),
    UNIVERSE_OBSERVER_DPR: String(profile.observerDeviceScaleFactor),
    UNIVERSE_CPU_THROTTLE_RATE: String(profile.cpuThrottleRate),
    UNIVERSE_FRAME_COLD: '1',
    UNIVERSE_FRAME_LABELS: '1',
    UNIVERSE_BENCHMARK_STRICT: '0',
    UNIVERSE_BENCHMARK_REQUIRE_PHYSICAL: '0',
    UNIVERSE_BENCHMARK_REPORT_PATH: reportPath,
  };

  if (configuration.hostDeviceClass === 'unclassified') {
    delete benchmarkEnvironment.UNIVERSE_BENCHMARK_DEVICE_CLASS;
  } else {
    benchmarkEnvironment.UNIVERSE_BENCHMARK_DEVICE_CLASS = configuration.hostDeviceClass;
  }
  if (configuration.hostDeviceLabel === null) {
    delete benchmarkEnvironment.UNIVERSE_BENCHMARK_DEVICE_LABEL;
  } else {
    benchmarkEnvironment.UNIVERSE_BENCHMARK_DEVICE_LABEL = configuration.hostDeviceLabel;
  }

  return benchmarkEnvironment;
}

export function validateSimulatedCampaignReports(reports, configuration, profile) {
  assertKnownSimulatedProfile(profile);
  if (!Array.isArray(reports) || reports.length !== PERFORMANCE_CAMPAIGN_PROTOCOLS.length) {
    throw new Error(
      `A simulated performance profile requires ${PERFORMANCE_CAMPAIGN_PROTOCOLS.length} reports.`,
    );
  }
  const reportsByBenchmark = new Map();

  for (const report of reports) {
    if (reportsByBenchmark.has(report?.benchmark)) {
      throw new Error(`Duplicate simulated campaign report: ${String(report?.benchmark)}.`);
    }
    reportsByBenchmark.set(report?.benchmark, report);
  }
  const orderedReports = PERFORMANCE_CAMPAIGN_PROTOCOLS.map((protocol) => {
    const report = reportsByBenchmark.get(protocol.benchmark);

    if (report === undefined) {
      throw new Error(`Missing simulated campaign report: ${protocol.benchmark}.`);
    }

    return report;
  });
  const [reference] = orderedReports;

  assertSimulatedCampaignReport(reference, configuration, profile);
  assertCleanCampaignSource(reference.source);
  for (const report of orderedReports.slice(1)) {
    assertSimulatedCampaignReport(report, configuration, profile);
    assertCleanCampaignSource(report.source);
    if (!isDeepStrictEqual(report.source, reference.source)) {
      throw new Error('Simulated campaign reports must use the same Git source state.');
    }
    if (!isDeepStrictEqual(report.host, reference.host)) {
      throw new Error('Simulated campaign reports must use the same source host.');
    }
    if (!isDeepStrictEqual(report.browser, reference.browser)) {
      throw new Error('Simulated campaign reports must use the same browser and WebGL renderer.');
    }
  }

  return orderedReports;
}

export function createSimulatedCampaignManifest({
  artifacts,
  configuration,
  capturedAt = new Date().toISOString(),
}) {
  const expectedArtifactCount =
    SIMULATED_PERFORMANCE_PROFILES.length * PERFORMANCE_CAMPAIGN_PROTOCOLS.length;

  if (!Array.isArray(artifacts) || artifacts.length !== expectedArtifactCount) {
    throw new Error(`A simulated campaign manifest requires ${expectedArtifactCount} artifacts.`);
  }
  const artifactsByKey = new Map(
    artifacts.map((artifact) => [
      artifactKey(artifact.profileId, artifact.report.benchmark),
      artifact,
    ]),
  );
  const validatedByProfile = SIMULATED_PERFORMANCE_PROFILES.map((profile) => ({
    profile,
    reports: validateSimulatedCampaignReports(
      artifacts
        .filter((artifact) => artifact.profileId === profile.id)
        .map((artifact) => artifact.report),
      configuration,
      profile,
    ),
  }));
  const [referenceProfile] = validatedByProfile;
  const [referenceReport] = referenceProfile.reports;

  for (const { reports } of validatedByProfile.slice(1)) {
    const [report] = reports;

    if (!isDeepStrictEqual(report.source, referenceReport.source)) {
      throw new Error('Simulated profiles must use the same Git source state.');
    }
    if (!isDeepStrictEqual(report.host, referenceReport.host)) {
      throw new Error('Simulated profiles must use the same source host.');
    }
    if (!isDeepStrictEqual(report.browser, referenceReport.browser)) {
      throw new Error('Simulated profiles must use the same browser and WebGL renderer.');
    }
  }

  const profiles = validatedByProfile.map(({ profile }) => {
    const protocols = PERFORMANCE_CAMPAIGN_PROTOCOLS.map((protocol) => {
      const artifact = artifactsByKey.get(artifactKey(profile.id, protocol.benchmark));

      if (artifact === undefined || artifact.fileName !== protocol.fileName) {
        throw new Error(
          `Unexpected artifact file for ${profile.id}/${protocol.benchmark}: ${String(
            artifact?.fileName,
          )}.`,
        );
      }

      return {
        benchmark: protocol.benchmark,
        file: `${profile.id}/${artifact.fileName}`,
        sha256: createHash('sha256').update(artifact.contents).digest('hex'),
        capturedAt: artifact.report.capturedAt,
        configuration: artifact.report.configuration,
        withinBudget: readReportBudgetStatus(artifact.report),
        summary: artifact.report.summary,
      };
    });

    return {
      id: profile.id,
      targetDeviceClass: profile.targetDeviceClass,
      quality: profile.quality,
      cpuThrottleRate: profile.cpuThrottleRate,
      observerDeviceScaleFactor: profile.observerDeviceScaleFactor,
      withinBudget: protocols.every((protocol) => protocol.withinBudget),
      protocols,
    };
  });

  return {
    schema: 'universe-map/simulated-performance-campaign@1',
    capturedAt,
    campaign: {
      measurementKind: 'simulated-cpu',
      hostDeviceClass: configuration.hostDeviceClass,
      hostDeviceLabel: configuration.hostDeviceLabel,
      runs: configuration.runs,
      resourceCycles: configuration.resourceCycles,
      profileCount: SIMULATED_PERFORMANCE_PROFILES.length,
      protocolsPerProfile: PERFORMANCE_CAMPAIGN_PROTOCOLS.length,
      failOnBudgetRegression: configuration.failOnBudgetRegression,
      withinBudget: profiles.every((profile) => profile.withinBudget),
    },
    limitations: [...SIMULATED_CAMPAIGN_LIMITATIONS],
    source: referenceReport.source,
    host: referenceReport.host,
    browser: referenceReport.browser,
    profiles,
  };
}

export async function runSimulatedPerformanceCampaign(options = {}) {
  const environment = options.environment ?? process.env;
  const repositoryDirectory = options.repositoryDirectory ?? REPOSITORY_DIRECTORY;
  const clientDirectory = options.clientDirectory ?? CLIENT_DIRECTORY;
  const toolsDirectory = options.toolsDirectory ?? TOOL_DIRECTORY;
  const configuration = parseSimulatedCampaignConfiguration(environment);
  const source = (options.readCampaignSource ?? readSourceRevision)(repositoryDirectory);

  assertCleanCampaignSource(source);
  const outputDirectory = await createSimulatedCampaignOutputDirectory(
    environment['UNIVERSE_BENCHMARK_CAMPAIGN_DIR'],
    repositoryDirectory,
  );
  const runBenchmarkProcess = options.runBenchmarkProcess ?? executeBenchmarkProcess;
  const writeLine = options.writeLine ?? console.log;
  const artifacts = [];

  writeLine(`Simulated CPU stress campaign: ${outputDirectory}`);
  for (const profile of SIMULATED_PERFORMANCE_PROFILES) {
    const profileDirectory = join(outputDirectory, profile.id);

    await mkdir(profileDirectory);
    writeLine(`${profile.id} proxy · quality ${profile.quality} · CPU ${profile.cpuThrottleRate}×`);
    for (const [index, protocol] of PERFORMANCE_CAMPAIGN_PROTOCOLS.entries()) {
      const reportPath = join(profileDirectory, protocol.fileName);

      writeLine(`[${index + 1}/${PERFORMANCE_CAMPAIGN_PROTOCOLS.length}] ${protocol.displayName}`);
      await runBenchmarkProcess(resolve(toolsDirectory, protocol.script), {
        clientDirectory,
        environment: createSimulatedCampaignBenchmarkEnvironment(
          configuration,
          profile,
          reportPath,
          environment,
        ),
      });
      const contents = await readFile(reportPath, 'utf8');
      let report;

      try {
        report = JSON.parse(contents);
      } catch {
        throw new Error(`Benchmark report is not valid JSON: ${reportPath}`);
      }
      artifacts.push({ profileId: profile.id, fileName: protocol.fileName, contents, report });
    }
  }
  const manifest = createSimulatedCampaignManifest({ artifacts, configuration });
  const manifestPath = join(outputDirectory, 'campaign.json');

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
  writeLine(`Simulated campaign manifest: ${manifestPath}`);
  writeLine(`Simulated campaign budgets: ${manifest.campaign.withinBudget ? 'pass' : 'fail'}`);

  if (configuration.failOnBudgetRegression && !manifest.campaign.withinBudget) {
    throw new Error(`Simulated campaign budgets failed. Evidence preserved at ${manifestPath}.`);
  }

  return { outputDirectory, manifestPath, manifest };
}

function readReportBudgetStatus(report) {
  if (report.benchmark === 'observable-planetarium') {
    const summary = report.summary;

    if (
      typeof summary?.allStable !== 'boolean' ||
      typeof summary.allPlanetsResolved !== 'boolean'
    ) {
      throw new Error('Observable planetarium evidence has an invalid budget summary.');
    }

    return summary.allStable && summary.allPlanetsResolved;
  }
  const summaries = report.summary;

  if (!Array.isArray(summaries) || summaries.length === 0) {
    throw new Error(`${report.benchmark} evidence has an invalid budget summary.`);
  }
  if (report.benchmark === 'startup') {
    return summaries.every((summary) => readBudgetBoolean(summary?.withinBudget, report.benchmark));
  }
  if (report.benchmark === 'tempel-transition') {
    return summaries.every((summary) => {
      if (!['60-fps', '30-fps', 'slow'].includes(summary?.frameBudget)) {
        throw new Error(`${report.benchmark} evidence has an invalid frame budget summary.`);
      }

      return summary.frameBudget !== 'slow';
    });
  }
  if (['resource-stability', 'scale-frame-stability'].includes(report.benchmark)) {
    return summaries.every((summary) => readBudgetBoolean(summary?.stable, report.benchmark));
  }

  throw new Error(`Unsupported simulated campaign benchmark: ${String(report.benchmark)}.`);
}

function readBudgetBoolean(value, benchmark) {
  if (typeof value !== 'boolean') {
    throw new Error(`${benchmark} evidence has an invalid budget summary.`);
  }

  return value;
}

function assertKnownSimulatedProfile(profile) {
  if (!SIMULATED_PERFORMANCE_PROFILES.includes(profile)) {
    throw new Error('Unknown simulated performance profile.');
  }
}

function assertSimulatedCampaignReport(report, configuration, profile) {
  if (report?.schema !== 'universe-map/performance-evidence@1') {
    throw new Error(`Unsupported simulated evidence schema for ${String(report?.benchmark)}.`);
  }
  if (report.evidence?.measurementKind !== 'simulated-cpu') {
    throw new Error(`Simulated campaign report is not CPU-throttled: ${report.benchmark}.`);
  }
  if (report.evidence.declaredDeviceClass !== configuration.hostDeviceClass) {
    throw new Error(`Simulated campaign source-host class mismatch: ${report.benchmark}.`);
  }
  if (report.evidence.deviceLabel !== configuration.hostDeviceLabel) {
    throw new Error(`Simulated campaign source-host label mismatch: ${report.benchmark}.`);
  }
  if (!report.host || !report.browser || typeof report.browser.renderer !== 'string') {
    throw new Error(`Simulated campaign source-host metadata is incomplete: ${report.benchmark}.`);
  }
  if (classifyBenchmarkEvidence(1, report.browser.renderer) !== 'physical-hardware') {
    throw new Error(
      `Simulated campaign requires a hardware-accelerated renderer: ${report.benchmark}.`,
    );
  }
  assertSimulatedReportConfiguration(report, configuration, profile);
}

function assertSimulatedReportConfiguration(report, configuration, profile) {
  const configuredQualities = report.configuration?.qualities;
  const qualityMatches = Array.isArray(configuredQualities)
    ? isDeepStrictEqual(configuredQualities, [profile.quality])
    : report.configuration?.quality === profile.quality;

  if (!qualityMatches) {
    throw new Error(`Simulated campaign quality mismatch: ${report.benchmark}.`);
  }
  if (report.configuration?.cpuThrottleRate !== profile.cpuThrottleRate) {
    throw new Error(`Simulated campaign CPU rate mismatch: ${report.benchmark}.`);
  }
  if (
    report.benchmark !== 'resource-stability' &&
    report.configuration?.runs !== configuration.runs
  ) {
    throw new Error(`Simulated campaign run count mismatch: ${report.benchmark}.`);
  }
  if (
    report.benchmark === 'resource-stability' &&
    report.configuration?.cycles !== configuration.resourceCycles
  ) {
    throw new Error('Simulated campaign resource cycle count mismatch.');
  }
  if (
    report.benchmark === 'scale-frame-stability' &&
    (report.configuration?.mode !== 'cold' || report.configuration?.labelsEnabled !== true)
  ) {
    throw new Error('Simulated campaign scale-frame configuration must be cold and labelled.');
  }
  if (
    report.benchmark === 'observable-planetarium' &&
    report.configuration?.requestedDeviceScaleFactor !== profile.observerDeviceScaleFactor
  ) {
    throw new Error('Simulated campaign observer DPR mismatch.');
  }
}

async function createSimulatedCampaignOutputDirectory(rawOutputDirectory, repositoryDirectory) {
  if (rawOutputDirectory === undefined) {
    return mkdtemp(join(tmpdir(), 'universe-map-simulated-'));
  }
  if (rawOutputDirectory.trim().length === 0) {
    throw new Error('Universe simulated campaign directory must be non-empty.');
  }
  const outputDirectory = resolve(rawOutputDirectory);

  assertCampaignOutputOutsideRepository(outputDirectory, repositoryDirectory);
  const createdDirectory = await mkdir(outputDirectory, { recursive: true });

  if (createdDirectory === undefined) {
    throw new Error('Universe simulated campaign directory must not already exist.');
  }

  return outputDirectory;
}

async function executeBenchmarkProcess(scriptPath, { clientDirectory, environment }) {
  await new Promise((resolveProcess, rejectProcess) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: clientDirectory,
      env: environment,
      stdio: 'inherit',
    });

    child.once('error', rejectProcess);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolveProcess();
      } else {
        rejectProcess(
          new Error(
            `Benchmark process failed (${signal === null ? `exit ${String(code)}` : signal}): ${scriptPath}`,
          ),
        );
      }
    });
  });
}

function artifactKey(profileId, benchmark) {
  return `${profileId}:${benchmark}`;
}

function parseBaseUrl(rawValue) {
  let url;

  try {
    url = new URL(rawValue);
  } catch {
    throw new Error('Universe simulated campaign base URL must be valid.');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Universe simulated campaign base URL must use HTTP or HTTPS.');
  }

  return url.href;
}

function readRepetitionCount(rawValue, label) {
  const value = Number(rawValue);

  if (!Number.isInteger(value) || value < MINIMUM_REPETITIONS) {
    throw new Error(
      `Universe simulated campaign ${label} must be an integer of at least ${MINIMUM_REPETITIONS}.`,
    );
  }

  return value;
}

function parseStrictMode(rawValue) {
  if (rawValue === undefined || rawValue === '1') {
    return true;
  }
  if (rawValue === '0') {
    return false;
  }

  throw new Error('Universe simulated campaign strict mode must be zero or one.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSimulatedPerformanceCampaign().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
