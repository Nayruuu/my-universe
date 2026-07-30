import {
  type ConstellationCatalog,
  type ConstellationFigure,
  type ConstellationSegment,
} from '../models/universe.models';

export function parseConstellationCatalog(value: unknown, source: string): ConstellationCatalog {
  if (!isCatalogRoot(value)) {
    throw invalidCatalog(source);
  }

  const figureIds = new Set<string>();
  const segmentIds = new Set<string>();
  const figures = value['figures'].map((figure, index) =>
    parseFigure(figure, source, index, figureIds, segmentIds),
  );

  return {
    version: value['version'],
    source: {
      name: value['source']['name'],
      url: value['source']['url'],
      license: value['source']['license'],
    },
    referenceFrame: 'equatorial-j2000',
    scientificConfidence: 'illustrative',
    starCatalog: value['starCatalog'],
    figures,
  };
}

export function assertConstellationCatalogReferences(
  catalog: ConstellationCatalog,
  catalogIds: Uint32Array,
): void {
  const availableIds = new Set(catalogIds);

  for (const figure of catalog.figures) {
    for (const segment of figure.segments) {
      for (const catalogId of segment) {
        if (!availableIds.has(catalogId)) {
          throw new Error(
            `Étoile HYG ${catalogId} absente du catalogue pour la constellation ${figure.id}.`,
          );
        }
      }
    }
  }
}

function parseFigure(
  value: unknown,
  source: string,
  index: number,
  figureIds: Set<string>,
  segmentIds: Set<string>,
): ConstellationFigure {
  if (!isFigureRoot(value)) {
    throw invalidFigure(source, index);
  }
  if (figureIds.has(value['id'])) {
    throw new Error(`Identifiant de constellation dupliqué : ${value['id']}.`);
  }
  figureIds.add(value['id']);

  const segments = value['segments'].map((segment) => {
    if (!isSegment(segment)) {
      throw invalidFigure(source, index);
    }
    const normalizedId = [...segment].sort((left, right) => left - right).join('–');

    if (segmentIds.has(normalizedId)) {
      throw new Error(`Segment de constellation dupliqué : ${normalizedId}.`);
    }
    segmentIds.add(normalizedId);

    return [segment[0], segment[1]] as const satisfies ConstellationSegment;
  });

  return {
    id: value['id'],
    name: value['name'],
    abbreviation: value['abbreviation'],
    segments,
  };
}

function isCatalogRoot(value: unknown): value is {
  version: string;
  source: { name: string; url: string; license: string };
  referenceFrame: 'equatorial-j2000';
  scientificConfidence: 'illustrative';
  starCatalog: string;
  figures: unknown[];
} {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value['version']) ||
    !isRecord(value['source']) ||
    !isNonEmptyString(value['source']['name']) ||
    !isNonEmptyString(value['source']['url']) ||
    !isNonEmptyString(value['source']['license']) ||
    value['referenceFrame'] !== 'equatorial-j2000' ||
    value['scientificConfidence'] !== 'illustrative' ||
    !isNonEmptyString(value['starCatalog']) ||
    !Array.isArray(value['figures']) ||
    value['figures'].length === 0
  ) {
    return false;
  }

  return true;
}

function isFigureRoot(value: unknown): value is {
  id: string;
  name: string;
  abbreviation: string;
  segments: unknown[];
} {
  return (
    isRecord(value) &&
    isNonEmptyString(value['id']) &&
    isNonEmptyString(value['name']) &&
    isNonEmptyString(value['abbreviation']) &&
    value['abbreviation'].length === 3 &&
    Array.isArray(value['segments']) &&
    value['segments'].length > 0
  );
}

function isSegment(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((catalogId) => Number.isInteger(catalogId) && catalogId > 0) &&
    value[0] !== value[1]
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function invalidCatalog(source: string): Error {
  return new Error(`Catalogue de constellations invalide : ${source}.`);
}

function invalidFigure(source: string, index: number): Error {
  return new Error(`Figure de constellation invalide dans ${source}, index ${index}.`);
}
