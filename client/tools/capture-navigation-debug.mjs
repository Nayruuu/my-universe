import { execFile } from 'node:child_process';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

const NAVIGATION_TRACE_SCHEMA = 'universe-map/navigation-wheel-trace@2';
const DEFAULT_POLL_INTERVAL_MS = 500;
const MAXIMUM_CLIPBOARD_BYTES = 32 * 1024 * 1024;
const DEFAULT_OUTPUT_DIRECTORY = fileURLToPath(
  new URL('../tmp/navigation-debug/', import.meta.url),
);
const execFileAsync = promisify(execFile);

export function parseNavigationDebugClipboard(text) {
  try {
    const value = JSON.parse(text);

    if (
      typeof value !== 'object' ||
      value === null ||
      value.schema !== NAVIGATION_TRACE_SCHEMA ||
      typeof value.capturedAt !== 'string' ||
      !Array.isArray(value.entries)
    ) {
      return null;
    }

    return value;
  } catch {
    return null;
  }
}

export async function writeNavigationDebugCapture(report, outputDirectory) {
  await mkdir(outputDirectory, { recursive: true });
  const filePath = join(outputDirectory, 'navigation-wheel-trace.latest.json');
  const temporaryPath = `${filePath}.${process.pid}.tmp`;

  await writeFile(temporaryPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, filePath);

  return filePath;
}

async function readClipboard() {
  if (process.platform !== 'darwin') {
    throw new Error('Navigation clipboard capture currently requires macOS and pbpaste.');
  }
  const { stdout } = await execFileAsync('pbpaste', [], {
    encoding: 'utf8',
    maxBuffer: MAXIMUM_CLIPBOARD_BYTES,
  });

  return stdout;
}

async function monitorClipboard() {
  const outputDirectory = process.env['UNIVERSE_NAVIGATION_CAPTURE_DIR']
    ? fileURLToPath(pathToFileURL(process.env['UNIVERSE_NAVIGATION_CAPTURE_DIR']))
    : DEFAULT_OUTPUT_DIRECTORY;
  let lastClipboard = '';
  let running = true;

  const stop = () => {
    running = false;
  };

  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  console.log(
    `Navigation trace capture is watching the clipboard. Use “Copy trace” in the debug panel.`,
  );
  console.log(`Latest capture: ${join(outputDirectory, 'navigation-wheel-trace.latest.json')}`);

  while (running) {
    const clipboard = await readClipboard();

    if (clipboard !== lastClipboard) {
      lastClipboard = clipboard;
      const report = parseNavigationDebugClipboard(clipboard);

      if (report) {
        const filePath = await writeNavigationDebugCapture(report, outputDirectory);

        console.log(
          `Captured ${report.entries.length} navigation events at ${report.capturedAt}: ${filePath}`,
        );
      }
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, DEFAULT_POLL_INTERVAL_MS));
  }
}

const executedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (executedDirectly) {
  monitorClipboard().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
