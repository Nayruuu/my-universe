import { pathToFileURL } from 'node:url';
import {
  printBenchmarkEvidence,
  publishBenchmarkEvidence,
  readBrowserHardwareSnapshot,
} from './benchmark-evidence.mjs';
import {
  installFrameCollector,
  parseAdaptiveRenderingStats,
  parseCpuThrottleRate,
  summarizeFramePhases,
  summarizeFrameStability,
} from './frame-stability-benchmark.mjs';

const DEFAULT_BASE_URL = 'http://127.0.0.1:4203';
const DEFAULT_RUNS = 3;
const DEFAULT_DEVICE_SCALE_FACTOR = 2;
const PROFILE = 'desktop-retina';
const VIEWPORT = Object.freeze({ width: 1_440, height: 900 });
const PLANET_ZOOM_IMPULSES = 18;

export function parseObserverDeviceScaleFactor(rawValue) {
  if (rawValue === undefined) {
    return DEFAULT_DEVICE_SCALE_FACTOR;
  }
  const value = Number(rawValue);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('Universe observer benchmark DPR must be a positive finite number.');
  }

  return value;
}

export function summarizeObserverBenchmarkSamples(samples) {
  if (samples.length === 0) {
    throw new Error('An observer benchmark summary requires at least one sample.');
  }
  const [{ profile, quality, requestedDeviceScaleFactor, cpuThrottleRate }] = samples;

  if (
    samples.some(
      (sample) =>
        sample.profile !== profile ||
        sample.quality !== quality ||
        sample.requestedDeviceScaleFactor !== requestedDeviceScaleFactor ||
        sample.cpuThrottleRate !== cpuThrottleRate,
    )
  ) {
    throw new Error(
      'Observer benchmark samples must use the same profile, quality, DPR, and CPU throttle.',
    );
  }
  const medianMetrics = {
    p95Ms: median(samples.map((sample) => sample.p95Ms)),
    p99Ms: median(samples.map((sample) => sample.p99Ms)),
    maximumMs: median(samples.map((sample) => sample.maximumMs)),
    longFrameRatio: median(samples.map((sample) => sample.longFrameRatio)),
    finalCanvasPixelRatio: median(samples.map((sample) => sample.finalCanvasPixelRatio)),
  };

  return {
    profile,
    quality,
    requestedDeviceScaleFactor,
    cpuThrottleRate,
    runs: samples.length,
    medianMetrics,
    worstMaximumMs: Math.max(...samples.map((sample) => sample.maximumMs)),
    worstLongFrameRatio: Math.max(...samples.map((sample) => sample.longFrameRatio)),
    resolvedRuns: samples.filter((sample) => sample.planetResolved).length,
    allStable: samples.every((sample) => sample.stable),
    allPlanetsResolved: samples.every((sample) => sample.planetResolved),
  };
}

