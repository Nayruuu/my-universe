import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  parseNavigationDebugClipboard,
  writeNavigationDebugCapture,
} from './capture-navigation-debug.mjs';

test('parseNavigationDebugClipboard accepts only the current navigation trace schema', () => {
  const report = {
    schema: 'universe-map/navigation-wheel-trace@2',
    capturedAt: '2026-08-19T19:34:00.924Z',
    entries: [{ sequence: 1 }],
  };

  assert.deepEqual(parseNavigationDebugClipboard(JSON.stringify(report)), report);
  assert.equal(parseNavigationDebugClipboard('not json'), null);
  assert.equal(
    parseNavigationDebugClipboard(
      JSON.stringify({ ...report, schema: 'universe-map/navigation-wheel-trace@1' }),
    ),
    null,
  );
  assert.equal(
    parseNavigationDebugClipboard(JSON.stringify({ ...report, entries: 'not-an-array' })),
    null,
  );
});

test('writeNavigationDebugCapture writes a stable, readable latest trace file', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'universe-navigation-capture-'));

  context.after(async () => {
    const { rm } = await import('node:fs/promises');

    await rm(directory, { recursive: true, force: true });
  });
  const report = {
    schema: 'universe-map/navigation-wheel-trace@2',
    capturedAt: '2026-08-19T19:34:00.924Z',
    entries: [{ sequence: 1 }],
  };
  const filePath = await writeNavigationDebugCapture(report, directory);

  assert.equal(filePath, join(directory, 'navigation-wheel-trace.latest.json'));
  assert.deepEqual(JSON.parse(await readFile(filePath, 'utf8')), report);
});
