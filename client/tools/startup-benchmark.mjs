import { pathToFileURL } from 'node:url';
import {
  parseCpuThrottleRate,
  printBenchmarkEvidence,
  publishBenchmarkEvidence,
  readBrowserHardwareSnapshot,
} from './benchmark-evidence.mjs';

const DEFAULT_BASE_URL = 'http://127.0.0.1:4203';
const DEFAULT_FIRST_USABLE_MAP_BUDGET_MS = 7_000;
const QUALITIES = ['low', 'medium', 'high'];

export function parseStartupMilestones(text) {
  const values = Array.from(text.matchAll(/\d+(?:[.,]\d+)?(?:e[+-]?\d+)?(?=\s*ms)/giu), (match) =>
    Number(match[0].replace(',', '.')),
  );

  if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) {
    throw new Error(`Expected four startup milestones, received: ${text.trim()}`);
  }

  return {
    engineModuleMs: values[0],
    dataReadyMs: values[1],
    sceneReadyMs: values[2],
    firstUsableMapMs: values[3],
  };
}

export function summarizeStartupSamples(samples, budgetMs = DEFAULT_FIRST_USABLE_MAP_BUDGET_MS) {
  if (samples.length === 0) {
    throw new Error('A startup benchmark summary requires at least one sample.');
  }
  const [{ profile, quality }] = samples;

  if (samples.some((sample) => sample.profile !== profile || sample.quality !== quality)) {
    throw new Error('Startup benchmark samples must use the same profile and quality.');
  }
  const medians = {
    engineModuleMs: median(samples.map((sample) => sample.engineModuleMs)),
    dataReadyMs: median(samples.map((sample) => sample.dataReadyMs)),
    sceneReadyMs: median(samples.map((sample) => sample.sceneReadyMs)),
    firstUsableMapMs: median(samples.map((sample) => sample.firstUsableMapMs)),
  };

  return {
    profile,
    quality,
    runs: samples.length,
    medians,
    worstFirstUsableMapMs: Math.max(...samples.map((sample) => sample.firstUsableMapMs)),
    withinBudget: medians.firstUsableMapMs <= budgetMs,
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
  const budgetMs = readPositiveNumber(
    process.env['UNIVERSE_STARTUP_BUDGET_MS'] ?? String(DEFAULT_FIRST_USABLE_MAP_BUDGET_MS),
    'budget',
  );
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
            samples.push(await measureStartup(context, baseUrl, profile, quality, cpuThrottleRate));
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
      summarizeStartupSamples(
        samples.filter((sample) => sample.profile === profile && sample.quality === quality),
        budgetMs,
      ),
    ),
  );

  console.table(
    summaries.map((summary) => ({
      profile: summary.profile,
      quality: summary.quality,
      runs: summary.runs,
      engineMs: summary.medians.engineModuleMs.toFixed(2),
      dataMs: summary.medians.dataReadyMs.toFixed(2),
      sceneMs: summary.medians.sceneReadyMs.toFixed(2),
      usableMs: summary.medians.firstUsableMapMs.toFixed(2),
      worstMs: summary.worstFirstUsableMapMs.toFixed(2),
      budget: summary.withinBudget ? 'pass' : 'fail',
    })),
  );
  printBenchmarkEvidence(
    await publishBenchmarkEvidence({
      benchmark: 'startup',
      browser: samples[0].browser,
      configuration: {
        profiles: profileFilter,
        qualities: qualityFilter,
        runs,
        cpuThrottleRate,
        firstUsableMapBudgetMs: budgetMs,
      },
      cpuThrottleRate,
      samples,
      summary: summaries,
    }),
  );
  if (
    process.env['UNIVERSE_BENCHMARK_STRICT'] === '1' &&
    summaries.some((summary) => !summary.withinBudget)
  ) {
    throw new Error(`At least one median startup exceeded the ${budgetMs} ms budget.`);
  }
}

async function measureStartup(context, baseUrl, profile, quality, cpuThrottleRate) {
  const page = await context.newPage();
  const devtools = await context.newCDPSession(page);
  const url = new URL('/en/', baseUrl);

  url.search = new URLSearchParams({
    target: 'earth',
    selected: 'earth',
    debug: 'true',
    quality,
    density: 'balanced',
    orbits: '1',
    constellations: '1',
    labels: '1',
  }).toString();
  try {
    await devtools.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottleRate });
    await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(
      () => {
        const value = document.querySelector('[data-debug-stat="startup-milestones"]')?.textContent;

        return Boolean(value && !value.includes('—'));
      },
      null,
      { timeout: 60_000 },
    );
    const text = await page.locator('[data-debug-stat="startup-milestones"]').textContent();

    if (text === null) {
      throw new Error('Startup milestones are unavailable.');
    }

    return {
      profile,
      quality,
      cpuThrottleRate,
      browser: await readBrowserHardwareSnapshot(page),
      ...parseStartupMilestones(text),
    };
  } finally {
    await devtools.detach();
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

function readPositiveInteger(rawValue, label) {
  const value = Number(rawValue);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Universe benchmark ${label} must be a positive integer.`);
  }

  return value;
}

function readPositiveNumber(rawValue, label) {
  const value = Number(rawValue);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Universe benchmark ${label} must be a positive number.`);
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

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await runBenchmark();
}
