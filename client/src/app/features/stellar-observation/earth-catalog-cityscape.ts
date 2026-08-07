import type { EarthObserverLocation } from '../../../engine/simulation/earth-observer-location';
import {
  createEarthUrbanLightPools,
  earthCityLightDensity,
  type EarthCityLightDensity,
  type EarthUrbanLightPool,
} from './earth-city-lighting';
import { PARIS_PANORAMA_HEIGHT, PARIS_PANORAMA_WIDTH } from './earth-paris-landmarks';

export type EarthCatalogArchitecture =
  'civic' | 'desert' | 'high-rise' | 'historic' | 'island' | 'metropolitan' | 'nordic' | 'tropical';

export type EarthCatalogTerrain = 'dunes' | 'hills' | 'lowlands' | 'mountains' | 'water';
export type EarthCatalogLightDensity = EarthCityLightDensity;

export interface EarthCatalogWindowLight {
  readonly height: number;
  readonly id: string;
  readonly opacity: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

export interface EarthCatalogCityscape {
  readonly architecture: EarthCatalogArchitecture;
  readonly farSilhouettePath: string;
  readonly lightDensity: EarthCatalogLightDensity;
  readonly lightPools: readonly EarthUrbanLightPool[];
  readonly locationId: string;
  readonly nearSilhouettePath: string;
  readonly terrain: EarthCatalogTerrain;
  readonly terrainPath: string;
  readonly windowLights: readonly EarthCatalogWindowLight[];
}

interface Building {
  readonly height: number;
  readonly roofY: number;
  readonly width: number;
  readonly x: number;
}

interface BuildingLayer {
  readonly buildings: readonly Building[];
  readonly path: string;
}

type RandomSource = () => number;

const MAX_BUILDING_BODY_HEIGHT_UNITS = 96;
const MAX_ROOFTOP_CROWN_HEIGHT_UNITS = 23 * 1.8;

export const EARTH_CATALOG_DECORATIVE_SKYLINE_MAX_HEIGHT_UNITS =
  MAX_BUILDING_BODY_HEIGHT_UNITS + MAX_ROOFTOP_CROWN_HEIGHT_UNITS;

const DESERT_COUNTRIES = new Set([
  'AE',
  'BH',
  'DZ',
  'EG',
  'IQ',
  'JO',
  'KW',
  'LY',
  'MA',
  'MR',
  'NE',
  'OM',
  'QA',
  'SA',
  'SD',
  'TN',
  'YE',
]);
const ISLAND_COUNTRIES = new Set([
  'AG',
  'BB',
  'BS',
  'CV',
  'DM',
  'FJ',
  'FM',
  'GD',
  'IS',
  'JM',
  'KI',
  'KM',
  'LC',
  'MV',
  'MH',
  'MT',
  'MU',
  'NR',
  'NZ',
  'PW',
  'SB',
  'SC',
  'TO',
  'TT',
  'TV',
  'VC',
  'VU',
  'WS',
]);
const NORDIC_COUNTRIES = new Set(['DK', 'FI', 'GL', 'IS', 'NO', 'SE']);
const HISTORIC_COUNTRIES = new Set([
  'AL',
  'AT',
  'BE',
  'BG',
  'CH',
  'CZ',
  'DE',
  'ES',
  'FR',
  'GB',
  'GR',
  'HR',
  'HU',
  'IE',
  'IT',
  'LU',
  'NL',
  'PL',
  'PT',
  'RO',
  'RS',
  'SI',
  'SK',
]);

export function createEarthCatalogCityscape(
  location: EarthObserverLocation,
): EarthCatalogCityscape {
  const seed = hashString(
    `${location.id}:${location.latitude.toFixed(4)}:${location.longitude.toFixed(4)}`,
  );
  const architecture = chooseArchitecture(location, seed);
  const terrain = chooseTerrain(location, architecture, seed);
  const lightDensity = earthCityLightDensity(location);
  const far = createBuildingLayer(architecture, seed ^ 0x6d2b_79f5, 'far');
  const near = createBuildingLayer(architecture, seed ^ 0x1b87_3593, 'near');

  return {
    architecture,
    farSilhouettePath: far.path,
    lightDensity,
    lightPools: createEarthUrbanLightPools(seed ^ 0xc17f_1a57, lightDensity),
    locationId: location.id,
    nearSilhouettePath: near.path,
    terrain,
    terrainPath: createTerrainPath(terrain, seed ^ 0xa511_e9b3),
    windowLights: createWindowLights(near.buildings, lightDensity, seed ^ 0x9e37_79b9),
  };
}

function chooseArchitecture(
  location: EarthObserverLocation,
  seed: number,
): EarthCatalogArchitecture {
  const countryCode = location.countryCode?.toUpperCase() ?? '';
  const population = location.population ?? 0;

  if (population >= 5_000_000) {
    return 'high-rise';
  }
  if (DESERT_COUNTRIES.has(countryCode)) {
    return 'desert';
  }
  if (ISLAND_COUNTRIES.has(countryCode)) {
    return 'island';
  }
  if (NORDIC_COUNTRIES.has(countryCode)) {
    return 'nordic';
  }
  if (Math.abs(location.latitude) <= 23.5) {
    return 'tropical';
  }
  if (HISTORIC_COUNTRIES.has(countryCode)) {
    return 'historic';
  }
  if (location.capital) {
    return 'civic';
  }

  return seed % 3 === 0 ? 'historic' : 'metropolitan';
}

function chooseTerrain(
  location: EarthObserverLocation,
  architecture: EarthCatalogArchitecture,
  seed: number,
): EarthCatalogTerrain {
  if (architecture === 'desert') {
    return 'dunes';
  }
  if (architecture === 'island') {
    return 'water';
  }
  if (architecture === 'nordic') {
    return 'mountains';
  }
  if (architecture === 'tropical') {
    return seed % 2 === 0 ? 'hills' : 'mountains';
  }
  if (Math.abs(location.latitude) >= 58) {
    return 'mountains';
  }
  if (location.timeZone.startsWith('Pacific/') || location.timeZone.startsWith('Atlantic/')) {
    return 'water';
  }

  return seed % 4 === 0 ? 'hills' : 'lowlands';
}

function createBuildingLayer(
  architecture: EarthCatalogArchitecture,
  seed: number,
  depth: 'far' | 'near',
): BuildingLayer {
  const random = createRandom(seed);
  const commands = [`M0 ${PARIS_PANORAMA_HEIGHT}`];
  const buildings: Building[] = [];
  const [minimumWidth, maximumWidth] = depth === 'far' ? [42, 108] : [34, 92];
  const [minimumHeight, maximumHeight] = buildingHeightRange(architecture, depth);
  let x = 0;
  let index = 0;

  while (x < PARIS_PANORAMA_WIDTH) {
    const requestedWidth = between(random, minimumWidth, maximumWidth);
    const width = Math.min(requestedWidth, PARIS_PANORAMA_WIDTH - x);
    const height = between(random, minimumHeight, maximumHeight);
    const roofY = PARIS_PANORAMA_HEIGHT - height;

    buildings.push({ height, roofY, width, x });
    commands.push(buildRoof(architecture, index, x, roofY, width, random));
    x += width;
    index += 1;
  }
  commands.push(`V${PARIS_PANORAMA_HEIGHT}H0Z`);

  return { buildings, path: commands.join('') };
}

function buildingHeightRange(
  architecture: EarthCatalogArchitecture,
  depth: 'far' | 'near',
): readonly [number, number] {
  const ranges: Readonly<Record<EarthCatalogArchitecture, readonly [number, number]>> = {
    civic: [38, 84],
    desert: [24, 72],
    'high-rise': [52, MAX_BUILDING_BODY_HEIGHT_UNITS],
    historic: [30, 78],
    island: [28, 74],
    metropolitan: [42, 90],
    nordic: [28, 76],
    tropical: [32, 82],
  };
  const [minimum, maximum] = ranges[architecture];

  return depth === 'near' ? [minimum, maximum] : [minimum * 0.58, maximum * 0.68];
}

function buildRoof(
  architecture: EarthCatalogArchitecture,
  index: number,
  x: number,
  y: number,
  width: number,
  random: RandomSource,
): string {
  const end = x + width;
  const middle = x + width / 2;
  const inset = width * (0.12 + random() * 0.1);
  const crown = 5 + random() * 18;
  const motif = (index + Math.floor(random() * 7)) % 7;

  if (architecture === 'high-rise' && motif <= 2) {
    return `L${f(x)} ${f(y + 18)}H${f(x + inset)}V${f(y + 6)}H${f(middle - 2)}L${f(middle)} ${f(y - crown * 1.8)}L${f(middle + 2)} ${f(y + 6)}H${f(end - inset)}V${f(y + 18)}H${f(end)}`;
  }
  if (architecture === 'historic' && motif <= 2) {
    return `L${f(x)} ${f(y + 13)}Q${f(middle)} ${f(y - crown)} ${f(end)} ${f(y + 13)}L${f(end)} ${f(y + 18)}H${f(end - inset)}V${f(y + 9)}H${f(x + inset)}V${f(y + 18)}H${f(end)}`;
  }
  if (architecture === 'desert' && motif <= 2) {
    return `L${f(x)} ${f(y + 15)}H${f(x + inset)}Q${f(middle)} ${f(y - crown)} ${f(end - inset)} ${f(y + 15)}H${f(end)}`;
  }
  if (architecture === 'nordic' && motif <= 2) {
    return `L${f(x)} ${f(y + 16)}L${f(middle)} ${f(y - crown)}L${f(end)} ${f(y + 16)}H${f(end)}`;
  }
  if ((architecture === 'tropical' || architecture === 'island') && motif === 0) {
    return `L${f(x)} ${f(y + 18)}H${f(x + inset)}V${f(y + 8)}Q${f(middle)} ${f(y - crown)} ${f(end - inset)} ${f(y + 8)}V${f(y + 18)}H${f(end)}`;
  }
  if (architecture === 'civic' && motif <= 2) {
    return `L${f(x)} ${f(y + 17)}H${f(x + inset)}V${f(y + 8)}H${f(middle - width * 0.18)}L${f(middle)} ${f(y - crown)}L${f(middle + width * 0.18)} ${f(y + 8)}H${f(end - inset)}V${f(y + 17)}H${f(end)}`;
  }
  if (motif === 3) {
    return `L${f(x)} ${f(y + 16)}H${f(x + inset)}V${f(y + 3)}H${f(end - inset)}V${f(y + 16)}H${f(end)}`;
  }
  if (motif === 4) {
    return `L${f(x)} ${f(y + 14)}H${f(middle - 1)}L${f(middle)} ${f(y - crown)}L${f(middle + 1)} ${f(y + 14)}H${f(end)}`;
  }

  return `L${f(x)} ${f(y + 18)}H${f(x + inset)}V${f(y + 7)}H${f(x + width * 0.42)}V${f(y)}H${f(end - width * 0.32)}V${f(y + 11)}H${f(end - inset)}V${f(y + 18)}H${f(end)}`;
}

function createTerrainPath(terrain: EarthCatalogTerrain, seed: number): string {
  const random = createRandom(seed);
  const points = [`M0 ${PARIS_PANORAMA_HEIGHT}`];
  const segmentWidth = terrain === 'mountains' ? 210 : terrain === 'dunes' ? 320 : 260;
  const amplitude = terrainAmplitude(terrain);

  for (let x = 0; x <= PARIS_PANORAMA_WIDTH; x += segmentWidth) {
    const base = PARIS_PANORAMA_HEIGHT - amplitude * (0.28 + random() * 0.32);
    const peak = base - amplitude * (0.25 + random() * 0.75);

    if (terrain === 'water' || terrain === 'lowlands') {
      points.push(`L${f(x)} ${f(base)}`);
    } else {
      points.push(`Q${f(x + segmentWidth * 0.5)} ${f(peak)} ${f(x + segmentWidth)} ${f(base)}`);
    }
  }
  points.push(`V${PARIS_PANORAMA_HEIGHT}H0Z`);

  return points.join('');
}

function terrainAmplitude(terrain: EarthCatalogTerrain): number {
  switch (terrain) {
    case 'mountains':
      return 118;
    case 'hills':
      return 62;
    case 'dunes':
      return 44;
    case 'water':
      return 12;
    case 'lowlands':
      return 24;
  }
}

function createWindowLights(
  buildings: readonly Building[],
  density: EarthCatalogLightDensity,
  seed: number,
): readonly EarthCatalogWindowLight[] {
  const random = createRandom(seed);
  const maximum = density === 'dense' ? 360 : density === 'balanced' ? 260 : 180;
  const minimumGridSize = density === 'dense' ? 3 : 2;
  const candidates: EarthCatalogWindowLight[] = [];

  for (const [buildingIndex, building] of buildings.entries()) {
    const columns = Math.max(minimumGridSize, Math.floor(building.width / 14));
    const rows = Math.max(minimumGridSize, Math.floor(building.height / 18));

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const width = 1.8 + random() * 1.8;
        const height = 1.2 + random() * 1.5;

        candidates.push({
          height,
          id: `${buildingIndex}-${row}-${column}`,
          opacity: 0.46 + random() * 0.42,
          width,
          x: building.x + ((column + 1) / (columns + 1)) * building.width - width / 2,
          y: building.roofY + 18 + ((row + 1) / (rows + 1)) * Math.max(1, building.height - 24),
        });
      }
    }
  }

  return selectEvenlyDistributedLights(candidates, maximum, random);
}

function selectEvenlyDistributedLights(
  candidates: readonly EarthCatalogWindowLight[],
  maximum: number,
  random: RandomSource,
): readonly EarthCatalogWindowLight[] {
  const ordered = [...candidates].sort((first, second) => first.x - second.x);

  return Array.from({ length: maximum }, (_, index) => {
    const start = Math.floor((index * ordered.length) / maximum);
    const end = Math.floor(((index + 1) * ordered.length) / maximum);
    const selectedIndex = start + Math.floor(random() * (end - start));

    return ordered[selectedIndex]!;
  });
}

function between(random: RandomSource, minimum: number, maximum: number): number {
  return minimum + random() * (maximum - minimum);
}

function createRandom(seed: number): RandomSource {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b_79f5;
    let value = state;

    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function hashString(value: string): number {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}

function f(value: number): string {
  return value.toFixed(2);
}
