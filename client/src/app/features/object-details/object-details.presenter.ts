import type {
  ScientificConfidence,
  SpaceObject,
  SpaceObjectType,
} from '../../../data/models/universe.models';
import type { AppContent, AppLanguage } from '../../core/i18n/i18n.service';

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

export class ObjectDetailsPresenter {
  constructor(private readonly context: ObjectDetailsPresentationContext) {}

  public hasOrbit(object: SpaceObject): boolean {
    return (
      Boolean(object.parentId) &&
      (object.positionProvider.type === 'keplerian' ||
        object.positionProvider.type === 'ephemeris' ||
        object.positionProvider.type === 'illustrative-orbit')
    );
  }

  public orbitPeriodLabel(object: SpaceObject): string | null {
    const provider = object.positionProvider;

    if (
      provider.type !== 'keplerian' &&
      provider.type !== 'ephemeris' &&
      provider.type !== 'illustrative-orbit'
    ) {
      return null;
    }
    if (provider.orbitalPeriodDays >= 730) {
      return `${this.formatNumber(provider.orbitalPeriodDays / 365.25, 2)} ${this.context.content().common.years}`;
    }

    return `${this.formatNumber(provider.orbitalPeriodDays, 2)} ${this.context.content().common.days}`;
  }

  public rotationPeriodLabel(object: SpaceObject): string | null {
    const periodHours = object.rotation?.siderealPeriodHours;

    if (!periodHours) {
      return null;
    }
    const absoluteHours = Math.abs(periodHours);

    if (absoluteHours >= 48) {
      return `${this.formatNumber(absoluteHours / 24, 2)} ${this.context.content().common.days}`;
    }
    const hours = Math.floor(absoluteHours);
    const minutes = Math.round((absoluteHours - hours) * 60);
    const common = this.context.content().common;

    return `${hours} ${common.hoursShort} ${minutes.toString().padStart(2, '0')} ${common.minutesShort}`;
  }

  public rotationDirectionLabel(object: SpaceObject): string {
    const details = this.context.content().details;

    return object.rotation?.direction === 'retrograde' ? details.retrograde : details.prograde;
  }

  public orbitActionLabel(object: SpaceObject): string {
    const details = this.context.content().details;

    return this.context.interpolate(details.orbitAction, {
      parent: this.parentName(object) ?? details.parentBody,
    });
  }

  public typeLabel(type: SpaceObjectType, metadata?: SpaceObject['metadata']): string {
    const content = this.context.content();

    if (type === 'region' && typeof metadata?.['constellationId'] === 'string') {
      return content.objectTypes.constellation;
    }
    if (type === 'exoplanet') {
      return content.details.confirmedExoplanet;
    }
    if (type === 'moon') {
      return content.details.naturalSatellite;
    }
    if (type === 'galaxy-cluster') {
      return content.details.galaxyCluster;
    }
    if (type === 'supercluster') {
      return content.details.galaxySupercluster;
    }
    if (type === 'cosmic-basin') {
      return content.details.attractionBasin;
    }
    if (type === 'cosmic-attractor') {
      return content.details.cosmicAttractor;
    }
    if (type === 'cosmic-repeller') {
      return content.details.cosmicRepeller;
    }
    if (type === 'artificial-object') {
      return content.details.astronomicalObject;
    }
    const labels = content.objectTypes as Readonly<Record<string, string>>;

    return labels[type] ?? content.objectTypes.default;
  }

  public parentName(object: SpaceObject): string | null {
    if (!object.parentId) {
      return null;
    }
    const parent = this.context.objects().find((candidate) => candidate.id === object.parentId);

    return parent ? this.context.objectName(parent.id, parent.name) : null;
  }

  public objectName(object: SpaceObject): string {
    return this.context.objectName(object.id, object.name);
  }

