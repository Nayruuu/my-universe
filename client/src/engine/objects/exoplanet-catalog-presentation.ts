import type { SearchEntry } from '../../data/models/universe.models';
import type { ExoplanetCatalog } from '../loaders/exoplanet-catalog';
import {
  compactDefinedValues,
  finiteCatalogValue,
  isPositiveFiniteCatalogValue,
  nonZeroCatalogValue,
} from './exoplanet-catalog-values';
import type { LabelObject } from './label-manager';

const DEFAULT_MAXIMUM_LABEL_RANK = 1_000;
const TEMPERATE_MINIMUM_KELVIN = 180;
const TEMPERATE_MAXIMUM_KELVIN = 320;
const TEMPERATE_MAXIMUM_RADIUS_EARTH = 2.5;

export interface ExoplanetCatalogPresentation {
  readonly renderableHostIndices: readonly number[];
  getSearchEntries(): readonly SearchEntry[];
  getLabelObjects(maximumRank?: number): readonly LabelObject[];
}

export function createExoplanetCatalogPresentation(
  catalog: ExoplanetCatalog,
  hostObjectIds: readonly string[],
  planetObjectIds: readonly string[],
  linkedObjectIds: ReadonlySet<string>,
): ExoplanetCatalogPresentation {
  const renderableHostIndices = createRenderableHostIndices(
    catalog,
    hostObjectIds,
    linkedObjectIds,
  );
  let searchEntries: readonly SearchEntry[] | null = null;

  return {
    renderableHostIndices,
    getSearchEntries: () => {
      searchEntries ??= createSearchEntries(
        catalog,
        hostObjectIds,
        planetObjectIds,
        linkedObjectIds,
      );

      return searchEntries;
    },
    getLabelObjects: (maximumRank = DEFAULT_MAXIMUM_LABEL_RANK) =>
      createLabelObjects(catalog, hostObjectIds, renderableHostIndices, maximumRank),
  };
}

function createSearchEntries(
  catalog: ExoplanetCatalog,
  hostObjectIds: readonly string[],
  planetObjectIds: readonly string[],
  linkedObjectIds: ReadonlySet<string>,
): readonly SearchEntry[] {
  return [
    ...catalog.hostNames.flatMap((_, index) =>
      linkedObjectIds.has(hostObjectIds[index]!)
        ? []
        : [createHostSearchEntry(catalog, hostObjectIds, index)],
    ),
    ...catalog.planetNames.flatMap((_, index) =>
      linkedObjectIds.has(planetObjectIds[index]!)
        ? []
        : [createPlanetSearchEntry(catalog, planetObjectIds, index)],
    ),
  ];
}

function createHostSearchEntry(
  catalog: ExoplanetCatalog,
  hostObjectIds: readonly string[],
  index: number,
): SearchEntry {
  return {
    id: hostObjectIds[index]!,
    name: catalog.hostNames[index]!,
    aliases: catalog.hostAliases[index]!,
    type: 'star',
    parentName: 'Voie lactée',
    keywords: ['NASA Exoplanet Archive', 'étoile hôte', 'exoplanète'],
    metadata: compactDefinedValues({
      exoplanetHost: true,
      distanceParsec: finiteCatalogValue(catalog.hostDistancesParsec[index]!),
      planetCount: catalog.hostPlanetCounts[index]!,
    }),
  };
}

function createPlanetSearchEntry(
  catalog: ExoplanetCatalog,
  planetObjectIds: readonly string[],
  index: number,
): SearchEntry {
  const hostIndex = catalog.planetHostIndices[index]!;
  const radius = catalog.planetRadiiEarth[index]!;
  const temperature = catalog.planetEquilibriumTemperaturesKelvin[index]!;
  const method = catalog.planetDiscoveryMethods[index]!;

  return {
    id: planetObjectIds[index]!,
    name: catalog.planetNames[index]!,
    aliases: [],
    type: 'exoplanet',
    parentName: catalog.hostNames[hostIndex]!,
    keywords: ['NASA Exoplanet Archive', 'exoplanète confirmée', method],
    metadata: compactDefinedValues({
      distanceParsec: finiteCatalogValue(catalog.hostDistancesParsec[hostIndex]!),
      radiusEarth: roundedFiniteValue(radius),
      discoveryMethod: method,
      discoveryYear: nonZeroCatalogValue(catalog.planetDiscoveryYears[index]!),
      temperateCandidate: isTemperateCandidate(radius, temperature),
      controversial: catalog.planetControversialFlags[index] === 1,
    }),
  };
}

function createRenderableHostIndices(
  catalog: ExoplanetCatalog,
  hostObjectIds: readonly string[],
  linkedObjectIds: ReadonlySet<string>,
): readonly number[] {
  return Array.from({ length: catalog.hostCount }, (_, index) => index)
    .filter((index) => !linkedObjectIds.has(hostObjectIds[index]!))
    .sort((left, right) => compareHostRank(catalog, left, right));
}

function createLabelObjects(
  catalog: ExoplanetCatalog,
  hostObjectIds: readonly string[],
  renderableHostIndices: readonly number[],
  maximumRank: number,
): readonly LabelObject[] {
  const limit = Math.min(renderableHostIndices.length, Math.max(0, Math.floor(maximumRank)));

  return renderableHostIndices.slice(0, limit).map((hostIndex, rank) => ({
    id: hostObjectIds[hostIndex]!,
    name: catalog.hostNames[hostIndex]!,
    type: 'star' as const,
    metadata: {
      exoplanetHost: true,
      exoplanetHostRank: rank,
      planetCount: catalog.hostPlanetCounts[hostIndex]!,
      ...(finiteMetadata('distanceParsec', catalog.hostDistancesParsec[hostIndex]!) ?? {}),
    },
  }));
}

function compareHostRank(catalog: ExoplanetCatalog, left: number, right: number): number {
  const leftDistance = finiteOrInfinity(catalog.hostDistancesParsec[left]!);
  const rightDistance = finiteOrInfinity(catalog.hostDistancesParsec[right]!);
  const leftMagnitude = finiteOrInfinity(catalog.hostApparentMagnitudes[left]!);
  const rightMagnitude = finiteOrInfinity(catalog.hostApparentMagnitudes[right]!);

  return (
    leftDistance - rightDistance ||
    leftMagnitude - rightMagnitude ||
    catalog.hostNames[left]!.localeCompare(catalog.hostNames[right]!)
  );
}

function isTemperateCandidate(radiusEarth: number, temperatureKelvin: number): boolean {
  return (
    isPositiveFiniteCatalogValue(radiusEarth) &&
    radiusEarth <= TEMPERATE_MAXIMUM_RADIUS_EARTH &&
    temperatureKelvin >= TEMPERATE_MINIMUM_KELVIN &&
    temperatureKelvin <= TEMPERATE_MAXIMUM_KELVIN
  );
}

function finiteMetadata(key: string, value: number): Readonly<Record<string, number>> | undefined {
  return Number.isFinite(value) ? { [key]: value } : undefined;
}

function roundedFiniteValue(value: number): number | undefined {
  return Number.isFinite(value) ? Math.round(value * 1_000_000) / 1_000_000 : undefined;
}

function finiteOrInfinity(value: number): number {
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}
