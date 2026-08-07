export const EARTH_LANDMARK_SILHOUETTE_FAMILIES = [
  'skyscraper',
  'tower',
  'bridge',
  'monument',
  'religious',
  'palace',
  'stadium',
  'historic-building',
  'mountain-natural',
  'generic-landmark',
  'cathedral',
  'mosque',
  'pagoda',
  'triumphal-arch',
  'obelisk',
  'statue',
  'suspension-bridge',
  'arch-bridge',
] as const;

export type EarthLandmarkSilhouetteFamily = (typeof EARTH_LANDMARK_SILHOUETTE_FAMILIES)[number];

export interface EarthLandmarkSilhouetteOptions {
  readonly aspectRatio?: number;
  readonly family: EarthLandmarkSilhouetteFamily;
  readonly height?: number;
  readonly id: string;
  readonly seed?: number;
}

export interface EarthLandmarkSilhouette {
  readonly fill: '#050a11';
  readonly fillRule: 'nonzero';
  readonly height: number;
  readonly opacity: 1;
  readonly path: string;
  readonly viewBox: string;
  readonly width: number;
}

interface SilhouetteCanvas {
  readonly height: number;
  readonly width: number;
}

type RandomSource = () => number;
type SilhouetteBuilder = (canvas: SilhouetteCanvas, random: RandomSource) => string;

const DEFAULT_SIZE = 200;
const MIN_HEIGHT = 64;
const MAX_HEIGHT = 512;
const MIN_ASPECT_RATIO = 0.25;
const MAX_ASPECT_RATIO = 3.5;

const BUILDERS: Readonly<Record<EarthLandmarkSilhouetteFamily, SilhouetteBuilder>> = {
  skyscraper: buildSkyscraper,
  tower: buildTower,
  bridge: buildBridge,
  monument: buildMonument,
  religious: buildReligiousBuilding,
  palace: buildPalace,
  stadium: buildStadium,
  'historic-building': buildHistoricBuilding,
  'mountain-natural': buildMountain,
  'generic-landmark': buildGenericLandmark,
  cathedral: buildCathedral,
  mosque: buildMosque,
  pagoda: buildPagoda,
  'triumphal-arch': buildTriumphalArch,
  obelisk: buildObelisk,
  statue: buildStatue,
  'suspension-bridge': buildSuspensionBridge,
  'arch-bridge': buildArchBridge,
};

export function createEarthLandmarkSilhouette(
  options: EarthLandmarkSilhouetteOptions,
): EarthLandmarkSilhouette {
  const height = boundedNumber(options.height, DEFAULT_SIZE, MIN_HEIGHT, MAX_HEIGHT);
  const aspectRatio = boundedNumber(options.aspectRatio, 1, MIN_ASPECT_RATIO, MAX_ASPECT_RATIO);
  const width = Math.round(height * aspectRatio);
  const seed = options.seed ?? hashString(options.id);
  const random = createRandomSource(hashString(`${options.id}:${seed}`));
  const canvas = { height, width };

  return {
    fill: '#050a11',
    fillRule: 'nonzero',
    height,
    opacity: 1,
    path: BUILDERS[options.family](canvas, random),
    viewBox: `0 0 ${width} ${height}`,
    width,
  };
}

function buildSkyscraper(canvas: SilhouetteCanvas, random: RandomSource): string {
  const crown = 8 + random() * 8;
  const shoulder = 22 + random() * 8;
  const inset = 8 + random() * 5;

  return [
    polygon(canvas, [
      [8, 100],
      [8, 52],
      [inset + 6, 52],
      [inset + 6, 34],
      [shoulder, 34],
      [shoulder, 20],
      [42, crown],
      [48, crown],
      [49, 0],
      [51, 0],
      [52, crown],
      [58, crown],
      [100 - shoulder, 20],
      [100 - shoulder, 34],
      [94 - inset, 34],
      [94 - inset, 52],
      [92, 52],
      [92, 100],
    ]),
    rectangle(canvas, 17, 61, 14, 39),
    rectangle(canvas, 69, 61, 14, 39),
  ].join('');
}

