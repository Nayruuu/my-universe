import { readFile } from 'node:fs/promises';

const statsPath = new URL('../dist/universe-map/stats.json', import.meta.url);
const budgetBytes = 9_500;
const stats = JSON.parse(await readFile(statsPath, 'utf8'));
const componentStyles = Object.entries(stats.outputs)
  .filter(([path]) => path.endsWith('.component.css') || path.includes('.component-'))
  .map(([path, output]) => ({ path: Object.keys(output.inputs)[0] ?? path, bytes: output.bytes }))
  .concat(
    Object.entries(stats.outputs)
      .filter(([path]) => /^app-[A-Z0-9]+\.css$/.test(path))
      .map(([path, output]) => ({
        path: Object.keys(output.inputs)[0] ?? path,
        bytes: output.bytes,
      })),
  )
  .sort((left, right) => right.bytes - left.bytes);
const oversized = componentStyles.filter(({ bytes }) => bytes > budgetBytes);

if (oversized.length > 0) {
  console.error(`Component style budget exceeded (${budgetBytes} bytes):`);
  for (const { path, bytes } of oversized) {
    console.error(`- ${path}: ${bytes} bytes`);
  }
  process.exitCode = 1;
} else {
  const largest = componentStyles[0];

  console.log(
    `Component style budget verified: ${componentStyles.length} files, largest ${largest?.path ?? 'none'} (${largest?.bytes ?? 0} bytes).`,
  );
}
