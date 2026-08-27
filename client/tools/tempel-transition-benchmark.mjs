import { pathToFileURL } from 'node:url';
import {
  parseCpuThrottleRate,
  printBenchmarkEvidence,
  publishBenchmarkEvidence,
  readBrowserHardwareSnapshot,
} from './benchmark-evidence.mjs';

const SIXTY_FPS_FRAME_MS = 1_000 / 60;
const THIRTY_FPS_FRAME_MS = 1_000 / 30;
const DEFAULT_BASE_URL = 'http://127.0.0.1:4203';
const QUALITIES = ['low', 'medium', 'high'];

export function parseDebugTimingText(text, expectedCount) {
  const values = Array.from(text.matchAll(/-?\d+(?:[.,]\d+)?(?:e[+-]?\d+)?(?=\s*ms)/giu), (match) =>
    Number(match[0].replace(',', '.')),
  );

  if (values.length !== expectedCount || values.some((value) => !Number.isFinite(value))) {
    throw new Error(`Expected ${expectedCount} timing values, received: ${text.trim()}`);
  }

  return values;
}

export function classifyFrameDuration(durationMs) {
  if (durationMs <= SIXTY_FPS_FRAME_MS) {
    return '60-fps';
  }
  if (durationMs <= THIRTY_FPS_FRAME_MS) {
    return '30-fps';
  }

  return 'slow';
}

export function summarizeTempelBenchmarkSamples(samples) {
  if (samples.length === 0) {
    throw new Error('A Tempel benchmark summary requires at least one sample.');
  }
  const [{ profile, quality }] = samples;

  if (samples.some((sample) => sample.profile !== profile || sample.quality !== quality)) {
    throw new Error('Tempel benchmark samples must use the same profile and quality.');
  }
  const firstVisibleFrames = samples.map((sample) => sample.firstVisibleFrameMs);
  const medians = {
    geometryPreparationMs: median(samples.map((sample) => sample.geometryPreparationMs)),
    sceneInstallationMs: median(samples.map((sample) => sample.sceneInstallationMs)),
    firstVisibleFrameMs: median(firstVisibleFrames),
    activationToFirstVisibleMs: median(samples.map((sample) => sample.activationToFirstVisibleMs)),
    timeToFirstVisibleMs: median(samples.map((sample) => sample.timeToFirstVisibleMs)),
    preloadLeadMs: median(samples.map((sample) => sample.preloadLeadMs)),
    drawCalls: median(samples.map((sample) => sample.drawCalls)),
    geometries: median(samples.map((sample) => sample.geometries)),
  };

  return {
    profile,
    quality,
    runs: samples.length,
    preloadHits: samples.filter((sample) => sample.preloadHit).length,
    medians,
    worstFirstVisibleFrameMs: Math.max(...firstVisibleFrames),
    frameBudget: classifyFrameDuration(medians.firstVisibleFrameMs),
  };
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

async function runBenchmark() {
  const { chromium, devices } = await import('playwright');
  const baseUrl = process.env['UNIVERSE_BENCHMARK_BASE_URL'] ?? DEFAULT_BASE_URL;
  const runs = readPositiveInteger(process.env['UNIVERSE_BENCHMARK_RUNS'] ?? '3', 'runs');
  const profileFilter = readFilter(process.env['UNIVERSE_BENCHMARK_PROFILES'], [
    'desktop',
    'mobile',
  ]);
  const qualityFilter = readFilter(process.env['UNIVERSE_BENCHMARK_QUALITIES'], QUALITIES);
  const cpuThrottleRate = parseCpuThrottleRate(process.env['UNIVERSE_CPU_THROTTLE_RATE']);
  const profiles = {
    desktop: { viewport: { width: 1_440, height: 900 } },
    mobile: { ...devices['Pixel 7'] },
  };
  const browser = await launchChromium(chromium);
  const samples = [];

  try {
    for (const profile of profileFilter) {
      for (const quality of qualityFilter) {
        for (let run = 0; run < runs; run += 1) {
          const context = await browser.newContext(profiles[profile]);

          try {
            samples.push(
              await measureTransition(context, baseUrl, profile, quality, cpuThrottleRate),
            );
          } finally {
            await context.close();
          }
        }
      }
    }
  } finally {
    await browser.close();
  }
  const summaries = profileFilter.flatMap((profile) =>
    qualityFilter.map((quality) =>
      summarizeTempelBenchmarkSamples(
        samples.filter((sample) => sample.profile === profile && sample.quality === quality),
      ),
    ),
  );

  printSummaries(summaries);
  printBenchmarkEvidence(
    await publishBenchmarkEvidence({
      benchmark: 'tempel-transition',
      browser: samples[0].browser,
      configuration: {
        profiles: profileFilter,
        qualities: qualityFilter,
        runs,
        cpuThrottleRate,
      },
      cpuThrottleRate,
      samples,
      summary: summaries,
    }),
  );
  if (
    process.env['UNIVERSE_BENCHMARK_STRICT'] === '1' &&
    summaries.some((summary) => summary.frameBudget === 'slow')
  ) {
    throw new Error('At least one median Tempel first frame exceeded the 30 FPS budget.');
  }
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

async function measureTransition(context, baseUrl, profile, quality, cpuThrottleRate) {
  const page = await context.newPage();
  const devtools = await context.newCDPSession(page);
  const url = new URL('/en/', baseUrl);

  url.search = new URLSearchParams({
    target: 'nearby-universe',
    selected: '',
    zoom: '120000',
    debug: 'true',
    quality,
    density: 'balanced',
    orbits: '1',
    constellations: '1',
    labels: '1',
  }).toString();
  try {
    await devtools.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottleRate });
    await page.goto(url.href, { waitUntil: 'networkidle', timeout: 60_000 });
    await page.getByRole('button', { name: 'Change scale' }).click();
    await page.getByRole('button', { name: 'Show Cosmic web scale' }).click();
    await page.waitForFunction(
      () => {
        const value = document.querySelector(
          '[data-debug-stat="tempel-first-frame-total"]',
        )?.textContent;

        return Boolean(value && !value.includes('—') && /\d/u.test(value));
      },
      null,
      { timeout: 60_000 },
    );
    const [geometryPreparationMs, sceneInstallationMs] = await readTimings(
      page,
      'tempel-geometry-install',
      2,
    );
    const [firstVisibleFrameMs, activationToFirstVisibleMs, timeToFirstVisibleMs] =
      await readTimings(page, 'tempel-first-frame-total', 3);
    const preloadText = await readStat(page, 'tempel-preload');
    const [preloadLeadMs] = parseDebugTimingText(preloadText, 1);

    return {
      profile,
      quality,
      cpuThrottleRate,
      browser: await readBrowserHardwareSnapshot(page),
      geometryPreparationMs,
      sceneInstallationMs,
      firstVisibleFrameMs,
      activationToFirstVisibleMs,
      timeToFirstVisibleMs,
      preloadHit: preloadText.includes('hit'),
      preloadLeadMs,
      drawCalls: await readIntegerStat(page, 'draw-calls'),
      geometries: await readIntegerStat(page, 'geometries'),
    };
  } finally {
    await devtools.detach();
  }
}

