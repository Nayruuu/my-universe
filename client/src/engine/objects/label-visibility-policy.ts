import type {
  GraphicQuality,
  LabelDensity,
  SpaceObject,
  SpaceObjectType,
} from '../../data/models/universe.models';
import { isGalaxyMapRankVisible } from './galaxy-map-policy';
import { scaleLabelLimit } from './label-density-policy';
import { getSolarSystemMapAccent } from './solar-system-map-palette';

export interface LabelObject {
  readonly id: string;
  readonly name: string;
  readonly type: SpaceObjectType;
  readonly visual?: Pick<SpaceObject['visual'], 'visualRadius'>;
  readonly metadata?: SpaceObject['metadata'];
}

const COSMIC_LABEL_PRIORITY_BASE = 300;
const MAXIMUM_CATALOG_LABEL_RANKS = {
  low: [400, 700, 1_000, 0, 0],
  medium: [800, 1_400, 2_200, 0, 0],
  high: [1_400, 2_400, 3_000, 0, 0],
} as const satisfies Record<GraphicQuality, readonly number[]>;
const MAXIMUM_EXOPLANET_HOST_LABEL_RANKS = {
  low: [1, 2, 3, 0, 0],
  medium: [2, 4, 5, 0, 0],
  high: [4, 8, 8, 0, 0],
} as const satisfies Record<GraphicQuality, readonly number[]>;
const MAXIMUM_CONSTELLATION_LABEL_RANKS = {
  low: [8, 12, 16, 0, 0, 0],
  medium: [14, 22, 30, 0, 0, 0],
  high: [20, 32, 44, 0, 0, 0],
} as const satisfies Record<GraphicQuality, readonly number[]>;
const MAXIMUM_COSMIC_LABEL_RANKS = {
  low: 24,
  medium: 48,
  high: 72,
} as const satisfies Record<GraphicQuality, number>;
const MAXIMUM_COSMIC_LABELS = {
  low: 10,
  medium: 16,
  high: 24,
} as const satisfies Record<GraphicQuality, number>;
const LABEL_TEXT_COLORS = {
  universe: '#d7ccff',
  'galaxy-cluster': '#d7ccff',
  supercluster: '#d9b8ff',
  'cosmic-wall': '#ffb78a',
  'cosmic-filament': '#7de4f2',
  'cosmic-void': '#78a9ff',
  'cosmic-basin': '#b89cff',
  'cosmic-attractor': '#ffd27c',
  'cosmic-repeller': '#7ce0c3',
  galaxy: '#c9b8ff',
  'black-hole': '#ffb274',
  supernova: '#ff9fc9',
  'supernova-remnant': '#82dcff',
  nebula: '#efb9dc',
  star: '#ffe7ad',
  planet: '#a9d4ff',
  exoplanet: '#77e6cf',
  'dwarf-planet': '#b9cfff',
  moon: '#d7dee8',
  asteroid: '#dbbe93',
  comet: '#a8e4d4',
  'artificial-object': '#bdcad7',
  region: '#b9c8dc',
} as const satisfies Record<SpaceObjectType, string>;
const CONSTELLATION_LABEL_TEXT_COLOR = '#8edff5';
const ACTIVE_LABEL_TEXT_COLOR = '#c8efff';
const SOLAR_SYSTEM_LABEL_TYPES = new Set<SpaceObjectType>([
  'planet',
  'dwarf-planet',
  'moon',
  'asteroid',
  'comet',
]);
const MAXIMUM_LABELS_BY_LOD = [64, 80, 96, 72, 36, 48, 72] as const;

export function getLabelTextColor(object: LabelObject, active: boolean, lodLevel = -1): string {
  if (isSolarSystemLabelAtLevel(object, lodLevel)) {
    return getSolarSystemMapAccent(object.id, active);
  }
  if (active) {
    return ACTIVE_LABEL_TEXT_COLOR;
  }
  if (isConstellationLabel(object)) {
    return CONSTELLATION_LABEL_TEXT_COLOR;
  }

  return LABEL_TEXT_COLORS[object.type];
}

