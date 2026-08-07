import type { SpaceObject } from '../../../data/models/universe.models';
import type { AppContent } from '../../core/i18n/i18n.service';

export interface ObjectDetailsOrbitPresentationContext {
  readonly content: () => AppContent;
  readonly formatNumber: (value: number, maximumFractionDigits?: number) => string;
  readonly interpolate: (
    template: string,
    values: Readonly<Record<string, string | number>>,
  ) => string;
  readonly parentName: (object: SpaceObject) => string | null;
}

export interface ObjectDetailsOrbitPresentation {
  readonly hasOrbit: (object: SpaceObject) => boolean;
  readonly orbitPeriodLabel: (object: SpaceObject) => string | null;
  readonly rotationPeriodLabel: (object: SpaceObject) => string | null;
  readonly rotationDirectionLabel: (object: SpaceObject) => string;
  readonly orbitActionLabel: (object: SpaceObject) => string;
  readonly hasIllustrativeOrbit: (object: SpaceObject) => boolean;
  readonly orbitApproximationNote: (object: SpaceObject) => string;
  readonly mapDistanceNotice: (object: SpaceObject) => string | null;
  readonly equilibriumTemperatureLabel: (object: SpaceObject) => string | null;
  readonly discoveryYearLabel: (object: SpaceObject) => string | null;
  readonly massProvenanceLabel: (object: SpaceObject) => string | null;
  readonly semiMajorAxisLabel: (object: SpaceObject) => string | null;
}

export function createObjectDetailsOrbitPresentation(
  context: ObjectDetailsOrbitPresentationContext,
): ObjectDetailsOrbitPresentation {
  return {
    hasOrbit(object: SpaceObject): boolean {
      return Boolean(object.parentId) && hasOrbitalPeriod(object);
    },
    orbitPeriodLabel(object: SpaceObject): string | null {
      const provider = object.positionProvider;

      if (!hasOrbitalPeriodProvider(provider)) {
        return null;
      }
      const period = provider.orbitalPeriodDays;

      return period >= 730
        ? `${context.formatNumber(period / 365.25, 2)} ${context.content().common.years}`
        : `${context.formatNumber(period, 2)} ${context.content().common.days}`;
    },
    rotationPeriodLabel(object: SpaceObject): string | null {
      const periodHours = object.rotation?.siderealPeriodHours;

      if (!periodHours) {
        return null;
      }
      const absoluteHours = Math.abs(periodHours);

      if (absoluteHours >= 48) {
        return `${context.formatNumber(absoluteHours / 24, 2)} ${context.content().common.days}`;
      }
      const hours = Math.floor(absoluteHours);
      const minutes = Math.round((absoluteHours - hours) * 60);
      const common = context.content().common;

      return `${hours} ${common.hoursShort} ${minutes.toString().padStart(2, '0')} ${common.minutesShort}`;
    },
    rotationDirectionLabel(object: SpaceObject): string {
      const details = context.content().details;

      return object.rotation?.direction === 'retrograde' ? details.retrograde : details.prograde;
    },
    orbitActionLabel(object: SpaceObject): string {
      const details = context.content().details;

      return context.interpolate(details.orbitAction, {
        parent: context.parentName(object) ?? details.parentBody,
      });
    },
    hasIllustrativeOrbit(object: SpaceObject): boolean {
      return object.positionProvider.type === 'illustrative-orbit';
    },
    orbitApproximationNote(object: SpaceObject): string {
      const semiMajorAxisSource = object.metadata?.['semiMajorAxisSource'];
      const orbitalPeriodSource = object.metadata?.['orbitalPeriodSource'];
      const details = context.content().details;

      if (
        semiMajorAxisSource === 'Illustrative map spacing' &&
        orbitalPeriodSource === 'Illustrative map timing'
      ) {
        return details.orbitIllustrativeNote;
      }
      if (
        semiMajorAxisSource === 'Calculated from Kepler’s third law' ||
        orbitalPeriodSource === 'Calculated from Kepler’s third law'
      ) {
        return details.orbitCalculatedNote;
      }
      if (
        semiMajorAxisSource === 'Illustrative map spacing' ||
        orbitalPeriodSource === 'Illustrative map timing'
      ) {
        return details.orbitOneIllustrativeNote;
      }

      return details.orbitCatalogNote;
    },
    mapDistanceNotice(object: SpaceObject): string | null {
      if (object.metadata?.['mapDistanceUnavailable'] !== true) {
        return null;
      }
      const fallback = object.metadata?.['mapDistanceFallbackPc'];
      const details = context.content().details;
      const depth =
        typeof fallback === 'number' ? context.formatNumber(fallback, 0) : details.unknownDepth;

      return context.interpolate(details.mapDistanceNote, { depth });
    },
    equilibriumTemperatureLabel: (object: SpaceObject) =>
      numericMetadataLabel(object, 'equilibriumTemperatureK', 0, ' K'),
    discoveryYearLabel: (object: SpaceObject) => numericMetadataLabel(object, 'discoveryYear', 0),
    massProvenanceLabel(object: SpaceObject): string | null {
      const provenance = object.metadata?.['massProvenance'];

      if (provenance === 'M-R relationship') {
        return context.content().details.massEstimated;
      }

      return provenance === 'Mass' ? context.content().details.massMeasured : null;
    },
    semiMajorAxisLabel(object: SpaceObject): string | null {
      const semiMajorAxisAu = object.metadata?.['semiMajorAxisAu'];

      return typeof semiMajorAxisAu === 'number'
        ? `${context.formatNumber(semiMajorAxisAu, 5)} ${context.content().common.astronomicalUnit}`
        : null;
    },
  };

  function numericMetadataLabel(
    object: SpaceObject,
    key: string,
    maximumFractionDigits: number,
    suffix = '',
  ): string | null {
    const value = object.metadata?.[key];

    return typeof value === 'number'
      ? `${context.formatNumber(value, maximumFractionDigits)}${suffix}`
      : null;
  }
}

function hasOrbitalPeriod(object: SpaceObject): boolean {
  return hasOrbitalPeriodProvider(object.positionProvider);
}

function hasOrbitalPeriodProvider(
  provider: SpaceObject['positionProvider'],
): provider is Extract<SpaceObject['positionProvider'], { orbitalPeriodDays: number }> {
  return (
    provider.type === 'keplerian' ||
    provider.type === 'ephemeris' ||
    provider.type === 'illustrative-orbit'
  );
}