function buildTower(canvas: SilhouetteCanvas, random: RandomSource): string {
  const podHalfWidth = 15 + random() * 5;
  const waist = 6 + random() * 3;

  return [
    polygon(canvas, [
      [19, 100],
      [38, 43],
      [50 - waist, 43],
      [47, 21],
      [49, 10],
      [50, 0],
      [51, 10],
      [53, 21],
      [50 + waist, 43],
      [62, 43],
      [81, 100],
      [68, 100],
      [57, 55],
      [43, 55],
      [32, 100],
    ]),
    roundedPod(canvas, 50 - podHalfWidth, 31, podHalfWidth * 2, 13),
    rectangle(canvas, 28, 73, 44, 6),
  ].join('');
}

function buildBridge(canvas: SilhouetteCanvas, random: RandomSource): string {
  const towerInset = 16 + random() * 5;
  const cableDepth = 26 + random() * 7;

  return [
    rectangle(canvas, 0, 82, 100, 18),
    rectangle(canvas, towerInset, 34, 10, 48),
    rectangle(canvas, 90 - towerInset, 34, 10, 48),
    polygon(canvas, [
      [towerInset - 2, 34],
      [towerInset + 5, 23],
      [towerInset + 12, 34],
    ]),
    polygon(canvas, [
      [88 - towerInset, 34],
      [95 - towerInset, 23],
      [102 - towerInset, 34],
    ]),
    curvedBand(canvas, towerInset + 5, 37, 95 - towerInset, 37, 50, 37 + cableDepth, 4),
    curvedBand(canvas, 0, 61, towerInset + 5, 37, towerInset / 2, 43, 3),
    curvedBand(canvas, 95 - towerInset, 37, 100, 61, 100 - towerInset / 2, 43, 3),
  ].join('');
}

function buildMonument(canvas: SilhouetteCanvas, random: RandomSource): string {
  const columnWidth = 17 + random() * 6;
  const crownHeight = 14 + random() * 7;

  return [
    rectangle(canvas, 17, 88, 66, 12),
    rectangle(canvas, 25, 77, 50, 11),
    rectangle(canvas, 50 - columnWidth / 2, 30, columnWidth, 47),
    polygon(canvas, [
      [50 - columnWidth / 2 - 3, 30],
      [50, 30 - crownHeight],
      [50 + columnWidth / 2 + 3, 30],
    ]),
    rectangle(canvas, 47, 6, 6, 12),
    polygon(canvas, [
      [47, 7],
      [42, 11],
      [46, 14],
      [50, 11],
      [54, 14],
      [58, 11],
      [53, 7],
    ]),
  ].join('');
}

function buildReligiousBuilding(canvas: SilhouetteCanvas, random: RandomSource): string {
  const domeHeight = 20 + random() * 8;
  const minaretWidth = 7 + random() * 3;

  return [
    rectangle(canvas, 15, 58, 70, 42),
    dome(canvas, 28, 58, 72, 58, 50, 58 - domeHeight),
    rectangle(canvas, 9, 29, minaretWidth, 71),
    rectangle(canvas, 91 - minaretWidth, 29, minaretWidth, 71),
    polygon(canvas, [
      [9, 29],
      [9 + minaretWidth / 2, 11],
      [9 + minaretWidth, 29],
    ]),
    polygon(canvas, [
      [91 - minaretWidth, 29],
      [91 - minaretWidth / 2, 11],
      [91, 29],
    ]),
    rectangle(canvas, 45, 73, 10, 27),
  ].join('');
}

function buildPalace(canvas: SilhouetteCanvas, random: RandomSource): string {
  const wingHeight = 48 + random() * 7;
  const cupolaHeight = 13 + random() * 6;

  return [
    rectangle(canvas, 4, wingHeight, 92, 100 - wingHeight),
    rectangle(canvas, 30, 38, 40, 62),
    dome(canvas, 37, 38, 63, 38, 50, 38 - cupolaHeight),
    rectangle(canvas, 9, wingHeight - 13, 13, 13),
    rectangle(canvas, 78, wingHeight - 13, 13, 13),
    polygon(canvas, [
      [8, wingHeight - 13],
      [15.5, wingHeight - 23],
      [23, wingHeight - 13],
    ]),
    polygon(canvas, [
      [77, wingHeight - 13],
      [84.5, wingHeight - 23],
      [92, wingHeight - 13],
    ]),
    rectangle(canvas, 45, 75, 10, 25),
  ].join('');
}

