import { pathToFileURL } from 'node:url';
import {
  parseCpuThrottleRate,
  printBenchmarkEvidence,
  publishBenchmarkEvidence,
  readBrowserHardwareSnapshot,
} from './benchmark-evidence.mjs';

export { parseCpuThrottleRate } from './benchmark-evidence.mjs';

const DEFAULT_BASE_URL = 'http://127.0.0.1:4203';
const DEFAULT_RUNS = 3;
const PROFILES = ['desktop', 'mobile'];
const QUALITIES = ['low', 'medium', 'high'];
const LONG_FRAME_THRESHOLD_MS = 1000 / 30;

export const DEFAULT_FRAME_STABILITY_BUDGETS = Object.freeze({
  p95Ms: LONG_FRAME_THRESHOLD_MS,
  p99Ms: 50,
  maximumMs: 100,
  longFrameRatio: 0.05,
});

export function parseFrameDurations(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error('A frame stability sample requires at least one frame.');
  }

  return values.map((rawValue) => {
    const value = Number(rawValue);

    if (!Number.isFinite(value) || value <= 0) {
      throw new Error('Frame durations must be positive finite numbers.');
    }

    return value;
  });
}

export function summarizeFrameStability(rawDurations, budgets = DEFAULT_FRAME_STABILITY_BUDGETS) {
  const durations = parseFrameDurations(rawDurations);
  const sorted = durations.toSorted((left, right) => left - right);
  const longFrames = durations.filter((duration) => duration > LONG_FRAME_THRESHOLD_MS).length;
  const summary = {
    frames: durations.length,
    meanMs: durations.reduce((total, duration) => total + duration, 0) / durations.length,
    p50Ms: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    p99Ms: percentile(sorted, 0.99),
    maximumMs: sorted.at(-1),
    longFrames,
    longFrameRatio: longFrames / durations.length,
  };

  return {
    ...summary,
    stable:
      summary.p95Ms <= budgets.p95Ms &&
      summary.p99Ms <= budgets.p99Ms &&
      summary.maximumMs <= budgets.maximumMs &&
      summary.longFrameRatio <= budgets.longFrameRatio,
  };
}

export function summarizeFramePhases(samples) {
  const grouped = new Map();

  for (const sample of samples) {
    if (typeof sample.phase !== 'string' || sample.phase.length === 0) {
      throw new Error('Frame samples require a non-empty phase.');
    }
    const durations = grouped.get(sample.phase) ?? [];

    durations.push(sample.durationMs);
    grouped.set(sample.phase, durations);
  }

  return [...grouped].map(([phase, durations]) => ({
    phase,
    ...summarizeFrameStability(durations),
  }));
}

export function parseAdaptiveRenderingStats(value) {
  const statuses = ['warming', 'stable', 'degraded', 'recovering', 'paused'];

  if (!value || typeof value !== 'object' || !statuses.includes(value.status)) {
    throw new Error('Adaptive rendering diagnostics require a valid status.');
  }
  const p95FrameMs = nullableNonNegativeNumber(value.p95FrameMs, 'p95 frame duration');
  const longFrameRatio = nullableRatio(value.longFrameRatio);
  const targetPixelRatio = positiveNumber(value.targetPixelRatio, 'target pixel ratio');
  const currentPixelRatio = positiveNumber(value.currentPixelRatio, 'current pixel ratio');

  return {
    status: value.status,
    p95FrameMs,
    longFrameRatio,
    targetPixelRatio,
    currentPixelRatio,
  };
}

export function parseBenchmarkToggle(rawValue, label) {
  if (rawValue === undefined || rawValue === '1') {
    return true;
  }
  if (rawValue === '0') {
    return false;
  }

  throw new Error(`Universe benchmark ${label} must be zero or one.`);
}

