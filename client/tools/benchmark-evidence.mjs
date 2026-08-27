import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { arch, cpus, platform, release, totalmem } from 'node:os';
import { dirname, resolve } from 'node:path';

const DEVICE_CLASSES = new Set(['high', 'medium', 'low']);
const SOFTWARE_RENDERER_PATTERN = /(?:swiftshader|llvmpipe|software rasterizer|basic render)/iu;

export function parseDeclaredDeviceClass(rawValue) {
  if (rawValue === undefined || rawValue.trim().length === 0) {
    return 'unclassified';
  }
  const value = rawValue.trim().toLowerCase();

  if (!DEVICE_CLASSES.has(value)) {
    throw new Error('Universe benchmark device class must be high, medium, or low.');
  }

  return value;
}

export function parseDeviceLabel(rawValue) {
  if (rawValue === undefined) {
    return null;
  }
  const value = rawValue.trim();

  if (value.length === 0 || value.length > 120) {
    throw new Error('Universe benchmark device label must contain between 1 and 120 characters.');
  }

  return value;
}

export function parsePhysicalEvidenceRequirement(rawValue) {
  if (rawValue === undefined || rawValue === '0') {
    return false;
  }
  if (rawValue === '1') {
    return true;
  }

  throw new Error('Universe benchmark physical-evidence requirement must be zero or one.');
}

export function parseCpuThrottleRate(rawValue) {
  if (rawValue === undefined) {
    return 1;
  }
  const rate = Number(rawValue);

  if (!Number.isFinite(rate)) {
    throw new Error('Universe benchmark CPU throttle rate must be a finite number.');
  }
  if (rate < 1) {
    throw new Error('Universe benchmark CPU throttle rate must be at least one.');
  }

  return rate;
}

export function classifyBenchmarkEvidence(cpuThrottleRate, renderer) {
  if (!Number.isFinite(cpuThrottleRate) || cpuThrottleRate < 1) {
    throw new Error('Benchmark evidence requires a CPU throttle rate of at least one.');
  }
  if (typeof renderer !== 'string' || renderer.trim().length === 0) {
    throw new Error('Benchmark evidence requires a non-empty WebGL renderer.');
  }
  if (cpuThrottleRate !== 1) {
    return 'simulated-cpu';
  }
  if (renderer.trim().toLowerCase() === 'unavailable') {
    return 'unverified-renderer';
  }
  if (SOFTWARE_RENDERER_PATTERN.test(renderer)) {
    return 'software-rendered';
  }

  return 'physical-hardware';
}

export function createHostSnapshot(values = {}) {
  const cpuEntries = values.cpuEntries ?? cpus();
  const totalMemoryBytes = values.totalMemoryBytes ?? totalmem();

  if (!Array.isArray(cpuEntries) || cpuEntries.length === 0) {
    throw new Error('Benchmark host metadata requires at least one logical CPU.');
  }
  if (!Number.isFinite(totalMemoryBytes) || totalMemoryBytes <= 0) {
    throw new Error('Benchmark host metadata requires positive physical memory.');
  }
  const cpuModels = [
    ...new Set(
      cpuEntries
        .map((entry) => String(entry.model ?? '').trim())
        .filter((model) => model.length > 0),
    ),
  ];

  return {
    platform: values.platform ?? platform(),
    release: values.release ?? release(),
    architecture: values.architecture ?? arch(),
    logicalCpuCount: cpuEntries.length,
    cpuModels: cpuModels.length > 0 ? cpuModels : ['unavailable'],
    totalMemoryBytes,
    nodeVersion: values.nodeVersion ?? process.version,
  };
}

export function readSourceRevision(repositoryDirectory = process.cwd()) {
  try {
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repositoryDirectory,
      encoding: 'utf8',
    }).trim();
    const status = execFileSync('git', ['status', '--short'], {
      cwd: repositoryDirectory,
      encoding: 'utf8',
    }).trim();

    return { commit, dirty: status.length > 0 };
  } catch {
    return { commit: null, dirty: null };
  }
}