function buildStadium(canvas: SilhouetteCanvas, random: RandomSource): string {
  const roofY = 38 + random() * 7;
  const openingWidth = 56 + random() * 8;

  return [
    stadiumBowl(canvas, 5, roofY, 95, 98),
    stadiumOpening(canvas, 50 - openingWidth / 2, roofY + 6, openingWidth, 22),
    rectangle(canvas, 11, 83, 78, 17),
    polygon(canvas, [
      [12, roofY + 4],
      [4, 25],
      [7, 24],
      [19, roofY + 6],
    ]),
    polygon(canvas, [
      [88, roofY + 4],
      [96, 25],
      [93, 24],
      [81, roofY + 6],
    ]),
  ].join('');
}

function buildHistoricBuilding(canvas: SilhouetteCanvas, random: RandomSource): string {
  const centralRoof = 25 + random() * 8;
  const towerHeight = 15 + random() * 7;

  return [
    rectangle(canvas, 8, 57, 84, 43),
    polygon(canvas, [
      [24, 57],
      [35, 38],
      [46, 57],
      [54, 57],
      [65, centralRoof],
      [78, 57],
    ]),
    rectangle(canvas, 7, towerHeight + 14, 15, 71 - towerHeight),
    polygon(canvas, [
      [5, towerHeight + 14],
      [14.5, towerHeight],
      [24, towerHeight + 14],
    ]),
    rectangle(canvas, 78, towerHeight + 20, 15, 65 - towerHeight),
    polygon(canvas, [
      [76, towerHeight + 20],
      [85.5, towerHeight + 6],
      [95, towerHeight + 20],
    ]),
    rectangle(canvas, 60, 75, 10, 25),
  ].join('');
}

function buildMountain(canvas: SilhouetteCanvas, random: RandomSource): string {
  const mainPeak = 8 + random() * 10;
  const leftPeak = 35 + random() * 9;
  const rightPeak = 29 + random() * 11;

  return polygon(canvas, [
    [0, 100],
    [0, 78],
    [10, 65],
    [18, leftPeak],
    [27, 59],
    [38, 46],
    [50, mainPeak],
    [59, 37],
    [67, 56],
    [78, rightPeak],
    [88, 62],
    [100, 72],
    [100, 100],
  ]);
}

function buildGenericLandmark(canvas: SilhouetteCanvas, random: RandomSource): string {
  const lean = 7 + random() * 9;
  const crown = 24 + random() * 8;

  return [
    rectangle(canvas, 18, 88, 64, 12),
    polygon(canvas, [
      [31, 88],
      [38 - lean / 2, 47],
      [31, 29],
      [43, 17],
      [50, crown],
      [61, 8],
      [69, 18],
      [60, 39],
      [66 + lean / 2, 88],
    ]),
    roundedPod(canvas, 33, 47, 34, 16),
  ].join('');
}

function buildCathedral(canvas: SilhouetteCanvas, random: RandomSource): string {
  const spireHeight = 5 + random() * 7;
  const naveRoof = 48 + random() * 7;

  return [
    rectangle(canvas, 13, 42, 20, 58),
    rectangle(canvas, 67, 42, 20, 58),
    polygon(canvas, [
      [11, 42],
      [23, spireHeight],
      [35, 42],
    ]),
    polygon(canvas, [
      [65, 42],
      [77, spireHeight + 2],
      [89, 42],
    ]),
    rectangle(canvas, 29, naveRoof, 42, 100 - naveRoof),
    polygon(canvas, [
      [27, naveRoof],
      [50, 31],
      [73, naveRoof],
    ]),
    rectangle(canvas, 45, 76, 10, 24),
  ].join('');
}

