import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import {
  parseDeclaredDeviceClass,
  parseDeviceLabel,
  readSourceRevision,
} from './benchmark-evidence.mjs';

const TOOL_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const CLIENT_DIRECTORY = resolve(TOOL_DIRECTORY, '..');
const REPOSITORY_DIRECTORY = resolve(CLIENT_DIRECTORY, '..');
const DEFAULT_BASE_URL = 'http://127.0.0.1:4203';
const MINIMUM_REPETITIONS = 3;
const QUALITIES = ['low', 'medium', 'high'];

export const PERFORMANCE_CAMPAIGN_PROTOCOLS = Object.freeze(
  [
    {
      benchmark: 'startup',
      displayName: 'Startup',
      script: 'startup-benchmark.mjs',
      fileName: '01-startup.json',
    },
    {
      benchmark: 'tempel-transition',
      displayName: 'Tempel transition',
      script: 'tempel-transition-benchmark.mjs',
      fileName: '02-tempel-transition.json',
    },
    {
      benchmark: 'resource-stability',
      displayName: 'Resource stability',
      script: 'resource-stability-benchmark.mjs',
      fileName: '03-resource-stability.json',
    },
    {
      benchmark: 'scale-frame-stability',
      displayName: 'Scale-frame stability',
      script: 'frame-stability-benchmark.mjs',
      fileName: '04-scale-frame-stability.json',
    },
    {
      benchmark: 'observable-planetarium',
      displayName: 'Observable planetarium',
      script: 'observer-frame-stability-benchmark.mjs',
      fileName: '05-observable-planetarium.json',
    },
  ].map((protocol) => Object.freeze(protocol)),
);

export function parsePerformanceCampaignConfiguration(environment = process.env) {
  const declaredDeviceClass = parseDeclaredDeviceClass(
    environment['UNIVERSE_BENCHMARK_DEVICE_CLASS'],
  );
  const deviceLabel = parseDeviceLabel(environment['UNIVERSE_BENCHMARK_DEVICE_LABEL']);

  if (declaredDeviceClass === 'unclassified') {
    throw new Error('A physical benchmark campaign requires a declared device class.');
  }
  if (deviceLabel === null) {
    throw new Error('A physical benchmark campaign requires a device label.');
  }
  const quality = environment['UNIVERSE_BENCHMARK_QUALITY'] ?? declaredDeviceClass;

  if (!QUALITIES.includes(quality)) {
    throw new Error('Universe benchmark campaign quality must be low, medium, or high.');
  }

  return {
    baseUrl: parseBaseUrl(environment['UNIVERSE_BENCHMARK_BASE_URL'] ?? DEFAULT_BASE_URL),
    declaredDeviceClass,
    deviceLabel,
    quality,
    runs: readRepetitionCount(environment['UNIVERSE_BENCHMARK_RUNS'] ?? '3', 'runs'),
    resourceCycles: readRepetitionCount(
      environment['UNIVERSE_RESOURCE_CYCLES'] ?? '3',
      'resource cycles',
    ),
    observerDeviceScaleFactor: readPositiveNumber(
      environment['UNIVERSE_OBSERVER_DPR'] ?? '2',
      'observer DPR',
    ),
  };
}

export function createCampaignBenchmarkEnvironment(
  configuration,
  reportPath,
  environment = process.env,
) {
  return {
    ...environment,
    UNIVERSE_BENCHMARK_BASE_URL: configuration.baseUrl,
    UNIVERSE_BENCHMARK_DEVICE_CLASS: configuration.declaredDeviceClass,
    UNIVERSE_BENCHMARK_DEVICE_LABEL: configuration.deviceLabel,
    UNIVERSE_BENCHMARK_PROFILES: 'desktop',
    UNIVERSE_BENCHMARK_QUALITIES: configuration.quality,
    UNIVERSE_BENCHMARK_QUALITY: configuration.quality,
    UNIVERSE_BENCHMARK_RUNS: String(configuration.runs),
    UNIVERSE_RESOURCE_CYCLES: String(configuration.resourceCycles),
    UNIVERSE_OBSERVER_DPR: String(configuration.observerDeviceScaleFactor),
    UNIVERSE_CPU_THROTTLE_RATE: '1',
    UNIVERSE_FRAME_COLD: '1',
    UNIVERSE_FRAME_LABELS: '1',
    UNIVERSE_BENCHMARK_STRICT: '1',
    UNIVERSE_BENCHMARK_REQUIRE_PHYSICAL: '1',
    UNIVERSE_BENCHMARK_REPORT_PATH: reportPath,
  };
}

export function assertCleanCampaignSource(source) {
  if (typeof source?.commit !== 'string' || source.commit.length === 0) {
    throw new Error('A performance benchmark campaign requires a readable Git revision.');
  }
  if (source.dirty !== false) {
    throw new Error('A performance benchmark campaign requires a clean Git checkout.');
  }
}

export function assertCampaignOutputOutsideRepository(outputDirectory, repositoryDirectory) {
  const relativePath = relative(resolve(repositoryDirectory), resolve(outputDirectory));
  const insideRepository =
    relativePath === '' ||
    (relativePath !== '..' && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath));

  if (insideRepository) {
    throw new Error('Performance benchmark campaign output must stay outside the repository.');
  }
}