  public description(object: SpaceObject): string {
    const content = this.context.content();

    if (this.context.language() === 'fr') {
      return object.description ?? content.details.noDescription;
    }
    const source = object.metadata?.['source'];

    return this.context.interpolate(content.details.catalogDescription, {
      source: typeof source === 'string' ? source : content.details.defaultSource,
    });
  }

  public appearanceDescription(object: SpaceObject): string | null {
    const visualSource = object.metadata?.['visualSource'];

    if (typeof visualSource !== 'string') {
      return null;
    }

    return this.context.language() === 'fr'
      ? visualSource
      : this.context.content().details.illustrativeAppearance;
  }

  public confidenceLabel(confidence: ScientificConfidence): string {
    const details = this.context.content().details;
    const labels: Readonly<Record<ScientificConfidence, string>> = {
      observed: details.confidenceObserved,
      calculated: details.confidenceCalculated,
      extrapolated: details.confidenceExtrapolated,
      simulated: details.confidenceSimulated,
      procedural: details.confidenceProcedural,
      illustrative: details.confidenceIllustrative,
    };

    return labels[confidence];
  }

  public confidenceDescription(confidence: ScientificConfidence): string {
    const details = this.context.content().details;
    const descriptions: Readonly<Record<ScientificConfidence, string>> = {
      observed: details.confidenceObservedDescription,
      calculated: details.confidenceCalculatedDescription,
      extrapolated: details.confidenceExtrapolatedDescription,
      simulated: details.confidenceSimulatedDescription,
      procedural: details.confidenceProceduralDescription,
      illustrative: details.confidenceIllustrativeDescription,
    };

    return descriptions[confidence];
  }

  public isApproximate(confidence: ScientificConfidence): boolean {
    return !['observed', 'calculated'].includes(confidence);
  }

  public hasIllustrativeOrbit(object: SpaceObject): boolean {
    return object.positionProvider.type === 'illustrative-orbit';
  }

  public orbitApproximationNote(object: SpaceObject): string {
    const semiMajorAxisSource = object.metadata?.['semiMajorAxisSource'];
    const orbitalPeriodSource = object.metadata?.['orbitalPeriodSource'];
    const details = this.context.content().details;

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
  }

  public mapDistanceNotice(object: SpaceObject): string | null {
    if (object.metadata?.['mapDistanceUnavailable'] !== true) {
      return null;
    }
    const fallback = object.metadata?.['mapDistanceFallbackPc'];
    const details = this.context.content().details;
    const depth =
      typeof fallback === 'number' ? this.formatNumber(fallback, 0) : details.unknownDepth;

    return this.context.interpolate(details.mapDistanceNote, { depth });
  }

  public equilibriumTemperatureLabel(object: SpaceObject): string | null {
    const temperature = object.metadata?.['equilibriumTemperatureK'];

    return typeof temperature === 'number' ? `${this.formatNumber(temperature, 0)} K` : null;
  }

  public discoveryYearLabel(object: SpaceObject): string | null {
    const year = object.metadata?.['discoveryYear'];

    return typeof year === 'number' ? this.formatNumber(year, 0) : null;
  }

  public massProvenanceLabel(object: SpaceObject): string | null {
    const provenance = object.metadata?.['massProvenance'];

    if (provenance === 'M-R relationship') {
      return this.context.content().details.massEstimated;
    }

    return provenance === 'Mass' ? this.context.content().details.massMeasured : null;
  }

  public semiMajorAxisLabel(object: SpaceObject): string | null {
    const semiMajorAxisAu = object.metadata?.['semiMajorAxisAu'];

    return typeof semiMajorAxisAu === 'number'
      ? `${this.formatNumber(semiMajorAxisAu, 5)} ${this.context.content().common.astronomicalUnit}`
      : null;
  }

  public formatNumber(value: number, maximumFractionDigits = 1): string {
    return this.context.formatNumber(value, maximumFractionDigits);
  }