function buildMosque(canvas: SilhouetteCanvas, random: RandomSource): string {
  const domeHeight = 26 + random() * 7;
  const minaretWidth = 6 + random() * 2;

  return [
    rectangle(canvas, 17, 59, 66, 41),
    dome(canvas, 24, 59, 76, 59, 50, domeHeight),
    rectangle(canvas, 7, 31, minaretWidth, 69),
    rectangle(canvas, 93 - minaretWidth, 31, minaretWidth, 69),
    polygon(canvas, [
      [5, 31],
      [7 + minaretWidth / 2, 7],
      [9 + minaretWidth, 31],
    ]),
    polygon(canvas, [
      [91 - minaretWidth, 31],
      [93 - minaretWidth / 2, 7],
      [95, 31],
    ]),
    rectangle(canvas, 46, 76, 8, 24),
  ].join('');
}

function buildPagoda(canvas: SilhouetteCanvas, random: RandomSource): string {
  const flare = 4 + random() * 4;
  const tiers = [32, 48, 64, 80];

  return [
    rectangle(canvas, 43, 18, 14, 82),
    polygon(canvas, [
      [48, 18],
      [50, 0],
      [52, 18],
    ]),
    ...tiers.map((baseline, index) => {
      const halfWidth = 16 + index * 5;

      return polygon(canvas, [
        [50 - halfWidth - flare, baseline],
        [50 - halfWidth, baseline - 9],
        [50 + halfWidth, baseline - 9],
        [50 + halfWidth + flare, baseline],
        [50, baseline - 2],
      ]);
    }),
    rectangle(canvas, 30, 88, 40, 12),
  ].join('');
}

function buildTriumphalArch(canvas: SilhouetteCanvas, random: RandomSource): string {
  const crownHeight = 14 + random() * 5;

  return [
    rectangle(canvas, 9, 21 + crownHeight, 21, 65 - crownHeight),
    rectangle(canvas, 70, 21 + crownHeight, 21, 65 - crownHeight),
    rectangle(canvas, 7, 15 + crownHeight, 86, 18),
    rectangle(canvas, 3, 88, 94, 12),
    curvedBand(canvas, 30, 61, 70, 61, 50, 34, 13),
  ].join('');
}

function buildObelisk(canvas: SilhouetteCanvas, random: RandomSource): string {
  const halfWidth = 7 + random() * 3;

  return [
    polygon(canvas, [
      [50 - halfWidth, 82],
      [50 - halfWidth * 0.55, 17],
      [50, 0],
      [50 + halfWidth * 0.55, 17],
      [50 + halfWidth, 82],
    ]),
    rectangle(canvas, 33, 82, 34, 8),
    rectangle(canvas, 24, 90, 52, 10),
  ].join('');
}

function buildStatue(canvas: SilhouetteCanvas, random: RandomSource): string {
  const armReach = 16 + random() * 5;

  return [
    rectangle(canvas, 26, 84, 48, 16),
    polygon(canvas, [
      [36, 84],
      [41, 55],
      [38, 42],
      [47, 34],
      [44, 25],
      [50, 17],
      [56, 25],
      [53, 34],
      [61, 42],
      [59, 57],
      [65, 84],
    ]),
    polygon(canvas, [
      [43, 43],
      [50 - armReach, 29],
      [47 - armReach, 22],
      [53 - armReach, 18],
      [57 - armReach, 27],
      [51, 50],
    ]),
    polygon(canvas, [
      [45 - armReach, 20],
      [49 - armReach, 4],
      [52 - armReach, 19],
    ]),
  ].join('');
}

function buildSuspensionBridge(canvas: SilhouetteCanvas, random: RandomSource): string {
  const towerInset = 17 + random() * 4;

  return [
    rectangle(canvas, 0, 84, 100, 16),
    rectangle(canvas, towerInset, 27, 8, 57),
    rectangle(canvas, 92 - towerInset, 27, 8, 57),
    polygon(canvas, [
      [towerInset - 2, 27],
      [towerInset + 4, 15],
      [towerInset + 10, 27],
    ]),
    polygon(canvas, [
      [90 - towerInset, 27],
      [96 - towerInset, 15],
      [102 - towerInset, 27],
    ]),
    curvedBand(canvas, towerInset + 4, 30, 96 - towerInset, 30, 50, 71, 3),
    curvedBand(canvas, 0, 69, towerInset + 4, 30, towerInset / 2, 39, 2.5),
    curvedBand(canvas, 96 - towerInset, 30, 100, 69, 100 - towerInset / 2, 39, 2.5),
  ].join('');
}

