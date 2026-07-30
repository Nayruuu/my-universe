export type RgbColor = readonly [number, number, number];

interface ColorStop {
  readonly colorIndex: number;
  readonly color: RgbColor;
}

const COLOR_STOPS: readonly ColorStop[] = [
  { colorIndex: -0.4, color: [0.57, 0.69, 1] },
  { colorIndex: 0, color: [0.75, 0.84, 1] },
  { colorIndex: 0.4, color: [1, 0.95, 0.83] },
  { colorIndex: 0.8, color: [1, 0.76, 0.48] },
  { colorIndex: 1.5, color: [1, 0.43, 0.22] },
  { colorIndex: 2, color: [1, 0.3, 0.15] },
];

export function colorIndexToRgb(colorIndex: number): RgbColor {
  const boundedIndex = clamp(
    colorIndex,
    COLOR_STOPS[0]!.colorIndex,
    COLOR_STOPS.at(-1)!.colorIndex,
  );

  for (let index = 1; index < COLOR_STOPS.length - 1; index += 1) {
    const right = COLOR_STOPS[index]!;

    if (boundedIndex <= right.colorIndex) {
      const left = COLOR_STOPS[index - 1]!;
      const progress = (boundedIndex - left.colorIndex) / (right.colorIndex - left.colorIndex);

      return [
        lerp(left.color[0], right.color[0], progress),
        lerp(left.color[1], right.color[1], progress),
        lerp(left.color[2], right.color[2], progress),
      ];
    }
  }

  const left = COLOR_STOPS.at(-2)!;
  const right = COLOR_STOPS.at(-1)!;
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