async function runBenchmark() {
  const { chromium, devices } = await import('playwright');
  const baseUrl = process.env['UNIVERSE_BENCHMARK_BASE_URL'] ?? DEFAULT_BASE_URL;
  const runs = readPositiveInteger(
    process.env['UNIVERSE_BENCHMARK_RUNS'] ?? String(DEFAULT_RUNS),
    'runs',
  );
  const profileFilter = readFilter(process.env['UNIVERSE_BENCHMARK_PROFILES'], PROFILES, [
    'desktop',
  ]);
  const qualityFilter = readFilter(process.env['UNIVERSE_BENCHMARK_QUALITIES'], QUALITIES, [
    'high',
  ]);
  const cold = process.env['UNIVERSE_FRAME_COLD'] === '1';
  const cpuThrottleRate = parseCpuThrottleRate(process.env['UNIVERSE_CPU_THROTTLE_RATE']);
  const labelsEnabled = parseBenchmarkToggle(process.env['UNIVERSE_FRAME_LABELS'], 'labels');
  const profiles = {
    desktop: { viewport: { width: 1_440, height: 900 } },
    mobile: { ...devices['Pixel 7'] },
  };
  const browser = await launchChromium(chromium);
  const summaries = [];

  try {
    for (const profile of profileFilter) {
      for (const quality of qualityFilter) {
        for (let run = 1; run <= runs; run += 1) {
          const context = await browser.newContext(profiles[profile]);

          try {
            summaries.push({
              profile,
              quality,
              run,
              mode: cold ? 'cold' : 'warm',
              ...(await measureJourney(
                context,
                baseUrl,
                quality,
                !cold,
                cpuThrottleRate,
                labelsEnabled,
              )),
              cpuThrottleRate,
              labelsEnabled,
            });
          } finally {
            await context.close();
          }
        }
      }
    }
  } finally {
    await browser.close();
  }

  printSummaries(summaries);
  printBenchmarkEvidence(
    await publishBenchmarkEvidence({
      benchmark: 'scale-frame-stability',
      browser: summaries[0].browser,
      configuration: {
        profiles: profileFilter,
        qualities: qualityFilter,
        runs,
        mode: cold ? 'cold' : 'warm',
        cpuThrottleRate,
        labelsEnabled,
      },
      cpuThrottleRate,
      samples: summaries,
      summary: summaries,
    }),
  );
  if (
    process.env['UNIVERSE_BENCHMARK_STRICT'] === '1' &&
    summaries.some((summary) => !summary.stable)
  ) {
    throw new Error('At least one scale journey exceeded the frame stability budget.');
  }
}

async function measureJourney(context, baseUrl, quality, warmUp, cpuThrottleRate, labelsEnabled) {
  const page = await context.newPage();
  const devtools = await context.newCDPSession(page);
  const url = new URL('/en/', baseUrl);

  url.search = new URLSearchParams({
    target: 'earth',
    selected: 'earth',
    e2e: '1',
    quality,
    density: 'balanced',
    orbits: '1',
    constellations: '1',
    labels: labelsEnabled ? '1' : '0',
  }).toString();
  await page.addInitScript(installFrameCollector);
  await devtools.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottleRate });
  await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const canvas = page.locator('canvas.universe-canvas');

  await canvas.waitFor({ state: 'visible', timeout: 60_000 });
  const browser = await readBrowserHardwareSnapshot(page);

  await waitForJourneyControls(page);
  await waitForCameraSettled(page);
  if (warmUp) {
    await completeScaleJourney(page, false);
    await page.waitForTimeout(1_000);
  }
  await page.evaluate(() => window.__UNIVERSE_FRAME_BENCHMARK__?.reset('earth-to-milky-way'));
  await completeScaleJourney(page, true);

  const samples = await page.evaluate(() => window.__UNIVERSE_FRAME_BENCHMARK__?.read() ?? []);
  await waitForAdaptiveRenderingSettled(page);
  const rawAdaptiveRendering = await page.evaluate(
    () => window.__UNIVERSE_MAP_OBSERVABILITY__?.getAdaptiveRenderingStats() ?? null,
  );
  const durations = samples.map((sample) => sample.durationMs);
  const adaptiveRendering = parseAdaptiveRenderingStats(rawAdaptiveRendering);

  return {
    browser,
    ...summarizeFrameStability(durations),
    phases: summarizeFramePhases(samples),
    adaptiveRendering,
  };
}

async function waitForJourneyControls(page) {
  await page.getByRole('button', { name: 'Change scale' }).waitFor({
    state: 'visible',
    timeout: 60_000,
  });
}

async function completeScaleJourney(page, measured) {
  await visitScale(page, 'Milky Way', 'milky-way');
  await setFramePhase(page, measured, 'milky-way-to-nearby');
  await visitScale(page, 'Nearby Universe', 'nearby-universe');
  await setFramePhase(page, measured, 'nearby-to-cosmic-web');
  await visitScale(page, 'Cosmic web', 'cosmic-web');
  await page.waitForTimeout(measured ? 250 : 1_000);
  await setFramePhase(page, measured, 'cosmic-web-to-earth');
  await visitScale(page, 'Planetary', 'earth');
  await setFramePhase(page, measured, 'earth-settle');
  await page.waitForTimeout(1_000);
}

async function setFramePhase(page, measured, phase) {
  if (measured) {
    await page.evaluate(
      (nextPhase) => window.__UNIVERSE_FRAME_BENCHMARK__?.setPhase(nextPhase),
      phase,
    );
  }
}

