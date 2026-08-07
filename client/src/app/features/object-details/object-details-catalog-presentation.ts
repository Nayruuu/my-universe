import type { SpaceObject } from '../../../data/models/universe.models';
import type { AppContent } from '../../core/i18n/i18n.service';

export interface ObjectDetailsCatalogPresentationContext {
  readonly content: () => AppContent;
  readonly formatNumber: (value: number, maximumFractionDigits?: number) => string;
}

export interface ObjectDetailsCatalogPresentation {
  readonly distanceLabel: (object: SpaceObject) => string | null;
  readonly apparentMagnitudeLabel: (object: SpaceObject) => string | null;
  readonly colorIndexLabel: (object: SpaceObject) => string | null;
  readonly catalogIdentifierLabel: (object: SpaceObject) => string | null;
  readonly effectiveRadiusLabel: (object: SpaceObject) => string | null;
  readonly structureLengthLabel: (object: SpaceObject) => string | null;
  readonly memberGalaxyCountLabel: (object: SpaceObject) => string | null;
  readonly catalogConfidenceLabel: (object: SpaceObject) => string | null;
  readonly catalogConfidenceMeaningLabel: (object: SpaceObject) => string | null;
  readonly extentMeaningLabel: (object: SpaceObject) => string | null;
  readonly densityContrastLabel: (object: SpaceObject) => string | null;
  readonly boundaryDistanceLabel: (object: SpaceObject) => string | null;
  readonly detectionMethodLabel: (object: SpaceObject) => string | null;
  readonly surveyEdgeLabel: (object: SpaceObject) => string | null;
  readonly distanceUncertaintyLabel: (object: SpaceObject) => string | null;
  readonly cmbVelocityLabel: (object: SpaceObject) => string | null;
  readonly morphologyLabel: (object: SpaceObject) => string | null;
  readonly diameterLabel: (object: SpaceObject) => string | null;
  readonly subgroupLabel: (object: SpaceObject) => string | null;
  readonly absoluteMagnitudeLabel: (object: SpaceObject) => string | null;
  readonly halfLightRadiusLabel: (object: SpaceObject) => string | null;
  readonly massSolarLabel: (object: SpaceObject) => string | null;
}

