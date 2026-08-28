import { type StarColorIndexSystem } from '../../data/models/universe.models';

export type RgbColor = readonly [number, number, number];

interface ColorStop {
  readonly colorIndex: number;
  readonly color: RgbColor;
}

const JOHNSON_BV_COLOR_STOPS: readonly ColorStop[] = [
  { colorIndex: -0.4, color: [0.57, 0.69, 1] },
  { colorIndex: 0, color: [0.75, 0.84, 1] },
  { colorIndex: 0.4, color: [1, 0.95, 0.83] },
  { colorIndex: 0.8, color: [1, 0.76, 0.48] },
  { colorIndex: 1.5, color: [1, 0.43, 0.22] },
  { colorIndex: 2, color: [1, 0.3, 0.15] },
];

// BP−RP is retained as observed Gaia photometry. These display colors are an illustrative,
// monotonic palette rather than a claim to reconstruct a calibrated screen spectrum.
const GAIA_BP_RP_COLOR_STOPS: readonly ColorStop[] = [
  { colorIndex: -0.5, color: [0.52, 0.66, 1] },
  { colorIndex: 0, color: [0.68, 0.78, 1] },
  { colorIndex: 0.5, color: [0.93, 0.93, 1] },
  { colorIndex: 0.9, color: [1, 0.95, 0.79] },
  { colorIndex: 1.5, color: [1, 0.75, 0.43] },
  { colorIndex: 2.5, color: [1, 0.48, 0.23] },
  { colorIndex: 4, color: [1, 0.3, 0.16] },
];

export function colorIndexToRgb(colorIndex: number): RgbColor {
  return interpolateColorIndex(colorIndex, JOHNSON_BV_COLOR_STOPS);
}

export function stellarColorIndexToRgb(colorIndex: number, system: StarColorIndexSystem): RgbColor {
  return interpolateColorIndex(
    colorIndex,
    system === 'gaia-bp-rp' ? GAIA_BP_RP_COLOR_STOPS : JOHNSON_BV_COLOR_STOPS,
  );
}

function interpolateColorIndex(colorIndex: number, stops: readonly ColorStop[]): RgbColor {
  const boundedIndex = clamp(colorIndex, stops[0]!.colorIndex, stops.at(-1)!.colorIndex);

  for (let index = 1; index < stops.length - 1; index += 1) {
    const right = stops[index]!;

    if (boundedIndex <= right.colorIndex) {
      const left = stops[index - 1]!;
      const progress = (boundedIndex - left.colorIndex) / (right.colorIndex - left.colorIndex);

      return [
        lerp(left.color[0], right.color[0], progress),
        lerp(left.color[1], right.color[1], progress),
        lerp(left.color[2], right.color[2], progress),
      ];
    }
  }

  const left = stops.at(-2)!;
  const right = stops.at(-1)!;
  const progress = (boundedIndex - left.colorIndex) / (right.colorIndex - left.colorIndex);

  return [
    lerp(left.color[0], right.color[0], progress),
    lerp(left.color[1], right.color[1], progress),
    lerp(left.color[2], right.color[2], progress),
  ];
}

export function colorIndexToCssColor(colorIndex: number): string {
  const color = colorIndexToRgb(colorIndex);

  return `#${color.map(toHexChannel).join('')}`;
}

function toHexChannel(value: number): string {
  return Math.round(clamp(value, 0, 1) * 255)
    .toString(16)
    .padStart(2, '0');
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}
