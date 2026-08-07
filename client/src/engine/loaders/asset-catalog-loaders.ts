import type { ConstellationCatalog, SpaceTileIndex } from '../../data/models/universe.models';
import { parseConstellationCatalog } from '../../data/validation/constellation-catalog';
import { parseSpaceTileIndex } from '../../data/validation/space-tile-index';
import { parseCosmicGroupCatalog, type CosmicGroupCatalog } from './cosmic-group-catalog';
import {
  parseCosmicStructureCatalog,
  parseCosmicStructureCatalogMetadata,
  type CosmicStructureCatalog,
} from './cosmic-structure-catalog';
import { parseCosmicWebVolume, type CosmicWebVolume } from './cosmic-web-volume';
import {
  parseExoplanetCatalog,
  parseExoplanetCatalogMetadata,
  type ExoplanetCatalog,
} from './exoplanet-catalog';
import { parseStarCatalog, type StarCatalog } from './star-catalog';

export interface OptionalAssetResult<T> {
  readonly value: T | null;
  readonly warnings: readonly string[];
}

export interface OptionalBinaryAssetOptions<T> {
  readonly datasetId: string;
  readonly url: string;
  readonly warningLabel: string;
  readonly parse: (buffer: ArrayBuffer) => T;
}

export async function loadOptionalBinaryAsset<T>(
  options: OptionalBinaryAssetOptions<T>,
): Promise<OptionalAssetResult<T>> {
  try {
    const response = await fetch(options.url);

    if (!response.ok) {
      throw unavailable(options.datasetId, response.status);
    }

    return { value: options.parse(await response.arrayBuffer()), warnings: [] };
  } catch (error) {
    return optionalFailure(options.warningLabel, error);
  }
}

export function loadOptionalStarCatalog(
  datasetId: string,
  url: string,
): Promise<OptionalAssetResult<StarCatalog>> {
  return loadOptionalBinaryAsset({
    datasetId,
    url,
    warningLabel: 'Catalogue stellaire dense indisponible',
    parse: parseStarCatalog,
  });
}

export function loadOptionalCosmicGroupCatalog(
  datasetId: string,
  url: string,
): Promise<OptionalAssetResult<CosmicGroupCatalog>> {
  return loadOptionalBinaryAsset({
    datasetId,
    url,
    warningLabel: 'Catalogue de groupes cosmiques indisponible',
    parse: parseCosmicGroupCatalog,
  });
}

export function loadOptionalCosmicWebVolume(
  datasetId: string,
  url: string,
): Promise<OptionalAssetResult<CosmicWebVolume>> {
  return loadOptionalBinaryAsset({
    datasetId,
    url,
    warningLabel: 'Volume du réseau cosmique indisponible',
    parse: parseCosmicWebVolume,
  });
}

export async function loadOptionalCosmicStructureCatalog(
  datasetId: string,
  url: string,
  metadataUrl: string,
): Promise<OptionalAssetResult<CosmicStructureCatalog>> {
  return loadOptionalMetadataBinaryAsset({
    datasetId,
    url,
    metadataUrl,
    warningLabel: 'Catalogue de structures cosmiques indisponible',
    parseMetadata: parseCosmicStructureCatalogMetadata,
    parse: parseCosmicStructureCatalog,
  });
}

export async function loadOptionalExoplanetCatalog(
  datasetId: string,
  url: string,
  metadataUrl: string,
): Promise<OptionalAssetResult<ExoplanetCatalog>> {
  return loadOptionalMetadataBinaryAsset({
    datasetId,
    url,
    metadataUrl,
    warningLabel: 'Catalogue d’exoplanètes indisponible',
    parseMetadata: parseExoplanetCatalogMetadata,
    parse: parseExoplanetCatalog,
  });
}

export async function loadConstellationCatalog(
  datasetId: string,
  url: string,
): Promise<ConstellationCatalog> {
  const response = await fetchRequired(datasetId, url);

  return parseConstellationCatalog(await response.json(), datasetId);
}

export async function loadSpaceTileIndex(datasetId: string, url: string): Promise<SpaceTileIndex> {
  const response = await fetchRequired(datasetId, url);

  return parseSpaceTileIndex(await response.json(), datasetId);
}

interface OptionalMetadataBinaryAssetOptions<TMetadata, TValue> {
  readonly datasetId: string;
  readonly url: string;
  readonly metadataUrl: string;
  readonly warningLabel: string;
  readonly parseMetadata: (value: unknown, source: string) => TMetadata;
  readonly parse: (buffer: ArrayBuffer, metadata: TMetadata) => TValue;
}

async function loadOptionalMetadataBinaryAsset<TMetadata, TValue>(
  options: OptionalMetadataBinaryAssetOptions<TMetadata, TValue>,
): Promise<OptionalAssetResult<TValue>> {
  try {
    const metadataResponse = await fetch(options.metadataUrl);

    if (!metadataResponse.ok) {
      throw new Error(
        `Impossible de charger les métadonnées ${options.datasetId} (${metadataResponse.status}).`,
      );
    }
    const metadata = options.parseMetadata(await metadataResponse.json(), options.datasetId);
    const response = await fetchRequired(options.datasetId, options.url);

    return { value: options.parse(await response.arrayBuffer(), metadata), warnings: [] };
  } catch (error) {
    return optionalFailure(options.warningLabel, error);
  }
}

async function fetchRequired(datasetId: string, url: string): Promise<Response> {
  const response = await fetch(url);

  if (!response.ok) {
    throw unavailable(datasetId, response.status);
  }

  return response;
}

function optionalFailure<T>(warningLabel: string, error: unknown): OptionalAssetResult<T> {
  const reason = error instanceof Error ? error.message : 'erreur inconnue';

  return { value: null, warnings: [`${warningLabel} : ${reason}`] };
}

function unavailable(datasetId: string, status: number): Error {
  return new Error(`Impossible de charger ${datasetId} (${status}).`);
}