function buildArchBridge(canvas: SilhouetteCanvas, random: RandomSource): string {
  const pierWidth = 7 + random() * 3;

  return [
    rectangle(canvas, 0, 49, 100, 12),
    rectangle(canvas, 0, 86, 100, 14),
    rectangle(canvas, 8, 56, pierWidth, 30),
    rectangle(canvas, 46, 56, pierWidth, 30),
    rectangle(canvas, 85, 56, pierWidth, 30),
    curvedBand(canvas, 12, 86, 50, 86, 31, 49, 8),
    curvedBand(canvas, 50, 86, 89, 86, 69.5, 49, 8),
  ].join('');
}

function polygon(canvas: SilhouetteCanvas, points: readonly (readonly [number, number])[]): string {
  const [first, ...remaining] = points;
  const commands = remaining.map(([x, y]) => `L${point(canvas, x, y)}`).join('');

  return `M${point(canvas, first![0], first![1])}${commands}Z`;
}

function rectangle(
  canvas: SilhouetteCanvas,
  x: number,
  y: number,
  width: number,
  height: number,
): string {
  return polygon(canvas, [
    [x, y],
    [x + width, y],
    [x + width, y + height],
    [x, y + height],
  ]);
}

function dome(
  canvas: SilhouetteCanvas,
  startX: number,
  baselineY: number,
  endX: number,
  endY: number,
  controlX: number,
  controlY: number,
): string {
  return `M${point(canvas, startX, baselineY)}Q${point(canvas, controlX, controlY)} ${point(canvas, endX, endY)}L${point(canvas, startX, baselineY)}Z`;
}

function roundedPod(
  canvas: SilhouetteCanvas,
  x: number,
  y: number,
  width: number,
  height: number,
): string {
  return `M${point(canvas, x, y + height / 2)}Q${point(canvas, x, y)} ${point(canvas, x + width / 2, y)}Q${point(canvas, x + width, y)} ${point(canvas, x + width, y + height / 2)}Q${point(canvas, x + width, y + height)} ${point(canvas, x + width / 2, y + height)}Q${point(canvas, x, y + height)} ${point(canvas, x, y + height / 2)}Z`;
}

function curvedBand(
  canvas: SilhouetteCanvas,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  controlX: number,
  controlY: number,
  thickness: number,
): string {
  return `M${point(canvas, startX, startY)}Q${point(canvas, controlX, controlY)} ${point(canvas, endX, endY)}L${point(canvas, endX, endY + thickness)}Q${point(canvas, controlX, controlY + thickness)} ${point(canvas, startX, startY + thickness)}Z`;
}

function stadiumBowl(
  canvas: SilhouetteCanvas,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): string {
  return `M${point(canvas, startX, startY)}Q${point(canvas, 50, startY - 17)} ${point(canvas, endX, startY)}L${point(canvas, endX - 8, endY)}H${coordinate(canvas.width, startX + 8)}Q${point(canvas, 50, endY + 3)} ${point(canvas, startX, startY)}Z`;
}

function stadiumOpening(
  canvas: SilhouetteCanvas,
  x: number,
  y: number,
  width: number,
  height: number,
): string {
  return `M${point(canvas, x, y)}Q${point(canvas, 50, y - 11)} ${point(canvas, x + width, y)}L${point(canvas, x + width - 5, y + height)}Q${point(canvas, 50, y + 5)} ${point(canvas, x + 5, y + height)}Z`;
}

function point(canvas: SilhouetteCanvas, x: number, y: number): string {
  return `${coordinate(canvas.width, x)} ${coordinate(canvas.height, y)}`;
}

function coordinate(size: number, percentage: number): string {
  return round((size * percentage) / 100).toString();
}

function boundedNumber(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const candidate = value ?? Number.NaN;
  const finite = Number.isFinite(candidate) ? candidate : fallback;

  return Math.round(Math.min(maximum, Math.max(minimum, finite)) * 100) / 100;
}

function hashString(value: string): number {
  let hash = 2_166_136_261;

  for (const character of value) {
    hash ^= character.codePointAt(0)!;
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}

function createRandomSource(seed: number): RandomSource {
  let state = seed ^ 0x9e3779b9;

  return () => {
    state += 0x6d2b79f5;
    let value = state;

    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
