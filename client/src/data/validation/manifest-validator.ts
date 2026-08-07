import type { DatasetManifest } from '../models/universe.models';
import { isRecord } from './validation-primitives';

export function parseManifest(value: unknown): DatasetManifest {
  if (
    !isRecord(value) ||
    typeof value['version'] !== 'string' ||
    !Array.isArray(value['datasets'])
  ) {
    throw new Error('Manifest de données invalide.');
  }

  const datasets: DatasetManifest['datasets'] = value['datasets'].map((entry, index) => {
    const datasetType = isRecord(entry) ? entry['type'] : undefined;

    if (
      !isRecord(entry) ||
      typeof entry['id'] !== 'string' ||
      typeof entry['url'] !== 'string' ||
      (datasetType !== 'json' &&
        datasetType !== 'binary' &&
        datasetType !== 'space-tile-index' &&
        datasetType !== 'constellation-lines' &&
        datasetType !== 'star-tile-index' &&
        datasetType !== 'cosmic-group-catalog' &&
        datasetType !== 'cosmic-structure-catalog' &&
        datasetType !== 'cosmic-web-volume' &&
        datasetType !== 'tempel-filament-spine-catalog' &&
        datasetType !== 'exoplanet-catalog')
    ) {
      throw new Error(`Entrée de manifest invalide à l’index ${index}.`);
    }

    if (datasetType === 'binary') {
      if (entry['format'] !== 'star-catalog-v2') {
        throw new Error(`Format binaire invalide à l’index ${index}.`);
      }

      return {
        id: entry['id'],
        url: entry['url'],
        type: 'binary',
        format: entry['format'],
      };
    }

    if (datasetType === 'space-tile-index') {
      if (entry['format'] !== 'space-tiles-v1' && entry['format'] !== 'space-tiles-v2') {
        throw new Error(`Format de tuiles invalide à l’index ${index}.`);
      }

      return {
        id: entry['id'],
        url: entry['url'],
        type: 'space-tile-index',
        format: entry['format'],
      };
    }

    if (datasetType === 'constellation-lines') {
      if (entry['format'] !== 'constellation-lines-v1') {
        throw new Error(`Format de constellations invalide à l’index ${index}.`);
      }

      return {
        id: entry['id'],
        url: entry['url'],
        type: 'constellation-lines',
        format: entry['format'],
      };
    }

    if (datasetType === 'star-tile-index') {
      if (entry['format'] !== 'star-tiles-v2') {
        throw new Error(`Format de tuiles stellaires invalide à l’index ${index}.`);
      }
      if (typeof entry['starCatalogId'] !== 'string') {
        throw new Error(`Catalogue stellaire manquant à l’index ${index}.`);
      }

      return {
        id: entry['id'],
        url: entry['url'],
        type: 'star-tile-index',
        format: entry['format'],
        starCatalogId: entry['starCatalogId'],
      };
    }

    if (datasetType === 'cosmic-group-catalog') {
      if (entry['format'] !== 'cosmicflows4-group-catalog-v2') {
        throw new Error(`Format de groupes cosmiques invalide à l’index ${index}.`);
      }

      return {
        id: entry['id'],
        url: entry['url'],
        type: 'cosmic-group-catalog',
        format: entry['format'],
      };
    }

    if (datasetType === 'cosmic-structure-catalog') {
      if (entry['format'] !== 'cosmic-structure-catalog-v1') {
        throw new Error(`Format de structures cosmiques invalide à l’index ${index}.`);
      }
      if (typeof entry['metadataUrl'] !== 'string') {
        throw new Error(`Métadonnées de structures cosmiques manquantes à l’index ${index}.`);
      }

      return {
        id: entry['id'],
        url: entry['url'],
        metadataUrl: entry['metadataUrl'],
        type: 'cosmic-structure-catalog',
        format: entry['format'],
      };
    }

    if (datasetType === 'cosmic-web-volume') {
      if (entry['format'] !== 'cosmic-web-volume-v1') {
        throw new Error(`Format de volume cosmique invalide à l’index ${index}.`);
      }

      return {
        id: entry['id'],
        url: entry['url'],
        type: 'cosmic-web-volume',
        format: entry['format'],
      };
    }

    if (datasetType === 'tempel-filament-spine-catalog') {
      if (entry['format'] !== 'tempel-filament-spines-v1') {
        throw new Error(`Format d’épines Tempel invalide à l’index ${index}.`);
      }

      return {
        id: entry['id'],
        url: entry['url'],
        type: 'tempel-filament-spine-catalog',
        format: entry['format'],
      };
    }

    if (datasetType === 'exoplanet-catalog') {
      if (entry['format'] !== 'exoplanet-catalog-v1') {
        throw new Error(`Format de catalogue d’exoplanètes invalide à l’index ${index}.`);
      }
      if (typeof entry['metadataUrl'] !== 'string') {
        throw new Error(`Métadonnées d’exoplanètes manquantes à l’index ${index}.`);
      }

      return {
        id: entry['id'],
        url: entry['url'],
        metadataUrl: entry['metadataUrl'],
        type: 'exoplanet-catalog',
        format: entry['format'],
      };
    }

    return {
      id: entry['id'],
      url: entry['url'],
      type: 'json',
    };
  });

  return { version: value['version'], datasets };
}
