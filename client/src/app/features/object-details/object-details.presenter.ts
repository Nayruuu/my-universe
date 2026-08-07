import type {
  ScientificConfidence,
  SpaceObject,
  SpaceObjectType,
} from '../../../data/models/universe.models';
import type { AppContent, AppLanguage } from '../../core/i18n/i18n.service';
import {
  createObjectDetailsCatalogPresentation,
  ObjectDetailsCatalogPresentation,
} from './object-details-catalog-presentation';
import {
  createObjectDetailsOrbitPresentation,
  ObjectDetailsOrbitPresentation,
} from './object-details-orbit-presentation';

export interface ObjectDetailsPresentationContext {
  readonly content: () => AppContent;
  readonly language: () => AppLanguage;
  readonly objects: () => readonly SpaceObject[];
  readonly formatNumber: (value: number, maximumFractionDigits?: number) => string;
  readonly objectName: (objectId: string, fallback: string) => string;
  readonly interpolate: (
    template: string,
    values: Readonly<Record<string, string | number>>,
  ) => string;
}

export type ObjectDetailsPresenter = ObjectDetailsCatalogPresentation &
  ObjectDetailsOrbitPresentation &
  ReturnType<typeof createBasePresentation>;

export function createObjectDetailsPresenter(
  context: ObjectDetailsPresentationContext,
): ObjectDetailsPresenter {
  const base = createBasePresentation(context);

  return {
    ...createObjectDetailsCatalogPresentation(context),
    ...createObjectDetailsOrbitPresentation({
      ...context,
      parentName: base.parentName,
    }),
    ...base,
  };
}

function createBasePresentation(context: ObjectDetailsPresentationContext) {
  return {
    typeLabel(type: SpaceObjectType, metadata?: SpaceObject['metadata']): string {
      const content = context.content();

      if (type === 'region' && typeof metadata?.['constellationId'] === 'string') {
        return content.objectTypes.constellation;
      }
      const specializedLabels: Partial<Record<SpaceObjectType, string>> = {
        exoplanet: content.details.confirmedExoplanet,
        moon: content.details.naturalSatellite,
        'galaxy-cluster': content.details.galaxyCluster,
        supercluster: content.details.galaxySupercluster,
        'cosmic-basin': content.details.attractionBasin,
        'cosmic-attractor': content.details.cosmicAttractor,
        'cosmic-repeller': content.details.cosmicRepeller,
        'artificial-object': content.details.astronomicalObject,
      };
      const labels = content.objectTypes as Readonly<Record<string, string>>;

      return specializedLabels[type] ?? labels[type] ?? content.objectTypes.default;
    },
    parentName(object: SpaceObject): string | null {
      if (!object.parentId) {
        return null;
      }
      const parent = context.objects().find((candidate) => candidate.id === object.parentId);

      return parent ? context.objectName(parent.id, parent.name) : null;
    },
    objectName: (object: SpaceObject): string => context.objectName(object.id, object.name),
    description(object: SpaceObject): string {
      const content = context.content();

      if (context.language() === 'fr') {
        return object.description ?? content.details.noDescription;
      }
      const source = object.metadata?.['source'];

      return context.interpolate(content.details.catalogDescription, {
        source: typeof source === 'string' ? source : content.details.defaultSource,
      });
    },
    appearanceDescription(object: SpaceObject): string | null {
      const visualSource = object.metadata?.['visualSource'];

      if (typeof visualSource !== 'string') {
        return null;
      }

      return context.language() === 'fr'
        ? visualSource
        : context.content().details.illustrativeAppearance;
    },
    confidenceLabel: (confidence: ScientificConfidence): string =>
      confidenceLabels(context.content())[confidence],
    confidenceDescription: (confidence: ScientificConfidence): string =>
      confidenceDescriptions(context.content())[confidence],
    isApproximate: (confidence: ScientificConfidence): boolean =>
      confidence !== 'observed' && confidence !== 'calculated',
    formatNumber: (value: number, maximumFractionDigits = 1): string =>
      context.formatNumber(value, maximumFractionDigits),
    shapeDimensionsLabel(object: SpaceObject): string | null {
      const dimensions = object.physical?.shape?.dimensionsKm;

      return dimensions
        ? `${dimensions.map((dimension) => context.formatNumber(dimension, 2)).join(' × ')} km`
        : null;
    },
    blackHoleActivityLabel(object: SpaceObject): string | null {
      if (object.type !== 'black-hole') {
        return null;
      }
      const details = context.content().details;
      const labels = {
        dormant: details.blackHoleDormant,
        quiescent: details.blackHoleQuiescent,
        active: details.blackHoleActive,
      } as const;
      const activity = object.visual.blackHoleActivity;

      return activity ? labels[activity] : null;
    },
    supernovaEventLabel: (object: SpaceObject): string | null =>
      stringMetadata(object, 'eventDateLabel'),
    supernovaTypeLabel: (object: SpaceObject): string | null =>
      stringMetadata(object, 'supernovaType'),
    hasSupernovaEvent: (object: SpaceObject): boolean =>
      typeof object.metadata?.['visualPeakJulianDay'] === 'number',
    hasIllustrativeAppearance: (object: SpaceObject): boolean =>
      object.metadata?.['appearanceConfidence'] === 'illustrative',
    constellationAbbreviationLabel: (object: SpaceObject): string | null =>
      stringMetadata(object, 'abbreviation'),
    constellationStarCountLabel: (object: SpaceObject): string | null =>
      formattedMetadataNumber(context, object, 'starCount'),
    constellationSegmentCountLabel: (object: SpaceObject): string | null =>
      formattedMetadataNumber(context, object, 'segmentCount'),
  };
}

function confidenceLabels(content: AppContent): Readonly<Record<ScientificConfidence, string>> {
  const details = content.details;

  return {
    observed: details.confidenceObserved,
    calculated: details.confidenceCalculated,
    extrapolated: details.confidenceExtrapolated,
    simulated: details.confidenceSimulated,
    procedural: details.confidenceProcedural,
    illustrative: details.confidenceIllustrative,
  };
}

function confidenceDescriptions(
  content: AppContent,
): Readonly<Record<ScientificConfidence, string>> {
  const details = content.details;

  return {
    observed: details.confidenceObservedDescription,
    calculated: details.confidenceCalculatedDescription,
    extrapolated: details.confidenceExtrapolatedDescription,
    simulated: details.confidenceSimulatedDescription,
    procedural: details.confidenceProceduralDescription,
    illustrative: details.confidenceIllustrativeDescription,
  };
}

function stringMetadata(object: SpaceObject, key: string): string | null {
  const value = object.metadata?.[key];

  return typeof value === 'string' ? value : null;
}

function formattedMetadataNumber(
  context: ObjectDetailsPresentationContext,
  object: SpaceObject,
  key: string,
): string | null {
  const value = object.metadata?.[key];

  return typeof value === 'number' ? context.formatNumber(value, 0) : null;
}
