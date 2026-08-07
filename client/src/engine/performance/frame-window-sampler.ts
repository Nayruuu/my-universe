export interface FrameWindowSummary {
  readonly p95FrameMs: number;
  readonly longFrameRatio: number;
}

export class FrameWindowSampler {
  private readonly samples: Float32Array;
  private readonly sortedSamples: Float32Array;
  private count = 0;

  constructor(public readonly capacity: number) {
    this.samples = new Float32Array(capacity);
    this.sortedSamples = new Float32Array(capacity);
  }

  public reset(): void {
    this.count = 0;
  }

  public add(frameMilliseconds: number, longFrameThresholdMs: number): FrameWindowSummary | null {
    this.samples[this.count] = frameMilliseconds;
    this.count += 1;
    if (this.count < this.capacity) {
      return null;
    }
    const summary = summarizeSamples(this.samples, this.sortedSamples, longFrameThresholdMs);

    this.count = 0;

    return summary;
  }
}

function summarizeSamples(
  samples: Float32Array,
  sortedSamples: Float32Array,
  longFrameThresholdMs: number,
): FrameWindowSummary {
  sortedSamples.set(samples);
  sortedSamples.sort();
  const percentileIndex = Math.ceil(sortedSamples.length * 0.95) - 1;
  let longFrames = 0;

  for (const duration of sortedSamples) {
    if (duration >= longFrameThresholdMs) {
      longFrames += 1;
    }
  }

  return {
    p95FrameMs: sortedSamples[percentileIndex]!,
    longFrameRatio: longFrames / sortedSamples.length,
  };
}
