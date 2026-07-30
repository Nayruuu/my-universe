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

  protected typeLabel(type: SpaceObjectType): string {
    const labels: Partial<Record<SpaceObjectType, string>> = {
      star: 'Étoile',
      planet: 'Planète',
      moon: 'Satellite naturel',
      galaxy: 'Galaxie',
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
      calculated: 'Position obtenue par un modèle orbital ou une éphéméride documentée.',
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
    const distanceLy = object.metadata?.['distanceLy'];

    if (typeof distanceLy === 'number') {
      return `${this.formatNumber(distanceLy, 3)} a.l.`;
    }
    const semiMajorAxisAu = object.metadata?.['semiMajorAxisAu'];

    if (typeof semiMajorAxisAu === 'number') {
      return `${this.formatNumber(semiMajorAxisAu, 3)} UA`;
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

    return typeof hygId === 'number' ? `HYG ${hygId}` : null;
  }

  protected morphologyLabel(object: SpaceObject): string | null {
    const morphology = object.metadata?.['morphology'];

    return typeof morphology === 'string' ? morphology : null;
  }

  protected diameterLabel(object: SpaceObject): string | null {
    const diameterLy = object.metadata?.['diameterLy'];

    return typeof diameterLy === 'number' ? `${this.formatNumber(diameterLy, 3)} a.l.` : null;
  }
}
