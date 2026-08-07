import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import type { SpaceObject } from '../../../data/models/universe.models';
import { UniverseEngineFacade } from '../../core/engine/universe-engine.facade';
import { I18nService } from '../../core/i18n/i18n.service';
import { equatorialCoordinates } from '../stellar-observation/earth-sky-catalog';
import { EarthSkyJourney } from '../stellar-observation/earth-sky-journey';
import { EarthSkyViewState } from '../stellar-observation/earth-sky-view-state';
import { StellarObservationComponent } from '../stellar-observation/stellar-observation.component';
import { createObjectDetailsPresenter } from './object-details.presenter';

@Component({
  selector: 'app-object-details',
  styleUrl: './object-details.component.scss',
  templateUrl: './object-details.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StellarObservationComponent],
})
export class ObjectDetailsComponent {
  protected readonly facade = inject(UniverseEngineFacade);
  protected readonly i18n = inject(I18nService);
  protected readonly object = this.facade.selectedObject;
  protected readonly presenter = createObjectDetailsPresenter({
    content: () => this.i18n.content(),
    language: () => this.i18n.lang(),
    objects: () => this.facade.objects(),
    formatNumber: (value, maximumFractionDigits) =>
      this.i18n.formatNumber(value, maximumFractionDigits),
    objectName: (objectId, fallback) => this.i18n.objectName(objectId, fallback),
    interpolate: (template, values) => this.i18n.interpolate(template, values),
  });
  protected readonly earthSkyViewState = inject(EarthSkyViewState);
  private readonly earthSkyJourney = inject(EarthSkyJourney);

  protected focus(object: SpaceObject): void {
    if (this.earthSkyViewState.phase() !== 'closed' && this.canObserveFromEarth(object)) {
      void this.earthSkyJourney.retarget(object);

      return;
    }
    void this.facade.focus(object.id);
  }

  protected canObserveFromEarth(object: SpaceObject): boolean {
    return object.type === 'star' && equatorialCoordinates(object) !== null;
  }

  protected observeFromEarth(object: SpaceObject): void {
    void this.earthSkyJourney.start(object);
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
}