export function validatePerformanceCampaignReports(reports, configuration) {
  if (!Array.isArray(reports) || reports.length !== PERFORMANCE_CAMPAIGN_PROTOCOLS.length) {
    throw new Error(
      `A performance campaign requires ${PERFORMANCE_CAMPAIGN_PROTOCOLS.length} reports.`,
    );
  }
  const reportsByBenchmark = new Map();

  for (const report of reports) {
    if (reportsByBenchmark.has(report?.benchmark)) {
      throw new Error(`Duplicate performance campaign report: ${String(report?.benchmark)}.`);
    }
    reportsByBenchmark.set(report?.benchmark, report);
  }
  const orderedReports = PERFORMANCE_CAMPAIGN_PROTOCOLS.map((protocol) => {
    const report = reportsByBenchmark.get(protocol.benchmark);

    if (report === undefined) {
      throw new Error(`Missing performance campaign report: ${protocol.benchmark}.`);
    }

    return report;
  });
  const [reference] = orderedReports;

  assertCampaignReport(reference, configuration);
  assertCleanCampaignSource(reference.source);
  for (const report of orderedReports.slice(1)) {
    assertCampaignReport(report, configuration);
    assertCleanCampaignSource(report.source);
    if (!isDeepStrictEqual(report.source, reference.source)) {
      throw new Error('Performance campaign reports must use the same Git source state.');
    }
    if (!isDeepStrictEqual(report.host, reference.host)) {
      throw new Error('Performance campaign reports must use the same physical host.');
    }
    if (!isDeepStrictEqual(report.browser, reference.browser)) {
      throw new Error('Performance campaign reports must use the same browser and WebGL renderer.');
    }
  }

  return orderedReports;
}

export function createPerformanceCampaignManifest({
  artifacts,
  configuration,
  capturedAt = new Date().toISOString(),
}) {
  if (!Array.isArray(artifacts) || artifacts.length !== PERFORMANCE_CAMPAIGN_PROTOCOLS.length) {
    throw new Error(
      `A performance campaign manifest requires ${PERFORMANCE_CAMPAIGN_PROTOCOLS.length} artifacts.`,
    );
  }
  const reports = validatePerformanceCampaignReports(
    artifacts.map((artifact) => artifact.report),
    configuration,
  );
  const artifactsByBenchmark = new Map(
    artifacts.map((artifact) => [artifact.report.benchmark, artifact]),
  );
  const [reference] = reports;

  return {
    schema: 'universe-map/performance-campaign@1',
    capturedAt,
    campaign: {
      declaredDeviceClass: configuration.declaredDeviceClass,
      deviceLabel: configuration.deviceLabel,
      quality: configuration.quality,
      runs: configuration.runs,
      resourceCycles: configuration.resourceCycles,
      observerDeviceScaleFactor: configuration.observerDeviceScaleFactor,
      protocolCount: PERFORMANCE_CAMPAIGN_PROTOCOLS.length,
    },
    source: reference.source,
    host: reference.host,
    browser: reference.browser,
    protocols: PERFORMANCE_CAMPAIGN_PROTOCOLS.map((protocol) => {
      const artifact = artifactsByBenchmark.get(protocol.benchmark);

      if (artifact.fileName !== protocol.fileName) {
        throw new Error(
          `Unexpected artifact file for ${protocol.benchmark}: ${artifact.fileName}.`,
        );
      }

      return {
        benchmark: protocol.benchmark,
        file: artifact.fileName,
        sha256: createHash('sha256').update(artifact.contents).digest('hex'),
        capturedAt: artifact.report.capturedAt,
        configuration: artifact.report.configuration,
        summary: artifact.report.summary,
      };
    }),
  };
}

export async function runPerformanceCampaign(options = {}) {
  const environment = options.environment ?? process.env;
  const repositoryDirectory = options.repositoryDirectory ?? REPOSITORY_DIRECTORY;
  const clientDirectory = options.clientDirectory ?? CLIENT_DIRECTORY;
  const toolsDirectory = options.toolsDirectory ?? TOOL_DIRECTORY;
  const configuration = parsePerformanceCampaignConfiguration(environment);
  const source = (options.readCampaignSource ?? readSourceRevision)(repositoryDirectory);

  assertCleanCampaignSource(source);
  const outputDirectory = await createCampaignOutputDirectory(
    environment['UNIVERSE_BENCHMARK_CAMPAIGN_DIR'],
    configuration.declaredDeviceClass,
    repositoryDirectory,
  );
  const runBenchmarkProcess = options.runBenchmarkProcess ?? executeBenchmarkProcess;
  const writeLine = options.writeLine ?? console.log;
  const artifacts = [];

  writeLine(`Physical ${configuration.declaredDeviceClass} campaign: ${outputDirectory}`);
  for (const [index, protocol] of PERFORMANCE_CAMPAIGN_PROTOCOLS.entries()) {
    const reportPath = join(outputDirectory, protocol.fileName);

    writeLine(`[${index + 1}/${PERFORMANCE_CAMPAIGN_PROTOCOLS.length}] ${protocol.displayName}`);
    await runBenchmarkProcess(resolve(toolsDirectory, protocol.script), {
      clientDirectory,
      environment: createCampaignBenchmarkEnvironment(configuration, reportPath, environment),
    });
    const contents = await readFile(reportPath, 'utf8');
    let report;

    try {
      report = JSON.parse(contents);
    } catch {
      throw new Error(`Benchmark report is not valid JSON: ${reportPath}`);
    }
    artifacts.push({ fileName: protocol.fileName, contents, report });
  }
  const manifest = createPerformanceCampaignManifest({ artifacts, configuration });
  const manifestPath = join(outputDirectory, 'campaign.json');

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
  writeLine(`Campaign manifest: ${manifestPath}`);

  return { outputDirectory, manifestPath, manifest };
}