export function installFrameCollector() {
  const samples = [];
  let previousTimestamp = null;
  let active = false;
  let phase = 'idle';
  const collect = (timestamp) => {
    if (active && previousTimestamp !== null) {
      samples.push({ phase, durationMs: timestamp - previousTimestamp });
    }
    previousTimestamp = timestamp;
    requestAnimationFrame(collect);
  };

  window.__UNIVERSE_FRAME_BENCHMARK__ = {
    reset: (nextPhase) => {
      samples.length = 0;
      previousTimestamp = null;
      phase = nextPhase;
      active = true;
    },
    setPhase: (nextPhase) => {
      phase = nextPhase;
    },
    read: () => samples.slice(),
  };
  requestAnimationFrame(collect);
}

async function visitScale(page, label, targetId) {
  await page.getByRole('button', { name: 'Change scale' }).click();
  await page.getByRole('button', { name: `Show ${label} scale` }).click();
  await page.waitForFunction(
    (expectedTarget) => new URL(window.location.href).searchParams.get('target') === expectedTarget,
    targetId,
    { timeout: 60_000 },
  );
  await waitForCameraSettled(page);
}

async function waitForCameraSettled(page) {
  await page.waitForFunction(
    () => window.__UNIVERSE_MAP_OBSERVABILITY__?.isCameraTransitioning() === false,
    undefined,
    { timeout: 60_000 },
  );
}

async function waitForAdaptiveRenderingSettled(page) {
  await page.waitForFunction(
    () => {
      const stats = window.__UNIVERSE_MAP_OBSERVABILITY__?.getAdaptiveRenderingStats();

      return (
        stats?.p95FrameMs !== null && stats?.status !== 'warming' && stats?.status !== 'paused'
      );
    },
    undefined,
    { timeout: 15_000 },
  );
}

async function launchChromium(chromium) {
  const explicitChannel = process.env['UNIVERSE_BENCHMARK_BROWSER_CHANNEL'];
  const preferredChannel =
    explicitChannel ?? (process.platform === 'darwin' ? 'chrome' : undefined);

  try {
    return await chromium.launch({
      headless: true,
      ...(preferredChannel ? { channel: preferredChannel } : {}),
    });
  } catch (error) {
    if (!preferredChannel || explicitChannel) {
      throw error;
    }

    return chromium.launch({ headless: true });
  }
}

function percentile(sorted, ratio) {
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

function nullableNonNegativeNumber(value, label) {
  if (value === null) {
    return null;
  }
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`Adaptive rendering ${label} must be null or a non-negative number.`);
  }

  return number;
}

function nullableRatio(value) {
  const ratio = nullableNonNegativeNumber(value, 'long-frame ratio');

  if (ratio !== null && ratio > 1) {
    throw new Error('Adaptive rendering long-frame ratio cannot exceed one.');
  }

  return ratio;
}

function positiveNumber(value, label) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`Adaptive rendering ${label} must be a positive number.`);
  }

  return number;
}

function readPositiveInteger(rawValue, label) {
  const value = Number(rawValue);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Universe benchmark ${label} must be a positive integer.`);
  }

  return value;
}

function readFilter(rawValue, allowedValues, defaultValues) {
  const values = rawValue ? rawValue.split(',').map((value) => value.trim()) : [...defaultValues];

  if (
    values.length === 0 ||
    values.some((value) => value.length === 0 || !allowedValues.includes(value))
  ) {
    throw new Error(`Expected a comma-separated subset of: ${allowedValues.join(', ')}.`);
  }

  return values;
}

function printSummaries(summaries) {
  console.table(
    summaries.map((summary) => ({
      profile: summary.profile,
      quality: summary.quality,
      mode: summary.mode,
      cpu: `${summary.cpuThrottleRate}×`,
      labels: summary.labelsEnabled ? 'on' : 'off',
      run: summary.run,
      frames: summary.frames,
      meanMs: summary.meanMs.toFixed(2),
      p95Ms: summary.p95Ms.toFixed(2),
      p99Ms: summary.p99Ms.toFixed(2),
      maxMs: summary.maximumMs.toFixed(2),
      longFrames: `${summary.longFrames} (${(summary.longFrameRatio * 100).toFixed(2)}%)`,
      adaptive: summary.adaptiveRendering.status,
      pixelRatio: `${summary.adaptiveRendering.currentPixelRatio.toFixed(3)} / ${summary.adaptiveRendering.targetPixelRatio.toFixed(3)}`,
      result: summary.stable ? 'pass' : 'fail',
    })),
  );
  console.table(
    summaries.flatMap((summary) =>
      summary.phases.map((phase) => ({
        profile: summary.profile,
        quality: summary.quality,
        mode: summary.mode,
        run: summary.run,
        phase: phase.phase,
        frames: phase.frames,
        p95Ms: phase.p95Ms.toFixed(2),
        maxMs: phase.maximumMs.toFixed(2),
        longFrames: phase.longFrames,
      })),
    ),
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await runBenchmark();
}