export function isLabelVisibleAtLevel(
  object: LabelObject,
  lodLevel: number,
  quality: GraphicQuality = 'high',
  density: LabelDensity = 'balanced',
): boolean {
  const catalogRecordIndex = object.metadata?.['catalogRecordIndex'];
  const exoplanetHostRank = object.metadata?.['exoplanetHostRank'];
  const cosmicLabelRank = getCosmicLabelRank(object);
  const constellationLabelRank = object.metadata?.['constellationLabelRank'];

  if (typeof catalogRecordIndex === 'number') {
    return catalogRecordIndex < getMaximumCatalogLabelRank(quality, lodLevel, density);
  }
  if (typeof exoplanetHostRank === 'number') {
    return exoplanetHostRank < getMaximumExoplanetHostLabelRank(quality, lodLevel, density);
  }
  if (cosmicLabelRank !== null) {
    return cosmicLabelRank < getMaximumCosmicLabelRank(quality, lodLevel, density);
  }
  if (typeof constellationLabelRank === 'number') {
    return constellationLabelRank < getMaximumConstellationLabelRank(quality, lodLevel, density);
  }
  if (object.type === 'galaxy') {
    if (object.id === 'milky-way') {
      return lodLevel >= 3;
    }
    const nearbyUniverseLabelRank = object.metadata?.['nearbyUniverseLabelRank'];

    if (typeof nearbyUniverseLabelRank === 'number') {
      return lodLevel >= 5;
    }

    return lodLevel >= 3 && lodLevel <= 4 && isGalaxyMapRankVisible(object, quality, density);
  }
  if (object.type === 'star') {
    if (object.id === 'sun') {
      return lodLevel <= 2;
    }

    return lodLevel >= 1 && lodLevel <= 2;
  }
  if (object.type === 'black-hole') {
    return lodLevel >= 1 && lodLevel <= 3;
  }
  if (object.type === 'supernova' || object.type === 'supernova-remnant') {
    return lodLevel >= 1 && lodLevel <= 3;
  }

  return lodLevel <= 1;
}

export function isScaleLandmarkAtLevel(object: LabelObject, lodLevel: number): boolean {
  return object.id === (lodLevel <= 2 ? 'sun' : 'milky-way');
}

export function getMaximumLabelCount(
  quality: GraphicQuality,
  lodLevel: number,
  density: LabelDensity = 'balanced',
): number {
  if (lodLevel === 6) {
    return scaleLabelLimit(MAXIMUM_COSMIC_LABELS[quality], density);
  }
  const qualityLimit = quality === 'low' ? 28 : quality === 'medium' ? 56 : 96;
  const lodLimit = MAXIMUM_LABELS_BY_LOD[lodLevel] ?? MAXIMUM_LABELS_BY_LOD.at(-1)!;

  return scaleLabelLimit(Math.min(qualityLimit, lodLimit), density);
}

export function getMaximumCatalogLabelRank(
  quality: GraphicQuality,
  lodLevel: number,
  density: LabelDensity = 'balanced',
): number {
  return scaleLabelLimit(MAXIMUM_CATALOG_LABEL_RANKS[quality][lodLevel] ?? 0, density);
}

export function getMaximumConstellationLabelRank(
  quality: GraphicQuality,
  lodLevel: number,
  density: LabelDensity = 'balanced',
): number {
  return scaleLabelLimit(MAXIMUM_CONSTELLATION_LABEL_RANKS[quality][lodLevel] ?? 0, density);
}

export function getMaximumExoplanetHostLabelRank(
  quality: GraphicQuality,
  lodLevel: number,
  density: LabelDensity = 'balanced',
): number {
  return scaleLabelLimit(MAXIMUM_EXOPLANET_HOST_LABEL_RANKS[quality][lodLevel] ?? 0, density);
}

