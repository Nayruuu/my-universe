import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  ScientificConfidence,
  SpaceObject,
  SpaceObjectType,
} from '../../../data/models/universe.models';
import { UniverseEngineFacade } from '../../core/engine/universe-engine.facade';
import { I18nService } from '../../core/i18n/i18n.service';

@Component({
  selector: 'app-object-details',
  styleUrl: './object-details.component.scss',
  templateUrl: './object-details.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObjectDetailsComponent {
  protected readonly facade = inject(UniverseEngineFacade);
  protected readonly i18n = inject(I18nService);
  protected readonly object = this.facade.selectedObject;

  protected focus(object: SpaceObject): void {
    void this.facade.focus(object.id);
  }

  protected viewRotation(object: SpaceObject): void {
    void this.facade.viewRotation(object.id);
  }

  protected viewOrbit(object: SpaceObject): void {
    this.facade.viewOrbit(object.id);
  }

  protected viewSupernovaEvent(object: SpaceObject): void {
    const julianDay = object.metadata?.['visualPeakJulianDay'];

    if (typeof julianDay !== 'number') {
      return;
    }
    this.facade.setTime({ julianDay });
    void this.facade.focus(object.id);
  }

  protected hasOrbit(object: SpaceObject): boolean {
    return (
      Boolean(object.parentId) &&
      (object.positionProvider.type === 'keplerian' ||
        object.positionProvider.type === 'ephemeris' ||
        object.positionProvider.type === 'illustrative-orbit')
    );
  }

  protected orbitPeriodLabel(object: SpaceObject): string | null {
    const provider = object.positionProvider;

    if (
      provider.type !== 'keplerian' &&
      provider.type !== 'ephemeris' &&
      provider.type !== 'illustrative-orbit'
    ) {
      return null;
    }
    if (provider.orbitalPeriodDays >= 730) {
      return `${this.formatNumber(provider.orbitalPeriodDays / 365.25, 2)} ${this.i18n.content().common.years}`;
    }

    return `${this.formatNumber(provider.orbitalPeriodDays, 2)} ${this.i18n.content().common.days}`;
  }

  protected rotationPeriodLabel(object: SpaceObject): string | null {
    const periodHours = object.visual.rotationPeriodHours;

    if (!periodHours) {
      return null;
    }
    const absoluteHours = Math.abs(periodHours);

    if (absoluteHours >= 48) {
      return `${this.formatNumber(absoluteHours / 24, 2)} jours`;
    }
    const hours = Math.floor(absoluteHours);
    const minutes = Math.round((absoluteHours - hours) * 60);

    const common = this.i18n.content().common;

    return `${hours} ${common.hoursShort} ${minutes.toString().padStart(2, '0')} ${common.minutesShort}`;
  }

  protected rotationDirectionLabel(object: SpaceObject): string {
    const details = this.i18n.content().details;

    return (object.visual.rotationPeriodHours ?? 1) < 0 ? details.retrograde : details.prograde;
  }

  protected orbitActionLabel(object: SpaceObject): string {
    const details = this.i18n.content().details;

    return this.i18n.interpolate(details.orbitAction, {
      parent: this.parentName(object) ?? details.parentBody,
    });
  }

  protected typeLabel(type: SpaceObjectType, metadata?: SpaceObject['metadata']): string {
    const content = this.i18n.content();

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

  protected parentName(object: SpaceObject): string | null {
    if (!object.parentId) {
      return null;
    }
    const parent = this.facade.objects().find((candidate) => candidate.id === object.parentId);

    return parent ? this.i18n.objectName(parent.id, parent.name) : null;
  }

  protected objectName(object: SpaceObject): string {
    return this.i18n.objectName(object.id, object.name);
  }

  protected description(object: SpaceObject): string {
    const content = this.i18n.content();

    if (this.i18n.lang() === 'fr') {
      return object.description ?? content.details.noDescription;
    }
    const source = object.metadata?.['source'];

    return this.i18n.interpolate(content.details.catalogDescription, {
      source: typeof source === 'string' ? source : content.details.defaultSource,
    });
  }

  protected appearanceDescription(object: SpaceObject): string | null {
    const visualSource = object.metadata?.['visualSource'];

    if (typeof visualSource !== 'string') {
      return null;
    }

    return this.i18n.lang() === 'fr'
      ? visualSource
      : this.i18n.content().details.illustrativeAppearance;
  }

  protected confidenceLabel(confidence: ScientificConfidence): string {
    const details = this.i18n.content().details;
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

  protected confidenceDescription(confidence: ScientificConfidence): string {
    const details = this.i18n.content().details;
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

  protected isApproximate(confidence: ScientificConfidence): boolean {
    return !['observed', 'calculated'].includes(confidence);
  }

  protected hasIllustrativeOrbit(object: SpaceObject): boolean {
    return object.positionProvider.type === 'illustrative-orbit';
  }

  protected orbitApproximationNote(object: SpaceObject): string {
    const semiMajorAxisSource = object.metadata?.['semiMajorAxisSource'];
    const orbitalPeriodSource = object.metadata?.['orbitalPeriodSource'];
    const details = this.i18n.content().details;

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

  protected mapDistanceNotice(object: SpaceObject): string | null {
    if (object.metadata?.['mapDistanceUnavailable'] !== true) {
      return null;
    }
    const fallback = object.metadata?.['mapDistanceFallbackPc'];
    const details = this.i18n.content().details;
    const depth =
      typeof fallback === 'number' ? this.formatNumber(fallback, 0) : details.unknownDepth;

    return this.i18n.interpolate(details.mapDistanceNote, { depth });
  }

  protected equilibriumTemperatureLabel(object: SpaceObject): string | null {
    const temperature = object.metadata?.['equilibriumTemperatureK'];

    return typeof temperature === 'number' ? `${this.formatNumber(temperature, 0)} K` : null;
  }

  protected discoveryYearLabel(object: SpaceObject): string | null {
    const year = object.metadata?.['discoveryYear'];

    return typeof year === 'number' ? this.formatNumber(year, 0) : null;
  }

  protected massProvenanceLabel(object: SpaceObject): string | null {
    const provenance = object.metadata?.['massProvenance'];

    if (provenance === 'M-R relationship') {
      return this.i18n.content().details.massEstimated;
    }

    return provenance === 'Mass' ? this.i18n.content().details.massMeasured : null;
  }

  protected semiMajorAxisLabel(object: SpaceObject): string | null {
    const semiMajorAxisAu = object.metadata?.['semiMajorAxisAu'];

    return typeof semiMajorAxisAu === 'number'
      ? `${this.formatNumber(semiMajorAxisAu, 5)} ${this.i18n.content().common.astronomicalUnit}`
      : null;
  }

  protected formatNumber(value: number, maximumFractionDigits = 1): string {
    return this.i18n.formatNumber(value, maximumFractionDigits);
  }

  protected distanceLabel(object: SpaceObject): string | null {
    const distanceMpc = object.metadata?.['distanceMpc'];

    if (typeof distanceMpc === 'number') {
      return `${this.formatNumber(distanceMpc, 3)} Mpc`;
    }
    const distanceLy = object.metadata?.['distanceLy'];

    if (typeof distanceLy === 'number') {
      return `${this.formatNumber(distanceLy, 3)} ${this.i18n.content().common.lightYear}`;
    }
    const semiMajorAxisAu = object.metadata?.['semiMajorAxisAu'];

    if (typeof semiMajorAxisAu === 'number') {
      return `${this.formatNumber(semiMajorAxisAu, 3)} ${this.i18n.content().common.astronomicalUnit}`;
    }
    const semiMajorAxisKm = object.metadata?.['semiMajorAxisKm'];

    if (typeof semiMajorAxisKm === 'number') {
      return `${this.formatNumber(semiMajorAxisKm, 0)} km`;
    }
    if (object.id === 'sun') {
      return this.i18n.content().details.distanceFromEarth;
    }

    return null;
  }

  protected apparentMagnitudeLabel(object: SpaceObject): string | null {
    const magnitude = object.metadata?.['apparentMagnitude'];

    return typeof magnitude === 'number' ? this.formatNumber(magnitude, 2) : null;
  }

  protected colorIndexLabel(object: SpaceObject): string | null {
    const colorIndex = object.metadata?.['colorIndexBv'];

    return typeof colorIndex === 'number' ? this.formatNumber(colorIndex, 3) : null;
  }

  protected catalogIdentifierLabel(object: SpaceObject): string | null {
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

  protected effectiveRadiusLabel(object: SpaceObject): string | null {
    const radiusMpc = object.metadata?.['effectiveRadiusMpc'];

    return typeof radiusMpc === 'number' ? `${this.formatNumber(radiusMpc, 2)} Mpc` : null;
  }

  protected structureLengthLabel(object: SpaceObject): string | null {
    const lengthMpc = object.metadata?.['lengthMpc'];

    return typeof lengthMpc === 'number' ? `${this.formatNumber(lengthMpc, 2)} Mpc` : null;
  }

  protected memberGalaxyCountLabel(object: SpaceObject): string | null {
    const count = object.metadata?.['memberGalaxyCount'];

    return typeof count === 'number' ? this.formatNumber(count, 0) : null;
  }

  protected catalogConfidenceLabel(object: SpaceObject): string | null {
    const confidence = object.metadata?.['catalogConfidence'];

    return typeof confidence === 'number' ? `${this.formatNumber(confidence * 100, 1)} %` : null;
  }

  protected densityContrastLabel(object: SpaceObject): string | null {
    const densityContrast = object.metadata?.['densityContrast'];

    return typeof densityContrast === 'number'
      ? `${this.formatNumber(densityContrast * 100, 1).replace('-', '−')} %`
      : null;
  }

  protected boundaryDistanceLabel(object: SpaceObject): string | null {
    const distanceMpc = object.metadata?.['boundaryDistanceMpc'];

    return typeof distanceMpc === 'number' ? `${this.formatNumber(distanceMpc, 2)} Mpc` : null;
  }

  protected detectionMethodLabel(object: SpaceObject): string | null {
    const method = object.metadata?.['detectionMethod'];

    return typeof method === 'string' ? method : null;
  }

  protected surveyEdgeLabel(object: SpaceObject): string | null {
    const surveyEdge = object.metadata?.['surveyEdge'];

    return typeof surveyEdge === 'boolean'
      ? surveyEdge
        ? this.i18n.content().details.surveyEdge
        : this.i18n.content().details.surveyInside
      : null;
  }

  protected distanceUncertaintyLabel(object: SpaceObject): string | null {
    const uncertainty = object.metadata?.['distanceModulusError'];

    return typeof uncertainty === 'number' ? `± ${this.formatNumber(uncertainty, 3)} mag` : null;
  }

  protected cmbVelocityLabel(object: SpaceObject): string | null {
    const velocity = object.metadata?.['velocityCmbKmPerSecond'];

    return typeof velocity === 'number' ? `${this.formatNumber(velocity, 0)} km/s` : null;
  }

  protected morphologyLabel(object: SpaceObject): string | null {
    const morphology = object.metadata?.['morphology'];

    return typeof morphology === 'string' ? morphology : null;
  }

  protected diameterLabel(object: SpaceObject): string | null {
    const diameterLy = object.metadata?.['diameterLy'];

    return typeof diameterLy === 'number'
      ? `${this.formatNumber(diameterLy, 3)} ${this.i18n.content().common.lightYear}`
      : null;
  }

  protected subgroupLabel(object: SpaceObject): string | null {
    const subgroup = object.metadata?.['subgroup'];

    return typeof subgroup === 'string' ? subgroup : null;
  }

  protected absoluteMagnitudeLabel(object: SpaceObject): string | null {
    const absoluteMagnitude = object.metadata?.['absoluteMagnitude'];

    return typeof absoluteMagnitude === 'number'
      ? this.formatNumber(absoluteMagnitude, 2).replace('-', '−')
      : null;
  }

  protected halfLightRadiusLabel(object: SpaceObject): string | null {
    const halfLightRadiusPc = object.metadata?.['halfLightRadiusPc'];

    return typeof halfLightRadiusPc === 'number'
      ? `${this.formatNumber(halfLightRadiusPc, 0)} pc`
      : null;
  }

  protected massSolarLabel(object: SpaceObject): string | null {
    const massSolar = object.metadata?.['massSolar'];

    return typeof massSolar === 'number'
      ? `${this.formatNumber(massSolar, 2)} ${this.i18n.content().common.solarMasses}`
      : null;
  }

  protected blackHoleActivityLabel(object: SpaceObject): string | null {
    if (object.type !== 'black-hole') {
      return null;
    }
    const details = this.i18n.content().details;
    const labels = {
      dormant: details.blackHoleDormant,
      quiescent: details.blackHoleQuiescent,
      active: details.blackHoleActive,
    } as const;
    const activity = object.visual.blackHoleActivity;

    return activity ? labels[activity] : null;
  }

  protected supernovaEventLabel(object: SpaceObject): string | null {
    const label = object.metadata?.['eventDateLabel'];

    return typeof label === 'string' ? label : null;
  }

  protected supernovaTypeLabel(object: SpaceObject): string | null {
    const type = object.metadata?.['supernovaType'];

    return typeof type === 'string' ? type : null;
  }

  protected hasSupernovaEvent(object: SpaceObject): boolean {
    return typeof object.metadata?.['visualPeakJulianDay'] === 'number';
  }

  protected hasIllustrativeAppearance(object: SpaceObject): boolean {
    return object.metadata?.['appearanceConfidence'] === 'illustrative';
  }

  protected constellationAbbreviationLabel(object: SpaceObject): string | null {
    const abbreviation = object.metadata?.['abbreviation'];

    return typeof abbreviation === 'string' ? abbreviation : null;
  }

  protected constellationStarCountLabel(object: SpaceObject): string | null {
    const starCount = object.metadata?.['starCount'];

    return typeof starCount === 'number' ? this.formatNumber(starCount, 0) : null;
  }

  protected constellationSegmentCountLabel(object: SpaceObject): string | null {
    const segmentCount = object.metadata?.['segmentCount'];

    return typeof segmentCount === 'number' ? this.formatNumber(segmentCount, 0) : null;
  }
}
