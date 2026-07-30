import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  ScientificConfidence,
  SpaceObject,
  SpaceObjectType,
} from '../../../data/models/universe.models';
import { UniverseEngineFacade } from '../../core/engine/universe-engine.facade';

@Component({
  selector: 'app-object-details',
  styleUrl: './object-details.component.scss',
  templateUrl: './object-details.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObjectDetailsComponent {
  protected readonly facade = inject(UniverseEngineFacade);
  protected readonly object = this.facade.selectedObject;

  protected focus(object: SpaceObject): void {
    void this.facade.focus(object.id);
  }

  protected viewOrbit(object: SpaceObject): void {
    this.facade.viewOrbit(object.id);
  }

  protected hasOrbit(object: SpaceObject): boolean {
    return (
      Boolean(object.parentId) &&
      (object.positionProvider.type === 'keplerian' || object.positionProvider.type === 'ephemeris')
    );
  }

  protected orbitPeriodLabel(object: SpaceObject): string | null {
    const provider = object.positionProvider;

    if (provider.type !== 'keplerian' && provider.type !== 'ephemeris') {
      return null;
    }
    if (provider.orbitalPeriodDays >= 730) {
      return `${this.formatNumber(provider.orbitalPeriodDays / 365.25, 2)} ans`;
    }

    return `${this.formatNumber(provider.orbitalPeriodDays, 2)} jours`;
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

    return `${hours} h ${minutes.toString().padStart(2, '0')} min`;
  }

  protected rotationDirectionLabel(object: SpaceObject): string {
    return (object.visual.rotationPeriodHours ?? 1) < 0 ? 'Rétrograde' : 'Prograde';
  }

  protected orbitActionLabel(object: SpaceObject): string {
    return `Orbite · ${this.parentName(object) ?? 'corps parent'}`;
  }

  protected typeLabel(type: SpaceObjectType, metadata?: SpaceObject['metadata']): string {
    if (type === 'region' && typeof metadata?.['constellationId'] === 'string') {
      return 'Constellation';
    }
    const labels: Partial<Record<SpaceObjectType, string>> = {
      star: 'Étoile',
      planet: 'Planète',
      moon: 'Satellite naturel',
      galaxy: 'Galaxie',
      'black-hole': 'Trou noir',
      'galaxy-cluster': 'Groupe ou amas de galaxies',
      universe: 'Univers',
      'dwarf-planet': 'Planète naine',
      asteroid: 'Astéroïde',
      comet: 'Comète',
      nebula: 'Nébuleuse',
      region: 'Région cosmique',
    };

    return labels[type] ?? 'Objet astronomique';
  }

  protected parentName(object: SpaceObject): string | null {
    return object.parentId
      ? (this.facade.objects().find((candidate) => candidate.id === object.parentId)?.name ?? null)
      : null;
  }

  protected confidenceLabel(confidence: ScientificConfidence): string {
    const labels: Record<ScientificConfidence, string> = {
      observed: 'Observé',
      calculated: 'Calculé',
      extrapolated: 'Extrapolé',
      simulated: 'Simulé',
      procedural: 'Procédural',
      illustrative: 'Illustratif',
    };

    return labels[confidence];
  }

  protected confidenceDescription(confidence: ScientificConfidence): string {
    const descriptions: Record<ScientificConfidence, string> = {
      observed: 'Fondé sur des mesures ou un catalogue astronomique.',
      calculated: 'Position ou distance obtenue par un calcul scientifique documenté.',
      extrapolated: 'Estimation prolongée à partir d’un mouvement connu.',
      simulated: 'Résultat d’un modèle scientifique.',
      procedural: 'Contenu généré pour compléter la scène.',
      illustrative: 'Représentation visuelle non fidèle à l’échelle réelle.',
    };

    return descriptions[confidence];
  }

  protected isApproximate(confidence: ScientificConfidence): boolean {
    return !['observed', 'calculated'].includes(confidence);
  }

  protected formatNumber(value: number, maximumFractionDigits = 1): string {
    return new Intl.NumberFormat('fr-FR', {
      maximumFractionDigits,
      notation: value >= 1e9 ? 'scientific' : 'standard',
    }).format(value);
  }

  protected distanceLabel(object: SpaceObject): string | null {
    const distanceMpc = object.metadata?.['distanceMpc'];

    if (typeof distanceMpc === 'number') {
      return `${this.formatNumber(distanceMpc, 3)} Mpc`;
    }
    const distanceLy = object.metadata?.['distanceLy'];

    if (typeof distanceLy === 'number') {
      return `${this.formatNumber(distanceLy, 3)} a.l.`;
    }
    const semiMajorAxisAu = object.metadata?.['semiMajorAxisAu'];

    if (typeof semiMajorAxisAu === 'number') {
      return `${this.formatNumber(semiMajorAxisAu, 3)} UA`;
    }
    const semiMajorAxisKm = object.metadata?.['semiMajorAxisKm'];

    if (typeof semiMajorAxisKm === 'number') {
      return `${this.formatNumber(semiMajorAxisKm, 0)} km`;
    }
    if (object.id === 'sun') {
      return '1 UA depuis la Terre';
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

    return typeof pgcId === 'number' ? `PGC ${pgcId}` : null;
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

    return typeof diameterLy === 'number' ? `${this.formatNumber(diameterLy, 3)} a.l.` : null;
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
      ? `${this.formatNumber(massSolar, 2)} masses solaires`
      : null;
  }

  protected blackHoleActivityLabel(object: SpaceObject): string | null {
    if (object.type !== 'black-hole') {
      return null;
    }
    const labels = {
      dormant: 'Dormant',
      quiescent: 'Quiescent',
      active: 'Actif',
    } as const;
    const activity = object.visual.blackHoleActivity;

    return activity ? labels[activity] : null;
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
