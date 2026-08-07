interface ParisSilhouetteOptions {
  readonly baseline: number;
  readonly heightRange: readonly [number, number];
  readonly seed: number;
  readonly width: number;
  readonly widthRange: readonly [number, number];
}

interface ParisBuildingBounds {
  readonly baseline: number;
  readonly roofY: number;
  readonly width: number;
  readonly x: number;
}

interface ParisSilhouette {
  readonly buildings: readonly ParisBuildingBounds[];
  readonly path: string;
}

export interface ParisWindowLight {
  readonly height: number;
  readonly id: string;
  readonly opacity: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

const PARIS_PANORAMA_SOURCE_WIDTH = 2_400;
const PARIS_PANORAMA_HORIZONTAL_SCALE = 3;

const PARIS_FAR_SILHOUETTE = createParisSilhouette({
  baseline: 320,
  heightRange: [48, 108],
  seed: 0x51a7_1900,
  width: PARIS_PANORAMA_SOURCE_WIDTH,
  widthRange: [10, 24],
});

const PARIS_NEAR_SILHOUETTE = createParisSilhouette({
  baseline: 320,
  heightRange: [38, 92],
  seed: 0x75e1_1889,
  width: PARIS_PANORAMA_SOURCE_WIDTH,
  widthRange: [6, 14],
});

export const PARIS_FAR_SILHOUETTE_PATH = PARIS_FAR_SILHOUETTE.path;
export const PARIS_NEAR_SILHOUETTE_PATH = PARIS_NEAR_SILHOUETTE.path;
export const PARIS_WINDOW_LIGHTS = createParisWindowLights(PARIS_NEAR_SILHOUETTE.buildings);

function createParisSilhouette(options: ParisSilhouetteOptions): ParisSilhouette {
  const random = createDeterministicRandom(options.seed);
  const commands = [`M0 ${options.baseline}`];
  const buildings: ParisBuildingBounds[] = [];
  let x = 0;

  while (x < options.width) {
    const requestedWidth = integerBetween(random, ...options.widthRange);
    const width = Math.min(requestedWidth, options.width - x);
    const height = integerBetween(random, ...options.heightRange);
    const roof = integerBetween(random, 0, 5);
    const roofY = options.baseline - height;

    buildings.push({ baseline: options.baseline, roofY, width, x });
    commands.push(parisRoofPath(roof, x, roofY, width, random));
    x += width;
  }

  commands.push(`V${options.baseline}H0Z`);

  return { buildings, path: commands.join('') };
}

function createParisWindowLights(
  buildings: readonly ParisBuildingBounds[],
): readonly ParisWindowLight[] {
  const random = createDeterministicRandom(0xc17f_1a57);
  const lights: ParisWindowLight[] = [];

  for (const [buildingIndex, building] of buildings.entries()) {
    if (random() > 0.36) {
      continue;
    }

    const margin = Math.min(2.5, building.width * 0.24);
    const availableWidth = Math.max(0, building.width - margin * 2);
    const availableHeight = Math.max(0, building.baseline - building.roofY - 18);
    const lightCount = building.width >= 12 && random() > 0.82 ? 2 : 1;

    for (let lightIndex = 0; lightIndex < lightCount; lightIndex += 1) {
      lights.push({
        height: 1.6 + random() * 1.4,
        id: `${buildingIndex}-${lightIndex}`,
        opacity: 0.24 + random() * 0.46,
        width: 1.8 + random() * 1.7,
        x: (building.x + margin + random() * availableWidth) * PARIS_PANORAMA_HORIZONTAL_SCALE,
        y: building.roofY + 10 + random() * availableHeight,
      });
    }
  }

  return lights;
}

function parisRoofPath(
  roof: number,
  x: number,
  y: number,
  width: number,
  random: () => number,
): string {
  const end = x + width;
  const midpoint = x + width / 2;

  switch (roof) {
    case 0:
      return flatRoofPath(x, y, end, width, random);
    case 1:
      return `L${format(x)} ${format(y + 7)}L${format(x + 3)} ${format(y + 1)}H${format(end - 3)}L${format(end)} ${format(y + 7)}`;
    case 2:
      return `L${format(x)} ${format(y + 8)}L${format(midpoint)} ${format(y)}L${format(end)} ${format(y + 8)}`;
    case 3:
      return `L${format(x)} ${format(y + 9)}Q${format(midpoint)} ${format(y - 4)} ${format(end)} ${format(y + 9)}`;
    case 4:
      return `L${format(x)} ${format(y + 8)}H${format(x + 2)}V${format(y + 3)}H${format(end - 2)}V${format(y + 8)}H${format(end)}`;
    default:
      return `L${format(x)} ${format(y + 8)}H${format(midpoint - 1.5)}L${format(midpoint)} ${format(y - 11)}L${format(midpoint + 1.5)} ${format(y + 8)}H${format(end)}`;
  }
}

function flatRoofPath(
  x: number,
  y: number,
  end: number,
  width: number,
  random: () => number,
): string {
  const chimneyWidth = Math.min(2.2, width * 0.18);
  const chimneyX = x + width * (0.22 + random() * 0.46);
  const chimneyHeight = 4 + random() * 8;

  return `L${format(x)} ${format(y)}H${format(chimneyX)}V${format(y - chimneyHeight)}H${format(chimneyX + chimneyWidth)}V${format(y)}H${format(end)}`;
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
