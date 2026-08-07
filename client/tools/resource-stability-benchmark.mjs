import { pathToFileURL } from 'node:url';
import {
  parseCpuThrottleRate,
  printBenchmarkEvidence,
  publishBenchmarkEvidence,
  readBrowserHardwareSnapshot,
} from './benchmark-evidence.mjs';

const DEFAULT_BASE_URL = 'http://127.0.0.1:4203';
const DEFAULT_CYCLES = 3;
const WARMUP_ROUND_TRIPS = 3;
const PROFILES = ['desktop', 'mobile'];
const QUALITIES = ['low', 'medium', 'high'];

export const DEFAULT_RESOURCE_STABILITY_BUDGETS = Object.freeze({
  geometries: 1,
  textures: 1,
  drawCalls: 2,
  usedJsHeapBytes: 8 * 1024 * 1024,
});

export function parseRendererResourceSnapshot(snapshot) {
  return {
    cycle: readNonNegativeInteger(snapshot.cycle, 'cycle'),
    geometries: readNonNegativeInteger(snapshot.geometries, 'geometries'),
    textures: readNonNegativeInteger(snapshot.textures, 'textures'),
    drawCalls: readNonNegativeInteger(snapshot.drawCalls, 'draw calls'),
    usedJsHeapBytes:
      snapshot.usedJsHeapBytes === null
        ? null
        : readNonNegativeNumber(snapshot.usedJsHeapBytes, 'used JS heap'),
  };
}

export function summarizeResourceStability(samples, budgets = DEFAULT_RESOURCE_STABILITY_BUDGETS) {
  if (samples.length === 0) {
    throw new Error('A resource stability summary requires a warmed baseline.');
  }
  const baseline = samples[0];

  if (baseline.cycle !== 0) {
    throw new Error('The resource stability baseline must be cycle zero.');
  }
  const final = samples.at(-1);
  const heapValues = samples
    .map((sample) => sample.usedJsHeapBytes)
    .filter((value) => value !== null);
  const heapDrift =
    baseline.usedJsHeapBytes === null || final.usedJsHeapBytes === null
      ? null
      : final.usedJsHeapBytes - baseline.usedJsHeapBytes;
  const drift = {
    geometries: final.geometries - baseline.geometries,
    textures: final.textures - baseline.textures,
    drawCalls: final.drawCalls - baseline.drawCalls,
    usedJsHeapBytes: heapDrift,
  };

  return {
    cycles: samples.length - 1,
    baseline,
    final,
    peak: {
      geometries: Math.max(...samples.map((sample) => sample.geometries)),
      textures: Math.max(...samples.map((sample) => sample.textures)),
      drawCalls: Math.max(...samples.map((sample) => sample.drawCalls)),
      usedJsHeapBytes: heapValues.length > 0 ? Math.max(...heapValues) : null,
    },
    drift,
    stable:
      drift.geometries <= budgets.geometries &&
      drift.textures <= budgets.textures &&
      drift.drawCalls <= budgets.drawCalls &&
      (heapDrift === null || heapDrift <= budgets.usedJsHeapBytes),
  };
}

export function hasStableRendererPlateau(samples) {
  if (samples.length < 3) {
    return false;
  }
  const recent = samples.slice(-3);
  const reference = recent[0];

  return recent.every(
    (sample) =>
      sample.geometries === reference.geometries && sample.textures === reference.textures,
  );
}

export function createResourceTimelineRows(samples) {
  const baselineHeap = samples[0]?.usedJsHeapBytes ?? null;

  return samples.map((sample) => ({
    cycle: sample.cycle,
    geometries: sample.geometries,
    textures: sample.textures,
    drawCalls: sample.drawCalls,
    heapMiB:
      sample.usedJsHeapBytes === null ? 'n/a' : (sample.usedJsHeapBytes / 1024 / 1024).toFixed(2),
    heapDriftMiB:
      sample.usedJsHeapBytes === null || baselineHeap === null
        ? 'n/a'
        : ((sample.usedJsHeapBytes - baselineHeap) / 1024 / 1024).toFixed(2),
  }));
}