export function getMaximumCosmicLabelRank(
  quality: GraphicQuality,
  lodLevel: number,
  density: LabelDensity = 'balanced',
): number {
  return lodLevel === 6 ? scaleLabelLimit(MAXIMUM_COSMIC_LABEL_RANKS[quality], density) : 0;
}

export function getMaximumCatalogLabelPoolRank(
  quality: GraphicQuality,
  density: LabelDensity,
): number {
  return Math.max(
    ...MAXIMUM_CATALOG_LABEL_RANKS[quality].map((rank) => scaleLabelLimit(rank, density)),
  );
}

export function getLabelPriority(object: LabelObject, lodLevel: number): number {
  if (object.id === 'sun' || object.id === 'milky-way') {
    return Number.MAX_SAFE_INTEGER;
  }
  if (lodLevel === 1) {
    if (object.type === 'planet') {
      return -300;
    }
    if (object.type === 'dwarf-planet') {
      return -240;
    }
    if (object.type === 'moon') {
      return -180;
    }
  }
  const catalogRecordIndex = object.metadata?.['catalogRecordIndex'];

  if (typeof catalogRecordIndex === 'number') {
    return 1_000 + catalogRecordIndex;
  }
  const cosmicCatalogRank = object.metadata?.['cosmicCatalogRank'];

  if (typeof cosmicCatalogRank === 'number') {
    return COSMIC_LABEL_PRIORITY_BASE + cosmicCatalogRank * 2;
  }
  const cosmicStructureRank = object.metadata?.['cosmicStructureRank'];

  if (typeof cosmicStructureRank === 'number') {
    return COSMIC_LABEL_PRIORITY_BASE + cosmicStructureRank * 2 + 1;
  }
  const constellationLabelRank = object.metadata?.['constellationLabelRank'];

  if (typeof constellationLabelRank === 'number') {
    return 400 + constellationLabelRank;
  }
  const exoplanetHostRank = object.metadata?.['exoplanetHostRank'];

  if (typeof exoplanetHostRank === 'number') {
    return 600 + exoplanetHostRank;
  }
  const mapLabelRank = object.metadata?.['mapLabelRank'];
  const nearbyUniverseLabelRank = object.metadata?.['nearbyUniverseLabelRank'];

  if (object.type === 'galaxy' && typeof nearbyUniverseLabelRank === 'number') {
    return 25 + nearbyUniverseLabelRank;
  }

  return object.type === 'galaxy' && typeof mapLabelRank === 'number' ? 50 + mapLabelRank : 0;
}

export function isSolarSystemPrimaryLabel(object: LabelObject, lodLevel: number): boolean {
  return (
    lodLevel === 1 &&
    (object.type === 'planet' || object.type === 'dwarf-planet' || object.type === 'moon')
  );
}

export function isSolarSystemLabelAtLevel(object: LabelObject, lodLevel: number): boolean {
  if (lodLevel < 0 || lodLevel > 2) {
    return false;
  }

  return object.id === 'sun' || SOLAR_SYSTEM_LABEL_TYPES.has(object.type);
}

export function isCatalogLabel(object: LabelObject): boolean {
  return (
    typeof object.metadata?.['catalogRecordIndex'] === 'number' ||
    typeof object.metadata?.['exoplanetHostRank'] === 'number' ||
    isCosmicCatalogLabel(object)
  );
}

export function isCosmicCatalogLabel(object: LabelObject): boolean {
  return getCosmicLabelRank(object) !== null;
}

export function isConstellationLabel(object: LabelObject): boolean {
  return typeof object.metadata?.['constellationLabelRank'] === 'number';
}

function getCosmicLabelRank(object: LabelObject): number | null {
  const catalogRank = object.metadata?.['cosmicCatalogRank'];

  if (typeof catalogRank === 'number') {
    return catalogRank;
  }
  const structureRank = object.metadata?.['cosmicStructureRank'];

  return typeof structureRank === 'number' ? structureRank : null;
}