async function createCampaignOutputDirectory(rawOutputDirectory, deviceClass, repositoryDirectory) {
  if (rawOutputDirectory === undefined) {
    return mkdtemp(join(tmpdir(), `universe-map-${deviceClass}-`));
  }
  if (rawOutputDirectory.trim().length === 0) {
    throw new Error('Universe benchmark campaign directory must be non-empty.');
  }
  const outputDirectory = resolve(rawOutputDirectory);

  assertCampaignOutputOutsideRepository(outputDirectory, repositoryDirectory);
  const createdDirectory = await mkdir(outputDirectory, { recursive: true });

  if (createdDirectory === undefined) {
    throw new Error('Universe benchmark campaign directory must not already exist.');
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

function assertCampaignReport(report, configuration) {
  if (report?.schema !== 'universe-map/performance-evidence@1') {
    throw new Error(`Unsupported performance evidence schema for ${String(report?.benchmark)}.`);
  }
  if (report.evidence?.measurementKind !== 'physical-hardware') {
    throw new Error(`Performance campaign report is not physical: ${report.benchmark}.`);
  }
  if (report.evidence.declaredDeviceClass !== configuration.declaredDeviceClass) {
    throw new Error(`Performance campaign device class mismatch: ${report.benchmark}.`);
  }
  if (report.evidence.deviceLabel !== configuration.deviceLabel) {
    throw new Error(`Performance campaign device label mismatch: ${report.benchmark}.`);
  }
  if (!report.host || !report.browser || typeof report.browser.renderer !== 'string') {
    throw new Error(`Performance campaign hardware metadata is incomplete: ${report.benchmark}.`);
  }
  assertCampaignReportConfiguration(report, configuration);
}

function assertCampaignReportConfiguration(report, configuration) {
  const configuredQualities = report.configuration?.qualities;
  const qualityMatches = Array.isArray(configuredQualities)
    ? isDeepStrictEqual(configuredQualities, [configuration.quality])
    : report.configuration?.quality === configuration.quality;

  if (!qualityMatches) {
    throw new Error(`Performance campaign quality mismatch: ${report.benchmark}.`);
  }
  if (report.configuration?.cpuThrottleRate !== 1) {
    throw new Error(`Physical performance campaign CPU rate mismatch: ${report.benchmark}.`);
  }
  if (
    report.benchmark !== 'resource-stability' &&
    report.configuration?.runs !== configuration.runs
  ) {
    throw new Error(`Performance campaign run count mismatch: ${report.benchmark}.`);
  }
  if (
    report.benchmark === 'resource-stability' &&
    report.configuration?.cycles !== configuration.resourceCycles
  ) {
    throw new Error('Performance campaign resource cycle count mismatch.');
  }
  if (
    report.benchmark === 'scale-frame-stability' &&
    (report.configuration?.cpuThrottleRate !== 1 ||
      report.configuration?.mode !== 'cold' ||
      report.configuration?.labelsEnabled !== true)
  ) {
    throw new Error('Performance campaign scale-frame configuration is not physical and cold.');
  }
  if (
    report.benchmark === 'observable-planetarium' &&
    (report.configuration?.cpuThrottleRate !== 1 ||
      report.configuration?.requestedDeviceScaleFactor !== configuration.observerDeviceScaleFactor)
  ) {
    throw new Error('Performance campaign observer configuration mismatch.');
  }
}

function parseBaseUrl(rawValue) {
  let url;

  try {
    url = new URL(rawValue);
  } catch {
    throw new Error('Universe benchmark campaign base URL must be valid.');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Universe benchmark campaign base URL must use HTTP or HTTPS.');
  }

  return url.href;
}

function readRepetitionCount(rawValue, label) {
  const value = Number(rawValue);

  if (!Number.isInteger(value) || value < MINIMUM_REPETITIONS) {
    throw new Error(
      `Universe benchmark campaign ${label} must be an integer of at least ${MINIMUM_REPETITIONS}.`,
    );
  }

  return value;
}

function readPositiveNumber(rawValue, label) {
  const value = Number(rawValue);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Universe benchmark campaign ${label} must be a positive number.`);
  }

  return value;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runPerformanceCampaign().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