  public distanceLabel(object: SpaceObject): string | null {
    const distanceMpc = object.metadata?.['distanceMpc'];

    if (typeof distanceMpc === 'number') {
      return `${this.formatNumber(distanceMpc, 3)} Mpc`;
    }
    const distanceLy = object.metadata?.['distanceLy'];

    if (typeof distanceLy === 'number') {
      return `${this.formatNumber(distanceLy, 3)} ${this.context.content().common.lightYear}`;
    }
    const semiMajorAxisAu = object.metadata?.['semiMajorAxisAu'];

    if (typeof semiMajorAxisAu === 'number') {
      return `${this.formatNumber(semiMajorAxisAu, 3)} ${this.context.content().common.astronomicalUnit}`;
    }
    const semiMajorAxisKm = object.metadata?.['semiMajorAxisKm'];

    if (typeof semiMajorAxisKm === 'number') {
      return `${this.formatNumber(semiMajorAxisKm, 0)} km`;
    }
    if (object.id === 'sun') {
      return this.context.content().details.distanceFromEarth;
    }

    return null;
  }

  public apparentMagnitudeLabel(object: SpaceObject): string | null {
    const magnitude = object.metadata?.['apparentMagnitude'];

    return typeof magnitude === 'number' ? this.formatNumber(magnitude, 2) : null;
  }

  public colorIndexLabel(object: SpaceObject): string | null {
    const colorIndex = object.metadata?.['colorIndexBv'];

    return typeof colorIndex === 'number' ? this.formatNumber(colorIndex, 3) : null;
  }

  public catalogIdentifierLabel(object: SpaceObject): string | null {
    const hygId = object.metadata?.['hygId'];

    if (typeof hygId === 'number') {
      return `HYG ${hygId}`;
    }
    const pgcId = object.metadata?.['pgcId'];

    if (typeof pgcId === 'number') {
      return `PGC ${pgcId}`;
    }
    const catalogIdentifier = object.metadata?.['catalogIdentifier'];

    return typeof catalogIdentifier === 'string' ? catalogIdentifier : null;
  }

  public effectiveRadiusLabel(object: SpaceObject): string | null {
    const radiusMpc = object.metadata?.['effectiveRadiusMpc'];

    return typeof radiusMpc === 'number' ? `${this.formatNumber(radiusMpc, 2)} Mpc` : null;
  }

  public structureLengthLabel(object: SpaceObject): string | null {
    const lengthMpc = object.metadata?.['lengthMpc'];

    return typeof lengthMpc === 'number' ? `${this.formatNumber(lengthMpc, 2)} Mpc` : null;
  }

  public memberGalaxyCountLabel(object: SpaceObject): string | null {
    const count = object.metadata?.['memberGalaxyCount'];

    return typeof count === 'number' ? this.formatNumber(count, 0) : null;
  }

  public catalogConfidenceLabel(object: SpaceObject): string | null {
    const confidence = object.metadata?.['catalogConfidence'];

    return typeof confidence === 'number' ? `${this.formatNumber(confidence * 100, 1)} %` : null;
  }

  public densityContrastLabel(object: SpaceObject): string | null {
    const densityContrast = object.metadata?.['densityContrast'];

    return typeof densityContrast === 'number'
      ? `${this.formatNumber(densityContrast * 100, 1).replace('-', '−')} %`
      : null;
  }

  public boundaryDistanceLabel(object: SpaceObject): string | null {
    const distanceMpc = object.metadata?.['boundaryDistanceMpc'];

    return typeof distanceMpc === 'number' ? `${this.formatNumber(distanceMpc, 2)} Mpc` : null;
  }

  public detectionMethodLabel(object: SpaceObject): string | null {
    const method = object.metadata?.['detectionMethod'];

    return typeof method === 'string' ? method : null;
  }

  public surveyEdgeLabel(object: SpaceObject): string | null {
    const surveyEdge = object.metadata?.['surveyEdge'];

    return typeof surveyEdge === 'boolean'
      ? surveyEdge
        ? this.context.content().details.surveyEdge
        : this.context.content().details.surveyInside
      : null;
  }