export function createObjectDetailsCatalogPresentation(
  context: ObjectDetailsCatalogPresentationContext,
): ObjectDetailsCatalogPresentation {
  const formatNumber = context.formatNumber;

  return {
    distanceLabel: (object) => {
      const distanceMpc = numberMetadata(object, 'distanceMpc');

      if (distanceMpc !== null) {
        return `${formatNumber(distanceMpc, 3)} Mpc`;
      }
      const distanceLy = numberMetadata(object, 'distanceLy');

      if (distanceLy !== null) {
        return `${formatNumber(distanceLy, 3)} ${context.content().common.lightYear}`;
      }
      const semiMajorAxisAu = numberMetadata(object, 'semiMajorAxisAu');

      if (semiMajorAxisAu !== null) {
        return `${formatNumber(semiMajorAxisAu, 3)} ${context.content().common.astronomicalUnit}`;
      }
      const semiMajorAxisKm = numberMetadata(object, 'semiMajorAxisKm');

      if (semiMajorAxisKm !== null) {
        return `${formatNumber(semiMajorAxisKm, 0)} km`;
      }

      return object.id === 'sun' ? context.content().details.distanceFromEarth : null;
    },
    apparentMagnitudeLabel: (object) => formattedNumber(object, 'apparentMagnitude', 2),
    colorIndexLabel: (object) => formattedNumber(object, 'colorIndexBv', 3),
    catalogIdentifierLabel: (object) => {
      const hygId = numberMetadata(object, 'hygId');

      if (hygId !== null) {
        return `HYG ${hygId}`;
      }
      const pgcId = numberMetadata(object, 'pgcId');

      return pgcId !== null ? `PGC ${pgcId}` : stringMetadata(object, 'catalogIdentifier');
    },
    effectiveRadiusLabel: (object) => distanceMpcLabel(object, 'effectiveRadiusMpc', 2),
    structureLengthLabel: (object) => distanceMpcLabel(object, 'lengthMpc', 2),
    memberGalaxyCountLabel: (object) => formattedNumber(object, 'memberGalaxyCount', 0),
    catalogConfidenceLabel: (object) => {
      const confidence = numberMetadata(object, 'catalogConfidence');

      return confidence === null ? null : `${formatNumber(confidence * 100, 1)} %`;
    },
    catalogConfidenceMeaningLabel: (object) => stringMetadata(object, 'catalogConfidenceMeaning'),
    extentMeaningLabel: (object) => stringMetadata(object, 'extentMeaning'),
    densityContrastLabel: (object) => {
      const contrast = numberMetadata(object, 'densityContrast');

      return contrast === null ? null : `${formatNumber(contrast * 100, 1).replace('-', '−')} %`;
    },
    boundaryDistanceLabel: (object) => distanceMpcLabel(object, 'boundaryDistanceMpc', 2),
    detectionMethodLabel: (object) => stringMetadata(object, 'detectionMethod'),
    surveyEdgeLabel: (object) => {
      const surveyEdge = object.metadata?.['surveyEdge'];

      if (typeof surveyEdge !== 'boolean') {
        return null;
      }

      return surveyEdge
        ? context.content().details.surveyEdge
        : context.content().details.surveyInside;
    },
    distanceUncertaintyLabel: (object) => {
      const uncertainty = numberMetadata(object, 'distanceModulusError');

      return uncertainty === null ? null : `± ${formatNumber(uncertainty, 3)} mag`;
    },
    cmbVelocityLabel: (object) => {
      const velocity = numberMetadata(object, 'velocityCmbKmPerSecond');

      return velocity === null ? null : `${formatNumber(velocity, 0)} km/s`;
    },
    morphologyLabel: (object) => stringMetadata(object, 'morphology'),
    diameterLabel: (object) => {
      const diameterLy = numberMetadata(object, 'diameterLy');

      return diameterLy === null
        ? null
        : `${formatNumber(diameterLy, 3)} ${context.content().common.lightYear}`;
    },
    subgroupLabel: (object) => stringMetadata(object, 'subgroup'),
    absoluteMagnitudeLabel: (object) => {
      const magnitude = numberMetadata(object, 'absoluteMagnitude');

      return magnitude === null ? null : formatNumber(magnitude, 2).replace('-', '−');
    },
    halfLightRadiusLabel: (object) => {
      const radiusPc = numberMetadata(object, 'halfLightRadiusPc');

      return radiusPc === null ? null : `${formatNumber(radiusPc, 0)} pc`;
    },
    massSolarLabel: (object) => {
      const massSolar = numberMetadata(object, 'massSolar');

      return massSolar === null
        ? null
        : `${formatNumber(massSolar, 2)} ${context.content().common.solarMasses}`;
    },
  };

  function formattedNumber(
    object: SpaceObject,
    key: string,
    maximumFractionDigits: number,
  ): string | null {
    const value = numberMetadata(object, key);

    return value === null ? null : formatNumber(value, maximumFractionDigits);
  }

  function distanceMpcLabel(
    object: SpaceObject,
    key: string,
    maximumFractionDigits: number,
  ): string | null {
    const distance = numberMetadata(object, key);

    return distance === null ? null : `${formatNumber(distance, maximumFractionDigits)} Mpc`;
  }
}

function numberMetadata(object: SpaceObject, key: string): number | null {
  const value = object.metadata?.[key];

  return typeof value === 'number' ? value : null;
}

function stringMetadata(object: SpaceObject, key: string): string | null {
  const value = object.metadata?.[key];

  return typeof value === 'string' ? value : null;
}