async function runBenchmark() {
  const { chromium } = await import('playwright');
  const baseUrl = process.env['UNIVERSE_BENCHMARK_BASE_URL'] ?? DEFAULT_BASE_URL;
  const runs = readPositiveInteger(
    process.env['UNIVERSE_BENCHMARK_RUNS'] ?? String(DEFAULT_RUNS),
    'runs',
  );
  const quality = process.env['UNIVERSE_BENCHMARK_QUALITY'] ?? 'high';
  const requestedDeviceScaleFactor = parseObserverDeviceScaleFactor(
    process.env['UNIVERSE_OBSERVER_DPR'],
  );
  const cpuThrottleRate = parseCpuThrottleRate(process.env['UNIVERSE_CPU_THROTTLE_RATE']);

  if (!['low', 'medium', 'high'].includes(quality)) {
    throw new Error('Universe observer benchmark quality must be low, medium, or high.');
  }
  const browser = await launchChromium(chromium);
  const samples = [];

  try {
    for (let run = 1; run <= runs; run += 1) {
      const context = await browser.newContext({
        viewport: VIEWPORT,
        deviceScaleFactor: requestedDeviceScaleFactor,
      });

      try {
        console.log(`Observable Retina run ${run}/${runs} · CPU ${cpuThrottleRate}×`);
        samples.push(
          await measureObserverJourney(
            context,
            baseUrl,
            quality,
            requestedDeviceScaleFactor,
            cpuThrottleRate,
            run,
          ),
        );
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  const summary = summarizeObserverBenchmarkSamples(samples);
  const evidence = await publishBenchmarkEvidence({
    benchmark: 'observable-planetarium',
    browser: samples[0].graphics,
    configuration: {
      profile: PROFILE,
      quality,
      runs,
      viewport: VIEWPORT,
      requestedDeviceScaleFactor,
      cpuThrottleRate,
    },
    cpuThrottleRate,
    samples,
    summary,
  });

  printSamples(samples, summary);
  printBenchmarkEvidence(evidence);
  if (
    process.env['UNIVERSE_BENCHMARK_STRICT'] === '1' &&
    (!summary.allStable || !summary.allPlanetsResolved)
  ) {
    throw new Error(
      'The observable Retina journey exceeded its budget or failed to resolve Jupiter.',
    );
  }
}

async function measureObserverJourney(
  context,
  baseUrl,
  quality,
  requestedDeviceScaleFactor,
  cpuThrottleRate,
  run,
) {
  const page = await context.newPage();
  const devtools = await context.newCDPSession(page);
  const url = new URL('/en/', baseUrl);

  url.search = new URLSearchParams({
    target: 'betelgeuse',
    selected: '',
    debug: 'true',
    e2e: '1',
    quality,
    density: 'balanced',
    orbits: '1',
    constellations: '1',
    labels: '1',
    time: '2026-01-15T22:00:00.000Z',
    mode: 'observable',
    view: 'planetarium',
    observer: 'paris',
  }).toString();
  await page.addInitScript(installFrameCollector);
  await devtools.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottleRate });
  await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const canvas = page.locator('canvas.universe-canvas');
  const sky = page.locator('#earth-sky-view[data-phase="open"]');
  const jupiter = sky.locator('[data-body-id="jupiter"]');

  await canvas.waitFor({ state: 'visible', timeout: 60_000 });
  await sky.waitFor({ state: 'visible', timeout: 60_000 });
  await jupiter.waitFor({ state: 'visible', timeout: 30_000 });
  await waitForCameraSettled(page);
  await page.waitForTimeout(500);
  const initialCanvasPixelRatio = await readCanvasPixelRatio(canvas);
  const graphics = await readBrowserHardwareSnapshot(page);

  await page.evaluate(() => window.__UNIVERSE_FRAME_BENCHMARK__?.reset('wide-pan'));
  await dragAcrossSky(page, canvas);
  await setFramePhase(page, 'recenter');
  await sky.locator('.earth-sky-view__recenter').click();
  await waitForCameraSettled(page);
  await page.waitForTimeout(700);
  await jupiter.waitFor({ state: 'visible', timeout: 10_000 });
  const initialPlanetDiameterPixels = Number(
    await jupiter.getAttribute('data-apparent-diameter-pixels'),
  );
  const planetCenter = await locatorCenter(jupiter);

  await setFramePhase(page, 'planet-zoom-in');
  await page.mouse.move(planetCenter.x, planetCenter.y);
  for (let impulse = 0; impulse < PLANET_ZOOM_IMPULSES; impulse += 1) {
    await page.mouse.wheel(0, -1_200);
    await page.waitForTimeout(190);
  }
  const planetResolved = (await jupiter.getAttribute('data-resolved')) === 'true';
  const resolvedPlanetDiameterPixels = Number(
    await jupiter.getAttribute('data-apparent-diameter-pixels'),
  );

  await setFramePhase(page, 'resolved-settle');
  await page.waitForTimeout(750);
  await setFramePhase(page, 'planet-zoom-out');
  await page.mouse.move(planetCenter.x, planetCenter.y);
  for (let impulse = 0; impulse < PLANET_ZOOM_IMPULSES; impulse += 1) {
    await page.mouse.wheel(0, 1_200);
    await page.waitForTimeout(120);
  }
  await setFramePhase(page, 'final-settle');
  await page.waitForTimeout(750);
  const rawSamples = await page.evaluate(() => window.__UNIVERSE_FRAME_BENCHMARK__?.read() ?? []);
  await waitForAdaptiveRenderingSettled(page);
  const rawAdaptiveRendering = await page.evaluate(
    () => window.__UNIVERSE_MAP_OBSERVABILITY__?.getAdaptiveRenderingStats() ?? null,
  );
  const finalCanvasPixelRatio = await readCanvasPixelRatio(canvas);
  const durations = rawSamples.map((sample) => sample.durationMs);

  await devtools.detach();

  return {
    profile: PROFILE,
    quality,
    run,
    requestedDeviceScaleFactor,
    cpuThrottleRate,
    initialCanvasPixelRatio,
    finalCanvasPixelRatio,
    graphics,
    planetResolved,
    initialPlanetDiameterPixels,
    resolvedPlanetDiameterPixels,
    ...summarizeFrameStability(durations),
    phases: summarizeFramePhases(rawSamples),
    adaptiveRendering: parseAdaptiveRenderingStats(rawAdaptiveRendering),
  };
}

async function dragAcrossSky(page, canvas) {
  const bounds = await canvas.boundingBox();

  if (bounds === null) {
    throw new Error('The observable benchmark canvas has no visible bounds.');
  }
  const start = {
    x: bounds.x + bounds.width * 0.42,
    y: bounds.y + bounds.height * 0.32,
  };
  const end = {
    x: bounds.x + bounds.width * 0.66,
    y: bounds.y + bounds.height * 0.42,
  };

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (let step = 1; step <= 24; step += 1) {
    const progress = step / 24;

    await page.mouse.move(
      start.x + (end.x - start.x) * progress,
      start.y + (end.y - start.y) * progress,
    );
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(350);
}

async function setFramePhase(page, phase) {
  await page.evaluate(
    (nextPhase) => window.__UNIVERSE_FRAME_BENCHMARK__?.setPhase(nextPhase),
    phase,
  );
}

async function locatorCenter(locator) {
  const bounds = await locator.boundingBox();

  if (bounds === null) {
    throw new Error('Jupiter is not visible in the observable benchmark.');
  }

  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}

async function readCanvasPixelRatio(canvas) {
  return canvas.evaluate((element) => {
    const bounds = element.getBoundingClientRect();

    return bounds.width > 0 ? element.width / bounds.width : 0;
  });
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

function readPositiveInteger(rawValue, label) {
  const value = Number(rawValue);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Universe benchmark ${label} must be a positive integer.`);
  }

  return value;
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function printSamples(samples, summary) {
  console.table(
    samples.map((sample) => ({
      profile: sample.profile,
      quality: sample.quality,
      run: sample.run,
      requestedDpr: sample.requestedDeviceScaleFactor.toFixed(2),
      cpu: `${sample.cpuThrottleRate}×`,
      canvasDpr: `${sample.initialCanvasPixelRatio.toFixed(3)} → ${sample.finalCanvasPixelRatio.toFixed(3)}`,
      frames: sample.frames,
      p95Ms: sample.p95Ms.toFixed(2),
      p99Ms: sample.p99Ms.toFixed(2),
      maxMs: sample.maximumMs.toFixed(2),
      longFrames: `${sample.longFrames} (${(sample.longFrameRatio * 100).toFixed(2)}%)`,
      jupiter: sample.planetResolved ? 'resolved' : 'point',
      adaptive: sample.adaptiveRendering.status,
      result: sample.stable && sample.planetResolved ? 'pass' : 'fail',
    })),
  );
  console.table(
    samples.flatMap((sample) =>
      sample.phases.map((phase) => ({
        run: sample.run,
        phase: phase.phase,
        frames: phase.frames,
        p95Ms: phase.p95Ms.toFixed(2),
        maxMs: phase.maximumMs.toFixed(2),
        longFrames: phase.longFrames,
      })),
    ),
  );
  console.table([
    {
      profile: summary.profile,
      quality: summary.quality,
      runs: summary.runs,
      requestedDpr: summary.requestedDeviceScaleFactor.toFixed(2),
      cpu: `${summary.cpuThrottleRate}×`,
      medianCanvasDpr: summary.medianMetrics.finalCanvasPixelRatio.toFixed(3),
      medianP95Ms: summary.medianMetrics.p95Ms.toFixed(2),
      medianP99Ms: summary.medianMetrics.p99Ms.toFixed(2),
      medianMaxMs: summary.medianMetrics.maximumMs.toFixed(2),
      worstMaxMs: summary.worstMaximumMs.toFixed(2),
      resolved: `${summary.resolvedRuns}/${summary.runs}`,
      result: summary.allStable && summary.allPlanetsResolved ? 'pass' : 'fail',
    },
  ]);
  console.log(`WebGL: ${samples[0].graphics.vendor} · ${samples[0].graphics.renderer}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await runBenchmark();
}
