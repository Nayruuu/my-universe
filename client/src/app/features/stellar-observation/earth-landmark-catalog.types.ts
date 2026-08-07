import type { ScientificConfidence } from '../../../data/models/universe.models';

export type EarthLandmarkScientificConfidence = Extract<
  ScientificConfidence,
  'observed' | 'illustrative'
>;

export type EarthLandmarkCategory =
  | 'architecture'
  | 'palace'
  | 'tower'
  | 'monument'
  | 'religious'
  | 'museum'
  | 'bridge'
  | 'fortification'
  | 'civic'
  | 'venue'
  | 'transport'
  | 'public-space'
  | 'illustrative-cityscape-anchor';

export type EarthLandmarkHeightConfidence = 'documented' | 'unknown' | 'illustrative';

export type EarthLandmarkSelectionMethod = 'wikimedia-geosearch' | 'geonames-illustrative-fallback';

export interface EarthLandmarkDefinition {
  readonly category: EarthLandmarkCategory;
  readonly distanceMeters: number;
  readonly heightConfidence: EarthLandmarkHeightConfidence;
  readonly heightMeters: number | null;
  readonly id: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly name: string;
  readonly scientificConfidence: EarthLandmarkScientificConfidence;
  readonly selectionMethod: EarthLandmarkSelectionMethod;
  readonly silhouettePath: string;
  readonly sourceAspectRatio: number;
  readonly sourceTitle: string;
  readonly sourceUrl: string;
  readonly sourceViewBox: string;
  readonly visualConfidence: 'illustrative';
  readonly wikidataId: string | null;
  readonly wikipediaUrl: string | null;
}

export interface EarthLandmarkManifest {
  readonly locationCount: number;
  readonly locationRegionById: ReadonlyMap<string, string>;
  readonly locationIdsByRegion: ReadonlyMap<string, readonly string[]>;
  readonly packUrlByRegion: ReadonlyMap<string, string>;
  readonly version: 1;
}

export type EarthLandmarkPack = ReadonlyMap<string, readonly EarthLandmarkDefinition[]>;

export type EarthLandmarkCatalogErrorCode =
  | 'manifest-unavailable'
  | 'manifest-invalid'
  | 'pack-unavailable'
  | 'pack-invalid'
  | 'unknown-region';

export interface EarthLandmarkCatalogErrorContext {
  readonly cause?: unknown;
  readonly regionId?: string;
  readonly status?: number;
  readonly url?: string;
}

export class EarthLandmarkCatalogError extends Error {
  public readonly code: EarthLandmarkCatalogErrorCode;
  private readonly context: EarthLandmarkCatalogErrorContext;

  constructor(
    code: EarthLandmarkCatalogErrorCode,
    message: string,
    context: EarthLandmarkCatalogErrorContext = {},
  ) {
    super(message);
    this.name = 'EarthLandmarkCatalogError';
    this.code = code;
    this.context = context;
  }

  public get contextCause(): unknown {
    return this.context.cause;
  }

  public get regionId(): string | undefined {
    return this.context.regionId;
  }

  public get status(): number | undefined {
    return this.context.status;
  }

  public get url(): string | undefined {
    return this.context.url;
  }
}

export type EarthLandmarkCatalogFetcher = (url: string) => Promise<Response>;