  public distanceUncertaintyLabel(object: SpaceObject): string | null {
    const uncertainty = object.metadata?.['distanceModulusError'];

    return typeof uncertainty === 'number' ? `± ${this.formatNumber(uncertainty, 3)} mag` : null;
  }

  public cmbVelocityLabel(object: SpaceObject): string | null {
    const velocity = object.metadata?.['velocityCmbKmPerSecond'];

    return typeof velocity === 'number' ? `${this.formatNumber(velocity, 0)} km/s` : null;
  }

  public morphologyLabel(object: SpaceObject): string | null {
    const morphology = object.metadata?.['morphology'];

    return typeof morphology === 'string' ? morphology : null;
  }

  public diameterLabel(object: SpaceObject): string | null {
    const diameterLy = object.metadata?.['diameterLy'];

    return typeof diameterLy === 'number'
      ? `${this.formatNumber(diameterLy, 3)} ${this.context.content().common.lightYear}`
      : null;
  }

  public subgroupLabel(object: SpaceObject): string | null {
    const subgroup = object.metadata?.['subgroup'];

    return typeof subgroup === 'string' ? subgroup : null;
  }

  public absoluteMagnitudeLabel(object: SpaceObject): string | null {
    const absoluteMagnitude = object.metadata?.['absoluteMagnitude'];

    return typeof absoluteMagnitude === 'number'
      ? this.formatNumber(absoluteMagnitude, 2).replace('-', '−')
      : null;
  }

  public halfLightRadiusLabel(object: SpaceObject): string | null {
    const halfLightRadiusPc = object.metadata?.['halfLightRadiusPc'];

    return typeof halfLightRadiusPc === 'number'
      ? `${this.formatNumber(halfLightRadiusPc, 0)} pc`
      : null;
  }

  public massSolarLabel(object: SpaceObject): string | null {
    const massSolar = object.metadata?.['massSolar'];

    return typeof massSolar === 'number'
      ? `${this.formatNumber(massSolar, 2)} ${this.context.content().common.solarMasses}`
      : null;
  }

  public blackHoleActivityLabel(object: SpaceObject): string | null {
    if (object.type !== 'black-hole') {
      return null;
    }
    const details = this.context.content().details;
    const labels = {
      dormant: details.blackHoleDormant,
      quiescent: details.blackHoleQuiescent,
      active: details.blackHoleActive,
    } as const;
    const activity = object.visual.blackHoleActivity;

    return activity ? labels[activity] : null;
  }

  public supernovaEventLabel(object: SpaceObject): string | null {
    const label = object.metadata?.['eventDateLabel'];

    return typeof label === 'string' ? label : null;
  }

  public supernovaTypeLabel(object: SpaceObject): string | null {
    const type = object.metadata?.['supernovaType'];

    return typeof type === 'string' ? type : null;
  }

  public hasSupernovaEvent(object: SpaceObject): boolean {
    return typeof object.metadata?.['visualPeakJulianDay'] === 'number';
  }

  public hasIllustrativeAppearance(object: SpaceObject): boolean {
    return object.metadata?.['appearanceConfidence'] === 'illustrative';
  }

  public constellationAbbreviationLabel(object: SpaceObject): string | null {
    const abbreviation = object.metadata?.['abbreviation'];

    return typeof abbreviation === 'string' ? abbreviation : null;
  }

  public constellationStarCountLabel(object: SpaceObject): string | null {
    const starCount = object.metadata?.['starCount'];

    return typeof starCount === 'number' ? this.formatNumber(starCount, 0) : null;
  }

  public constellationSegmentCountLabel(object: SpaceObject): string | null {
    const segmentCount = object.metadata?.['segmentCount'];

    return typeof segmentCount === 'number' ? this.formatNumber(segmentCount, 0) : null;
  }
}