export async function readBrowserHardwareSnapshot(page) {
  return page.locator('canvas.universe-canvas').evaluate((element) => {
    const context = element.getContext('webgl2') ?? element.getContext('webgl');
    const extension = context?.getExtension('WEBGL_debug_renderer_info');

    return {
      vendor:
        context && extension
          ? String(context.getParameter(extension.UNMASKED_VENDOR_WEBGL))
          : 'unavailable',
      renderer:
        context && extension
          ? String(context.getParameter(extension.UNMASKED_RENDERER_WEBGL))
          : 'unavailable',
      userAgent: navigator.userAgent,
      hardwareConcurrency: navigator.hardwareConcurrency,
      reportedDeviceMemoryGiB:
        Number.isFinite(navigator.deviceMemory) && navigator.deviceMemory > 0
          ? navigator.deviceMemory
          : null,
    };
  });
}

export function createBenchmarkEvidenceReport({
  benchmark,
  browser,
  configuration,
  cpuThrottleRate,
  declaredDeviceClass,
  deviceLabel,
  host,
  samples,
  source,
  summary,
  capturedAt = new Date().toISOString(),
}) {
  if (typeof benchmark !== 'string' || benchmark.length === 0) {
    throw new Error('Benchmark evidence requires a benchmark name.');
  }
  const measurementKind = classifyBenchmarkEvidence(cpuThrottleRate, browser.renderer);

  return {
    schema: 'universe-map/performance-evidence@1',
    capturedAt,
    benchmark,
    evidence: {
      measurementKind,
      declaredDeviceClass,
      deviceLabel,
    },
    source,
    host,
    browser,
    configuration,
    summary,
    samples,
  };
}

export function assertPhysicalBenchmarkEvidence(report) {
  if (report.evidence.measurementKind !== 'physical-hardware') {
    throw new Error(
      `Physical benchmark evidence required, received ${report.evidence.measurementKind}.`,
    );
  }
  if (report.evidence.declaredDeviceClass === 'unclassified') {
    throw new Error('Physical benchmark evidence requires a declared device class.');
  }
}

export async function writeBenchmarkEvidenceReport(outputPath, report) {
  if (typeof outputPath !== 'string' || outputPath.trim().length === 0) {
    throw new Error('Benchmark evidence output path must be non-empty.');
  }
  const absolutePath = resolve(outputPath);

  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  return absolutePath;
}

export async function publishBenchmarkEvidence({
  benchmark,
  browser,
  configuration,
  cpuThrottleRate,
  samples,
  summary,
  capturedAt,
  environment = process.env,
  host,
  repositoryDirectory = process.cwd(),
  source,
}) {
  const report = createBenchmarkEvidenceReport({
    benchmark,
    browser,
    configuration,
    cpuThrottleRate,
    declaredDeviceClass: parseDeclaredDeviceClass(environment['UNIVERSE_BENCHMARK_DEVICE_CLASS']),
    deviceLabel: parseDeviceLabel(environment['UNIVERSE_BENCHMARK_DEVICE_LABEL']),
    host: host ?? createHostSnapshot(),
    samples,
    source: source ?? readSourceRevision(repositoryDirectory),
    summary,
    ...(capturedAt === undefined ? {} : { capturedAt }),
  });
  if (parsePhysicalEvidenceRequirement(environment['UNIVERSE_BENCHMARK_REQUIRE_PHYSICAL'])) {
    assertPhysicalBenchmarkEvidence(report);
  }
  const configuredOutputPath = environment['UNIVERSE_BENCHMARK_REPORT_PATH'];
  const outputPath =
    configuredOutputPath === undefined
      ? null
      : await writeBenchmarkEvidenceReport(configuredOutputPath, report);

  return { report, outputPath };
}

export function printBenchmarkEvidence({ report, outputPath }, writeLine = console.log) {
  writeLine(
    `Evidence: ${report.evidence.measurementKind} · class ${report.evidence.declaredDeviceClass}`,
  );
  if (outputPath !== null) {
    writeLine(`Evidence report: ${outputPath}`);
  }
}
