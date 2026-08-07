import type { EarthHorizonCityscapeKind } from './earth-horizon-cityscapes';
import {
  createEarthUrbanLightPools,
  type EarthCityLightDensity,
  type EarthUrbanLightPool,
} from './earth-city-lighting';
import { PARIS_PANORAMA_HEIGHT, PARIS_PANORAMA_WIDTH } from './earth-paris-landmarks';

export type EarthRegionalCityscapeKind = Exclude<EarthHorizonCityscapeKind, 'paris' | 'procedural'>;

type EarthRegionalArchitecture =
  'skyscraper' | 'metropolitan' | 'historic' | 'harbor' | 'desert' | 'coastal' | 'mountain';

type EarthRegionalTerrain = 'none' | 'hills' | 'harbor' | 'dunes' | 'mountains';

interface EarthRegionalLayerOptions {
  readonly heightRange: readonly [minimum: number, maximum: number];
  readonly widthRange: readonly [minimum: number, maximum: number];
}

interface EarthRegionalCityscapeOptions {
  readonly architecture: EarthRegionalArchitecture;
  readonly far: EarthRegionalLayerOptions;
  readonly kind: EarthRegionalCityscapeKind;
  readonly lightDensity: EarthCityLightDensity;
  readonly lightProbability: number;
  readonly near: EarthRegionalLayerOptions;
  readonly seed: number;
  readonly terrain: EarthRegionalTerrain;
}

interface EarthRegionalBuilding {
  readonly baseline: number;
  readonly roofY: number;
  readonly width: number;
  readonly x: number;
}

interface EarthRegionalLayer {
  readonly buildings: readonly EarthRegionalBuilding[];
  readonly path: string;
}

