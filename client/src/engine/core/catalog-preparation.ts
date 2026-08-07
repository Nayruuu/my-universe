// Share bounded CPU preparation between registries and rendering. Geometry builders allocate
// managed Three.js resources only on completion, when ownership passes to their caller.
export const CATALOG_PREPARATION_CHUNK_SIZE = 512;

export function* sortCatalogRecords<T>(
  records: T[],
  compare: (left: T, right: T) => number,
): Generator<void, T[]> {
  const count = records.length;

  if (count < CATALOG_PREPARATION_CHUNK_SIZE) {
    return records.sort(compare);
  }
  // Small native sorts followed by bounded stable merges keep a large catalogue sort from
  // becoming a single long task. Equal records keep the original catalogue order.
  for (let offset = 0; offset < count; offset += CATALOG_PREPARATION_CHUNK_SIZE) {
    const run = records.slice(offset, offset + CATALOG_PREPARATION_CHUNK_SIZE).sort(compare);

    for (let index = 0; index < run.length; index += 1) {
      records[offset + index] = run[index]!;
    }
    yield;
  }
  let source = records;
  let target = new Array<T>(count);

  for (let width = CATALOG_PREPARATION_CHUNK_SIZE; width < count; width *= 2) {
    for (let start = 0; start < count; start += width * 2) {
      const middle = Math.min(start + width, count);
      const end = Math.min(start + width * 2, count);
      let left = start;
      let right = middle;

      for (let index = start; index < end; index += 1) {
        if (left < middle && (right >= end || compare(source[left]!, source[right]!) <= 0)) {
          target[index] = source[left++]!;
        } else {
          target[index] = source[right++]!;
        }
        if ((index + 1) % CATALOG_PREPARATION_CHUNK_SIZE === 0) {
          yield;
        }
      }
    }
    [source, target] = [target, source];
  }

  return source;
}

export function finishCatalogPreparation<T>(steps: Generator<void, T>): T {
  let step = steps.next();

  while (!step.done) {
    step = steps.next();
  }

  return step.value;
}

export async function prepareCatalogIncrementally<T>(
  steps: Generator<void, T>,
  yieldControl: () => Promise<void>,
): Promise<T> {
  let step = steps.next();

  while (!step.done) {
    await yieldControl();
    step = steps.next();
  }

  return step.value;
}

export async function yieldCatalogPreparation(): Promise<void> {
  // Ordinary posted-message tasks let input, timers and animation frames run between batches.
  // Repeated boosted scheduler.yield continuations can starve these; nested timers add 4 ms/lot.
  if (typeof MessageChannel !== 'undefined') {
    await new Promise<void>((resolve) => {
      const channel = new MessageChannel();

      channel.port1.onmessage = () => {
        channel.port1.close();
        channel.port2.close();
        resolve();
      };
      channel.port2.postMessage(null);
    });
  } else {
    await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0));
  }
}