async function runBenchmark() {
  const { chromium, devices } = await import('playwright');
  const baseUrl = process.env['UNIVERSE_BENCHMARK_BASE_URL'] ?? DEFAULT_BASE_URL;
  const cycles = readPositiveInteger(
    process.env['UNIVERSE_RESOURCE_CYCLES'] ?? String(DEFAULT_CYCLES),
    'cycles',
  );
  const profileFilter = readFilter(process.env['UNIVERSE_BENCHMARK_PROFILES'], PROFILES, [
    'desktop',
  ]);
  const qualityFilter = readFilter(process.env['UNIVERSE_BENCHMARK_QUALITIES'], QUALITIES, [
    'high',
  ]);
  const cpuThrottleRate = parseCpuThrottleRate(process.env['UNIVERSE_CPU_THROTTLE_RATE']);
  const profiles = {
    desktop: { viewport: { width: 1_440, height: 900 } },
    mobile: { ...devices['Pixel 7'] },
  };
  const browser = await launchChromium(chromium);
  const summaries = [];

  try {
    for (const profile of profileFilter) {
      for (const quality of qualityFilter) {
        const context = await browser.newContext(profiles[profile]);

        try {
          summaries.push(
            await measureResourceStability(
              context,
              baseUrl,
              profile,
              quality,
              cycles,
              cpuThrottleRate,
            ),
          );
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }

  printSummaries(summaries);
  printBenchmarkEvidence(
    await publishBenchmarkEvidence({
      benchmark: 'resource-stability',
      browser: summaries[0].browser,
      configuration: {
        profiles: profileFilter,
        qualities: qualityFilter,
        cycles,
        cpuThrottleRate,
        warmupRoundTrips: WARMUP_ROUND_TRIPS,
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
    throw new Error('At least one warmed scale round trip exceeded the resource drift budget.');
  }
}

async function measureResourceStability(
  context,
  baseUrl,
  profile,
  quality,
  cycles,
  cpuThrottleRate,
) {
  const page = await context.newPage();
  const devtools = await context.newCDPSession(page);
  const url = new URL('/en/', baseUrl);

  url.search = new URLSearchParams({
    target: 'earth',
    selected: 'earth',
    debug: 'true',
    e2e: '1',
    quality,
    density: 'balanced',
    orbits: '1',
    constellations: '1',
    labels: '1',
  }).toString();
  await devtools.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottleRate });
  await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.locator('canvas.universe-canvas').waitFor({ state: 'visible', timeout: 60_000 });
  const browser = await readBrowserHardwareSnapshot(page);

  await waitForPopulatedStat(page, 'startup-milestones');

  for (let warmup = 0; warmup < WARMUP_ROUND_TRIPS; warmup += 1) {
    console.log(`Resource warmup ${warmup + 1}/${WARMUP_ROUND_TRIPS}`);
    await completeScaleRoundTrip(page, warmup === 0);
  }
  const samples = [await readRendererResources(page, 0, devtools)];

  for (let cycle = 1; cycle <= cycles; cycle += 1) {
    console.log(`Resource cycle ${cycle}/${cycles}`);
    await completeScaleRoundTrip(page, false);
    samples.push(await readRendererResources(page, cycle, devtools));
  }

  await devtools.detach();

  return {
    profile,
    quality,
    cpuThrottleRate,
    browser,
    samples,
    ...summarizeResourceStability(samples),
  };
}

async function completeScaleRoundTrip(page, waitForDeferredFilaments) {
  await visitScale(page, 'Milky Way', 'milky-way');
  await visitScale(page, 'Nearby Universe', 'nearby-universe');
  await visitScale(page, 'Cosmic web', 'cosmic-web');
  if (waitForDeferredFilaments) {
    await waitForPopulatedStat(page, 'tempel-first-frame-total');
  }
  await visitScale(page, 'Planetary', 'earth');
  await waitForRendererPlateau(page);
}

async function visitScale(page, label, targetId) {
  await activateButton(page.getByRole('button', { name: 'Change scale' }));
  await activateButton(page.getByRole('button', { name: `Show ${label} scale` }));
  await page.waitForFunction(
    (expectedTarget) => new URL(window.location.href).searchParams.get('target') === expectedTarget,
    targetId,
    { timeout: 60_000 },
  );
  await page.waitForFunction(
    () => window.__UNIVERSE_MAP_OBSERVABILITY__?.isCameraTransitioning() === false,
    undefined,
    { timeout: 60_000 },
  );
}

async function activateButton(locator) {
  await locator.waitFor({ state: 'visible', timeout: 30_000 });
  await locator.evaluate((button) => button.click());
}

async function waitForRendererPlateau(page) {
  const samples = [];

  for (let attempt = 0; attempt < 12; attempt += 1) {
    await page.waitForTimeout(1_100);
    samples.push(await readRendererResources(page, 0));
    if (hasStableRendererPlateau(samples)) {
      return;
    }
  }

  throw new Error('Renderer geometry and texture counters did not reach a stable plateau.');
}

async function readRendererResources(page, cycle, devtools) {
  if (devtools) {
    await devtools.send('HeapProfiler.collectGarbage');
    await page.waitForTimeout(100);
  }
  const panel = page.getByRole('complementary', { name: 'Debug statistics' });
  const [geometries, textures, drawCalls, usedJsHeapBytes] = await Promise.all([
    readStat(panel, 'geometries'),
    readStat(panel, 'textures'),
    readStat(panel, 'draw-calls'),
    page.evaluate(() => {
      const memory = performance.memory;

      return memory && Number.isFinite(memory.usedJSHeapSize) ? memory.usedJSHeapSize : null;
    }),
  ]);

  return parseRendererResourceSnapshot({
    cycle,
    geometries,
    textures,
    drawCalls,
    usedJsHeapBytes,
  });
}

async function waitForPopulatedStat(page, stat) {
  await page.waitForFunction(
    (requestedStat) => {
      const value = document.querySelector(`[data-debug-stat="${requestedStat}"]`)?.textContent;

      return Boolean(value && !value.includes('—'));
    },
    stat,
    { timeout: 60_000 },
  );
}

async function readStat(panel, stat) {
  const text = await panel.locator(`[data-debug-stat="${stat}"]`).textContent();

  if (text === null) {
    throw new Error(`Debug statistic ${stat} is unavailable.`);
  }

  return text.trim();
}

async function launchChromium(chromium) {
  const explicitChannel = process.env['UNIVERSE_BENCHMARK_BROWSER_CHANNEL'];
  const preferredChannel =
    explicitChannel ?? (process.platform === 'darwin' ? 'chrome' : undefined);

  try {
    return await chromium.launch({
      headless: true,
      ...(preferredChannel ? { channel: preferredChannel } : {}),
      args: ['--enable-precise-memory-info'],
    });
  } catch (error) {
    if (!preferredChannel || explicitChannel) {
      throw error;
    }

    return chromium.launch({ headless: true, args: ['--enable-precise-memory-info'] });
  }
}

function readPositiveInteger(rawValue, label) {
  const value = Number(rawValue);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Universe benchmark ${label} must be a positive integer.`);
  }

  return value;
}

function readNonNegativeInteger(rawValue, label) {
  const value = Number(rawValue);

  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Universe benchmark ${label} must be a non-negative integer.`);
  }

  return value;
}

function readNonNegativeNumber(rawValue, label) {
  const value = Number(rawValue);

  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Universe benchmark ${label} must be a non-negative number.`);
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
      cycles: summary.cycles,
      geometries: `${summary.baseline.geometries} → ${summary.final.geometries}`,
      textures: `${summary.baseline.textures} → ${summary.final.textures}`,
      drawCalls: `${summary.baseline.drawCalls} → ${summary.final.drawCalls}`,
      heapMiB:
        summary.drift.usedJsHeapBytes === null
          ? 'n/a'
          : `${(summary.drift.usedJsHeapBytes / 1024 / 1024).toFixed(2)} Δ`,
      result: summary.stable ? 'pass' : 'fail',
    })),
  );
  for (const summary of summaries) {
    console.log(`Resource timeline: ${summary.profile}/${summary.quality}`);
    console.table(createResourceTimelineRows(summary.samples));
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await runBenchmark();
}