export interface EarthRegionalWindowLight {
  readonly height: number;
  readonly id: string;
  readonly opacity: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

export interface EarthRegionalCityscape {
  readonly farSilhouettePath: string;
  readonly kind: EarthRegionalCityscapeKind;
  readonly lightDensity: EarthCityLightDensity;
  readonly lightPools: readonly EarthUrbanLightPool[];
  readonly nearSilhouettePath: string;
  readonly terrainPath: string | null;
  readonly windowLights: readonly EarthRegionalWindowLight[];
}

const CITYSCAPE_OPTIONS: readonly EarthRegionalCityscapeOptions[] = [
  {
    architecture: 'skyscraper',
    far: { heightRange: [54, 142], widthRange: [34, 82] },
    kind: 'new-york',
    lightDensity: 'dense',
    lightProbability: 0.84,
    near: { heightRange: [72, 190], widthRange: [30, 76] },
    seed: 0x4e59_4321,
    terrain: 'none',
  },
  {
    architecture: 'metropolitan',
    far: { heightRange: [42, 112], widthRange: [34, 92] },
    kind: 'tokyo',
    lightDensity: 'dense',
    lightProbability: 0.86,
    near: { heightRange: [58, 166], widthRange: [28, 78] },
    seed: 0x544f_4b59,
    terrain: 'hills',
  },
  {
    architecture: 'historic',
    far: { heightRange: [38, 82], widthRange: [42, 104] },
    kind: 'london',
    lightDensity: 'balanced',
    lightProbability: 0.7,
    near: { heightRange: [48, 126], widthRange: [36, 92] },
    seed: 0x4c4f_4e44,
    terrain: 'none',
  },
  {
    architecture: 'harbor',
    far: { heightRange: [36, 88], widthRange: [48, 116] },
    kind: 'sydney',
    lightDensity: 'balanced',
    lightProbability: 0.72,
    near: { heightRange: [52, 142], widthRange: [40, 94] },
    seed: 0x5359_444e,
    terrain: 'harbor',
  },
  {
    architecture: 'desert',
    far: { heightRange: [28, 64], widthRange: [52, 128] },
    kind: 'cairo',
    lightDensity: 'balanced',
    lightProbability: 0.6,
    near: { heightRange: [38, 102], widthRange: [44, 108] },
    seed: 0x4341_4952,
    terrain: 'dunes',
  },
  {
    architecture: 'coastal',
    far: { heightRange: [34, 74], widthRange: [48, 112] },
    kind: 'rio',
    lightDensity: 'dense',
    lightProbability: 0.78,
    near: { heightRange: [52, 132], widthRange: [36, 88] },
    seed: 0x5249_4f21,
    terrain: 'mountains',
  },
  {
    architecture: 'mountain',
    far: { heightRange: [40, 94], widthRange: [44, 106] },
    kind: 'seoul',
    lightDensity: 'dense',
    lightProbability: 0.82,
    near: { heightRange: [58, 154], widthRange: [34, 84] },
    seed: 0x5345_4f55,
    terrain: 'mountains',
  },
];

const REGIONAL_CITYSCAPES = new Map(
  CITYSCAPE_OPTIONS.map((options) => [options.kind, createRegionalCityscape(options)] as const),
);

export function earthRegionalCityscape(
  kind: EarthHorizonCityscapeKind,
): EarthRegionalCityscape | null {
  if (kind === 'paris' || kind === 'procedural') {
    return null;
  }

  return REGIONAL_CITYSCAPES.get(kind)!;
}

function createRegionalCityscape(options: EarthRegionalCityscapeOptions): EarthRegionalCityscape {
  const far = createBuildingLayer(options, options.far, options.seed ^ 0x51f2_a84d);
  const near = createBuildingLayer(options, options.near, options.seed ^ 0x9e37_79b9);

  return {
    farSilhouettePath: far.path,
    kind: options.kind,
    lightDensity: options.lightDensity,
    lightPools: createEarthUrbanLightPools(options.seed ^ 0x49b2_671d, options.lightDensity),
    nearSilhouettePath: near.path,
    terrainPath: createTerrainPath(options.terrain, options.seed ^ 0xa511_e9b3),
    windowLights: createWindowLights(options, near.buildings),
  };
}

function createBuildingLayer(
  cityscape: EarthRegionalCityscapeOptions,
  layer: EarthRegionalLayerOptions,
  seed: number,
): EarthRegionalLayer {
  const random = createDeterministicRandom(seed);
  const commands = [`M0 ${PARIS_PANORAMA_HEIGHT}`];
  const buildings: EarthRegionalBuilding[] = [];
  let x = 0;
  let buildingIndex = 0;

  while (x < PARIS_PANORAMA_WIDTH) {
    const requestedWidth = integerBetween(random, ...layer.widthRange);
    const width = Math.min(requestedWidth, PARIS_PANORAMA_WIDTH - x);
    const height = integerBetween(random, ...layer.heightRange);
    const roofY = PARIS_PANORAMA_HEIGHT - height;

    buildings.push({ baseline: PARIS_PANORAMA_HEIGHT, roofY, width, x });
    commands.push(
      architecturalRoofPath(cityscape.architecture, buildingIndex, x, roofY, width, random),
    );
    x += width;
    buildingIndex += 1;
  }
  commands.push(`V${PARIS_PANORAMA_HEIGHT}H0Z`);

  return { buildings, path: commands.join('') };
}

function architecturalRoofPath(
  architecture: EarthRegionalArchitecture,
  index: number,
  x: number,
  y: number,
  width: number,
  random: () => number,
): string {
  switch (architecture) {
    case 'skyscraper':
      return skyscraperRoofPath(index, x, y, width);
    case 'metropolitan':
      return metropolitanRoofPath(index, x, y, width);
    case 'historic':
      return historicRoofPath(index, x, y, width);
    case 'harbor':
      return harborRoofPath(index, x, y, width);
    case 'desert':
      return desertRoofPath(index, x, y, width);
    case 'coastal':
      return coastalRoofPath(index, x, y, width);
    case 'mountain':
      return mountainCityRoofPath(index, x, y, width, random);
  }
}

function skyscraperRoofPath(index: number, x: number, y: number, width: number): string {
  const end = x + width;
  const middle = x + width / 2;

  if (index % 5 === 0) {
    return `L${format(x)} ${format(y + 20)}H${format(x + width * 0.18)}V${format(y + 8)}H${format(middle - 2)}L${format(middle)} ${format(y - 36)}L${format(middle + 2)} ${format(y + 8)}H${format(end - width * 0.18)}V${format(y + 20)}H${format(end)}`;
  }
  if (index % 3 === 0) {
    return `L${format(x)} ${format(y + 18)}H${format(x + width * 0.16)}V${format(y + 8)}H${format(x + width * 0.32)}V${format(y)}H${format(end - width * 0.32)}V${format(y + 8)}H${format(end - width * 0.16)}V${format(y + 18)}H${format(end)}`;
  }

  return rooftopEquipmentPath(x, y, width, 8 + (index % 4) * 3);
}

function metropolitanRoofPath(index: number, x: number, y: number, width: number): string {
  const end = x + width;
  const antennaX = x + width * (0.34 + (index % 3) * 0.14);

  if (index % 4 === 0) {
    return `L${format(x)} ${format(y + 7)}H${format(antennaX - 2)}V${format(y - 8)}H${format(antennaX - 0.7)}L${format(antennaX)} ${format(y - 28)}L${format(antennaX + 0.7)} ${format(y - 8)}H${format(antennaX + 2)}V${format(y + 7)}H${format(end)}`;
  }

  return rooftopEquipmentPath(x, y, width, 6 + (index % 3) * 2);
}

function historicRoofPath(index: number, x: number, y: number, width: number): string {
  const end = x + width;
  const middle = x + width / 2;

  if (index % 4 === 0) {
    return `L${format(x)} ${format(y + 12)}Q${format(middle)} ${format(y - 18)} ${format(end)} ${format(y + 12)}`;
  }
  if (index % 3 === 0) {
    return `L${format(x)} ${format(y + 14)}L${format(middle)} ${format(y - 12)}L${format(end)} ${format(y + 14)}`;
  }

  return `L${format(x)} ${format(y + 8)}H${format(x + width * 0.22)}V${format(y)}H${format(end - width * 0.22)}V${format(y + 8)}H${format(end)}`;
}

function harborRoofPath(index: number, x: number, y: number, width: number): string {
  const end = x + width;

  if (index % 4 === 0) {
    return `L${format(x)} ${format(y + 18)}L${format(x + width * 0.62)} ${format(y)}H${format(end - width * 0.12)}V${format(y + 18)}H${format(end)}`;
  }

  return rooftopEquipmentPath(x, y, width, 5 + (index % 3) * 3);
}

function desertRoofPath(index: number, x: number, y: number, width: number): string {
  const end = x + width;
  const middle = x + width / 2;

  if (index % 5 === 0) {
    return `L${format(x)} ${format(y + 10)}H${format(middle - width * 0.16)}Q${format(middle)} ${format(y - 18)} ${format(middle + width * 0.16)} ${format(y + 10)}H${format(end)}`;
  }
  if (index % 4 === 0) {
    return `L${format(x)} ${format(y + 12)}H${format(middle - 2)}L${format(middle)} ${format(y - 30)}L${format(middle + 2)} ${format(y + 12)}H${format(end)}`;
  }

  return `L${format(x)} ${format(y + 7)}H${format(x + width * 0.16)}V${format(y)}H${format(x + width * 0.3)}V${format(y + 7)}H${format(end)}`;
}

function coastalRoofPath(index: number, x: number, y: number, width: number): string {
  const end = x + width;

  if (index % 3 === 0) {
    return `L${format(x)} ${format(y + 16)}H${format(x + width * 0.2)}V${format(y + 8)}H${format(x + width * 0.48)}V${format(y)}H${format(end - width * 0.12)}V${format(y + 16)}H${format(end)}`;
  }

  return rooftopEquipmentPath(x, y, width, 5 + (index % 4) * 2);
}

function mountainCityRoofPath(
  index: number,
  x: number,
  y: number,
  width: number,
  random: () => number,
): string {
  const end = x + width;
  const equipmentWidth = Math.min(width * 0.28, 18 + random() * 12);
  const equipmentX = x + width * (0.18 + random() * 0.34);

  if (index % 4 === 0) {
    return `L${format(x)} ${format(y + 9)}H${format(equipmentX)}V${format(y - 9)}H${format(equipmentX + equipmentWidth)}V${format(y + 9)}H${format(end)}`;
  }

  return rooftopEquipmentPath(x, y, width, 7 + (index % 3) * 2);
}

function rooftopEquipmentPath(x: number, y: number, width: number, height: number): string {
  const end = x + width;
  const equipmentStart = x + width * 0.32;
  const equipmentEnd = x + width * 0.62;

  return `L${format(x)} ${format(y + 8)}H${format(equipmentStart)}V${format(y - height)}H${format(equipmentEnd)}V${format(y + 8)}H${format(end)}`;
}

function createTerrainPath(terrain: EarthRegionalTerrain, seed: number): string | null {
  switch (terrain) {
    case 'none':
      return null;
    case 'hills':
      return rollingTerrainPath(seed, 252, 34, 9);
    case 'harbor':
      return rollingTerrainPath(seed, 286, 12, 13);
    case 'dunes':
      return rollingTerrainPath(seed, 276, 20, 16);
    case 'mountains':
      return rollingTerrainPath(seed, 236, 76, 11);
  }
}

function rollingTerrainPath(
  seed: number,
  baseline: number,
  amplitude: number,
  segmentCount: number,
): string {
  const random = createDeterministicRandom(seed);
  const segmentWidth = PARIS_PANORAMA_WIDTH / segmentCount;
  const commands = [`M0 ${PARIS_PANORAMA_HEIGHT}`, `L0 ${baseline}`];

  for (let index = 0; index < segmentCount; index += 1) {
    const start = index * segmentWidth;
    const end = start + segmentWidth;
    const controlX = start + segmentWidth / 2;
    const controlY = baseline - amplitude * (0.36 + random() * 0.64);
    const endY = baseline - amplitude * (0.08 + random() * 0.24);

    commands.push(`Q${format(controlX)} ${format(controlY)} ${format(end)} ${format(endY)}`);
  }
  commands.push(`V${PARIS_PANORAMA_HEIGHT}H0Z`);

  return commands.join('');
}

function createWindowLights(
  cityscape: EarthRegionalCityscapeOptions,
  buildings: readonly EarthRegionalBuilding[],
): readonly EarthRegionalWindowLight[] {
  const random = createDeterministicRandom(cityscape.seed ^ 0xc17f_1a57);
  const lights: EarthRegionalWindowLight[] = [];

  for (const [buildingIndex, building] of buildings.entries()) {
    if (random() > cityscape.lightProbability) {
      continue;
    }
    const columns = building.width >= 72 ? 3 : building.width >= 44 ? 2 : 1;
    const buildingHeight = building.baseline - building.roofY;
    const rows = buildingHeight >= 140 ? 3 : buildingHeight >= 72 ? 2 : 1;

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        lights.push(createWindowLight(building, buildingIndex, row, column, columns, random));
      }
    }
  }

  return lights;
}

function createWindowLight(
  building: EarthRegionalBuilding,
  buildingIndex: number,
  row: number,
  column: number,
  columns: number,
  random: () => number,
): EarthRegionalWindowLight {
  const horizontalFraction = (column + 1) / (columns + 1);
  const usableHeight = Math.max(10, building.baseline - building.roofY - 18);
  const verticalFraction = (row + 1) / 3;

  return {
    height: 2 + random() * 1.6,
    id: `${buildingIndex}-${row}-${column}`,
    opacity: 0.44 + random() * 0.43,
    width: 2.4 + random() * 2.5,
    x: building.x + building.width * horizontalFraction,
    y: building.roofY + 10 + usableHeight * verticalFraction,
  };
}

function createDeterministicRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;

    return state / 0x1_0000_0000;
  };
}

function integerBetween(random: () => number, minimum: number, maximum: number): number {
  return minimum + Math.floor(random() * (maximum - minimum + 1));
}

function format(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(2);
}