async function readTimings(page, stat, expectedCount) {
  return parseDebugTimingText(await readStat(page, stat), expectedCount);
}

async function readIntegerStat(page, stat) {
  const text = await readStat(page, stat);
  const value = Number(text.trim());

  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Expected a non-negative integer for ${stat}, received: ${text.trim()}`);
  }

  return value;
}

async function readStat(page, stat) {
  const text = await page.locator(`[data-debug-stat="${stat}"]`).textContent();

  if (text === null) {
    throw new Error(`Debug statistic ${stat} is unavailable.`);
  }

  return text;
}

function readPositiveInteger(rawValue, label) {
  const value = Number(rawValue);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Universe benchmark ${label} must be a positive integer.`);
  }

  return value;
}

function readFilter(rawValue, allowedValues) {
  const values = rawValue ? rawValue.split(',').map((value) => value.trim()) : [...allowedValues];

  if (
    values.length === 0 ||
    values.some((value) => value.length === 0 || !allowedValues.includes(value))
  ) {
    throw new Error(`Expected a comma-separated subset of: ${allowedValues.join(', ')}.`);
  }

  return values;
}

function printSummaries(summaries) {
  const rows = summaries.map((summary) => ({
    profile: summary.profile,
    quality: summary.quality,
    runs: summary.runs,
    preload: `${summary.preloadHits}/${summary.runs}`,
    prepareMs: summary.medians.geometryPreparationMs.toFixed(2),
    installMs: summary.medians.sceneInstallationMs.toFixed(2),
    firstFrameMs: summary.medians.firstVisibleFrameMs.toFixed(2),
    worstFrameMs: summary.worstFirstVisibleFrameMs.toFixed(2),
    activationMs: summary.medians.activationToFirstVisibleMs.toFixed(2),
    totalMs: summary.medians.timeToFirstVisibleMs.toFixed(2),
    drawCalls: summary.medians.drawCalls,
    geometries: summary.medians.geometries,
    budget: summary.frameBudget,
  }));

  console.table(rows);
  console.log(JSON.stringify(summaries, null, 2));
}

const entryPoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;

if (entryPoint === import.meta.url) {
  runBenchmark().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
